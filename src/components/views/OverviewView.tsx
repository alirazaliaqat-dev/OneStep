import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Link2,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  AdCampaign,
  CrmLead,
  DashboardKpiId,
  DashboardPreferences,
  DashboardSummary,
  DashboardWidgetId,
  Employee,
  MetaQuery,
  MetaStatusResponse,
  QueryStatus,
  RolePermissions,
  RoleRecord,
  TikTokStatusResponse,
  WorkspaceTab,
} from '../../types/crm';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  AppearHeading,
  GlassButton,
  RevealWidget,
  SegmentedControl,
  SlideDrawer,
} from '../ui/LiquidGlass';
import { WhatsAppInbox } from '../inbox/WhatsAppInbox';
import { triggerHaptic } from '../../utils/haptics';

interface OverviewViewProps {
  summary: DashboardSummary | null;
  preferences: DashboardPreferences;
  onSavePreferences: (next: DashboardPreferences) => Promise<void>;
  permissions: RolePermissions;
  activeRole: RoleRecord;
  campaigns: AdCampaign[];
  queries: MetaQuery[];
  leads: CrmLead[];
  employees: Employee[];
  metaStatus: MetaStatusResponse | null;
  tiktokStatus: TikTokStatusResponse | null;
  searchQuery: string;
  onNavigate: (tab: WorkspaceTab, subTab?: string) => void;
  onInspectQuery: (queryId: string) => void;
  onAssignQuery: (queryId: string, employeeId: string | null) => Promise<void>;
  onUpdateQueryStatus: (queryId: string, status: QueryStatus) => Promise<void>;
  onSendReply: (queryId: string, body: string, authorName: string) => Promise<void>;
  onConvertToLead: (queryId: string, company: string, dealValue: number) => Promise<void>;
  onConnectMeta: () => void;
  onConnectTikTok: () => void;
}

const KPI_LABELS: Record<DashboardKpiId, string> = {
  total_leads: 'Total Leads',
  conversion_rate: 'Conversion',
  active_campaigns: 'Active Ads',
  ad_spend: 'Ad Spend',
  roas: 'ROAS',
  team_deals_closed: 'Deals Won',
};

const WIDGET_LABELS: Array<{ id: DashboardWidgetId; label: string }> = [
  { id: 'campaign_roas_chart', label: 'Spend & ROAS Chart' },
  { id: 'funnel_channel_chart', label: 'Conversion Funnel' },
  { id: 'employee_performance_chart', label: 'Team Performance' },
];

type AnalyticsTab = 'roas' | 'funnel' | 'team';

export function OverviewView({
  summary,
  preferences,
  onSavePreferences,
  permissions,
  activeRole,
  campaigns,
  queries,
  employees,
  metaStatus,
  tiktokStatus,
  searchQuery,
  onNavigate,
  onInspectQuery,
  onAssignQuery,
  onUpdateQueryStatus,
  onSendReply,
  onConvertToLead,
  onConnectMeta,
  onConnectTikTok,
}: OverviewViewProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hoveredCampaignId, setHoveredCampaignId] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(queries[0]?.id || null);

  const m = summary?.metrics;
  const isMetaConnected = metaStatus?.connection?.status === 'Connected';
  const isTikTokConnected = tiktokStatus?.connection?.status === 'Connected';
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchedQueries = useMemo(() => {
    if (!normalizedSearch) return queries;
    return queries.filter(
      (q) =>
        q.customer_name.toLowerCase().includes(normalizedSearch) ||
        q.subject.toLowerCase().includes(normalizedSearch) ||
        q.channel.toLowerCase().includes(normalizedSearch) ||
        q.platform.toLowerCase().includes(normalizedSearch) ||
        (q.ad_creative_name || '').toLowerCase().includes(normalizedSearch) ||
        (q.campaign_name || '').toLowerCase().includes(normalizedSearch)
    );
  }, [queries, normalizedSearch]);

  const kpiDefinitions: Record<
    DashboardKpiId,
    { label: string; value: string; sub: string; allowed: boolean }
  > = {
    total_leads: {
      label: 'Total Leads',
      value: formatNumber((m?.totalLeadsFromAds || 0) + (m?.totalCrmLeads || 0)),
      sub: `${m?.totalCrmLeads || 0} in pipeline`,
      allowed: permissions.reporting.viewExecutiveKpis,
    },
    conversion_rate: {
      label: 'Conversion',
      value: `${m?.conversionRate || 0}%`,
      sub: `${m?.totalDealsClosed || 0} won`,
      allowed: permissions.reporting.viewExecutiveKpis,
    },
    active_campaigns: {
      label: 'Active Ads',
      value: formatNumber(m?.activeCampaigns || 0),
      sub: `${m?.openQueries || 0} open chats`,
      allowed: permissions.dataAccess.viewCampaigns,
    },
    ad_spend: {
      label: 'Ad Spend',
      value: formatCurrency(m?.totalSpend || 0),
      sub: `${formatCurrency(m?.pipelineValue || 0)} pipeline`,
      allowed: permissions.reporting.viewFinancialRoas,
    },
    roas: {
      label: 'ROAS',
      value: `${m?.avgRoas || 0}x`,
      sub: `${formatCurrency(m?.wonRevenue || 0)} won`,
      allowed: permissions.reporting.viewFinancialRoas,
    },
    team_deals_closed: {
      label: 'Deals Won',
      value: formatNumber(m?.totalDealsClosed || 0),
      sub: `${m?.totalLeadsContacted || 0} contacted`,
      allowed: permissions.reporting.viewExecutiveKpis,
    },
  };

  const orderedVisibleKpis = preferences.kpiOrder.filter(
    (id) => !preferences.hiddenKpis.includes(id) && kpiDefinitions[id]?.allowed
  );

  const isWidgetVisible = (id: DashboardWidgetId) => preferences.visibleWidgets.includes(id);

  const analyticsOptions = useMemo(() => {
    const opts: Array<{ value: AnalyticsTab; label: string }> = [];
    if (isWidgetVisible('campaign_roas_chart') && permissions.reporting.viewFinancialRoas) {
      opts.push({ value: 'roas', label: 'Spend & ROAS' });
    }
    if (isWidgetVisible('funnel_channel_chart') && permissions.reporting.viewExecutiveKpis) {
      opts.push({ value: 'funnel', label: 'Funnel' });
    }
    if (isWidgetVisible('employee_performance_chart') && permissions.reporting.viewTeamPerformance) {
      opts.push({ value: 'team', label: 'Team' });
    }
    return opts;
  }, [preferences.visibleWidgets, permissions]);

  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('roas');
  const activeAnalyticsTab: AnalyticsTab | null =
    analyticsOptions.find((o) => o.value === analyticsTab)?.value ||
    analyticsOptions[0]?.value ||
    null;

  const moveKpi = async (index: number, direction: -1 | 1) => {
    const nextOrder = [...preferences.kpiOrder];
    const target = index + direction;
    if (target < 0 || target >= nextOrder.length) return;
    const temp = nextOrder[index];
    nextOrder[index] = nextOrder[target];
    nextOrder[target] = temp;
    triggerHaptic('selection');
    setSavingPrefs(true);
    try {
      await onSavePreferences({ ...preferences, kpiOrder: nextOrder });
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleKpiVisibility = async (id: DashboardKpiId) => {
    const hidden = preferences.hiddenKpis.includes(id)
      ? preferences.hiddenKpis.filter((x) => x !== id)
      : [...preferences.hiddenKpis, id];
    triggerHaptic('light');
    setSavingPrefs(true);
    try {
      await onSavePreferences({ ...preferences, hiddenKpis: hidden });
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleWidgetVisibility = async (id: DashboardWidgetId) => {
    const visible = preferences.visibleWidgets.includes(id)
      ? preferences.visibleWidgets.filter((x) => x !== id)
      : [...preferences.visibleWidgets, id];
    triggerHaptic('light');
    setSavingPrefs(true);
    try {
      await onSavePreferences({ ...preferences, visibleWidgets: visible });
    } finally {
      setSavingPrefs(false);
    }
  };

  const maxSpend = Math.max(...campaigns.map((c) => Number(c.spend || 0)), 1);
  const maxRoas = Math.max(...campaigns.map((c) => Number(c.roas || 0)), 6);
  const hoveredCampaign = campaigns.find((c) => c.id === hoveredCampaignId) || campaigns[0] || null;

  const slotWidth = 520 / Math.max(1, campaigns.length);
  const barWidth = Math.min(36, slotWidth * 0.32);

  const roasPoints = campaigns.map((camp, i) => {
    const xBase = 64 + i * slotWidth;
    const roasH = Math.max(8, (Number(camp.roas) / maxRoas) * 136);
    return {
      id: camp.id,
      x: xBase + barWidth + 4,
      y: 168 - roasH,
    };
  });

  const roasLinePath = useMemo(() => {
    if (roasPoints.length === 0) return '';
    return roasPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      const prev = roasPoints[idx - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');
  }, [roasPoints]);

  const funnelStages = summary?.charts?.funnelStages || [];
  const maxFunnel = Math.max(...funnelStages.map((s) => s.count), 1);

  const empPerformance = summary?.charts?.employeePerformance || [];
  const maxEmpScore = Math.max(
    ...empPerformance.map((e) => Math.max(e.leadsContacted, e.dealsClosed * 2, 1)),
    1
  );

  return (
    <div className="space-y-6 text-[#08131F]">
      {/* Quiet Utility Strip (Zero Banner Bloat) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <AppearHeading as="p" className="text-[13px] font-medium text-[#08131F]/65">
          {activeRole.name} ·{' '}
          {permissions.dataAccess.queriesScope === 'all' ? 'All Channels' : 'Assigned Queue'}
        </AppearHeading>

        <div className="flex flex-wrap items-center gap-2">
          {!isMetaConnected && permissions.dataAccess.viewCampaigns && (
            <GlassButton variant="secondary" size="sm" onClick={onConnectMeta}>
              <Link2 className="w-3.5 h-3.5 text-[#2E4F6B]" />
              <span>Link Meta</span>
            </GlassButton>
          )}
          {!isTikTokConnected && permissions.dataAccess.viewCampaigns && (
            <GlassButton variant="secondary" size="sm" onClick={onConnectTikTok}>
              <Link2 className="w-3.5 h-3.5 text-[#2E4F6B]" />
              <span>Link TikTok</span>
            </GlassButton>
          )}
          {permissions.reporting.customizeDashboard && (
            <GlassButton variant="ghost" size="sm" onClick={() => setCustomizeOpen(true)}>
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#2E4F6B]" />
              <span>Customize</span>
            </GlassButton>
          )}
        </div>
      </div>

      {/* SURFACE 1: Unified Crystal-Clear Liquid Glass KPI Strip (Single Elevated Surface, Zero Clutter) */}
      {orderedVisibleKpis.length > 0 && (
        <RevealWidget
          ariaLabel="Key Performance Indicators"
          className="glass-panel rounded-[28px] overflow-hidden"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-white/55">
            {orderedVisibleKpis.map((id, idx) => {
              const kpi = kpiDefinitions[id];
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: idx * 0.03 }}
                  className="px-5 py-4 flex flex-col justify-between gap-1.5"
                >
                  <span className="text-[12px] font-medium text-[#08131F]/60 truncate">
                    {kpi.label}
                  </span>
                  <span className="text-[24px] font-semibold tracking-tight text-[#08131F] tabular-nums leading-none">
                    {kpi.value}
                  </span>
                  <span className="text-[11.5px] text-[#08131F]/55 truncate">{kpi.sub}</span>
                </motion.div>
              );
            })}
          </div>
        </RevealWidget>
      )}

      {/* SURFACE 2: Hero WhatsApp-Style Omnichannel Inbox */}
      <RevealWidget delay={0.06} ariaLabel="Omnichannel Inbox">
        <WhatsAppInbox
          compact
          layoutIdPrefix="dashboard-wa"
          title="Omnichannel Chats"
          queries={searchedQueries}
          employees={employees}
          permissions={permissions}
          activeRoleName={activeRole.name}
          selectedQueryId={selectedInboxId}
          onSelectQueryId={setSelectedInboxId}
          onAssignQuery={onAssignQuery}
          onUpdateQueryStatus={onUpdateQueryStatus}
          onSendReply={onSendReply}
          onConvertToLead={onConvertToLead}
          onInspectFullThread={onInspectQuery}
          onOpenFullInbox={() => onNavigate('meta', 'queries')}
        />
      </RevealWidget>

      {/* SURFACE 3: Single Unified Crystal-Clear Analytics Panel (Tabs eliminate multi-card clutter) */}
      {activeAnalyticsTab && (
        <RevealWidget
          delay={0.1}
          className="glass-panel rounded-[28px] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AppearHeading as="h2" className="text-[15.5px] font-semibold text-[#08131F]">
              Analytics
            </AppearHeading>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                layoutId="overview-analytics-tabs"
                ariaLabel="Analytics Charts"
                value={activeAnalyticsTab}
                onChange={setAnalyticsTab}
                options={analyticsOptions}
              />
              {activeAnalyticsTab === 'roas' && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('meta', 'campaigns')}
                >
                  <span>Campaigns</span>
                </GlassButton>
              )}
              {activeAnalyticsTab === 'team' && permissions.dataAccess.viewOrganization && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('organization', 'employees')}
                >
                  <span>Directory</span>
                </GlassButton>
              )}
            </div>
          </div>

          {/* Tab 1: Dynamic Ad Spend & ROAS SVG Graph */}
          {activeAnalyticsTab === 'roas' && (
            <div className="space-y-4">
              <svg
                viewBox="0 0 600 208"
                className="w-full h-[190px] sm:h-[210px] overflow-visible"
                role="img"
                aria-label="Campaign spend and ROAS trajectory chart"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                  const y = 168 - step * 136;
                  return (
                    <g key={step}>
                      <line
                        x1="48"
                        y1={y}
                        x2="585"
                        y2={y}
                        stroke="#08131F"
                        strokeOpacity="0.1"
                        strokeWidth="1"
                        strokeDasharray={step === 0 ? undefined : '4 4'}
                      />
                      <text
                        x="40"
                        y={y + 4}
                        textAnchor="end"
                        fill="#08131F"
                        opacity="0.55"
                        fontSize="10"
                        className="tabular-nums"
                      >
                        ${Math.round((maxSpend * step) / 1000)}k
                      </text>
                    </g>
                  );
                })}

                {campaigns.map((camp, i) => {
                  const xBase = 64 + i * slotWidth;
                  const spendH = Math.max(8, (Number(camp.spend) / maxSpend) * 136);
                  const roasH = Math.max(8, (Number(camp.roas) / maxRoas) * 136);
                  const isActiveHover = hoveredCampaign?.id === camp.id;

                  return (
                    <g
                      key={camp.id}
                      onMouseEnter={() => {
                        triggerHaptic('selection');
                        setHoveredCampaignId(camp.id);
                      }}
                      onClick={() => {
                        triggerHaptic('selection');
                        setHoveredCampaignId(camp.id);
                      }}
                      className="cursor-pointer"
                    >
                      <motion.rect
                        x={xBase}
                        y={168 - spendH}
                        width={barWidth}
                        height={spendH}
                        rx="6"
                        fill={isActiveHover ? '#08131F' : '#16314A'}
                        initial={{ scaleY: 0, opacity: 0.4 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.08 + i * 0.07,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }}
                      />
                      <motion.rect
                        x={xBase + barWidth + 8}
                        y={168 - roasH}
                        width={barWidth}
                        height={roasH}
                        rx="6"
                        fill="#5F7F98"
                        initial={{ scaleY: 0, opacity: 0.3 }}
                        animate={{ scaleY: 1, opacity: isActiveHover ? 1 : 0.78 }}
                        transition={{
                          duration: 0.58,
                          delay: 0.14 + i * 0.07,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }}
                      />
                      <text
                        x={xBase + barWidth + 4}
                        y="192"
                        textAnchor="middle"
                        fill="#08131F"
                        fontSize="10.5"
                        fontWeight={isActiveHover ? '600' : '500'}
                      >
                        {camp.name.split(' ').slice(0, 2).join(' ')}
                      </text>
                    </g>
                  );
                })}

                {roasLinePath && (
                  <motion.path
                    d={roasLinePath}
                    fill="none"
                    stroke="#08131F"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.9 }}
                    transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}

                {roasPoints.map((pt, idx) => (
                  <motion.circle
                    key={pt.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredCampaign?.id === pt.id ? 4.8 : 3.6}
                    fill="#E8EFF3"
                    stroke="#08131F"
                    strokeWidth="2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 + idx * 0.07, duration: 0.22 }}
                  />
                ))}
              </svg>

              <div className="pt-3 border-t border-white/55 flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
                <div className="flex items-center gap-4 text-[#08131F]/75">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#16314A]" />
                    <span>Spend</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5F7F98]" />
                    <span>ROAS</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-[#08131F] rounded-full" />
                    <span>Trajectory</span>
                  </span>
                </div>
                {hoveredCampaign && (
                  <span className="font-semibold text-[#08131F] tabular-nums">
                    {hoveredCampaign.name} · {formatCurrency(hoveredCampaign.spend)} ·{' '}
                    {hoveredCampaign.leads_count} leads · {hoveredCampaign.roas}x
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Clean Conversion Funnel & Unboxed Channel Mix */}
          {activeAnalyticsTab === 'funnel' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-3.5">
                {funnelStages.map((stage, idx) => {
                  const pct = Math.max(10, Math.round((stage.count / maxFunnel) * 100));
                  const fills = ['bg-[#08131F]', 'bg-[#16314A]', 'bg-[#2E4F6B]', 'bg-[#5F7F98]'];
                  return (
                    <div key={stage.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#08131F]">{stage.label}</span>
                        <span className="tabular-nums font-semibold text-[#08131F]">
                          {formatNumber(stage.count)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white/45 overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 0.5,
                            delay: 0.08 + idx * 0.07,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          style={{ width: `${pct}%`, transformOrigin: 'left' }}
                          className={`h-full rounded-full ${fills[idx % fills.length]}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-4 lg:pl-6 lg:border-l border-white/55 divide-y divide-white/50">
                {(summary?.charts?.channelBreakdown || []).map((ch) => (
                  <div
                    key={ch.channel}
                    className="py-2.5 first:pt-0 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="text-[#08131F]/70 truncate">{ch.channel}</span>
                    <span className="font-semibold text-[#08131F] tabular-nums">{ch.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Clean Hairline Team Performance List (Zero Nested Cards) */}
          {activeAnalyticsTab === 'team' && (
            <div className="divide-y divide-white/50">
              {empPerformance.map((emp, idx) => {
                const contactedPct = Math.max(
                  6,
                  Math.round((emp.leadsContacted / maxEmpScore) * 100)
                );
                const closedPct = Math.max(
                  6,
                  Math.round(((emp.dealsClosed * 2) / maxEmpScore) * 100)
                );
                return (
                  <div key={emp.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <div className="min-w-0">
                        <span className="font-semibold text-[#08131F]">{emp.name}</span>
                        <span className="text-[#08131F]/55 ml-1.5">· {emp.role}</span>
                      </div>
                      <span className="tabular-nums font-medium text-[#08131F] shrink-0">
                        {emp.leadsContacted} contacted · {emp.dealsClosed} closed ·{' '}
                        {formatCurrency(emp.wonRevenue)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-2 rounded-full bg-white/45 overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 0.45,
                            delay: 0.08 + idx * 0.05,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          style={{ width: `${contactedPct}%`, transformOrigin: 'left' }}
                          className="h-full rounded-full bg-[#2E4F6B]"
                        />
                      </div>
                      <div className="h-2 rounded-full bg-white/45 overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 0.5,
                            delay: 0.12 + idx * 0.05,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          style={{ width: `${closedPct}%`, transformOrigin: 'left' }}
                          className="h-full rounded-full bg-[#08131F]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </RevealWidget>
      )}

      {/* Customize Dashboard Slide-Over Drawer */}
      <SlideDrawer
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Customize Dashboard"
        subtitle="Prioritize KPI order and visible analytics"
      >
        <div className="space-y-6 text-[#08131F]">
          <section className="space-y-3">
            <h3 className="text-[14px] font-semibold text-[#08131F]">KPI Strip Priority</h3>
            <div className="space-y-2">
              {preferences.kpiOrder.map((kpiId, index) => {
                const isHidden = preferences.hiddenKpis.includes(kpiId);
                return (
                  <div
                    key={kpiId}
                    className="rounded-2xl bg-white/55 border border-white/80 px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <span
                      className={`text-[13.5px] font-medium truncate ${
                        isHidden ? 'text-[#08131F]/40 line-through' : 'text-[#08131F]'
                      }`}
                    >
                      {KPI_LABELS[kpiId]}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        disabled={savingPrefs || index === 0}
                        aria-label={`Move ${KPI_LABELS[kpiId]} up`}
                        onClick={() => moveKpi(index, -1)}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        disabled={savingPrefs || index === preferences.kpiOrder.length - 1}
                        aria-label={`Move ${KPI_LABELS[kpiId]} down`}
                        onClick={() => moveKpi(index, 1)}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </GlassButton>
                      <GlassButton
                        variant="secondary"
                        size="sm"
                        disabled={savingPrefs}
                        onClick={() => toggleKpiVisibility(kpiId)}
                      >
                        {isHidden ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>{isHidden ? 'Hidden' : 'Visible'}</span>
                      </GlassButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-[#08131F]/10">
            <h3 className="text-[14px] font-semibold text-[#08131F]">Analytics Views</h3>
            <div className="space-y-2">
              {WIDGET_LABELS.map(({ id: widgetId, label }) => {
                const visible = preferences.visibleWidgets.includes(widgetId);
                return (
                  <div
                    key={widgetId}
                    className="rounded-2xl bg-white/55 border border-white/80 px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <span className="text-[13.5px] font-medium text-[#08131F] truncate">
                      {label}
                    </span>
                    <GlassButton
                      variant={visible ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={savingPrefs}
                      onClick={() => toggleWidgetVisibility(widgetId)}
                    >
                      <span>{visible ? 'Shown' : 'Hidden'}</span>
                    </GlassButton>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </SlideDrawer>
    </div>
  );
}
