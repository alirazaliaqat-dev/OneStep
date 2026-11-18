import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'clearline.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

export interface RolePermissions {
  dataAccess: {
    leadsScope: 'all' | 'department' | 'assigned';
    queriesScope: 'all' | 'department' | 'assigned';
    viewCampaigns: boolean;
    viewOrganization: boolean;
  };
  modifications: {
    updateInquiries: boolean;
    assignTasks: boolean;
    manageCampaigns: boolean;
    manageDeals: boolean;
    manageAssignmentRules: boolean;
    manageTeam: boolean;
    manageRoles: boolean;
  };
  reporting: {
    viewExecutiveKpis: boolean;
    viewTeamPerformance: boolean;
    viewFinancialRoas: boolean;
    customizeDashboard: boolean;
  };
}

function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initializeDatabase(): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      website TEXT NOT NULL,
      timezone TEXT NOT NULL,
      meta_business_id TEXT NOT NULL,
      sla_target_minutes INTEGER NOT NULL DEFAULT 15,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      permissions_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      head_employee_id TEXT,
      routing_channel TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      role_id TEXT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      max_capacity INTEGER NOT NULL DEFAULT 12,
      monthly_quota INTEGER NOT NULL DEFAULT 35000,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta_connections (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Disconnected',
      business_name TEXT NOT NULL,
      ad_account_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      page_name TEXT NOT NULL,
      instagram_handle TEXT NOT NULL,
      access_token TEXT,
      token_expires_at TEXT,
      last_synced_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tiktok_connections (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Disconnected',
      advertiser_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      tiktok_handle TEXT NOT NULL,
      access_token TEXT,
      token_expires_at TEXT,
      last_synced_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      objective TEXT NOT NULL,
      status TEXT NOT NULL,
      daily_budget REAL NOT NULL,
      spend REAL NOT NULL,
      impressions INTEGER NOT NULL,
      clicks INTEGER NOT NULL,
      leads_count INTEGER NOT NULL,
      roas REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignment_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'Any',
      platform TEXT NOT NULL DEFAULT 'Any',
      campaign_id TEXT NOT NULL DEFAULT 'Any',
      strategy TEXT NOT NULL DEFAULT 'least_loaded',
      target_employee_id TEXT,
      target_department_id TEXT,
      priority_override TEXT NOT NULL DEFAULT 'Keep',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS queries (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      assigned_employee_id TEXT,
      assigned_rule_name TEXT,
      customer_name TEXT NOT NULL,
      customer_handle TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      channel TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'Instagram',
      ad_creative_id TEXT,
      ad_creative_name TEXT,
      ad_creative_format TEXT,
      ad_set_name TEXT,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      subject TEXT NOT NULL,
      message_preview TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      sla_due_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      query_id TEXT,
      campaign_id TEXT,
      owner_id TEXT,
      contact_name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      source_channel TEXT NOT NULL,
      stage TEXT NOT NULL,
      deal_value REAL NOT NULL,
      probability INTEGER NOT NULL DEFAULT 30,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_preferences (
      id TEXT PRIMARY KEY,
      kpi_order_json TEXT NOT NULL,
      hidden_kpis_json TEXT NOT NULL,
      visible_widgets_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hr_attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      work_date TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      work_mode TEXT NOT NULL DEFAULT 'On-Site',
      status TEXT NOT NULL DEFAULT 'Present',
      hours_worked REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hr_leave_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      reviewed_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hr_payroll_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      pay_period TEXT NOT NULL,
      base_salary REAL NOT NULL,
      crm_commission REAL NOT NULL DEFAULT 0,
      bonus REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      net_pay REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      paid_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hr_reviews (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      review_cycle TEXT NOT NULL,
      rating REAL NOT NULL,
      attendance_score INTEGER NOT NULL,
      crm_attainment_pct INTEGER NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Completed',
      created_at TEXT NOT NULL
    );
  `);

  // Non-destructive column migrations for existing databases
  ensureColumn('employees', 'role_id', 'TEXT');
  ensureColumn('employees', 'base_salary', 'REAL NOT NULL DEFAULT 6500');
  ensureColumn('employees', 'employment_type', "TEXT NOT NULL DEFAULT 'Full-Time'");
  ensureColumn('employees', 'hire_date', "TEXT NOT NULL DEFAULT '2025-03-15'");
  ensureColumn('employees', 'leave_balance', 'INTEGER NOT NULL DEFAULT 18');
  ensureColumn('employees', 'work_location', "TEXT NOT NULL DEFAULT 'San Francisco HQ'");
  ensureColumn('queries', 'assigned_rule_name', 'TEXT');
  ensureColumn('queries', 'platform', "TEXT NOT NULL DEFAULT 'Instagram'");
  ensureColumn('queries', 'ad_creative_id', 'TEXT');
  ensureColumn('queries', 'ad_creative_name', 'TEXT');
  ensureColumn('queries', 'ad_creative_format', 'TEXT');
  ensureColumn('queries', 'ad_set_name', 'TEXT');

  seedRolesIfEmpty();
  seedAssignmentRulesIfEmpty();
  seedDashboardPreferencesIfEmpty();
  seedInitialWorkspaceIfEmpty();
  backfillQueryCreativesAndRoles();
  seedHrmsIfEmpty();
  seedTikTokIfEmpty();
}

function seedRolesIfEmpty(): void {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM roles').get() as { cnt: number };
  if (Number(count?.cnt || 0) > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO roles (id, name, description, is_system, permissions_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminPerms: RolePermissions = {
    dataAccess: {
      leadsScope: 'all',
      queriesScope: 'all',
      viewCampaigns: true,
      viewOrganization: true,
    },
    modifications: {
      updateInquiries: true,
      assignTasks: true,
      manageCampaigns: true,
      manageDeals: true,
      manageAssignmentRules: true,
      manageTeam: true,
      manageRoles: true,
    },
    reporting: {
      viewExecutiveKpis: true,
      viewTeamPerformance: true,
      viewFinancialRoas: true,
      customizeDashboard: true,
    },
  };

  const managerPerms: RolePermissions = {
    dataAccess: {
      leadsScope: 'all',
      queriesScope: 'all',
      viewCampaigns: true,
      viewOrganization: true,
    },
    modifications: {
      updateInquiries: true,
      assignTasks: true,
      manageCampaigns: true,
      manageDeals: true,
      manageAssignmentRules: true,
      manageTeam: false,
      manageRoles: false,
    },
    reporting: {
      viewExecutiveKpis: true,
      viewTeamPerformance: true,
      viewFinancialRoas: true,
      customizeDashboard: true,
    },
  };

  const agentPerms: RolePermissions = {
    dataAccess: {
      leadsScope: 'assigned',
      queriesScope: 'assigned',
      viewCampaigns: false,
      viewOrganization: false,
    },
    modifications: {
      updateInquiries: true,
      assignTasks: false,
      manageCampaigns: false,
      manageDeals: true,
      manageAssignmentRules: false,
      manageTeam: false,
      manageRoles: false,
    },
    reporting: {
      viewExecutiveKpis: true,
      viewTeamPerformance: false,
      viewFinancialRoas: false,
      customizeDashboard: true,
    },
  };

  insert.run(
    'role_admin',
    'Administrator',
    'Full workspace access including Meta OAuth, financial ROAS reporting, team governance, and custom RBAC roles.',
    1,
    JSON.stringify(adminPerms),
    now
  );
  insert.run(
    'role_manager',
    'Manager',
    'Oversees team performance, assigns Meta inquiries and tasks, manages pipeline deals, and edits routing rules.',
    1,
    JSON.stringify(managerPerms),
    now
  );
  insert.run(
    'role_agent',
    'Agent',
    'Handles assigned Meta ad inquiries, replies to clients, updates inquiry statuses, and progresses owned CRM deals.',
    1,
    JSON.stringify(agentPerms),
    now
  );
}

function seedAssignmentRulesIfEmpty(): void {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM assignment_rules').get() as { cnt: number };
  if (Number(count?.cnt || 0) > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO assignment_rules (id, name, channel, platform, campaign_id, strategy, target_employee_id, target_department_id, priority_override, is_active, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  insert.run(
    'rule_wholesale_forms',
    'Enterprise Lead Forms → Inbound Revenue',
    'Lead Form',
    'Any',
    'cmp_q4_b2b',
    'least_loaded',
    null,
    'dept_sales',
    'Urgent',
    1,
    now
  );
  insert.run(
    'rule_ig_story_dm',
    'Instagram Story DMs → Marcus Alvarez',
    'Instagram DM',
    'Instagram',
    'Any',
    'specific_agent',
    'emp_marcus',
    'dept_sales',
    'High',
    2,
    now
  );
  insert.run(
    'rule_messenger_care',
    'Messenger & Ad Comments → Client Success',
    'Messenger',
    'Facebook',
    'Any',
    'least_loaded',
    null,
    'dept_care',
    'Keep',
    3,
    now
  );
}

function seedDashboardPreferencesIfEmpty(): void {
  const existing = db.prepare('SELECT id FROM dashboard_preferences WHERE id = ?').get('default');
  if (existing) return;

  db.prepare(`
    INSERT INTO dashboard_preferences (id, kpi_order_json, hidden_kpis_json, visible_widgets_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'default',
    JSON.stringify([
      'total_leads',
      'conversion_rate',
      'active_campaigns',
      'ad_spend',
      'roas',
      'team_deals_closed',
    ]),
    JSON.stringify([]),
    JSON.stringify([
      'campaign_roas_chart',
      'funnel_channel_chart',
      'employee_performance_chart',
      'priority_queries',
    ]),
    new Date().toISOString()
  );
}

function seedInitialWorkspaceIfEmpty(): void {
  const existingOrg = db.prepare('SELECT id FROM organizations LIMIT 1').get();
  if (existingOrg) {
    return;
  }

  const now = new Date();
  const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const futureIso = (minutesAhead = 15) => new Date(now.getTime() + minutesAhead * 60_000).toISOString();

  db.prepare(`
    INSERT INTO organizations (id, name, industry, website, timezone, meta_business_id, sla_target_minutes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'org_northline',
    'Northline Commerce Group',
    'Omnichannel Retail & B2B Services',
    'https://northlinecommerce.com',
    'America/Los_Angeles',
    'BM-8841209471',
    15,
    iso(0)
  );

  const insertDept = db.prepare(`
    INSERT INTO departments (id, organization_id, name, head_employee_id, routing_channel, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertDept.run(
    'dept_growth',
    'org_northline',
    'Performance Marketing',
    'emp_claire',
    'Lead Form',
    'Manages Meta ad spend, instant lead forms, and campaign attribution.',
    iso(43200)
  );
  insertDept.run(
    'dept_sales',
    'org_northline',
    'Inbound Revenue',
    'emp_marcus',
    'Instagram DM',
    'Qualifies high-intent ad inquiries and closes commercial pipeline deals.',
    iso(43200)
  );
  insertDept.run(
    'dept_care',
    'org_northline',
    'Client Success',
    'emp_elena',
    'Messenger',
    'Resolves post-click questions, ad comments, and onboarding requests.',
    iso(43200)
  );

  const insertEmp = db.prepare(`
    INSERT INTO employees (id, organization_id, department_id, role_id, full_name, email, role, title, status, max_capacity, monthly_quota, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEmp.run('emp_claire', 'org_northline', 'dept_growth', 'role_admin', 'Claire Bennett', 'claire@northlinecommerce.com', 'Administrator', 'VP of Growth', 'Active', 10, 60000, iso(40000));
  insertEmp.run('emp_marcus', 'org_northline', 'dept_sales', 'role_manager', 'Marcus Alvarez', 'marcus@northlinecommerce.com', 'Manager', 'Sales Team Manager', 'Active', 14, 55000, iso(38000));
  insertEmp.run('emp_elena', 'org_northline', 'dept_care', 'role_agent', 'Elena Rostova', 'elena@northlinecommerce.com', 'Agent', 'Client Care Specialist', 'Active', 16, 25000, iso(35000));
  insertEmp.run('emp_david', 'org_northline', 'dept_sales', 'role_agent', 'David Kim', 'david@northlinecommerce.com', 'Agent', 'Inbound Sales Agent', 'Active', 12, 42000, iso(30000));
  insertEmp.run('emp_nadia', 'org_northline', 'dept_growth', 'role_manager', 'Nadia Patel', 'nadia@northlinecommerce.com', 'Manager', 'Paid Social Lead', 'Active', 10, 35000, iso(28000));

  db.prepare(`
    INSERT INTO meta_connections (id, organization_id, status, business_name, ad_account_id, page_id, page_name, instagram_handle, access_token, token_expires_at, last_synced_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'meta_primary',
    'org_northline',
    'Disconnected',
    'Northline Business Suite',
    'act_pending_oauth',
    'page_pending_oauth',
    'Northline Official',
    '@northline.official',
    null,
    null,
    null,
    iso(0)
  );

  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (id, name, platform, objective, status, daily_budget, spend, impressions, clicks, leads_count, roas, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCampaign.run('cmp_q4_b2b', 'Q4 Enterprise Wholesale Lead Form', 'Facebook & Instagram', 'Lead Generation', 'Active', 450, 8420, 218400, 6410, 148, 4.6, iso(12));
  insertCampaign.run('cmp_ig_retarget', 'Instagram Story Retargeting — Demo', 'Instagram', 'Messages', 'Active', 280, 4910, 142800, 4120, 94, 5.2, iso(25));
  insertCampaign.run('cmp_msg_consult', 'Messenger Direct Consultation Offer', 'Facebook', 'Conversions', 'Active', 220, 3180, 96200, 2890, 61, 3.8, iso(48));
  insertCampaign.run('cmp_brand_lookalike', 'High-LTV Lookalike Video Awareness', 'Facebook & Instagram', 'Traffic', 'Paused', 180, 2140, 164000, 3180, 29, 2.4, iso(320));

  const insertQuery = db.prepare(`
    INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuery.run(
    'qry_101',
    'cmp_q4_b2b',
    null,
    null,
    'Hannah Lindqvist',
    'Nordic Supply Co.',
    'hannah@nordicsupply.io',
    '+1 (415) 890-3341',
    'Lead Form',
    'Facebook',
    'cr_9921_carousel',
    'Wholesale Pricing Carousel — Q4 Tier Card',
    'Carousel · 4 Cards',
    'US Retail Buyers 25–54',
    'Urgent',
    'New',
    'Wholesale volume pricing for 12 retail locations',
    'Submitted Instant Lead Form requesting Q4 wholesale tier sheet and onboarding timeline.',
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: 'Hannah Lindqvist',
        body: 'Hi team, we operate 12 coastal retail stores and saw your Q4 Enterprise ad. Looking for wholesale tier pricing and lead times before December.',
        timestamp: iso(6),
      },
    ]),
    futureIso(9),
    iso(6),
    iso(6)
  );

  insertQuery.run(
    'qry_102',
    'cmp_ig_retarget',
    'emp_marcus',
    'Instagram Story DMs → Marcus Alvarez',
    'Mateo Silva',
    '@mateo.studio',
    'mateo@atelierforma.com',
    '+1 (310) 742-1198',
    'Instagram DM',
    'Instagram',
    'cr_4410_reel',
    '15s Founder Walkthrough Story Reel',
    'Vertical Video · 9:16',
    'Retargeting · Site Visitors 30d',
    'High',
    'In Progress',
    'Multi-seat workspace demo inquiry from IG Story',
    'Asked whether Meta ad lead routing supports regional sales territories.',
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: 'Mateo Silva',
        body: 'Saw your Instagram Story ad—can we route leads by West Coast vs East Coast reps automatically?',
        timestamp: iso(42),
      },
      {
        id: 'm2',
        sender: 'agent',
        author: 'Marcus Alvarez',
        body: 'Hi Mateo! Yes, departments can be mapped directly to channels or regional territories. Would a 15-minute walkthrough tomorrow morning work?',
        timestamp: iso(28),
      },
      {
        id: 'm3',
        sender: 'customer',
        author: 'Mateo Silva',
        body: 'Tomorrow at 10:30 AM PST works great. We have 18 reps across two offices.',
        timestamp: iso(14),
      },
    ]),
    futureIso(24),
    iso(42),
    iso(14)
  );

  insertQuery.run(
    'qry_103',
    'cmp_msg_consult',
    'emp_elena',
    'Messenger & Ad Comments → Client Success',
    'Priya Nair',
    'Verve Wellness',
    'priya@vervewellness.co',
    '+1 (646) 519-8820',
    'Messenger',
    'Facebook',
    'cr_7723_static',
    'Direct Attribution Consultation Offer Banner',
    'Single Image · 1:1 Feed',
    'Health & Wellness Founders',
    'Standard',
    'Replied',
    'Consultation request on ad campaign attribution',
    'Confirmed onboarding call slot and requested sample SLA policy.',
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: 'Priya Nair',
        body: 'Hello, does the Messenger integration track which specific Meta ad creative drove the inquiry?',
        timestamp: iso(110),
      },
      {
        id: 'm2',
        sender: 'agent',
        author: 'Elena Rostova',
        body: 'Yes Priya—every incoming Messenger query preserves its originating Meta campaign ID and ad creative metadata inside the CRM record.',
        timestamp: iso(85),
      },
    ]),
    futureIso(60),
    iso(110),
    iso(85)
  );

  insertQuery.run(
    'qry_104',
    'cmp_q4_b2b',
    null,
    null,
    'Liam O’Connor',
    '@liam_builds',
    'liam@harborfreightlabs.com',
    '+1 (206) 441-7209',
    'Ad Comment',
    'Facebook',
    'cr_9921_carousel',
    'Wholesale Pricing Carousel — Q4 Tier Card',
    'Carousel · 4 Cards',
    'US Retail Buyers 25–54',
    'High',
    'New',
    'Comment on Q4 Enterprise Wholesale carousel ad',
    'Asked publicly on Facebook ad post about annual contract discounts and API access.',
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: 'Liam O’Connor',
        body: 'Do you offer annual billing discounts for 25+ team members and webhook access for custom ERP sync?',
        timestamp: iso(19),
      },
    ]),
    futureIso(12),
    iso(19),
    iso(19)
  );

  insertQuery.run(
    'qry_105',
    'cmp_ig_retarget',
    'emp_david',
    'Instagram Story DMs → Marcus Alvarez',
    'Sophia Chen',
    '@sophia.chen.ops',
    'sophia@pacificmeridian.com',
    '+1 (415) 312-9044',
    'Instagram DM',
    'Instagram',
    'cr_4410_reel',
    '15s Founder Walkthrough Story Reel',
    'Vertical Video · 9:16',
    'Retargeting · Site Visitors 30d',
    'Standard',
    'Resolved',
    'Follow-up on enterprise security documentation',
    'Delivered SOC2 summary and converted account to qualified pipeline deal.',
    JSON.stringify([
      {
        id: 'm1',
        sender: 'customer',
        author: 'Sophia Chen',
        body: 'Could you share your data retention policy before we proceed with the pilot?',
        timestamp: iso(340),
      },
      {
        id: 'm2',
        sender: 'agent',
        author: 'David Kim',
        body: 'Sent over our security brief and pilot agreement—let me know if your legal team needs anything else.',
        timestamp: iso(260),
      },
    ]),
    futureIso(120),
    iso(340),
    iso(260)
  );

  const insertLead = db.prepare(`
    INSERT INTO leads (id, query_id, campaign_id, owner_id, contact_name, company, email, phone, source_channel, stage, deal_value, probability, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLead.run('lead_201', 'qry_105', 'cmp_ig_retarget', 'emp_david', 'Sophia Chen', 'Pacific Meridian Logistics', 'sophia@pacificmeridian.com', '+1 (415) 312-9044', 'Instagram DM', 'Negotiation', 28500, 75, 'Legal review on final MSA terms.', iso(900), iso(45));
  insertLead.run('lead_202', 'qry_102', 'cmp_ig_retarget', 'emp_marcus', 'Mateo Silva', 'Atelier Forma', 'mateo@atelierforma.com', '+1 (310) 742-1198', 'Instagram DM', 'Qualified', 19200, 50, '18 seats across LA and NYC studios.', iso(1400), iso(20));
  insertLead.run('lead_203', null, 'cmp_q4_b2b', 'emp_marcus', 'Rachel Goldstein', 'Beacon Dental Partners', 'rachel@beacondental.org', '+1 (617) 882-4100', 'Lead Form', 'Proposal Sent', 42000, 65, 'Multi-clinic Meta Ads intake rollout.', iso(2800), iso(180));
  insertLead.run('lead_204', null, 'cmp_msg_consult', 'emp_claire', 'Omar Farooq', 'Crescent Hospitality', 'omar@crescenthotels.com', '+1 (312) 905-6672', 'Messenger', 'Won', 34000, 100, 'Signed 12-month platform agreement.', iso(4200), iso(600));
  insertLead.run('lead_205', null, 'cmp_q4_b2b', 'emp_david', 'Tessa Wright', 'Wright & Co. Interiors', 'tessa@wrightinteriors.com', '+1 (512) 774-0933', 'Lead Form', 'New Lead', 14800, 25, 'Initial discovery call scheduled for Friday.', iso(720), iso(120));

  const insertActivity = db.prepare(`
    INSERT INTO activities (id, entity_type, entity_id, actor_name, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertActivity.run('act_1', 'lead', 'lead_201', 'David Kim', 'Shared security brief and advanced deal to Negotiation.', iso(45));
  insertActivity.run('act_2', 'lead', 'lead_202', 'Marcus Alvarez', 'Scheduled 18-seat workspace demo via Instagram DM.', iso(20));
  insertActivity.run('act_3', 'lead', 'lead_204', 'Claire Bennett', 'Closed Won annual agreement ($34,000).', iso(600));
}

function backfillQueryCreativesAndRoles(): void {
  // Ensure existing seeded employees map cleanly to new RBAC roles if database pre-existed
  db.prepare(`UPDATE employees SET role = 'Administrator', role_id = 'role_admin' WHERE role IN ('Admin', 'Administrator')`).run();
  db.prepare(`UPDATE employees SET role = 'Manager', role_id = 'role_manager' WHERE role IN ('Ad Manager', 'Manager')`).run();
  db.prepare(`UPDATE employees SET role = 'Agent', role_id = 'role_agent' WHERE role IN ('Sales Lead', 'Support Specialist', 'Agent') AND role_id IS NULL`).run();

  // Ensure existing seeded queries have creative metadata populated
  db.prepare(`
    UPDATE queries
    SET platform = 'Facebook',
        ad_creative_id = COALESCE(ad_creative_id, 'cr_9921_carousel'),
        ad_creative_name = COALESCE(ad_creative_name, 'Wholesale Pricing Carousel — Q4 Tier Card'),
        ad_creative_format = COALESCE(ad_creative_format, 'Carousel · 4 Cards'),
        ad_set_name = COALESCE(ad_set_name, 'US Retail Buyers 25–54')
    WHERE id IN ('qry_101', 'qry_104') AND ad_creative_name IS NULL
  `).run();

  db.prepare(`
    UPDATE queries
    SET platform = 'Instagram',
        ad_creative_id = COALESCE(ad_creative_id, 'cr_4410_reel'),
        ad_creative_name = COALESCE(ad_creative_name, '15s Founder Walkthrough Story Reel'),
        ad_creative_format = COALESCE(ad_creative_format, 'Vertical Video · 9:16'),
        ad_set_name = COALESCE(ad_set_name, 'Retargeting · Site Visitors 30d')
    WHERE id IN ('qry_102', 'qry_105') AND ad_creative_name IS NULL
  `).run();

  db.prepare(`
    UPDATE queries
    SET platform = 'Facebook',
        ad_creative_id = COALESCE(ad_creative_id, 'cr_7723_static'),
        ad_creative_name = COALESCE(ad_creative_name, 'Direct Attribution Consultation Offer Banner'),
        ad_creative_format = COALESCE(ad_creative_format, 'Single Image · 1:1 Feed'),
        ad_set_name = COALESCE(ad_set_name, 'Health & Wellness Founders')
    WHERE id = 'qry_103' AND ad_creative_name IS NULL
  `).run();
}

function seedHrmsIfEmpty(): void {
  // Set tailored base salaries and hire dates on initial employees if still at default
  db.prepare(`UPDATE employees SET base_salary = 11500, work_location = 'San Francisco HQ', hire_date = '2024-02-10' WHERE id = 'emp_claire' AND base_salary = 6500`).run();
  db.prepare(`UPDATE employees SET base_salary = 8800, work_location = 'Los Angeles Studio', hire_date = '2024-06-03' WHERE id = 'emp_marcus' AND base_salary = 6500`).run();
  db.prepare(`UPDATE employees SET base_salary = 6400, work_location = 'Remote · New York', hire_date = '2024-11-18' WHERE id = 'emp_elena' AND base_salary = 6500`).run();
  db.prepare(`UPDATE employees SET base_salary = 7200, work_location = 'San Francisco HQ', hire_date = '2025-01-12' WHERE id = 'emp_david' AND base_salary = 6500`).run();
  db.prepare(`UPDATE employees SET base_salary = 7900, work_location = 'Remote · Austin', hire_date = '2025-04-01' WHERE id = 'emp_nadia' AND base_salary = 6500`).run();

  const existingAttendance = db.prepare('SELECT COUNT(*) AS cnt FROM hr_attendance').get() as { cnt: number };
  if (Number(existingAttendance?.cnt || 0) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const insAtt = db.prepare(`
      INSERT INTO hr_attendance (id, employee_id, work_date, clock_in, clock_out, work_mode, status, hours_worked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insAtt.run('att_1', 'emp_claire', today, '08:48', null, 'On-Site', 'Present', 4.5, nowIso);
    insAtt.run('att_2', 'emp_marcus', today, '08:55', null, 'Hybrid', 'Present', 4.4, nowIso);
    insAtt.run('att_3', 'emp_elena', today, '09:02', null, 'Remote', 'Remote', 4.2, nowIso);
    insAtt.run('att_4', 'emp_david', today, '09:16', null, 'On-Site', 'Late', 4.0, nowIso);
    insAtt.run('att_5', 'emp_nadia', today, '08:50', null, 'Remote', 'Remote', 4.5, nowIso);
  }

  const existingLeaves = db.prepare('SELECT COUNT(*) AS cnt FROM hr_leave_requests').get() as { cnt: number };
  if (Number(existingLeaves?.cnt || 0) === 0) {
    const nowIso = new Date().toISOString();
    const insLeave = db.prepare(`
      INSERT INTO hr_leave_requests (id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insLeave.run('lv_1', 'emp_david', 'Annual', '2026-11-25', '2026-11-27', 3, 'Thanksgiving family travel across coast.', 'Pending', null, nowIso);
    insLeave.run('lv_2', 'emp_elena', 'Personal', '2026-12-04', '2026-12-04', 1, 'Scheduled wellness appointment.', 'Pending', null, nowIso);
    insLeave.run('lv_3', 'emp_nadia', 'Annual', '2026-11-05', '2026-11-06', 2, 'Design & paid social summit attendance.', 'Approved', 'Claire Bennett', nowIso);
  }

  const existingPayroll = db.prepare('SELECT COUNT(*) AS cnt FROM hr_payroll_records').get() as { cnt: number };
  if (Number(existingPayroll?.cnt || 0) === 0) {
    const nowIso = new Date().toISOString();
    const period = 'November 2026';
    const insPay = db.prepare(`
      INSERT INTO hr_payroll_records (id, employee_id, pay_period, base_salary, crm_commission, bonus, deductions, net_pay, status, paid_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insPay.run('pay_1', 'emp_claire', period, 11500, 1700, 500, 1950, 11750, 'Scheduled', null, nowIso);
    insPay.run('pay_2', 'emp_marcus', period, 8800, 1250, 400, 1480, 8970, 'Scheduled', null, nowIso);
    insPay.run('pay_3', 'emp_elena', period, 6400, 300, 250, 920, 6030, 'Scheduled', null, nowIso);
    insPay.run('pay_4', 'emp_david', period, 7200, 680, 0, 1120, 6760, 'Scheduled', null, nowIso);
    insPay.run('pay_5', 'emp_nadia', period, 7900, 450, 300, 1210, 7440, 'Scheduled', null, nowIso);
  }

  const existingReviews = db.prepare('SELECT COUNT(*) AS cnt FROM hr_reviews').get() as { cnt: number };
  if (Number(existingReviews?.cnt || 0) === 0) {
    const nowIso = new Date().toISOString();
    const insRev = db.prepare(`
      INSERT INTO hr_reviews (id, employee_id, reviewer_name, review_cycle, rating, attendance_score, crm_attainment_pct, summary, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insRev.run('rev_1', 'emp_marcus', 'Claire Bennett', 'Q4 2026', 4.8, 98, 112, 'Exceeded Instagram Story DM conversion targets and mentored two inbound reps.', 'Completed', nowIso);
    insRev.run('rev_2', 'emp_david', 'Marcus Alvarez', 'Q4 2026', 4.5, 94, 96, 'Strong enterprise discovery calls; moving Pacific Meridian deal through legal.', 'Completed', nowIso);
    insRev.run('rev_3', 'emp_elena', 'Claire Bennett', 'Q4 2026', 4.7, 99, 104, 'Maintained sub-12m Messenger SLA across all consultation campaigns.', 'Completed', nowIso);
  }
}

function seedTikTokIfEmpty(): void {
  const now = new Date();
  const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const futureIso = (minutesAhead = 15) => new Date(now.getTime() + minutesAhead * 60_000).toISOString();

  const existingConn = db.prepare('SELECT id FROM tiktok_connections WHERE id = ?').get('tiktok_primary');
  if (!existingConn) {
    db.prepare(`
      INSERT INTO tiktok_connections (id, organization_id, status, advertiser_id, account_name, tiktok_handle, access_token, token_expires_at, last_synced_at, updated_at)
      VALUES (?, ?, 'Disconnected', ?, ?, ?, NULL, NULL, NULL, ?)
    `).run('tiktok_primary', 'org_northline', 'adv_pending_oauth', 'Northline TikTok Business', '@northline.official', iso(0));
  }

  const existingCampaign = db.prepare('SELECT id FROM campaigns WHERE id = ?').get('cmp_tiktok_spark');
  if (!existingCampaign) {
    db.prepare(`
      INSERT INTO campaigns (id, name, platform, objective, status, daily_budget, spend, impressions, clicks, leads_count, roas, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('cmp_tiktok_spark', 'TikTok Spark Ads — Direct DM & Lead Capture', 'TikTok', 'Lead Generation', 'Active', 260, 3640, 294500, 7420, 78, 4.9, iso(9));
  }

  const existingTikTokRule = db.prepare('SELECT id FROM assignment_rules WHERE id = ?').get('rule_tiktok_dm');
  if (!existingTikTokRule) {
    db.prepare(`
      INSERT INTO assignment_rules (id, name, channel, platform, campaign_id, strategy, target_employee_id, target_department_id, priority_override, is_active, sort_order, created_at)
      VALUES (?, ?, 'Any', 'TikTok', 'Any', 'least_loaded', NULL, 'dept_sales', 'High', 1, 4, ?)
    `).run('rule_tiktok_dm', 'TikTok Messages & Leads → Inbound Revenue', iso(0));
  }

  const existingTikTokQueries = db
    .prepare(`SELECT COUNT(*) AS cnt FROM queries WHERE platform = 'TikTok'`)
    .get() as { cnt: number };

  if (Number(existingTikTokQueries?.cnt || 0) === 0) {
    const insQry = db.prepare(`
      INSERT INTO queries (id, campaign_id, assigned_employee_id, assigned_rule_name, customer_name, customer_handle, customer_email, customer_phone, channel, platform, ad_creative_id, ad_creative_name, ad_creative_format, ad_set_name, priority, status, subject, message_preview, messages_json, sla_due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TikTok', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insQry.run(
      'qry_tk_201',
      'cmp_tiktok_spark',
      'emp_marcus',
      'TikTok Messages & Leads → Inbound Revenue',
      'Chloe Watanabe',
      '@chloe.studio.sf',
      'chloe@studiowatanabe.co',
      '+1 (415) 609-4418',
      'TikTok DM',
      'cr_tk_spark_01',
      '22s Founder Walkthrough Spark Ad',
      'TikTok Spark Video · 9:16',
      'US E-Commerce Founders 22–44',
      'Urgent',
      'In Progress',
      'TikTok DM from Spark Ad — 14-seat team onboarding',
      'Sent a TikTok message asking about instant TikTok DM + Meta Inbox routing.',
      JSON.stringify([
        {
          id: 'm1',
          sender: 'customer',
          author: 'Chloe Watanabe',
          body: 'Hey! Just watched your TikTok Spark Ad. Can our sales reps answer TikTok DMs and Instagram DMs from one unified inbox?',
          timestamp: iso(11),
        },
        {
          id: 'm2',
          sender: 'agent',
          author: 'Marcus Alvarez',
          body: 'Hi Chloe! Yes—TikTok Direct Messages, TikTok Lead Forms, Instagram DMs, Messenger, and Facebook Lead Ads all land in our single Omnichannel Inbox.',
          timestamp: iso(5),
        },
      ]),
      futureIso(10),
      iso(11),
      iso(5)
    );

    insQry.run(
      'qry_tk_202',
      'cmp_tiktok_spark',
      null,
      null,
      'Noah Sterling',
      '@noahsterling.hq',
      'noah@sterlingretail.com',
      '+1 (312) 488-9102',
      'TikTok Lead',
      'cr_tk_spark_02',
      'Retail Margin Calculator — TikTok In-Feed',
      'TikTok Instant Form · 9:16',
      'Multi-Location Retail Ops',
      'High',
      'New',
      'TikTok Lead Form — Q4 multi-store rollout pricing',
      'Submitted TikTok Instant Lead Form requesting enterprise rollout quote.',
      JSON.stringify([
        {
          id: 'm1',
          sender: 'customer',
          author: 'Noah Sterling',
          body: 'Submitted our team details via your TikTok ad form—looking for Q4 wholesale + omnichannel CRM pricing for 9 stores.',
          timestamp: iso(3),
        },
      ]),
      futureIso(12),
      iso(3),
      iso(3)
    );
  }
}

