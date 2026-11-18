export type WorkspaceTab = 'overview' | 'meta' | 'pipeline' | 'hrms' | 'organization';

export type QueryChannel =
  | 'Lead Form'
  | 'Instagram DM'
  | 'Messenger'
  | 'Ad Comment'
  | 'TikTok DM'
  | 'TikTok Lead';
export type QueryPlatform = 'Facebook' | 'Instagram' | 'TikTok';
export type QueryStatus = 'New' | 'In Progress' | 'Replied' | 'Qualified' | 'Resolved';
export type QueryPriority = 'Urgent' | 'High' | 'Standard';

export type LeadStage = 'New Lead' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Closed Lost';

export type EmployeeRole = string;

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

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: RolePermissions;
  createdAt: string;
}

export interface AssignmentRule {
  id: string;
  name: string;
  channel: 'Any' | QueryChannel;
  platform: 'Any' | QueryPlatform;
  campaign_id: string;
  campaign_name?: string | null;
  strategy: 'specific_agent' | 'least_loaded' | 'round_robin';
  target_employee_id: string | null;
  target_employee_name?: string | null;
  target_department_id: string | null;
  target_department_name?: string | null;
  priority_override: 'Keep' | QueryPriority;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type DashboardKpiId =
  | 'total_leads'
  | 'conversion_rate'
  | 'active_campaigns'
  | 'ad_spend'
  | 'roas'
  | 'team_deals_closed';

export type DashboardWidgetId =
  | 'campaign_roas_chart'
  | 'funnel_channel_chart'
  | 'employee_performance_chart'
  | 'priority_queries';

export interface DashboardPreferences {
  kpiOrder: DashboardKpiId[];
  hiddenKpis: DashboardKpiId[];
  visibleWidgets: DashboardWidgetId[];
  updatedAt?: string;
}

export interface QueryMessage {
  id: string;
  sender: 'customer' | 'agent';
  author: string;
  body: string;
  timestamp: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  website: string;
  timezone: string;
  meta_business_id: string;
  sla_target_minutes: number;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  head_employee_id: string | null;
  head_name?: string | null;
  routing_channel: QueryChannel;
  description: string;
  member_count?: number;
  created_at: string;
}

export interface Employee {
  id: string;
  organization_id: string;
  department_id: string;
  role_id?: string | null;
  department_name?: string;
  full_name: string;
  email: string;
  role: EmployeeRole;
  title: string;
  status: 'Active' | 'Away';
  max_capacity: number;
  monthly_quota: number;
  active_queries?: number;
  leads_contacted?: number;
  deals_closed?: number;
  won_revenue?: number;
  base_salary?: number;
  employment_type?: string;
  hire_date?: string;
  leave_balance?: number;
  work_location?: string;
  created_at: string;
}

export interface MetaStatusResponse {
  configured: boolean;
  redirectUri: string;
  webhookUrl: string;
  connection: {
    id: string;
    status: 'Connected' | 'Disconnected';
    businessName: string;
    adAccountId: string;
    pageId: string;
    pageName: string;
    instagramHandle: string;
    lastSyncedAt: string | null;
  } | null;
}

export interface TikTokStatusResponse {
  configured: boolean;
  redirectUri: string;
  webhookUrl: string;
  connection: {
    id: string;
    status: 'Connected' | 'Disconnected';
    accountName: string;
    advertiserId: string;
    tiktokHandle: string;
    lastSyncedAt: string | null;
  } | null;
}

export interface AdCampaign {
  id: string;
  name: string;
  platform: string;
  objective: string;
  status: 'Active' | 'Paused';
  daily_budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads_count: number;
  roas: number;
  updated_at: string;
}

export interface MetaQuery {
  id: string;
  campaign_id: string | null;
  campaign_name?: string | null;
  campaign_objective?: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name?: string | null;
  assigned_rule_name?: string | null;
  customer_name: string;
  customer_handle: string;
  customer_email: string;
  customer_phone: string;
  channel: QueryChannel;
  platform: QueryPlatform;
  ad_creative_id?: string | null;
  ad_creative_name?: string | null;
  ad_creative_format?: string | null;
  ad_set_name?: string | null;
  priority: QueryPriority;
  status: QueryStatus;
  subject: string;
  message_preview: string;
  messages_json: string;
  sla_due_at: string;
  created_at: string;
  updated_at: string;
}

export interface CrmLead {
  id: string;
  query_id: string | null;
  campaign_id: string | null;
  campaign_name?: string | null;
  owner_id: string | null;
  owner_name?: string | null;
  contact_name: string;
  company: string;
  email: string;
  phone: string;
  source_channel: string;
  stage: LeadStage;
  deal_value: number;
  probability: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_name: string;
  summary: string;
  created_at: string;
}

export interface DashboardSummary {
  metrics: {
    totalSpend: number;
    totalLeadsFromAds: number;
    totalCrmLeads: number;
    conversionRate: number;
    activeCampaigns: number;
    avgRoas: number;
    openQueries: number;
    unassignedQueries: number;
    pipelineValue: number;
    wonRevenue: number;
    totalDealsClosed: number;
    totalLeadsContacted: number;
    totalEmployees: number;
    totalDepartments: number;
  };
  charts: {
    channelBreakdown: Array<{ channel: string; count: number }>;
    platformBreakdown: Array<{ platform: string; count: number }>;
    funnelStages: Array<{ label: string; count: number }>;
    employeePerformance: Array<{
      id: string;
      name: string;
      role: string;
      leadsContacted: number;
      dealsClosed: number;
      wonRevenue: number;
    }>;
  };
  recentActivities: ActivityLog[];
}

export interface HrmsAttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_title: string;
  department_name: string;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  work_mode: 'On-Site' | 'Remote' | 'Hybrid';
  status: 'Present' | 'Remote' | 'Late';
  hours_worked: number;
}

export interface HrmsLeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_balance: number;
  department_name: string;
  leave_type: 'Annual' | 'Sick' | 'Personal' | 'Parental';
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  reviewed_by: string | null;
  created_at: string;
}

export interface HrmsPayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_title: string;
  department_name: string;
  pay_period: string;
  base_salary: number;
  crm_commission: number;
  bonus: number;
  deductions: number;
  net_pay: number;
  status: 'Scheduled' | 'Paid';
  paid_at: string | null;
}

export interface HrmsReviewRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_title: string;
  department_name: string;
  reviewer_name: string;
  review_cycle: string;
  rating: number;
  attendance_score: number;
  crm_attainment_pct: number;
  summary: string;
  status: string;
  created_at: string;
}

export interface HrmsOverviewResponse {
  metrics: {
    totalHeadcount: number;
    presentToday: number;
    pendingLeaves: number;
    monthlyPayrollTotal: number;
    avgRating: number;
  };
  attendance: HrmsAttendanceRecord[];
  leaves: HrmsLeaveRequest[];
  payroll: HrmsPayrollRecord[];
  reviews: HrmsReviewRecord[];
}

