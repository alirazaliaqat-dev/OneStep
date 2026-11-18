import crypto from 'node:crypto';
import { db } from '../db/database.ts';
import { evaluateAssignmentRules } from './routingService.ts';

const META_GRAPH_VERSION = 'v21.0';
const META_SCOPES = [
  'ads_read',
  'ads_management',
  'leads_retrieval',
  'pages_show_list',
  'pages_read_engagement',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'business_management',
].join(',');

export function getAppBaseUrl(reqOrigin?: string): string {
  const configured = process.env.APP_URL;
  if (configured && !configured.includes('MY_APP_URL')) {
    return configured.replace(/\/$/, '');
  }
  if (reqOrigin) {
    return reqOrigin.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function buildMetaAuthUrl(redirectUri: string, state: string): string {
  const appId = process.env.META_APP_ID || '';
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: META_SCOPES,
  });
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCodeForToken(code: string, redirectUri: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET are required to complete Meta OAuth.');
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`
  );
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message || 'Meta token exchange failed.');
  }

  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in || 5184000,
  };
}

export async function syncLiveMetaAccount(accessToken: string): Promise<{
  businessName: string;
  adAccountId: string;
  pageId: string;
  pageName: string;
  campaignsSynced: number;
  leadsImported: number;
}> {
  const meResponse = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
  );
  const meData = (await meResponse.json()) as { id?: string; name?: string; error?: { message?: string } };
  if (!meResponse.ok) {
    throw new Error(meData.error?.message || 'Unable to verify Meta profile.');
  }

  const adAccountsResponse = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status&limit=5&access_token=${encodeURIComponent(accessToken)}`
  );
  const adAccountsData = (await adAccountsResponse.json()) as {
    data?: Array<{ id: string; name?: string }>;
  };

  const pagesResponse = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=5&access_token=${encodeURIComponent(accessToken)}`
  );
  const pagesData = (await pagesResponse.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };

  const primaryAdAccount = adAccountsData.data?.[0];
  const primaryPage = pagesData.data?.[0];

  let campaignsSynced = 0;
  let leadsImported = 0;

  if (primaryAdAccount?.id) {
    const campaignsResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${primaryAdAccount.id}/campaigns?fields=id,name,objective,status,daily_budget,insights{spend,impressions,clicks,actions}&limit=25&access_token=${encodeURIComponent(accessToken)}`
    );
    const campaignsData = (await campaignsResponse.json()) as {
      data?: Array<{
        id: string;
        name: string;
        objective?: string;
        status?: string;
        daily_budget?: string;
        insights?: {
          data?: Array<{
            spend?: string;
            impressions?: string;
            clicks?: string;
            actions?: Array<{ action_type: string; value: string }>;
          }>;
        };
      }>;
    };

    if (Array.isArray(campaignsData.data)) {
      const upsert = db.prepare(`
        INSERT INTO campaigns (id, name, platform, objective, status, daily_budget, spend, impressions, clicks, leads_count, roas, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          objective = excluded.objective,
          status = excluded.status,
          daily_budget = excluded.daily_budget,
          spend = excluded.spend,
          impressions = excluded.impressions,
          clicks = excluded.clicks,
          leads_count = excluded.leads_count,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      for (const camp of campaignsData.data) {
        const insight = camp.insights?.data?.[0];
        const leadAction = insight?.actions?.find(
          (a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
        );
        const spend = Number(insight?.spend || 0);
        const leadsCount = Number(leadAction?.value || 0);
        const dailyBudget = camp.daily_budget ? Number(camp.daily_budget) / 100 : 100;
        const normalizedStatus = camp.status === 'ACTIVE' ? 'Active' : 'Paused';

        upsert.run(
          camp.id,
          camp.name,
          'Facebook & Instagram',
          camp.objective || 'Lead Generation',
          normalizedStatus,
          dailyBudget,
          spend,
          Number(insight?.impressions || 0),
          Number(insight?.clicks || 0),
          leadsCount,
          spend > 0 && leadsCount > 0 ? Number(((leadsCount * 240) / spend).toFixed(1)) : 0,
          now
        );
        campaignsSynced += 1;
      }
    }

    // Fetch Ad Creatives & Leadgen Forms from Meta Ads if available
    const adsResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${primaryAdAccount.id}/ads?fields=id,name,campaign_id,adset{name},creative{id,name,title,body},leads{id,created_time,field_data}&limit=15&access_token=${encodeURIComponent(accessToken)}`
    );
    const adsData = (await adsResponse.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        campaign_id?: string;
        adset?: { name?: string };
        creative?: { id?: string; name?: string; title?: string; body?: string };
        leads?: {
          data?: Array<{
            id: string;
            created_time?: string;
            field_data?: Array<{ name: string; values: string[] }>;
          }>;
        };
      }>;
    };

    if (Array.isArray(adsData.data)) {
      const now = new Date().toISOString();
      const due = new Date(Date.now() + 15 * 60_000).toISOString();

      for (const ad of adsData.data) {
        const adLeads = ad.leads?.data || [];
        for (const lead of adLeads) {
          const queryId = `qry_meta_${lead.id}`;
          const already = db.prepare('SELECT id FROM queries WHERE id = ?').get(queryId);
          if (already) continue;

          const fieldMap = new Map<string, string>();
          for (const f of lead.field_data || []) {
            fieldMap.set(f.name.toLowerCase(), f.values?.[0] || '');
          }

          const fullName =
            fieldMap.get('full_name') ||
            fieldMap.get('first_name') ||
            `Meta Lead ${lead.id.slice(-4)}`;
          const email = fieldMap.get('email') || '';
          const phone = fieldMap.get('phone_number') || fieldMap.get('phone') || '';
          const company = fieldMap.get('company_name') || fullName;

          const assignment = evaluateAssignmentRules({
            channel: 'Lead Form',
            platform: 'Facebook',
            campaign_id: ad.campaign_id || null,
          });

          const creativeTitle = ad.creative?.name || ad.creative?.title || ad.name || 'Meta Lead Ad Creative';
          const msgBody = ad.creative?.body
            ? `Submitted Meta Lead Form on creative "${creativeTitle}".`
            : `Imported directly from Meta Ads Lead Form (${ad.name || ad.id}).`;

          db.prepare(`
            INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Lead Form', 'Facebook', ?, ?, 'Meta Instant Form', ?, ?, 'New', ?, ?, ?, ?, ?, ?)
          `).run(
            queryId,
            ad.campaign_id || null,
            assignment.employeeId,
            assignment.ruleName,
            fullName,
            company,
            email,
            phone,
            ad.creative?.id || ad.id,
            creativeTitle,
            ad.adset?.name || 'Meta Ad Set',
            assignment.priorityOverride || 'High',
            `Lead Form Inquiry · ${ad.name || 'Meta Campaign'}`,
            msgBody,
            JSON.stringify([
              {
                id: `m_${crypto.randomUUID().slice(0, 6)}`,
                sender: 'customer',
                author: fullName,
                body: msgBody,
                timestamp: lead.created_time || now,
              },
            ]),
            due,
            lead.created_time || now,
            now
          );
          leadsImported += 1;
        }
      }
    }
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE meta_connections
    SET status = 'Connected',
        business_name = ?,
        ad_account_id = ?,
        page_id = ?,
        page_name = ?,
        instagram_handle = ?,
        access_token = ?,
        token_expires_at = ?,
        last_synced_at = ?,
        updated_at = ?
    WHERE id = 'meta_primary'
  `).run(
    meData.name || 'Meta Business Account',
    primaryAdAccount?.id || 'act_connected',
    primaryPage?.id || 'page_connected',
    primaryPage?.name || 'Connected Facebook Page',
    primaryPage?.instagram_business_account?.username
      ? `@${primaryPage.instagram_business_account.username}`
      : '@instagram_business',
    accessToken,
    expiresAt,
    now,
    now
  );

  return {
    businessName: meData.name || 'Meta Business Account',
    adAccountId: primaryAdAccount?.id || 'act_connected',
    pageId: primaryPage?.id || 'page_connected',
    pageName: primaryPage?.name || 'Connected Facebook Page',
    campaignsSynced,
    leadsImported,
  };
}
