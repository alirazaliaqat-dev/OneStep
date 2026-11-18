import type {
  AdCampaign,
  AssignmentRule,
  CrmLead,
  DashboardPreferences,
  DashboardSummary,
  Department,
  Employee,
  HrmsOverviewResponse,
  MetaQuery,
  MetaStatusResponse,
  Organization,
  RolePermissions,
  RoleRecord,
  TikTokStatusResponse,
} from '../types/crm';

let activeRoleHeaderId = 'role_admin';

export function setActiveApiRoleId(roleId: string): void {
  activeRoleHeaderId = roleId || 'role_admin';
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-role-id': activeRoleHeaderId,
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${response.status})`);
  }
  return data as T;
}

export const crmApi = {
  getDashboardSummary: () => request<DashboardSummary>('/api/dashboard/summary'),
  getDashboardPreferences: () => request<DashboardPreferences>('/api/dashboard/preferences'),
  saveDashboardPreferences: (prefs: DashboardPreferences) =>
    request<{ ok: boolean }>('/api/dashboard/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  getRoles: () => request<RoleRecord[]>('/api/roles'),
  createRole: (payload: { name: string; description: string; permissions: RolePermissions }) =>
    request<RoleRecord>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRole: (id: string, payload: Partial<{ name: string; description: string; permissions: RolePermissions }>) =>
    request<RoleRecord>(`/api/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteRole: (id: string) => request<{ ok: boolean }>(`/api/roles/${id}`, { method: 'DELETE' }),

  getAssignmentRules: () => request<AssignmentRule[]>('/api/assignment-rules'),
  createAssignmentRule: (payload: {
    name: string;
    channel: string;
    platform: string;
    campaign_id: string;
    strategy: string;
    target_employee_id?: string | null;
    target_department_id?: string | null;
    priority_override: string;
  }) =>
    request<AssignmentRule>('/api/assignment-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAssignmentRule: (id: string, payload: Partial<AssignmentRule>) =>
    request<AssignmentRule>(`/api/assignment-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAssignmentRule: (id: string) =>
    request<{ ok: boolean }>(`/api/assignment-rules/${id}`, { method: 'DELETE' }),

  getMetaStatus: () => request<MetaStatusResponse>('/api/meta/status'),
  getMetaAuthUrl: () => request<{ url: string; redirectUri: string }>('/api/meta/auth/url'),
  syncMeta: () =>
    request<{ ok: boolean; result: { campaignsSynced: number; leadsImported?: number } }>('/api/meta/sync', {
      method: 'POST',
    }),
  disconnectMeta: () => request<{ ok: boolean }>('/api/meta/disconnect', { method: 'POST' }),

  getTikTokStatus: () => request<TikTokStatusResponse>('/api/tiktok/status'),
  getTikTokAuthUrl: () => request<{ url: string; redirectUri: string }>('/api/tiktok/auth/url'),
  syncTikTok: () =>
    request<{ ok: boolean; result: { messagesImported?: number; tiktokHandle?: string } }>('/api/tiktok/sync', {
      method: 'POST',
    }),
  disconnectTikTok: () => request<{ ok: boolean }>('/api/tiktok/disconnect', { method: 'POST' }),

  getCampaigns: () => request<AdCampaign[]>('/api/campaigns'),
  updateCampaign: (id: string, payload: Partial<Pick<AdCampaign, 'status' | 'daily_budget'>>) =>
    request<AdCampaign>(`/api/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getQueries: () => request<MetaQuery[]>('/api/queries'),
  autoAssignQueries: () => request<{ ok: boolean; assignedCount: number }>('/api/queries/auto-assign', { method: 'POST' }),
  createQuery: (payload: {
    customer_name: string;
    customer_handle?: string;
    customer_email?: string;
    customer_phone?: string;
    channel: string;
    platform?: string;
    ad_creative_name?: string;
    ad_creative_format?: string;
    ad_set_name?: string;
    priority: string;
    campaign_id?: string;
    subject: string;
    message: string;
    auto_assign?: boolean;
  }) =>
    request<MetaQuery>('/api/queries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateQuery: (
    id: string,
    payload: { assigned_employee_id?: string | null; status?: string; priority?: string }
  ) =>
    request<MetaQuery>(`/api/queries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  replyToQuery: (id: string, payload: { body: string; author_name: string }) =>
    request<MetaQuery>(`/api/queries/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  convertQueryToLead: (id: string, payload: { company?: string; deal_value?: number; owner_id?: string }) =>
    request<{ lead: CrmLead; alreadyConverted: boolean }>(`/api/queries/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLeads: () => request<CrmLead[]>('/api/leads'),
  createLead: (payload: Partial<CrmLead>) =>
    request<CrmLead>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLead: (id: string, payload: Partial<CrmLead>) =>
    request<CrmLead>(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteLead: (id: string) => request<{ ok: boolean }>(`/api/leads/${id}`, { method: 'DELETE' }),

  getOrganization: () => request<Organization>('/api/organization'),
  updateOrganization: (payload: Partial<Organization>) =>
    request<Organization>('/api/organization', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getDepartments: () => request<Department[]>('/api/departments'),
  createDepartment: (payload: {
    name: string;
    head_employee_id?: string;
    routing_channel: string;
    description: string;
  }) =>
    request<Department>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getEmployees: () => request<Employee[]>('/api/employees'),
  createEmployee: (payload: {
    full_name: string;
    email: string;
    role: string;
    role_id?: string;
    title: string;
    department_id: string;
    max_capacity: number;
    monthly_quota: number;
  }) =>
    request<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateEmployee: (id: string, payload: Partial<Employee>) =>
    request<Employee>(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteEmployee: (id: string) => request<{ ok: boolean }>(`/api/employees/${id}`, { method: 'DELETE' }),

  getHrmsOverview: () => request<HrmsOverviewResponse>('/api/hrms/overview'),
  clockAttendance: (payload: { employee_id: string; work_mode: string; action: 'in' | 'out' }) =>
    request<{ ok: boolean }>('/api/hrms/attendance/clock', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createLeaveRequest: (payload: {
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) =>
    request<{ ok: boolean }>('/api/hrms/leaves', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLeaveStatus: (id: string, payload: { status: 'Approved' | 'Declined'; reviewed_by: string }) =>
    request<{ ok: boolean }>(`/api/hrms/leaves/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  runPayroll: (pay_period: string) =>
    request<{ ok: boolean }>('/api/hrms/payroll/run', {
      method: 'POST',
      body: JSON.stringify({ pay_period }),
    }),
  createReview: (payload: {
    employee_id: string;
    reviewer_name: string;
    review_cycle: string;
    rating: number;
    attendance_score: number;
    crm_attainment_pct: number;
    summary: string;
  }) =>
    request<{ ok: boolean }>('/api/hrms/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
