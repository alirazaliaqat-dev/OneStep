import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { X } from 'lucide-react';
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
  QueryChannel,
  QueryPlatform,
  QueryStatus,
  RolePermissions,
  RoleRecord,
  TikTokStatusResponse,
  WorkspaceTab,
} from './types/crm';
import { crmApi, setActiveApiRoleId } from './services/api';
import { Sidebar, type SidebarSectionKey } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MobileNav } from './components/layout/MobileNav';
import { WorkspaceSettingsDrawer } from './components/layout/WorkspaceSettingsDrawer';
import { OverviewView } from './components/views/OverviewView';
import { MetaInboxView, type MetaSubTab } from './components/views/MetaInboxView';
import { PipelineView } from './components/views/PipelineView';
import { HrmsView } from './components/views/HrmsView';
import { OrganizationView } from './components/views/OrganizationView';
import { triggerHaptic } from './utils/haptics';

const FALLBACK_PERMISSIONS: RolePermissions = {
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

const DEFAULT_PREFERENCES: DashboardPreferences = {
  kpiOrder: [
    'total_leads',
    'conversion_rate',
    'active_campaigns',
    'ad_spend',
    'roas',
    'team_deals_closed',
  ],
  hiddenKpis: [],
  visibleWidgets: [
    'campaign_roas_chart',
    'funnel_channel_chart',
    'employee_performance_chart',
    'priority_queries',
  ],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [metaSubTab, setMetaSubTab] = useState<MetaSubTab>('queries');
  const [orgSubTab, setOrgSubTab] = useState<'employees' | 'departments' | 'roles'>('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);
  const [metaStatus, setMetaStatus] = useState<MetaStatusResponse | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<TikTokStatusResponse | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [queries, setQueries] = useState<MetaQuery[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>([]);
  const [hrms, setHrms] = useState<HrmsOverviewResponse | null>(null);
  const [activeRoleId, setActiveRoleId] = useState<string>('role_admin');

  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logQueryOpen, setLogQueryOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [requestLeaveOpen, setRequestLeaveOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadWorkspace = useCallback(async () => {
    try {
      const [
        sum,
        prefs,
        meta,
        tiktok,
        camps,
        qrys,
        lds,
        org,
        depts,
        emps,
        roleList,
        rules,
        hrmsData,
      ] = await Promise.all([
        crmApi.getDashboardSummary(),
        crmApi.getDashboardPreferences(),
        crmApi.getMetaStatus(),
        crmApi.getTikTokStatus(),
        crmApi.getCampaigns(),
        crmApi.getQueries(),
        crmApi.getLeads(),
        crmApi.getOrganization(),
        crmApi.getDepartments(),
        crmApi.getEmployees(),
        crmApi.getRoles(),
        crmApi.getAssignmentRules(),
        crmApi.getHrmsOverview(),
      ]);

      setSummary(sum);
      setPreferences(prefs);
      setMetaStatus(meta);
      setTiktokStatus(tiktok);
      setCampaigns(camps);
      setQueries(qrys);
      setLeads(lds);
      setOrganization(org);
      setDepartments(depts);
      setEmployees(emps);
      setRoles(roleList);
      setAssignmentRules(rules);
      setHrms(hrmsData);
      setSelectedQueryId((prev) => prev || qrys[0]?.id || null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const activeRole: RoleRecord = useMemo(() => {
    return (
      roles.find((r) => r.id === activeRoleId) ||
      roles[0] || {
        id: 'role_admin',
        name: 'Administrator',
        description: 'Full access',
        isSystem: true,
        permissions: FALLBACK_PERMISSIONS,
        createdAt: '',
      }
    );
  }, [roles, activeRoleId]);

  const handleNavigateSection = useCallback((tab: WorkspaceTab, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'meta' && (subTab === 'queries' || subTab === 'campaigns' || subTab === 'rules')) {
      setMetaSubTab(subTab);
    }
    if (
      tab === 'organization' &&
      (subTab === 'employees' || subTab === 'departments' || subTab === 'roles')
    ) {
      setOrgSubTab(subTab);
    }
  }, []);

  const handleChangeActiveRole = (roleId: string) => {
    setActiveRoleId(roleId);
    setActiveApiRoleId(roleId);
    const chosen = roles.find((r) => r.id === roleId);
    if (chosen) {
      if (!chosen.permissions.dataAccess.viewOrganization && activeTab === 'organization') {
        setActiveTab('overview');
      }
      if (!chosen.permissions.dataAccess.viewCampaigns && activeTab === 'meta' && metaSubTab === 'campaigns') {
        setMetaSubTab('queries');
      }
      if (!chosen.permissions.modifications.manageAssignmentRules && activeTab === 'meta' && metaSubTab === 'rules') {
        setMetaSubTab('queries');
      }
      if (!chosen.permissions.modifications.manageRoles && activeTab === 'organization' && orgSubTab === 'roles') {
        setOrgSubTab('employees');
      }
      notify(`Switched active access view to ${chosen.name}.`);
    }
  };

  // Scope queries & leads dynamically when an Agent or scoped Custom Role is active
  const scopedQueries = useMemo(() => {
    const scope = activeRole.permissions.dataAccess.queriesScope;
    if (scope === 'assigned') {
      const sampleAgent = employees.find((e) => e.role === 'Agent') || employees[0];
      return sampleAgent
        ? queries.filter((q) => q.assigned_employee_id === sampleAgent.id)
        : queries;
    }
    return queries;
  }, [queries, activeRole, employees]);

  const scopedLeads = useMemo(() => {
    const scope = activeRole.permissions.dataAccess.leadsScope;
    if (scope === 'assigned') {
      const sampleAgent = employees.find((e) => e.role === 'Agent') || employees[0];
      return sampleAgent ? leads.filter((l) => l.owner_id === sampleAgent.id) : leads;
    }
    return leads;
  }, [leads, activeRole, employees]);

  // Listen for Meta & TikTok OAuth popup callback postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        triggerHaptic('success');
        const label = event.data?.provider === 'tiktok' ? 'TikTok Business' : 'Meta Business';
        notify(`${label} connected and synced.`);
        loadWorkspace();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        triggerHaptic('warning');
        notify(event.data.error || 'Channel authorization was cancelled.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadWorkspace, notify]);

  const handleConnectMeta = async () => {
    try {
      const { url } = await crmApi.getMetaAuthUrl();
      const popup = window.open(url, 'meta_oauth', 'width=640,height=740');
      if (!popup) {
        triggerHaptic('warning');
        notify('Please enable popups in your browser to authorize Meta Business.');
      }
    } catch (err) {
      triggerHaptic('warning');
      setSettingsOpen(true);
      notify(
        err instanceof Error
          ? err.message
          : 'Configure META_APP_ID & META_APP_SECRET in secrets to launch Meta OAuth.'
      );
    }
  };

  const handleConnectTikTok = async () => {
    try {
      const { url } = await crmApi.getTikTokAuthUrl();
      const popup = window.open(url, 'tiktok_oauth', 'width=640,height=740');
      if (!popup) {
        triggerHaptic('warning');
        notify('Please enable popups in your browser to authorize TikTok Business.');
      }
    } catch (err) {
      triggerHaptic('warning');
      setSettingsOpen(true);
      notify(
        err instanceof Error
          ? err.message
          : 'Configure TIKTOK_CLIENT_KEY & TIKTOK_CLIENT_SECRET in secrets to launch TikTok OAuth.'
      );
    }
  };

  const handleSyncMeta = async () => {
    setSyncing(true);
    try {
      if (metaStatus?.connection?.status === 'Connected') {
        const res = await crmApi.syncMeta();
        triggerHaptic('success');
        notify(
          `Synced ${res.result.campaignsSynced} Meta campaigns and imported ${res.result.leadsImported || 0} inquiries.`
        );
      } else {
        triggerHaptic('light');
        notify('Workspace refreshed. Link Meta Business in Channels & Setup for live Graph API sync.');
      }
      await loadWorkspace();
    } catch (err) {
      triggerHaptic('warning');
      notify(err instanceof Error ? err.message : 'Meta sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncTikTok = async () => {
    setSyncing(true);
    try {
      if (tiktokStatus?.connection?.status === 'Connected') {
        const res = await crmApi.syncTikTok();
        triggerHaptic('success');
        notify(
          `Synced ${res.result.messagesImported || 0} messages from ${res.result.tiktokHandle || 'TikTok Business'}.`
        );
      } else {
        triggerHaptic('light');
        notify('Workspace refreshed. Link TikTok Business in Channels & Setup for live message sync.');
      }
      await loadWorkspace();
    } catch (err) {
      triggerHaptic('warning');
      notify(err instanceof Error ? err.message : 'TikTok sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllChannels = async () => {
    setSyncing(true);
    try {
      const syncedLabels: string[] = [];
      if (metaStatus?.connection?.status === 'Connected') {
        await crmApi.syncMeta();
        syncedLabels.push('Meta');
      }
      if (tiktokStatus?.connection?.status === 'Connected') {
        await crmApi.syncTikTok();
        syncedLabels.push('TikTok');
      }
      await loadWorkspace();
      triggerHaptic(syncedLabels.length > 0 ? 'success' : 'light');
      notify(
        syncedLabels.length > 0
          ? `Synced live queries from ${syncedLabels.join(' & ')}.`
          : 'Workspace refreshed across Meta & TikTok.'
      );
    } catch (err) {
      triggerHaptic('warning');
      notify(err instanceof Error ? err.message : 'Channel sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectMeta = async () => {
    await crmApi.disconnectMeta();
    triggerHaptic('medium');
    notify('Disconnected Meta Business account.');
    await loadWorkspace();
  };

  const handleDisconnectTikTok = async () => {
    await crmApi.disconnectTikTok();
    triggerHaptic('medium');
    notify('Disconnected TikTok Business account.');
    await loadWorkspace();
  };

  const handleAssignQuery = async (queryId: string, employeeId: string | null) => {
    await crmApi.updateQuery(queryId, {
      assigned_employee_id: employeeId,
      status: employeeId ? 'In Progress' : 'New',
    });
    triggerHaptic('medium');
    notify(employeeId ? 'Query assigned to specialist.' : 'Query unassigned.');
    await loadWorkspace();
  };

  const handleUpdateQueryStatus = async (queryId: string, status: QueryStatus) => {
    await crmApi.updateQuery(queryId, { status });
    triggerHaptic('selection');
    notify(`Query marked as ${status}.`);
    await loadWorkspace();
  };

  const handleSendReply = async (queryId: string, body: string, authorName: string) => {
    await crmApi.replyToQuery(queryId, { body, author_name: authorName });
    triggerHaptic('success');
    notify('Reply sent and logged.');
    await loadWorkspace();
  };

  const handlePrimaryAction = () => {
    if (activeTab === 'overview') {
      handleSyncAllChannels();
    } else if (activeTab === 'meta') {
      setLogQueryOpen(true);
    } else if (activeTab === 'pipeline') {
      setCreateLeadOpen(true);
    } else if (activeTab === 'hrms') {
      setRequestLeaveOpen(true);
    } else if (activeTab === 'organization') {
      if (!activeRole.permissions.modifications.manageTeam) {
        triggerHaptic('warning');
        notify(`${activeRole.name} role cannot add organization members.`);
        return;
      }
      setAddMemberOpen(true);
    }
  };

  const activeSection: SidebarSectionKey = useMemo(() => {
    if (activeTab === 'meta') {
      if (metaSubTab === 'campaigns') return 'meta:campaigns';
      if (metaSubTab === 'rules') return 'meta:rules';
      return 'meta:queries';
    }
    if (activeTab === 'organization') {
      return orgSubTab === 'roles' ? 'organization:roles' : 'organization:employees';
    }
    if (activeTab === 'pipeline') return 'pipeline';
    if (activeTab === 'hrms') return 'hrms';
    return 'overview';
  }, [activeTab, metaSubTab, orgSubTab]);

  const openQueriesCount = scopedQueries.filter((q) => q.status !== 'Resolved').length;
  const pendingLeavesCount = hrms?.metrics?.pendingLeaves || 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen ambient-mesh text-black flex overflow-x-clip">
        {/* Refractive color-depth orbs behind Liquid Glass panels */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="ambient-orb-1 absolute -top-24 -left-16 w-[460px] h-[460px] rounded-full blur-3xl" />
          <div className="ambient-orb-2 absolute top-[18%] right-[-8%] w-[520px] h-[520px] rounded-full blur-3xl" />
          <div className="ambient-orb-3 absolute bottom-[-18%] left-[26%] w-[540px] h-[540px] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex w-full min-w-0">
          <Sidebar
            activeSection={activeSection}
            onNavigateSection={handleNavigateSection}
            openQueriesCount={openQueriesCount}
            pendingLeavesCount={pendingLeavesCount}
            organization={organization}
            metaStatus={metaStatus}
            tiktokStatus={tiktokStatus}
            roles={roles}
            activeRole={activeRole}
            activeRoleId={activeRoleId}
            onChangeActiveRole={handleChangeActiveRole}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <div className="flex-1 min-w-0 flex flex-col">
          <TopBar
            activeTab={activeTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPrimaryAction={handlePrimaryAction}
            onOpenSettings={() => setSettingsOpen(true)}
            isSyncing={syncing}
          />

          <main className="flex-1 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-24 lg:px-6 lg:pb-6 max-w-[1400px] w-full mx-auto">
            {loading ? (
              <div className="space-y-5" aria-busy="true" aria-label="Loading workspace">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div
                      key={item}
                      className="glass-panel rounded-3xl p-5 h-[126px] animate-pulse"
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  <div className="xl:col-span-7 glass-panel rounded-3xl h-[340px] animate-pulse" />
                  <div className="xl:col-span-5 glass-panel rounded-3xl h-[340px] animate-pulse" />
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeTab === 'overview' && (
                    <OverviewView
                      summary={summary}
                      preferences={preferences}
                      onSavePreferences={async (next) => {
                        setPreferences(next);
                        await crmApi.saveDashboardPreferences(next);
                      }}
                      permissions={activeRole.permissions}
                      activeRole={activeRole}
                      campaigns={campaigns}
                      queries={scopedQueries}
                      leads={scopedLeads}
                      employees={employees}
                      metaStatus={metaStatus}
                      tiktokStatus={tiktokStatus}
                      searchQuery={searchQuery}
                      onNavigate={handleNavigateSection}
                      onInspectQuery={(id) => {
                        setSelectedQueryId(id);
                        setMetaSubTab('queries');
                        setActiveTab('meta');
                      }}
                      onAssignQuery={handleAssignQuery}
                      onUpdateQueryStatus={handleUpdateQueryStatus}
                      onSendReply={handleSendReply}
                      onConvertToLead={async (queryId, company, dealValue) => {
                        const res = await crmApi.convertQueryToLead(queryId, {
                          company,
                          deal_value: dealValue,
                        });
                        triggerHaptic('success');
                        notify(
                          res.alreadyConverted
                            ? 'Deal already exists in CRM Pipeline.'
                            : 'Converted inquiry into CRM Deal.'
                        );
                        await loadWorkspace();
                      }}
                      onConnectMeta={handleConnectMeta}
                      onConnectTikTok={handleConnectTikTok}
                    />
                  )}

                  {activeTab === 'meta' && (
                    <MetaInboxView
                      queries={scopedQueries}
                      campaigns={campaigns}
                      employees={employees}
                      assignmentRules={assignmentRules}
                      permissions={activeRole.permissions}
                      metaStatus={metaStatus}
                      tiktokStatus={tiktokStatus}
                      requestedSubTab={metaSubTab}
                      onSubTabChange={setMetaSubTab}
                      selectedQueryId={selectedQueryId}
                      onSelectQueryId={setSelectedQueryId}
                      searchQuery={searchQuery}
                      logDrawerOpen={logQueryOpen}
                      onCloseLogDrawer={() => setLogQueryOpen(false)}
                      onAssignQuery={handleAssignQuery}
                      onUpdateQueryStatus={handleUpdateQueryStatus}
                      onSendReply={handleSendReply}
                      onConvertToLead={async (queryId, company, dealValue) => {
                        const res = await crmApi.convertQueryToLead(queryId, {
                          company,
                          deal_value: dealValue,
                        });
                        triggerHaptic('success');
                        notify(
                          res.alreadyConverted
                            ? 'Deal already exists in CRM Pipeline.'
                            : 'Converted Meta inquiry into CRM Deal.'
                        );
                        await loadWorkspace();
                      }}
                      onCreateQuery={async (payload: {
                        customer_name: string;
                        customer_handle: string;
                        customer_email: string;
                        customer_phone: string;
                        channel: QueryChannel;
                        platform: QueryPlatform;
                        ad_creative_name: string;
                        ad_creative_format: string;
                        ad_set_name: string;
                        priority: string;
                        campaign_id: string;
                        subject: string;
                        message: string;
                        auto_assign: boolean;
                      }) => {
                        const created = await crmApi.createQuery(payload);
                        triggerHaptic('success');
                        setSelectedQueryId(created.id);
                        notify(
                          created.assigned_employee_name
                            ? `Imported inquiry & auto-assigned to ${created.assigned_employee_name}.`
                            : 'Imported Meta ad inquiry.'
                        );
                        await loadWorkspace();
                      }}
                      onRunAutoAssign={async () => {
                        const res = await crmApi.autoAssignQueries();
                        triggerHaptic('success');
                        notify(
                          res.assignedCount > 0
                            ? `Auto-assigned ${res.assignedCount} unassigned Meta inquiries.`
                            : 'All open Meta inquiries are already assigned.'
                        );
                        await loadWorkspace();
                      }}
                      onCreateRule={async (payload) => {
                        await crmApi.createAssignmentRule(payload);
                        triggerHaptic('success');
                        notify(`Created rule "${payload.name}".`);
                        await loadWorkspace();
                      }}
                      onToggleRule={async (rule) => {
                        await crmApi.updateAssignmentRule(rule.id, { is_active: !rule.is_active });
                        triggerHaptic('selection');
                        notify(`Rule "${rule.name}" ${!rule.is_active ? 'enabled' : 'paused'}.`);
                        await loadWorkspace();
                      }}
                      onDeleteRule={async (id) => {
                        await crmApi.deleteAssignmentRule(id);
                        triggerHaptic('warning');
                        notify('Assignment rule removed.');
                        await loadWorkspace();
                      }}
                      onToggleCampaignStatus={async (camp) => {
                        const nextStatus = camp.status === 'Active' ? 'Paused' : 'Active';
                        await crmApi.updateCampaign(camp.id, { status: nextStatus });
                        triggerHaptic('medium');
                        notify(`${camp.name} is now ${nextStatus}.`);
                        await loadWorkspace();
                      }}
                      onConnectMeta={handleConnectMeta}
                      onSyncMeta={handleSyncMeta}
                      onConnectTikTok={handleConnectTikTok}
                      onSyncTikTok={handleSyncTikTok}
                    />
                  )}

                  {activeTab === 'pipeline' && (
                    <PipelineView
                      leads={scopedLeads}
                      employees={employees}
                      campaigns={campaigns}
                      searchQuery={searchQuery}
                      createDrawerOpen={createLeadOpen}
                      onCloseCreateDrawer={() => setCreateLeadOpen(false)}
                      onCreateLead={async (payload) => {
                        await crmApi.createLead(payload);
                        triggerHaptic('success');
                        notify('Lead added to CRM Pipeline.');
                        await loadWorkspace();
                      }}
                      onUpdateLead={async (id, payload) => {
                        await crmApi.updateLead(id, payload);
                        triggerHaptic('medium');
                        notify('Deal updated.');
                        await loadWorkspace();
                      }}
                      onDeleteLead={async (id) => {
                        await crmApi.deleteLead(id);
                        triggerHaptic('warning');
                        notify('Deal removed from pipeline.');
                        await loadWorkspace();
                      }}
                    />
                  )}

                  {activeTab === 'hrms' && (
                    <HrmsView
                      hrms={hrms}
                      employees={employees}
                      permissions={activeRole.permissions}
                      searchQuery={searchQuery}
                      requestLeaveOpen={requestLeaveOpen}
                      onCloseRequestLeave={() => setRequestLeaveOpen(false)}
                      onOpenRequestLeave={() => setRequestLeaveOpen(true)}
                      onClockAttendance={async (payload) => {
                        await crmApi.clockAttendance(payload);
                        triggerHaptic('success');
                        notify(
                          payload.action === 'in'
                            ? `Clocked in (${payload.work_mode}).`
                            : 'Clocked out and logged shift hours.'
                        );
                        await loadWorkspace();
                      }}
                      onCreateLeave={async (payload) => {
                        await crmApi.createLeaveRequest(payload);
                        triggerHaptic('success');
                        notify('Leave request submitted for approval.');
                        await loadWorkspace();
                      }}
                      onUpdateLeaveStatus={async (id, status) => {
                        await crmApi.updateLeaveStatus(id, {
                          status,
                          reviewed_by: `${activeRole.name} Desk`,
                        });
                        triggerHaptic(status === 'Approved' ? 'success' : 'warning');
                        notify(`Leave request ${status.toLowerCase()}.`);
                        await loadWorkspace();
                      }}
                      onRunPayroll={async (period) => {
                        await crmApi.runPayroll(period);
                        triggerHaptic('success');
                        notify(`Payroll processed for ${period} with live CRM commissions.`);
                        await loadWorkspace();
                      }}
                      onCreateReview={async (payload) => {
                        await crmApi.createReview(payload);
                        triggerHaptic('success');
                        notify(`Logged ${payload.review_cycle} performance review.`);
                        await loadWorkspace();
                      }}
                    />
                  )}

                  {activeTab === 'organization' && (
                    <OrganizationView
                      organization={organization}
                      departments={departments}
                      employees={employees}
                      roles={roles}
                      activeRole={activeRole}
                      requestedSubTab={orgSubTab}
                      onSubTabChange={setOrgSubTab}
                      searchQuery={searchQuery}
                      addMemberOpen={addMemberOpen}
                      onCloseAddMember={() => setAddMemberOpen(false)}
                      onUpdateOrganization={async (payload) => {
                        await crmApi.updateOrganization(payload);
                        triggerHaptic('success');
                        notify('Organization profile saved.');
                        await loadWorkspace();
                      }}
                      onCreateDepartment={async (payload) => {
                        await crmApi.createDepartment(payload);
                        triggerHaptic('success');
                        notify(`Created ${payload.name} department.`);
                        await loadWorkspace();
                      }}
                      onCreateEmployee={async (payload) => {
                        await crmApi.createEmployee(payload);
                        triggerHaptic('success');
                        notify(`Added ${payload.full_name} to team.`);
                        await loadWorkspace();
                      }}
                      onUpdateEmployee={async (id, payload) => {
                        await crmApi.updateEmployee(id, payload);
                        triggerHaptic('success');
                        notify('Employee record updated.');
                        await loadWorkspace();
                      }}
                      onDeleteEmployee={async (id) => {
                        await crmApi.deleteEmployee(id);
                        triggerHaptic('warning');
                        notify('Employee removed from directory.');
                        await loadWorkspace();
                      }}
                      onCreateRole={async (payload) => {
                        await crmApi.createRole(payload);
                        triggerHaptic('success');
                        notify(`Created custom role "${payload.name}".`);
                        await loadWorkspace();
                      }}
                      onUpdateRole={async (id, perms) => {
                        await crmApi.updateRole(id, { permissions: perms });
                        triggerHaptic('selection');
                        notify('Updated role permissions.');
                        await loadWorkspace();
                      }}
                      onDeleteRole={async (id) => {
                        await crmApi.deleteRole(id);
                        if (activeRoleId === id) {
                          handleChangeActiveRole('role_admin');
                        }
                        triggerHaptic('warning');
                        notify('Removed custom role.');
                        await loadWorkspace();
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>

          {/* Desktop Sticky Liquid Glass Footer */}
          <footer
            aria-label="Workspace Sticky Footer"
            className="hidden lg:flex sticky bottom-0 z-30 px-6 pb-3 pt-1 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[1400px] mx-auto glass-sheet rounded-2xl px-4 py-2 flex items-center justify-between gap-4 text-[12px] text-black">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-semibold text-black truncate">
                  {organization?.name || 'Clearline CRM'}
                </span>
                <span className="text-black/45">·</span>
                <span className="text-black/70 truncate">
                  {activeRole.name} · {openQueriesCount} open omnichannel chats ·{' '}
                  {metaStatus?.connection?.status === 'Connected' ? 'Meta Live' : 'Meta Ready'} ·{' '}
                  {tiktokStatus?.connection?.status === 'Connected' ? 'TikTok Live' : 'TikTok Ready'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {(
                  [
                    ['overview', 'Overview'],
                    ['meta', 'Chats'],
                    ['pipeline', 'Pipeline'],
                    ['hrms', 'HRMS'],
                  ] as const
                ).map(([tabKey, label]) => {
                  const active = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        handleNavigateSection(tabKey);
                      }}
                      className={`px-3 py-1 rounded-xl text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#0F0F0F] text-[#F8F8F8] border border-[#5DD62C]/35'
                          : 'text-black/75 hover:text-black hover:bg-[#F8F8F8]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </footer>
        </div>
        </div>

        <MobileNav
          activeTab={activeTab}
          onSelectTab={(tab) => handleNavigateSection(tab)}
          openQueriesCount={openQueriesCount}
          pendingLeavesCount={pendingLeavesCount}
          canViewOrganization={activeRole.permissions.dataAccess.viewOrganization}
        />

        <WorkspaceSettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          metaStatus={metaStatus}
          tiktokStatus={tiktokStatus}
          roles={roles}
          activeRoleId={activeRoleId}
          permissions={activeRole.permissions}
          onChangeActiveRole={handleChangeActiveRole}
          onConnectMeta={handleConnectMeta}
          onSyncMeta={handleSyncMeta}
          onDisconnectMeta={handleDisconnectMeta}
          onConnectTikTok={handleConnectTikTok}
          onSyncTikTok={handleSyncTikTok}
          onDisconnectTikTok={handleDisconnectTikTok}
          onNotify={notify}
        />

        {/* Accessible Liquid Glass Toast Announcer */}
        <div
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 pointer-events-none"
        >
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="pointer-events-auto glass-dark-anchor text-[#F8F8F8] rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm"
              >
                <span className="text-[13px] font-medium leading-snug">{toast}</span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => {
                    triggerHaptic('light');
                    setToast(null);
                  }}
                  className="text-[#5DD62C] hover:text-[#F8F8F8] whitespace-nowrap shrink-0 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
