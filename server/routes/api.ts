import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { db, type RolePermissions } from '../db/database.ts';
import {
  buildMetaAuthUrl,
  getAppBaseUrl,
  isMetaOAuthConfigured,
  syncLiveMetaAccount,
} from '../services/metaService.ts';
import {
  buildTikTokAuthUrl,
  isTikTokOAuthConfigured,
  syncLiveTikTokAccount,
} from '../services/tiktokService.ts';
import { evaluateAssignmentRules } from '../services/routingService.ts';

export const apiRouter = Router();

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function logActivity(entityType: string, entityId: string, actorName: string, summary: string): void {
  db.prepare(`
    INSERT INTO activities (id, entity_type, entity_id, actor_name, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(newId('act'), entityType, entityId, actorName, summary, new Date().toISOString());
}

function getRequestRolePermissions(req: Request): RolePermissions | null {
  const roleId = req.header('x-role-id');
  if (!roleId) return null;
  const row = db.prepare('SELECT permissions_json FROM roles WHERE id = ?').get(roleId) as
    | { permissions_json: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.permissions_json) as RolePermissions;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dashboard Summary & Customizable Preferences
// ---------------------------------------------------------------------------
apiRouter.get('/dashboard/summary', (_req: Request, res: Response) => {
  const campaigns = db.prepare('SELECT * FROM campaigns').all();
  const queries = db.prepare('SELECT * FROM queries').all();
  const leads = db.prepare('SELECT * FROM leads').all();
  const employees = db.prepare(`
    SELECT emp.*,
      d.name AS department_name,
      (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id) AS total_assigned_queries,
      (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id AND q.status IN ('Replied', 'Resolved')) AS leads_contacted,
      (SELECT COUNT(*) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS deals_closed,
      (SELECT COALESCE(SUM(l.deal_value), 0) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS won_revenue
    FROM employees emp
    LEFT JOIN departments d ON d.id = emp.department_id
    ORDER BY won_revenue DESC, leads_contacted DESC
  `).all();
  const departments = db.prepare('SELECT * FROM departments').all();
  const activities = db
    .prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT 10')
    .all();

  const totalSpend = campaigns.reduce((acc, c) => acc + Number(c.spend || 0), 0);
  const totalLeadsFromAds = campaigns.reduce((acc, c) => acc + Number(c.leads_count || 0), 0);
  const totalCrmLeads = leads.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active').length;
  const avgRoas =
    campaigns.length > 0
      ? Number((campaigns.reduce((acc, c) => acc + Number(c.roas || 0), 0) / campaigns.length).toFixed(1))
      : 0;

  const openQueries = queries.filter((q) => q.status !== 'Resolved').length;
  const unassignedQueries = queries.filter((q) => !q.assigned_employee_id && q.status !== 'Resolved').length;
  const pipelineValue = leads
    .filter((l) => l.stage !== 'Closed Lost')
    .reduce((acc, l) => acc + Number(l.deal_value || 0), 0);
  const wonLeads = leads.filter((l) => l.stage === 'Won');
  const wonRevenue = wonLeads.reduce((acc, l) => acc + Number(l.deal_value || 0), 0);
  const conversionRate =
    totalCrmLeads > 0 ? Number(((wonLeads.length / totalCrmLeads) * 100).toFixed(1)) : 0;

  const totalDealsClosed = wonLeads.length;
  const totalLeadsContacted = queries.filter((q) => q.status === 'Replied' || q.status === 'Resolved').length;

  const channelCounts = ['Lead Form', 'Instagram DM', 'Messenger', 'Ad Comment', 'TikTok DM', 'TikTok Lead'].map(
    (ch) => ({
      channel: ch,
      count: queries.filter((q) => q.channel === ch).length,
    })
  );

  const platformCounts = ['Facebook', 'Instagram', 'TikTok'].map((plat) => ({
    platform: plat,
    count: queries.filter((q) => q.platform === plat).length,
  }));

  const funnelStages = [
    { label: 'Ad Inquiries', count: queries.length },
    { label: 'Contacted', count: totalLeadsContacted },
    { label: 'Pipeline Deals', count: totalCrmLeads },
    { label: 'Closed Won', count: totalDealsClosed },
  ];

  res.json({
    metrics: {
      totalSpend,
      totalLeadsFromAds,
      totalCrmLeads,
      conversionRate,
      activeCampaigns,
      avgRoas,
      openQueries,
      unassignedQueries,
      pipelineValue,
      wonRevenue,
      totalDealsClosed,
      totalLeadsContacted,
      totalEmployees: employees.length,
      totalDepartments: departments.length,
    },
    charts: {
      channelBreakdown: channelCounts,
      platformBreakdown: platformCounts,
      funnelStages,
      employeePerformance: employees.map((e) => ({
        id: e.id,
        name: e.full_name,
        role: e.role,
        leadsContacted: Number(e.leads_contacted || 0),
        dealsClosed: Number(e.deals_closed || 0),
        wonRevenue: Number(e.won_revenue || 0),
      })),
    },
    recentActivities: activities,
  });
});

apiRouter.get('/dashboard/preferences', (_req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM dashboard_preferences WHERE id = ?').get('default') as
    | {
        kpi_order_json: string;
        hidden_kpis_json: string;
        visible_widgets_json: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    res.json({
      kpiOrder: ['total_leads', 'conversion_rate', 'active_campaigns', 'ad_spend', 'roas', 'team_deals_closed'],
      hiddenKpis: [],
      visibleWidgets: ['campaign_roas_chart', 'funnel_channel_chart', 'employee_performance_chart', 'priority_queries'],
    });
    return;
  }

  res.json({
    kpiOrder: JSON.parse(row.kpi_order_json),
    hiddenKpis: JSON.parse(row.hidden_kpis_json),
    visibleWidgets: JSON.parse(row.visible_widgets_json),
    updatedAt: row.updated_at,
  });
});

apiRouter.put('/dashboard/preferences', (req: Request, res: Response) => {
  const { kpiOrder, hiddenKpis, visibleWidgets } = req.body as {
    kpiOrder?: string[];
    hiddenKpis?: string[];
    visibleWidgets?: string[];
  };

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO dashboard_preferences (id, kpi_order_json, hidden_kpis_json, visible_widgets_json, updated_at)
    VALUES ('default', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kpi_order_json = excluded.kpi_order_json,
      hidden_kpis_json = excluded.hidden_kpis_json,
      visible_widgets_json = excluded.visible_widgets_json,
      updated_at = excluded.updated_at
  `).run(
    JSON.stringify(kpiOrder || []),
    JSON.stringify(hiddenKpis || []),
    JSON.stringify(visibleWidgets || []),
    now
  );

  res.json({ ok: true, kpiOrder, hiddenKpis, visibleWidgets, updatedAt: now });
});

// ---------------------------------------------------------------------------
// Roles & Granular Permissions (RBAC)
// ---------------------------------------------------------------------------
apiRouter.get('/roles', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, name ASC').all() as Array<
    Record<string, unknown>
  >;
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
      permissions: JSON.parse(String(r.permissions_json)),
      createdAt: r.created_at,
    }))
  );
});

apiRouter.post('/roles', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageRoles) {
    res.status(403).json({ error: 'Your active role does not have permission to create roles.' });
    return;
  }

  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: RolePermissions;
  };

  if (!name?.trim() || !permissions) {
    res.status(400).json({ error: 'Role name and granular permissions are required.' });
    return;
  }

  const id = newId('role');
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO roles (id, name, description, is_system, permissions_json, created_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(id, name.trim(), (description || 'Custom workspace role.').trim(), JSON.stringify(permissions), now);
  } catch {
    res.status(400).json({ error: 'A role with that name already exists.' });
    return;
  }

  logActivity('role', id, 'Access Control', `Created custom role "${name.trim()}".`);
  res.status(201).json({
    id,
    name: name.trim(),
    description: (description || 'Custom workspace role.').trim(),
    isSystem: false,
    permissions,
    createdAt: now,
  });
});

apiRouter.patch('/roles/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageRoles) {
    res.status(403).json({ error: 'Your active role does not have permission to modify roles.' });
    return;
  }

  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as
    | { id: string; name: string; description: string; is_system: number; permissions_json: string; created_at: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Role not found.' });
    return;
  }

  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: RolePermissions;
  };

  const nextName = existing.is_system ? existing.name : name?.trim() || existing.name;
  const nextDesc = description?.trim() || existing.description;
  const nextPerms = permissions ? JSON.stringify(permissions) : existing.permissions_json;

  db.prepare(`UPDATE roles SET name = ?, description = ?, permissions_json = ? WHERE id = ?`).run(
    nextName,
    nextDesc,
    nextPerms,
    id
  );

  logActivity('role', String(id), 'Access Control', `Updated permissions for "${nextName}".`);
  res.json({
    id: existing.id,
    name: nextName,
    description: nextDesc,
    isSystem: Boolean(existing.is_system),
    permissions: JSON.parse(nextPerms),
    createdAt: existing.created_at,
  });
});

apiRouter.delete('/roles/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageRoles) {
    res.status(403).json({ error: 'Your active role does not have permission to remove roles.' });
    return;
  }

  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as
    | { id: string; name: string; is_system: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Role not found.' });
    return;
  }
  if (existing.is_system) {
    res.status(400).json({ error: 'Core system roles (Administrator, Manager, Agent) cannot be deleted.' });
    return;
  }

  db.prepare(`UPDATE employees SET role = 'Agent', role_id = 'role_agent' WHERE role_id = ?`).run(id);
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  logActivity('role', String(id), 'Access Control', `Removed custom role "${existing.name}".`);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Automated Inquiry Assignment Rules
// ---------------------------------------------------------------------------
apiRouter.get('/assignment-rules', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT r.*, e.full_name AS target_employee_name, d.name AS target_department_name, c.name AS campaign_name
    FROM assignment_rules r
    LEFT JOIN employees e ON e.id = r.target_employee_id
    LEFT JOIN departments d ON d.id = r.target_department_id
    LEFT JOIN campaigns c ON c.id = r.campaign_id
    ORDER BY r.sort_order ASC, r.created_at ASC
  `).all();
  res.json(rows.map((r) => ({ ...r, is_active: Boolean(r.is_active) })));
});

apiRouter.post('/assignment-rules', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageAssignmentRules) {
    res.status(403).json({ error: 'Your active role cannot modify assignment rules.' });
    return;
  }

  const {
    name,
    channel,
    platform,
    campaign_id,
    strategy,
    target_employee_id,
    target_department_id,
    priority_override,
  } = req.body as Record<string, string>;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Rule name is required.' });
    return;
  }

  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM assignment_rules').get() as {
    m: number;
  };
  const id = newId('rule');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO assignment_rules (id, name, channel, platform, campaign_id, strategy, target_employee_id, target_department_id, priority_override, is_active, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    name.trim(),
    channel || 'Any',
    platform || 'Any',
    campaign_id || 'Any',
    strategy || 'least_loaded',
    target_employee_id || null,
    target_department_id || null,
    priority_override || 'Keep',
    Number(maxSort?.m || 0) + 1,
    now
  );

  logActivity('rule', id, 'Routing Engine', `Added assignment rule "${name.trim()}".`);
  const created = db.prepare(`
    SELECT r.*, e.full_name AS target_employee_name, d.name AS target_department_name, c.name AS campaign_name
    FROM assignment_rules r
    LEFT JOIN employees e ON e.id = r.target_employee_id
    LEFT JOIN departments d ON d.id = r.target_department_id
    LEFT JOIN campaigns c ON c.id = r.campaign_id
    WHERE r.id = ?
  `).get(id);
  res.status(201).json({ ...created, is_active: Boolean(created?.is_active) });
});

apiRouter.patch('/assignment-rules/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageAssignmentRules) {
    res.status(403).json({ error: 'Your active role cannot modify assignment rules.' });
    return;
  }

  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM assignment_rules WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Assignment rule not found.' });
    return;
  }

  const { is_active, strategy, target_employee_id, target_department_id } = req.body as {
    is_active?: boolean;
    strategy?: string;
    target_employee_id?: string | null;
    target_department_id?: string | null;
  };

  db.prepare(`
    UPDATE assignment_rules
    SET is_active = ?, strategy = ?, target_employee_id = ?, target_department_id = ?
    WHERE id = ?
  `).run(
    typeof is_active === 'boolean' ? (is_active ? 1 : 0) : existing.is_active,
    strategy ?? existing.strategy,
    target_employee_id === undefined ? existing.target_employee_id : target_employee_id,
    target_department_id === undefined ? existing.target_department_id : target_department_id,
    id
  );

  const updated = db.prepare(`
    SELECT r.*, e.full_name AS target_employee_name, d.name AS target_department_name, c.name AS campaign_name
    FROM assignment_rules r
    LEFT JOIN employees e ON e.id = r.target_employee_id
    LEFT JOIN departments d ON d.id = r.target_department_id
    LEFT JOIN campaigns c ON c.id = r.campaign_id
    WHERE r.id = ?
  `).get(id);
  res.json({ ...updated, is_active: Boolean(updated?.is_active) });
});

apiRouter.delete('/assignment-rules/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageAssignmentRules) {
    res.status(403).json({ error: 'Your active role cannot remove assignment rules.' });
    return;
  }
  db.prepare('DELETE FROM assignment_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Meta Connection, OAuth & Webhook
// ---------------------------------------------------------------------------
apiRouter.get('/meta/status', (req: Request, res: Response) => {
  const connection = db.prepare('SELECT * FROM meta_connections WHERE id = ?').get('meta_primary');
  const baseUrl = getAppBaseUrl(`${req.protocol}://${req.get('host')}`);

  res.json({
    configured: isMetaOAuthConfigured(),
    redirectUri: `${baseUrl}/auth/meta/callback`,
    webhookUrl: `${baseUrl}/api/meta/webhook`,
    connection: connection
      ? {
          id: connection.id,
          status: connection.status,
          businessName: connection.business_name,
          adAccountId: connection.ad_account_id,
          pageId: connection.page_id,
          pageName: connection.page_name,
          instagramHandle: connection.instagram_handle,
          lastSyncedAt: connection.last_synced_at,
        }
      : null,
  });
});

apiRouter.get('/meta/auth/url', (req: Request, res: Response) => {
  if (!isMetaOAuthConfigured()) {
    res.status(400).json({
      error: 'Meta OAuth credentials are not configured yet. Add META_APP_ID and META_APP_SECRET in environment secrets.',
    });
    return;
  }

  const baseUrl = getAppBaseUrl(`${req.protocol}://${req.get('host')}`);
  const redirectUri = `${baseUrl}/auth/meta/callback`;
  const state = crypto.randomBytes(12).toString('hex');
  const url = buildMetaAuthUrl(redirectUri, state);

  res.json({ url, redirectUri });
});

apiRouter.post('/meta/sync', async (_req: Request, res: Response) => {
  const connection = db.prepare('SELECT * FROM meta_connections WHERE id = ?').get('meta_primary');
  if (!connection || !connection.access_token || connection.status !== 'Connected') {
    res.status(400).json({
      error: 'No active Meta Business OAuth token is connected. Connect your Meta Business account first.',
    });
    return;
  }

  try {
    const result = await syncLiveMetaAccount(String(connection.access_token));
    logActivity(
      'meta',
      'meta_primary',
      'System Sync',
      `Synced ${result.campaignsSynced} live Meta campaigns and ${result.leadsImported} inquiries.`
    );
    res.json({ ok: true, result });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Meta Graph API sync failed.',
    });
  }
});

apiRouter.post('/meta/disconnect', (_req: Request, res: Response) => {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE meta_connections
    SET status = 'Disconnected',
        access_token = NULL,
        token_expires_at = NULL,
        updated_at = ?
    WHERE id = 'meta_primary'
  `).run(now);
  res.json({ ok: true });
});

apiRouter.get('/meta/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'clearline_meta_verify';

  if (mode === 'subscribe' && token === expectedToken && typeof challenge === 'string') {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

apiRouter.post('/meta/webhook', (req: Request, res: Response) => {
  const body = req.body as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        field?: string;
        value?: {
          leadgen_id?: string;
          ad_id?: string;
          campaign_id?: string;
          ad_creative_name?: string;
          ad_creative_format?: string;
          ad_set_name?: string;
          form_id?: string;
          message?: string;
          sender_name?: string;
          email?: string;
          phone?: string;
        };
      }>;
      messaging?: Array<{ sender?: { id?: string }; message?: { text?: string } }>;
    }>;
  };

  const now = new Date().toISOString();
  const due = new Date(Date.now() + 15 * 60_000).toISOString();
  let createdCount = 0;

  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const val = change.value || {};
          const queryId = newId('qry');
          const customerName = val.sender_name || `Meta Lead ${val.leadgen_id || queryId.slice(-4)}`;
          const channel = change.field === 'feed' ? 'Ad Comment' : 'Lead Form';
          const platform = body.object === 'instagram' ? 'Instagram' : 'Facebook';
          const campaignId = val.campaign_id || 'cmp_q4_b2b';
          const assignment = evaluateAssignmentRules({ channel, platform, campaign_id: campaignId });

          const messageBody =
            val.message ||
            `Inbound Meta ${change.field || 'leadgen'} webhook event (Form ${val.form_id || 'Instant'}).`;

          db.prepare(`
            INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?)
          `).run(
            queryId,
            campaignId,
            assignment.employeeId,
            assignment.ruleName,
            customerName,
            `Meta ID ${val.leadgen_id || entry.id || 'Live'}`,
            val.email || 'pending@meta-lead.inbound',
            val.phone || 'Captured via Webhook',
            channel,
            platform,
            val.ad_id || 'cr_webhook_ad',
            val.ad_creative_name || 'Meta Webhook Ad Creative',
            val.ad_creative_format || 'Instant Lead Form',
            val.ad_set_name || 'Active Meta Ad Set',
            assignment.priorityOverride || 'High',
            `Live Meta ${change.field || 'Lead'} Inquiry`,
            messageBody,
            JSON.stringify([{ id: 'm1', sender: 'customer', author: customerName, body: messageBody, timestamp: now }]),
            due,
            now,
            now
          );
          createdCount += 1;
        }
      }

      if (Array.isArray(entry.messaging)) {
        for (const msg of entry.messaging) {
          const text = msg.message?.text;
          if (!text) continue;
          const queryId = newId('qry');
          const senderId = msg.sender?.id || 'Messenger User';
          const platform = body.object === 'instagram' ? 'Instagram' : 'Facebook';
          const channel = platform === 'Instagram' ? 'Instagram DM' : 'Messenger';
          const campaignId = platform === 'Instagram' ? 'cmp_ig_retarget' : 'cmp_msg_consult';
          const assignment = evaluateAssignmentRules({ channel, platform, campaign_id: campaignId });

          db.prepare(`
            INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cr_msg_referral', 'Click-to-Message Ad Creative', 'Sponsored Message', 'Active Messaging Ad Set', ?, 'New', ?, ?, ?, ?, ?, ?)
          `).run(
            queryId,
            campaignId,
            assignment.employeeId,
            assignment.ruleName,
            `${platform} Contact ${senderId.slice(-4)}`,
            `PSID ${senderId}`,
            'messenger@meta.inbound',
            `Via ${channel}`,
            channel,
            platform,
            assignment.priorityOverride || 'High',
            `Live ${channel} Ad Inquiry`,
            text,
            JSON.stringify([{ id: 'm1', sender: 'customer', author: `User ${senderId.slice(-4)}`, body: text, timestamp: now }]),
            due,
            now,
            now
          );
          createdCount += 1;
        }
      }
    }
  }

  res.status(200).json({ received: true, ingestedQueries: createdCount });
});

// ---------------------------------------------------------------------------
// TikTok Business Connection, OAuth & Direct Message Webhook
// ---------------------------------------------------------------------------
apiRouter.get('/tiktok/status', (req: Request, res: Response) => {
  const connection = db.prepare('SELECT * FROM tiktok_connections WHERE id = ?').get('tiktok_primary');
  const baseUrl = getAppBaseUrl(`${req.protocol}://${req.get('host')}`);

  res.json({
    configured: isTikTokOAuthConfigured(),
    redirectUri: `${baseUrl}/auth/tiktok/callback`,
    webhookUrl: `${baseUrl}/api/tiktok/webhook`,
    connection: connection
      ? {
          id: connection.id,
          status: connection.status,
          accountName: connection.account_name,
          advertiserId: connection.advertiser_id,
          tiktokHandle: connection.tiktok_handle,
          lastSyncedAt: connection.last_synced_at,
        }
      : null,
  });
});

apiRouter.get('/tiktok/auth/url', (req: Request, res: Response) => {
  if (!isTikTokOAuthConfigured()) {
    res.status(400).json({
      error:
        'TikTok OAuth credentials are not configured yet. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in environment secrets.',
    });
    return;
  }

  const baseUrl = getAppBaseUrl(`${req.protocol}://${req.get('host')}`);
  const redirectUri = `${baseUrl}/auth/tiktok/callback`;
  const state = crypto.randomBytes(12).toString('hex');
  const url = buildTikTokAuthUrl(redirectUri, state);

  res.json({ url, redirectUri });
});

apiRouter.post('/tiktok/sync', async (_req: Request, res: Response) => {
  const connection = db.prepare('SELECT * FROM tiktok_connections WHERE id = ?').get('tiktok_primary');
  if (!connection || !connection.access_token || connection.status !== 'Connected') {
    res.status(400).json({
      error: 'No active TikTok Business OAuth token is connected. Connect TikTok Business first.',
    });
    return;
  }

  try {
    const result = await syncLiveTikTokAccount(String(connection.access_token));
    logActivity(
      'tiktok',
      'tiktok_primary',
      'System Sync',
      `Synced TikTok Business (${result.tiktokHandle}) and imported ${result.messagesImported} messages.`
    );
    res.json({ ok: true, result });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'TikTok API sync failed.',
    });
  }
});

apiRouter.post('/tiktok/disconnect', (_req: Request, res: Response) => {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tiktok_connections
    SET status = 'Disconnected',
        access_token = NULL,
        token_expires_at = NULL,
        updated_at = ?
    WHERE id = 'tiktok_primary'
  `).run(now);
  res.json({ ok: true });
});

apiRouter.get('/tiktok/webhook', (req: Request, res: Response) => {
  const challenge = req.query.challenge || req.query['hub.challenge'];
  if (typeof challenge === 'string') {
    res.status(200).send(challenge);
    return;
  }
  res.status(200).json({ ok: true, service: 'Clearline TikTok Webhook' });
});

apiRouter.post('/tiktok/webhook', (req: Request, res: Response) => {
  const body = req.body as {
    event?: string;
    sender_name?: string;
    sender_handle?: string;
    message?: string;
    email?: string;
    phone?: string;
    ad_creative_name?: string;
    campaign_id?: string;
    channel?: string;
  };

  const messageText = body?.message?.trim();
  if (!messageText) {
    res.status(200).json({ received: true, ingestedQueries: 0 });
    return;
  }

  const now = new Date().toISOString();
  const due = new Date(Date.now() + 15 * 60_000).toISOString();
  const queryId = newId('qry_tk');
  const channel = body.channel === 'TikTok Lead' || body.event === 'lead' ? 'TikTok Lead' : 'TikTok DM';
  const campaignId = body.campaign_id || 'cmp_tiktok_spark';
  const customerName = body.sender_name?.trim() || `TikTok User ${queryId.slice(-4)}`;
  const customerHandle = body.sender_handle?.trim() || `@${customerName.toLowerCase().replace(/\s+/g, '')}`;
  const assignment = evaluateAssignmentRules({ channel, platform: 'TikTok', campaign_id: campaignId });

  db.prepare(`
    INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TikTok', 'cr_tk_webhook', ?, 'TikTok Spark Video · 9:16', 'TikTok Live Inbound', ?, 'New', ?, ?, ?, ?, ?, ?)
  `).run(
    queryId,
    campaignId,
    assignment.employeeId,
    assignment.ruleName,
    customerName,
    customerHandle,
    body.email || '',
    body.phone || '',
    channel,
    body.ad_creative_name || 'TikTok Business Direct Message',
    assignment.priorityOverride || 'High',
    `Live ${channel} Inquiry from ${customerHandle}`,
    messageText,
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: customerName,
        body: messageText,
        timestamp: now,
      },
    ]),
    due,
    now,
    now
  );

  logActivity('query', queryId, 'TikTok Webhook', `Ingested ${channel} from ${customerName}.`);
  res.status(200).json({ received: true, ingestedQueries: 1, queryId });
});

// ---------------------------------------------------------------------------
// Meta Campaigns
// ---------------------------------------------------------------------------
apiRouter.get('/campaigns', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY spend DESC').all();
  res.json(rows);
});

apiRouter.patch('/campaigns/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageCampaigns) {
    res.status(403).json({ error: 'Your active role does not have permission to modify Meta campaigns.' });
    return;
  }

  const { id } = req.params;
  const { status, daily_budget } = req.body as { status?: string; daily_budget?: number };
  const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Campaign not found.' });
    return;
  }

  const nextStatus = status ?? String(existing.status);
  const nextBudget = typeof daily_budget === 'number' && daily_budget > 0 ? daily_budget : Number(existing.daily_budget);
  const now = new Date().toISOString();

  db.prepare(`UPDATE campaigns SET status = ?, daily_budget = ?, updated_at = ? WHERE id = ?`).run(
    nextStatus,
    nextBudget,
    now,
    id
  );

  logActivity('campaign', String(id), 'Ad Operations', `Updated ${existing.name} (${nextStatus}, $${nextBudget}/day).`);
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id));
});

// ---------------------------------------------------------------------------
// Unified Meta Ad Queries + Auto-Assignment
// ---------------------------------------------------------------------------
apiRouter.get('/queries', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT q.*, c.name AS campaign_name, c.objective AS campaign_objective, e.full_name AS assigned_employee_name
    FROM queries q
    LEFT JOIN campaigns c ON c.id = q.campaign_id
    LEFT JOIN employees e ON e.id = q.assigned_employee_id
    ORDER BY q.updated_at DESC
  `).all();
  res.json(rows);
});

apiRouter.post('/queries/auto-assign', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.assignTasks) {
    res.status(403).json({ error: 'Your active role cannot run automated query routing.' });
    return;
  }

  const unassigned = db
    .prepare(`SELECT * FROM queries WHERE assigned_employee_id IS NULL AND status != 'Resolved'`)
    .all() as Array<{ id: string; channel: string; platform: string; campaign_id: string | null; customer_name: string }>;

  let assignedCount = 0;
  const now = new Date().toISOString();

  for (const qry of unassigned) {
    const match = evaluateAssignmentRules({
      channel: qry.channel,
      platform: qry.platform || 'Facebook',
      campaign_id: qry.campaign_id,
    });
    if (match.employeeId) {
      db.prepare(`
        UPDATE queries
        SET assigned_employee_id = ?, assigned_rule_name = ?, priority = COALESCE(?, priority), status = 'In Progress', updated_at = ?
        WHERE id = ?
      `).run(match.employeeId, match.ruleName, match.priorityOverride, now, qry.id);
      logActivity(
        'query',
        qry.id,
        'Routing Engine',
        `Auto-assigned ${qry.customer_name} to ${match.employeeName} (${match.ruleName}).`
      );
      assignedCount += 1;
    }
  }

  res.json({ ok: true, assignedCount });
});

apiRouter.post('/queries', (req: Request, res: Response) => {
  const {
    customer_name,
    customer_handle,
    customer_email,
    customer_phone,
    channel,
    platform,
    ad_creative_name,
    ad_creative_format,
    ad_set_name,
    priority,
    campaign_id,
    subject,
    message,
    auto_assign,
  } = req.body as Record<string, string | boolean>;

  if (!customer_name || !subject || !message) {
    res.status(400).json({ error: 'Customer name, subject, and message are required.' });
    return;
  }

  const id = newId('qry');
  const now = new Date().toISOString();
  const due = new Date(Date.now() + 15 * 60_000).toISOString();
  const chosenChannel = String(channel || 'Lead Form');
  const chosenPlatform = String(
    platform || (chosenChannel === 'Instagram DM' ? 'Instagram' : 'Facebook')
  );
  const chosenCampaign = String(campaign_id || 'cmp_q4_b2b');
  const shouldAutoAssign = auto_assign !== false;

  const assignment = shouldAutoAssign
    ? evaluateAssignmentRules({
        channel: chosenChannel,
        platform: chosenPlatform,
        campaign_id: chosenCampaign,
      })
    : { employeeId: null, employeeName: null, ruleName: null, priorityOverride: null };

  db.prepare(`
    INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    chosenCampaign,
    assignment.employeeId,
    assignment.ruleName,
    String(customer_name).trim(),
    String(customer_handle || customer_name).trim(),
    String(customer_email || '').trim(),
    String(customer_phone || '').trim(),
    chosenChannel,
    chosenPlatform,
    'cr_custom_intake',
    String(ad_creative_name || 'Q4 Meta Ad Creative').trim(),
    String(ad_creative_format || (chosenPlatform === 'Instagram' ? 'Story Reel · 9:16' : 'Carousel Ad')).trim(),
    String(ad_set_name || 'Primary Prospecting Ad Set').trim(),
    assignment.priorityOverride || String(priority || 'High'),
    assignment.employeeId ? 'In Progress' : 'New',
    String(subject).trim(),
    String(message).trim(),
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: String(customer_name).trim(),
        body: String(message).trim(),
        timestamp: now,
      },
    ]),
    due,
    now,
    now
  );

  logActivity(
    'query',
    id,
    'Meta Intake',
    assignment.employeeName
      ? `Imported ${chosenPlatform} ${chosenChannel} from ${customer_name} · Auto-assigned to ${assignment.employeeName}.`
      : `Logged new ${chosenPlatform} ${chosenChannel} query from ${customer_name}.`
  );

  const created = db.prepare(`
    SELECT q.*, c.name AS campaign_name, c.objective AS campaign_objective, e.full_name AS assigned_employee_name
    FROM queries q
    LEFT JOIN campaigns c ON c.id = q.campaign_id
    LEFT JOIN employees e ON e.id = q.assigned_employee_id
    WHERE q.id = ?
  `).get(id);
  res.status(201).json(created);
});

apiRouter.patch('/queries/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  const { id } = req.params;
  const { assigned_employee_id, status, priority } = req.body as {
    assigned_employee_id?: string | null;
    status?: string;
    priority?: string;
  };

  if (callerPerms && assigned_employee_id !== undefined && !callerPerms.modifications.assignTasks) {
    res.status(403).json({ error: 'Your active role does not have permission to reassign inquiries.' });
    return;
  }
  if (callerPerms && status !== undefined && !callerPerms.modifications.updateInquiries) {
    res.status(403).json({ error: 'Your active role cannot update inquiry status.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Query not found.' });
    return;
  }

  const nextOwner = assigned_employee_id === undefined ? existing.assigned_employee_id : assigned_employee_id;
  const nextStatus = status ?? String(existing.status);
  const nextPriority = priority ?? String(existing.priority);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE queries
    SET assigned_employee_id = ?, status = ?, priority = ?, updated_at = ?
    WHERE id = ?
  `).run(nextOwner, nextStatus, nextPriority, now, id);

  if (assigned_employee_id !== undefined) {
    const emp = assigned_employee_id
      ? db.prepare('SELECT full_name FROM employees WHERE id = ?').get(assigned_employee_id)
      : null;
    logActivity(
      'query',
      String(id),
      'Queue Routing',
      emp ? `Assigned ${existing.customer_name} to ${emp.full_name}.` : `Unassigned ${existing.customer_name}.`
    );
  } else if (status && status !== existing.status) {
    logActivity('query', String(id), 'Agent Update', `Updated ${existing.customer_name} inquiry status to ${nextStatus}.`);
  }

  const updated = db.prepare(`
    SELECT q.*, c.name AS campaign_name, c.objective AS campaign_objective, e.full_name AS assigned_employee_name
    FROM queries q
    LEFT JOIN campaigns c ON c.id = q.campaign_id
    LEFT JOIN employees e ON e.id = q.assigned_employee_id
    WHERE q.id = ?
  `).get(id);
  res.json(updated);
});

apiRouter.post('/queries/:id/reply', (req: Request, res: Response) => {
  const { id } = req.params;
  const { body, author_name } = req.body as { body?: string; author_name?: string };
  if (!body || !body.trim()) {
    res.status(400).json({ error: 'Reply message cannot be empty.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Query not found.' });
    return;
  }

  const messages = JSON.parse(String(existing.messages_json || '[]')) as Array<Record<string, string>>;
  const now = new Date().toISOString();
  const senderName = author_name?.trim() || 'Sales Agent';

  messages.push({
    id: `m_${messages.length + 1}`,
    sender: 'agent',
    author: senderName,
    body: body.trim(),
    timestamp: now,
  });

  db.prepare(`
    UPDATE queries
    SET messages_json = ?, message_preview = ?, status = 'Replied', updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(messages), body.trim(), now, id);

  logActivity('query', String(id), senderName, `Replied to ${existing.customer_name} via ${existing.channel}.`);

  const updated = db.prepare(`
    SELECT q.*, c.name AS campaign_name, c.objective AS campaign_objective, e.full_name AS assigned_employee_name
    FROM queries q
    LEFT JOIN campaigns c ON c.id = q.campaign_id
    LEFT JOIN employees e ON e.id = q.assigned_employee_id
    WHERE q.id = ?
  `).get(id);
  res.json(updated);
});

apiRouter.post('/queries/:id/convert', (req: Request, res: Response) => {
  const { id } = req.params;
  const { company, deal_value, owner_id } = req.body as {
    company?: string;
    deal_value?: number;
    owner_id?: string;
  };

  const query = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
  if (!query) {
    res.status(404).json({ error: 'Query not found.' });
    return;
  }

  const existingLead = db.prepare('SELECT * FROM leads WHERE query_id = ?').get(id);
  if (existingLead) {
    res.json({ lead: existingLead, alreadyConverted: true });
    return;
  }

  const leadId = newId('lead');
  const now = new Date().toISOString();
  const assignedOwner = owner_id || query.assigned_employee_id || 'emp_marcus';

  db.prepare(`
    INSERT INTO leads (id, query_id, campaign_id, owner_id, contact_name, company, email, phone, source_channel, stage, deal_value, probability, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Qualified', ?, 45, ?, ?, ?)
  `).run(
    leadId,
    id,
    query.campaign_id,
    assignedOwner,
    query.customer_name,
    company?.trim() || String(query.customer_handle || query.customer_name),
    query.customer_email,
    query.customer_phone,
    query.channel,
    typeof deal_value === 'number' && deal_value > 0 ? deal_value : 15000,
    `Converted from Meta ${query.platform} ${query.channel} (${query.ad_creative_name || 'Ad Creative'})`,
    now,
    now
  );

  db.prepare(`UPDATE queries SET status = 'Resolved', updated_at = ? WHERE id = ?`).run(now, id);
  logActivity('lead', leadId, 'Pipeline Engine', `Converted Meta query from ${query.customer_name} into CRM deal.`);

  const createdLead = db.prepare(`
    SELECT l.*, e.full_name AS owner_name, c.name AS campaign_name
    FROM leads l
    LEFT JOIN employees e ON e.id = l.owner_id
    LEFT JOIN campaigns c ON c.id = l.campaign_id
    WHERE l.id = ?
  `).get(leadId);

  res.status(201).json({ lead: createdLead, alreadyConverted: false });
});

// ---------------------------------------------------------------------------
// CRM Leads & Pipeline
// ---------------------------------------------------------------------------
apiRouter.get('/leads', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT l.*, e.full_name AS owner_name, c.name AS campaign_name
    FROM leads l
    LEFT JOIN employees e ON e.id = l.owner_id
    LEFT JOIN campaigns c ON c.id = l.campaign_id
    ORDER BY l.updated_at DESC
  `).all();
  res.json(rows);
});

apiRouter.post('/leads', (req: Request, res: Response) => {
  const { contact_name, company, email, phone, source_channel, stage, deal_value, owner_id, campaign_id, notes } =
    req.body as {
      contact_name?: string;
      company?: string;
      email?: string;
      phone?: string;
      source_channel?: string;
      stage?: string;
      deal_value?: number;
      owner_id?: string;
      campaign_id?: string;
      notes?: string;
    };

  if (!contact_name || !company) {
    res.status(400).json({ error: 'Contact name and company are required.' });
    return;
  }

  const id = newId('lead');
  const now = new Date().toISOString();
  const stageProbMap: Record<string, number> = {
    'New Lead': 25,
    Qualified: 45,
    'Proposal Sent': 65,
    Negotiation: 80,
    Won: 100,
    'Closed Lost': 0,
  };
  const chosenStage = stage || 'New Lead';

  db.prepare(`
    INSERT INTO leads (id, query_id, campaign_id, owner_id, contact_name, company, email, phone, source_channel, stage, deal_value, probability, notes, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    campaign_id || 'cmp_q4_b2b',
    owner_id || 'emp_marcus',
    contact_name.trim(),
    company.trim(),
    (email || '').trim(),
    (phone || '').trim(),
    source_channel || 'Lead Form',
    chosenStage,
    Number(deal_value || 12000),
    stageProbMap[chosenStage] ?? 30,
    (notes || '').trim(),
    now,
    now
  );

  logActivity('lead', id, 'CRM Desk', `Created deal for ${company} ($${Number(deal_value || 12000).toLocaleString()}).`);

  const created = db.prepare(`
    SELECT l.*, e.full_name AS owner_name, c.name AS campaign_name
    FROM leads l
    LEFT JOIN employees e ON e.id = l.owner_id
    LEFT JOIN campaigns c ON c.id = l.campaign_id
    WHERE l.id = ?
  `).get(id);
  res.status(201).json(created);
});

apiRouter.patch('/leads/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Lead not found.' });
    return;
  }

  const { stage, deal_value, owner_id, notes, company, contact_name, email, phone } = req.body as {
    stage?: string;
    deal_value?: number;
    owner_id?: string;
    notes?: string;
    company?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
  };

  const stageProbMap: Record<string, number> = {
    'New Lead': 25,
    Qualified: 45,
    'Proposal Sent': 65,
    Negotiation: 80,
    Won: 100,
    'Closed Lost': 0,
  };

  const nextStage = stage ?? String(existing.stage);
  const nextProb = stage ? stageProbMap[nextStage] ?? Number(existing.probability) : Number(existing.probability);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE leads
    SET stage = ?, probability = ?, deal_value = ?, owner_id = ?, notes = ?, company = ?, contact_name = ?, email = ?, phone = ?, updated_at = ?
    WHERE id = ?
  `).run(
    nextStage,
    nextProb,
    typeof deal_value === 'number' ? deal_value : Number(existing.deal_value),
    owner_id ?? existing.owner_id,
    notes ?? String(existing.notes),
    company ?? String(existing.company),
    contact_name ?? String(existing.contact_name),
    email ?? String(existing.email),
    phone ?? String(existing.phone),
    now,
    id
  );

  if (stage && stage !== existing.stage) {
    logActivity('lead', String(id), 'Pipeline Update', `Moved ${existing.company} to ${nextStage}.`);
  }

  const updated = db.prepare(`
    SELECT l.*, e.full_name AS owner_name, c.name AS campaign_name
    FROM leads l
    LEFT JOIN employees e ON e.id = l.owner_id
    LEFT JOIN campaigns c ON c.id = l.campaign_id
    WHERE l.id = ?
  `).get(id);
  res.json(updated);
});

apiRouter.delete('/leads/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Lead not found.' });
    return;
  }
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  logActivity('lead', String(id), 'CRM Desk', `Removed deal ${existing.company}.`);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Organization, Departments & Employees
// ---------------------------------------------------------------------------
apiRouter.get('/organization', (_req: Request, res: Response) => {
  const org = db.prepare('SELECT * FROM organizations LIMIT 1').get();
  res.json(org);
});

apiRouter.patch('/organization', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Only Administrators can update organization governance settings.' });
    return;
  }

  const { name, industry, website, timezone, meta_business_id, sla_target_minutes } = req.body as {
    name?: string;
    industry?: string;
    website?: string;
    timezone?: string;
    meta_business_id?: string;
    sla_target_minutes?: number;
  };
  const existing = db.prepare('SELECT * FROM organizations LIMIT 1').get();
  if (!existing) {
    res.status(404).json({ error: 'Organization not found.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE organizations
    SET name = ?, industry = ?, website = ?, timezone = ?, meta_business_id = ?, sla_target_minutes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() || existing.name,
    industry?.trim() || existing.industry,
    website?.trim() || existing.website,
    timezone?.trim() || existing.timezone,
    meta_business_id?.trim() || existing.meta_business_id,
    typeof sla_target_minutes === 'number' && sla_target_minutes > 0
      ? sla_target_minutes
      : existing.sla_target_minutes,
    now,
    existing.id
  );

  logActivity('organization', String(existing.id), 'Workspace Admin', 'Updated organization governance profile.');
  res.json(db.prepare('SELECT * FROM organizations WHERE id = ?').get(existing.id));
});

apiRouter.get('/departments', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT d.*,
      e.full_name AS head_name,
      (SELECT COUNT(*) FROM employees emp WHERE emp.department_id = d.id) AS member_count
    FROM departments d
    LEFT JOIN employees e ON e.id = d.head_employee_id
    ORDER BY d.name ASC
  `).all();
  res.json(rows);
});

apiRouter.post('/departments', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Only Administrators can create departments.' });
    return;
  }

  const { name, head_employee_id, routing_channel, description } = req.body as {
    name?: string;
    head_employee_id?: string;
    routing_channel?: string;
    description?: string;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Department name is required.' });
    return;
  }

  const org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
  const id = newId('dept');
  db.prepare(`
    INSERT INTO departments (id, organization_id, name, head_employee_id, routing_channel, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    org?.id || 'org_northline',
    name.trim(),
    head_employee_id || null,
    routing_channel || 'Lead Form',
    (description || 'Dedicated operational team.').trim(),
    new Date().toISOString()
  );

  logActivity('department', id, 'Workspace Admin', `Created ${name.trim()} department.`);
  const created = db.prepare(`
    SELECT d.*, e.full_name AS head_name, 0 AS member_count
    FROM departments d
    LEFT JOIN employees e ON e.id = d.head_employee_id
    WHERE d.id = ?
  `).get(id);
  res.status(201).json(created);
});

apiRouter.get('/employees', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT emp.*,
      d.name AS department_name,
      (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id AND q.status != 'Resolved') AS active_queries,
      (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id AND q.status IN ('Replied', 'Resolved')) AS leads_contacted,
      (SELECT COUNT(*) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS deals_closed,
      (SELECT COALESCE(SUM(l.deal_value), 0) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS won_revenue
    FROM employees emp
    LEFT JOIN departments d ON d.id = emp.department_id
    ORDER BY emp.full_name ASC
  `).all();
  res.json(rows);
});

apiRouter.post('/employees', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Your active role does not have permission to add employees.' });
    return;
  }

  const { full_name, email, role, role_id, title, department_id, max_capacity, monthly_quota } = req.body as {
    full_name?: string;
    email?: string;
    role?: string;
    role_id?: string;
    title?: string;
    department_id?: string;
    max_capacity?: number;
    monthly_quota?: number;
  };

  if (!full_name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Full name and email are required.' });
    return;
  }

  const resolvedRole = role_id
    ? (db.prepare('SELECT id, name FROM roles WHERE id = ?').get(role_id) as { id: string; name: string } | undefined)
    : (db.prepare('SELECT id, name FROM roles WHERE name = ?').get(role || 'Agent') as
        | { id: string; name: string }
        | undefined);

  const org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
  const id = newId('emp');
  db.prepare(`
    INSERT INTO employees (id, organization_id, department_id, role_id, full_name, email, role, title, status, max_capacity, monthly_quota, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
  `).run(
    id,
    org?.id || 'org_northline',
    department_id || 'dept_sales',
    resolvedRole?.id || 'role_agent',
    full_name.trim(),
    email.trim(),
    resolvedRole?.name || role || 'Agent',
    (title || resolvedRole?.name || role || 'Team Member').trim(),
    Number(max_capacity || 12),
    Number(monthly_quota || 35000),
    new Date().toISOString()
  );

  logActivity('employee', id, 'Workspace Admin', `Added ${full_name.trim()} (${resolvedRole?.name || role || 'Agent'}) to organization.`);
  const created = db.prepare(`
    SELECT emp.*, d.name AS department_name, 0 AS active_queries, 0 AS leads_contacted, 0 AS deals_closed, 0 AS won_revenue
    FROM employees emp
    LEFT JOIN departments d ON d.id = emp.department_id
    WHERE emp.id = ?
  `).get(id);
  res.status(201).json(created);
});

apiRouter.patch('/employees/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Your active role does not have permission to edit employees.' });
    return;
  }

  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }

  const { role, role_id, title, department_id, status, max_capacity, monthly_quota } = req.body as {
    role?: string;
    role_id?: string;
    title?: string;
    department_id?: string;
    status?: string;
    max_capacity?: number;
    monthly_quota?: number;
  };

  let nextRoleName = role ?? String(existing.role);
  let nextRoleId = role_id ?? String(existing.role_id || 'role_agent');
  if (role_id) {
    const found = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(role_id) as
      | { id: string; name: string }
      | undefined;
    if (found) {
      nextRoleId = found.id;
      nextRoleName = found.name;
    }
  } else if (role) {
    const found = db.prepare('SELECT id, name FROM roles WHERE name = ?').get(role) as
      | { id: string; name: string }
      | undefined;
    if (found) {
      nextRoleId = found.id;
      nextRoleName = found.name;
    }
  }

  db.prepare(`
    UPDATE employees
    SET role = ?, role_id = ?, title = ?, department_id = ?, status = ?, max_capacity = ?, monthly_quota = ?
    WHERE id = ?
  `).run(
    nextRoleName,
    nextRoleId,
    title ?? existing.title,
    department_id ?? existing.department_id,
    status ?? existing.status,
    typeof max_capacity === 'number' ? max_capacity : existing.max_capacity,
    typeof monthly_quota === 'number' ? monthly_quota : existing.monthly_quota,
    id
  );

  const updated = db.prepare(`
    SELECT emp.*,
      d.name AS department_name,
      (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id AND q.status != 'Resolved') AS active_queries,
      (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id AND q.status IN ('Replied', 'Resolved')) AS leads_contacted,
      (SELECT COUNT(*) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS deals_closed,
      (SELECT COALESCE(SUM(l.deal_value), 0) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS won_revenue
    FROM employees emp
    LEFT JOIN departments d ON d.id = emp.department_id
    WHERE emp.id = ?
  `).get(id);
  res.json(updated);
});

apiRouter.delete('/employees/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Your active role does not have permission to remove employees.' });
    return;
  }

  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  db.prepare('UPDATE queries SET assigned_employee_id = NULL WHERE assigned_employee_id = ?').run(id);
  db.prepare('UPDATE leads SET owner_id = NULL WHERE owner_id = ?').run(id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  logActivity('employee', String(id), 'Workspace Admin', `Removed ${existing.full_name} from directory.`);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// HRMS: Attendance, Leave Requests, Payroll & Performance Reviews
// ---------------------------------------------------------------------------
apiRouter.get('/hrms/overview', (_req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const employees = db.prepare(`
    SELECT emp.*, d.name AS department_name,
      (SELECT COALESCE(SUM(l.deal_value), 0) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS won_revenue
    FROM employees emp
    LEFT JOIN departments d ON d.id = emp.department_id
    ORDER BY emp.full_name ASC
  `).all();

  const attendance = db.prepare(`
    SELECT a.*, e.full_name AS employee_name, e.title AS employee_title, d.name AS department_name
    FROM hr_attendance a
    JOIN employees e ON e.id = a.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY a.work_date DESC, a.clock_in DESC
  `).all();

  const leaves = db.prepare(`
    SELECT l.*, e.full_name AS employee_name, e.leave_balance, d.name AS department_name
    FROM hr_leave_requests l
    JOIN employees e ON e.id = l.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY CASE WHEN l.status = 'Pending' THEN 0 ELSE 1 END, l.created_at DESC
  `).all();

  const payroll = db.prepare(`
    SELECT p.*, e.full_name AS employee_name, e.title AS employee_title, d.name AS department_name
    FROM hr_payroll_records p
    JOIN employees e ON e.id = p.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY p.net_pay DESC
  `).all();

  const reviews = db.prepare(`
    SELECT r.*, e.full_name AS employee_name, e.title AS employee_title, d.name AS department_name
    FROM hr_reviews r
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY r.created_at DESC
  `).all();

  const presentToday = attendance.filter((a) => a.work_date === today).length;
  const pendingLeaves = leaves.filter((l) => l.status === 'Pending').length;
  const monthlyPayrollTotal = payroll.reduce((acc, p) => acc + Number(p.net_pay || 0), 0);
  const avgRating =
    reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length).toFixed(1))
      : 4.7;

  res.json({
    metrics: {
      totalHeadcount: employees.length,
      presentToday,
      pendingLeaves,
      monthlyPayrollTotal,
      avgRating,
    },
    attendance,
    leaves,
    payroll,
    reviews,
  });
});

apiRouter.post('/hrms/attendance/clock', (req: Request, res: Response) => {
  const { employee_id, work_mode, action } = req.body as {
    employee_id?: string;
    work_mode?: string;
    action?: 'in' | 'out';
  };
  if (!employee_id) {
    res.status(400).json({ error: 'Employee is required.' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const nowIso = new Date().toISOString();

  const existing = db
    .prepare('SELECT * FROM hr_attendance WHERE employee_id = ? AND work_date = ?')
    .get(employee_id, today);

  if (action === 'out' && existing) {
    const [inH, inM] = String(existing.clock_in).split(':').map(Number);
    const [outH, outM] = nowTime.split(':').map(Number);
    const diffHours = Math.max(0.5, Number((((outH * 60 + outM) - (inH * 60 + inM)) / 60).toFixed(1)));
    db.prepare('UPDATE hr_attendance SET clock_out = ?, hours_worked = ? WHERE id = ?').run(
      nowTime,
      diffHours,
      existing.id
    );
    logActivity('hrms', String(existing.id), 'HRMS Attendance', `Clocked out at ${nowTime} (${diffHours}h logged).`);
    res.json({ ok: true });
    return;
  }

  if (existing) {
    db.prepare('UPDATE hr_attendance SET work_mode = ?, clock_out = NULL WHERE id = ?').run(
      work_mode || existing.work_mode,
      existing.id
    );
    res.json({ ok: true });
    return;
  }

  const id = newId('att');
  const status = work_mode === 'Remote' ? 'Remote' : 'Present';
  db.prepare(`
    INSERT INTO hr_attendance (id, employee_id, work_date, clock_in, clock_out, work_mode, status, hours_worked, created_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 0, ?)
  `).run(id, employee_id, today, nowTime, work_mode || 'On-Site', status, nowIso);

  const emp = db.prepare('SELECT full_name FROM employees WHERE id = ?').get(employee_id);
  logActivity('hrms', id, 'HRMS Attendance', `${emp?.full_name || 'Employee'} clocked in (${work_mode || 'On-Site'}).`);
  res.status(201).json({ ok: true, id });
});

apiRouter.post('/hrms/leaves', (req: Request, res: Response) => {
  const { employee_id, leave_type, start_date, end_date, reason } = req.body as {
    employee_id?: string;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  };
  if (!employee_id || !start_date || !end_date || !reason?.trim()) {
    res.status(400).json({ error: 'Employee, dates, and reason are required.' });
    return;
  }

  const startMs = new Date(start_date).getTime();
  const endMs = new Date(end_date).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
  const id = newId('lv');

  db.prepare(`
    INSERT INTO hr_leave_requests (id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NULL, ?)
  `).run(id, employee_id, leave_type || 'Annual', start_date, end_date, days, reason.trim(), new Date().toISOString());

  const emp = db.prepare('SELECT full_name FROM employees WHERE id = ?').get(employee_id);
  logActivity('hrms', id, emp?.full_name ? String(emp.full_name) : 'Employee', `Requested ${days}d ${leave_type || 'Annual'} leave.`);
  res.status(201).json({ ok: true, id });
});

apiRouter.patch('/hrms/leaves/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.assignTasks && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Only Managers or Administrators can approve or decline leave requests.' });
    return;
  }

  const { id } = req.params;
  const { status, reviewed_by } = req.body as { status?: string; reviewed_by?: string };
  const existing = db.prepare('SELECT * FROM hr_leave_requests WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Leave request not found.' });
    return;
  }

  const nextStatus = status || 'Approved';
  db.prepare('UPDATE hr_leave_requests SET status = ?, reviewed_by = ? WHERE id = ?').run(
    nextStatus,
    reviewed_by || 'Workspace Manager',
    id
  );

  if (nextStatus === 'Approved' && existing.status !== 'Approved') {
    db.prepare('UPDATE employees SET leave_balance = MAX(0, leave_balance - ?) WHERE id = ?').run(
      Number(existing.days_count || 1),
      existing.employee_id
    );
  }

  logActivity('hrms', String(id), reviewed_by || 'HR Manager', `${nextStatus} leave request.`);
  res.json({ ok: true });
});

apiRouter.post('/hrms/payroll/run', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Only Administrators can run payroll disbursements.' });
    return;
  }

  const { pay_period } = req.body as { pay_period?: string };
  const targetPeriod = pay_period || 'November 2026';
  const nowIso = new Date().toISOString();

  // Sync CRM won revenue into 5% sales commission before marking payroll paid
  const employees = db.prepare(`
    SELECT emp.id, emp.base_salary,
      (SELECT COALESCE(SUM(l.deal_value), 0) FROM leads l WHERE l.owner_id = emp.id AND l.stage = 'Won') AS won_revenue
    FROM employees emp
  `).all();

  for (const emp of employees) {
    const commission = Math.round(Number(emp.won_revenue || 0) * 0.05);
    const existingPay = db
      .prepare('SELECT * FROM hr_payroll_records WHERE employee_id = ? AND pay_period = ?')
      .get(emp.id, targetPeriod);

    if (existingPay) {
      const bonus = Number(existingPay.bonus || 0);
      const deductions = Number(existingPay.deductions || 0);
      const base = Number(emp.base_salary || existingPay.base_salary);
      const net = Math.max(0, base + commission + bonus - deductions);
      db.prepare(`
        UPDATE hr_payroll_records
        SET base_salary = ?, crm_commission = ?, net_pay = ?, status = 'Paid', paid_at = ?
        WHERE id = ?
      `).run(base, commission, net, nowIso, existingPay.id);
    }
  }

  logActivity('hrms', targetPeriod, 'Payroll Desk', `Disbursed ${targetPeriod} payroll with synced CRM commissions.`);
  res.json({ ok: true });
});

apiRouter.patch('/hrms/payroll/:id', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Only Administrators can update payroll records.' });
    return;
  }
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  db.prepare('UPDATE hr_payroll_records SET status = ?, paid_at = ? WHERE id = ?').run(
    status || 'Paid',
    status === 'Paid' ? new Date().toISOString() : null,
    id
  );
  res.json({ ok: true });
});

apiRouter.post('/hrms/reviews', (req: Request, res: Response) => {
  const callerPerms = getRequestRolePermissions(req);
  if (callerPerms && !callerPerms.modifications.assignTasks && !callerPerms.modifications.manageTeam) {
    res.status(403).json({ error: 'Only Managers or Administrators can log performance reviews.' });
    return;
  }

  const { employee_id, reviewer_name, review_cycle, rating, attendance_score, crm_attainment_pct, summary } =
    req.body as {
      employee_id?: string;
      reviewer_name?: string;
      review_cycle?: string;
      rating?: number;
      attendance_score?: number;
      crm_attainment_pct?: number;
      summary?: string;
    };

  if (!employee_id || !summary?.trim()) {
    res.status(400).json({ error: 'Employee and review summary are required.' });
    return;
  }

  const id = newId('rev');
  db.prepare(`
    INSERT INTO hr_reviews (id, employee_id, reviewer_name, review_cycle, rating, attendance_score, crm_attainment_pct, summary, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?)
  `).run(
    id,
    employee_id,
    reviewer_name || 'Claire Bennett',
    review_cycle || 'Q4 2026',
    Number(rating || 4.6),
    Number(attendance_score || 96),
    Number(crm_attainment_pct || 100),
    summary.trim(),
    new Date().toISOString()
  );

  const emp = db.prepare('SELECT full_name FROM employees WHERE id = ?').get(employee_id);
  logActivity('hrms', id, reviewer_name || 'HR Review', `Completed ${review_cycle || 'Q4 2026'} review for ${emp?.full_name || 'employee'}.`);
  res.status(201).json({ ok: true, id });
});

