import { db } from '../db/database.ts';
import { evaluateAssignmentRules } from './routingService.ts';
import crypto from 'node:crypto';

const TIKTOK_SCOPES = [
  'user.info.basic',
  'biz.spark.read',
  'message.list',
  'message.send',
  'leads.read',
].join(',');

export function isTikTokOAuthConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function buildTikTokAuthUrl(redirectUri: string, state: string): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: TIKTOK_SCOPES,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCodeForToken(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  openId: string;
  expiresIn: number;
}> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET are required to complete TikTok OAuth.');
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    open_id?: string;
    expires_in?: number;
    error_description?: string;
    message?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.message || 'TikTok token exchange failed.');
  }

  return {
    accessToken: payload.access_token,
    openId: payload.open_id || 'tiktok_biz_account',
    expiresIn: payload.expires_in || 86400,
  };
}

export async function syncLiveTikTokAccount(accessToken: string): Promise<{
  accountName: string;
  tiktokHandle: string;
  messagesImported: number;
}> {
  const userResp = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const userJson = (await userResp.json().catch(() => ({}))) as {
    data?: { user?: { open_id?: string; display_name?: string; username?: string } };
  };

  const user = userJson.data?.user;
  const accountName = user?.display_name || 'TikTok Business Account';
  const tiktokHandle = user?.username ? `@${user.username}` : '@northline.tiktok';
  const openId = user?.open_id || 'tt_connected';

  // Fetch recent TikTok business direct messages if endpoint permission is active
  let messagesImported = 0;
  try {
    const convResp = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/business/message/conversation/list/',
      {
        headers: { 'Access-Token': accessToken },
      }
    );
    if (convResp.ok) {
      const convData = (await convResp.json()) as {
        data?: {
          conversations?: Array<{
            conversation_id?: string;
            participant_name?: string;
            participant_handle?: string;
            last_message?: string;
            updated_time?: string;
          }>;
        };
      };
      const convs = convData.data?.conversations || [];
      const now = new Date().toISOString();
      const due = new Date(Date.now() + 15 * 60_000).toISOString();

      for (const conv of convs) {
        if (!conv.conversation_id || !conv.last_message) continue;
        const qryId = `qry_tk_${conv.conversation_id}`;
        const existing = db.prepare('SELECT id FROM queries WHERE id = ?').get(qryId);
        if (existing) continue;

        const assignment = evaluateAssignmentRules({
          channel: 'TikTok DM',
          platform: 'TikTok',
          campaign_id: 'cmp_tiktok_spark',
        });
        const customerName = conv.participant_name || `TikTok Contact ${conv.conversation_id.slice(-4)}`;

        db.prepare(`
          INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
          VALUES (?, 'cmp_tiktok_spark', ?, ?, ?, ?, '', '', 'TikTok DM', 'TikTok', 'cr_tk_live', 'TikTok Direct Message Thread', 'Short-Form Video · 9:16', 'TikTok Active Audience', ?, 'New', ?, ?, ?, ?, ?, ?)
        `).run(
          qryId,
          assignment.employeeId,
          assignment.ruleName,
          customerName,
          conv.participant_handle || '@tiktok_user',
          assignment.priorityOverride || 'High',
          'TikTok Direct Message Inquiry',
          conv.last_message,
          JSON.stringify([
            {
              id: `m_${crypto.randomUUID().slice(0, 6)}`,
              sender: 'customer',
              author: customerName,
              body: conv.last_message,
              timestamp: conv.updated_time || now,
            },
          ]),
          due,
          conv.updated_time || now,
          now
        );
        messagesImported += 1;
      }
    }
  } catch {
    // Non-fatal if TikTok account lacks business messaging scope on sandbox token
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    UPDATE tiktok_connections
    SET status = 'Connected',
        advertiser_id = ?,
        account_name = ?,
        tiktok_handle = ?,
        access_token = ?,
        token_expires_at = ?,
        last_synced_at = ?,
        updated_at = ?
    WHERE id = 'tiktok_primary'
  `).run(openId, accountName, tiktokHandle, accessToken, expiresAt, now, now);

  return { accountName, tiktokHandle, messagesImported };
}
