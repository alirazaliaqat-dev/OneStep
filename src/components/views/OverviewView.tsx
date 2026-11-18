import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Eye,
  EyeOff,
  Link2,
  MessageSquareText,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Percent,
  CheckCircle2,
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
import {
  formatCurrency,
  formatNumber,
} from '../../utils/formatters';
import { AppearHeading, GlassButton, RevealWidget, SlideDrawer } from '../ui/LiquidGlass';
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
  conversion_rate: 'Conversion Rate',
  active_campaigns: 'Active Ad Campaigns',
  ad_spend: 'Total Ad Spend',
  roas: 'Return on Ad Spend (ROAS)',
  team_deals_closed: 'Deals Closed',
};

const WIDGET_LABELS: Array<{ id: DashboardWidgetId; label: string }> = [
  { id: 'campaign_roas_chart', label: 'Campaign Spend & ROAS Chart' },
  { id: 'funnel_channel_chart', label: 'Conversion Funnel & Channel Mix' },
  { id: 'employee_performance_chart', label: 'Employee Performance Metrics' },
];

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
    {
      label: string;
      value: string;
      detail: string;
      icon: React.ComponentType<{ className?: string }>;
      allowed: boolean;
    }
  > = {
    total_leads: {
      label: 'Total Leads',
      value: formatNumber((m?.totalLeadsFromAds || 0) + (m?.totalCrmLeads || 0)),
      detail: `${m?.totalLeadsFromAds || 0} ad leads · ${m?.totalCrmLeads || 0} CRM deals`,
      icon: Users,
      allowed: permissions.reporting.viewExecutiveKpis,
    },
    conversion_rate: {
      label: 'Conversion Rate',
      value: `${m?.conversionRate || 0}%`,
      detail: `${m?.totalDealsClosed || 0} deals won of ${m?.totalCrmLeads || 0} pipeline leads`,
      icon: Percent,
      allowed: permissions.reporting.viewExecutiveKpis,
    },
    active_campaigns: {
      label: 'Active Ad Campaigns',
      value: formatNumber(m?.activeCampaigns || 0),
      detail: `${campaigns.length} Meta & TikTok campaigns · ${m?.openQueries || 0} open`,
      icon: MessageSquareText,
      allowed: permissions.dataAccess.viewCampaigns,
    },
    ad_spend: {
      label: 'Total Ad Spend',
      value: formatCurrency(m?.totalSpend || 0),
      detail: `${formatCurrency(m?.pipelineValue || 0)} active pipeline value`,
      icon: TrendingUp,
      allowed: permissions.reporting.viewFinancialRoas,
    },
    roas: {
      label: 'Return on Ad Spend',
      value: `${m?.avgRoas || 0}x`,
      detail: `${formatCurrency(m?.wonRevenue || 0)} closed won revenue`,
      icon: ArrowUpRight,
      allowed: permissions.reporting.viewFinancialRoas,
    },
    team_deals_closed: {
      label: 'Deals Closed',
      value: formatNumber(m?.totalDealsClosed || 0),
      detail: `${m?.totalLeadsContacted || 0} ad inquiries contacted`,
      icon: CheckCircle2,
      allowed: permissions.reporting.viewExecutiveKpis,
    },
  };

  const orderedVisibleKpis = preferences.kpiOrder.filter(
    (id) => !preferences.hiddenKpis.includes(id) && kpiDefinitions[id]?.allowed
  );

  const isWidgetVisible = (id: DashboardWidgetId) => preferences.visibleWidgets.includes(id);

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
  const barWidth = Math.min(40, slotWidth * 0.34);

  const roasPoints = campaigns.map((camp, i) => {
    const xBase = 64 + i * slotWidth;
    const roasH = Math.max(8, (Number(camp.roas) / maxRoas) * 140);
    return {
      id: camp.id,
      x: xBase + barWidth + 4,
      y: 170 - roasH,
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

  const showCampaignChart =
    isWidgetVisible('campaign_roas_chart') && permissions.reporting.viewFinancialRoas;
  const showFunnelChart =
    isWidgetVisible('funnel_channel_chart') && permissions.reporting.viewExecutiveKpis;

  return (
    <div className="space-y-5 sm:space-y-6 text-black">
      {/* Role-Contextual Header Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AppearHeading as="p" className="text-[12.5px] sm:text-[13px] font-medium text-black/75 min-w-0">
          {activeRole.name} View ·{' '}
          {permissions.dataAccess.queriesScope === 'all'
            ? 'All Meta & TikTok Inquiries'
            : 'Assigned Meta & TikTok Inquiries'}{' '}
          ·{' '}
          {permissions.reporting.viewFinancialRoas
            ? 'Full Spend & ROAS Analytics'
            : 'Conversion & Queue Metrics'}
        </AppearHeading>

        {permissions.reporting.customizeDashboard && (
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setCustomizeOpen(true)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>Customize</span>
          </GlassButton>
        )}
      </div>

      {/* Frosted Light Omnichannel Sync Banner (Black Typography on Light Glass) */}
      {(!isMetaConnected || !isTikTokConnected) && permissions.dataAccess.viewCampaigns && (
        <RevealWidget
          as="section"
          className="glass-panel rounded-3xl p-4 sm:p-5 md:p-6 text-black flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="space-y-1 max-w-2xl">
            <AppearHeading as="h2" className="text-[16px] md:text-[17px] font-semibold tracking-tight text-black">
              Live Meta & TikTok Omnichannel Sync Ready
            </AppearHeading>
            <p className="text-[13px] sm:text-[13.5px] text-black/70 leading-relaxed">
              Authorize Meta Business (Facebook, Instagram, Messenger) and TikTok Business Messages to stream real inquiries directly into your WhatsApp-style inbox.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isMetaConnected && (
              <GlassButton variant="primary" size="sm" onClick={onConnectMeta}>
                <Link2 className="w-4 h-4 shrink-0" />
                <span>Connect Meta</span>
              </GlassButton>
            )}
            {!isTikTokConnected && (
              <GlassButton variant="secondary" size="sm" onClick={onConnectTikTok}>
                <Link2 className="w-4 h-4 shrink-0" />
                <span>Connect TikTok</span>
              </GlassButton>
            )}
          </div>
        </RevealWidget>
      )}

      {/* Customizable KPI Cards Grid with Staggered Entrance Effects */}
      {orderedVisibleKpis.length > 0 && (
        <section
          aria-label="Key Performance Indicators"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4"
        >
          {orderedVisibleKpis.map((id, idx) => {
            const kpi = kpiDefinitions[id];
            const Icon = kpi.icon;
            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28, delay: idx * 0.04 }}
                whileHover={{ y: -2 }}
                className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-black/70">{kpi.label}</span>
                  <Icon className="w-4 h-4 text-black/60 shrink-0" />
                </div>
                <div className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-black tabular-nums leading-none">
                  {kpi.value}
                </div>
                <p className="text-[12px] text-black/65 truncate">{kpi.detail}</p>
              </motion.div>
            );
          })}
        </section>
      )}

      {/* MAIN SCREEN WHATSAPP-STYLE OMNICHANNEL INBOX (Always present on every role's dashboard) */}
      <RevealWidget delay={0.08} ariaLabel="Main Screen WhatsApp Omnichannel Inbox">
        <WhatsAppInbox
          compact
          layoutIdPrefix="dashboard-wa"
          title="Live Omnichannel Chats · Meta & TikTok"
          subtitle={`WhatsApp-style messaging across Facebook, Instagram, Messenger & TikTok (${searchedQueries.length} active)`}
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

      {/* Dynamic Graph Drawing Charts Row */}
      {(showCampaignChart || showFunnelChart) && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 items-stretch">
          {showCampaignChart && (
            <RevealWidget
              delay={0.12}
              className={`${
                showFunnelChart ? 'xl:col-span-7' : 'xl:col-span-12'
              } glass-panel rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col justify-between gap-4`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <AppearHeading as="h2" className="text-[16px] font-semibold text-black">
                    Ad Spend vs. Return on Ad Spend (ROAS)
                  </AppearHeading>
                  <p className="text-[12.5px] text-black/65 mt-0.5">
                    Tap or hover any campaign bar to inspect spend, leads, and live ROAS curve
                  </p>
                </div>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('meta', 'campaigns')}
                >
                  <span>Campaigns</span>
                </GlassButton>
              </div>

              {/* Dynamic SVG Column + Animated ROAS Path Chart */}
              <div className="rounded-2xl glass-recessed p-3.5 sm:p-4 space-y-4">
                <svg
                  viewBox="0 0 600 212"
                  className="w-full h-[185px] sm:h-[200px] overflow-visible"
                  role="img"
                  aria-label="Dynamic campaign spend and ROAS trajectory chart"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const y = 170 - step * 140;
                    return (
                      <g key={step}>
                        <line
                          x1="48"
                          y1={y}
                          x2="585"
                          y2={y}
                          stroke="#202020"
                          strokeOpacity="0.12"
                          strokeWidth="1"
                          strokeDasharray={step === 0 ? undefined : '4 4'}
                        />
                        <text
                          x="40"
                          y={y + 4}
                          textAnchor="end"
                          fill="#000000"
                          opacity="0.6"
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
                    const spendH = Math.max(8, (Number(camp.spend) / maxSpend) * 140);
                    const roasH = Math.max(8, (Number(camp.roas) / maxRoas) * 140);
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
                          y={170 - spendH}
                          width={barWidth}
                          height={spendH}
                          rx="6"
                          fill={isActiveHover ? '#0F0F0F' : '#202020'}
                          initial={{ scaleY: 0, opacity: 0.4 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{
                            duration: 0.55,
                            delay: 0.1 + i * 0.08,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }}
                        />
                        <motion.rect
                          x={xBase + barWidth + 8}
                          y={170 - roasH}
                          width={barWidth}
                          height={roasH}
                          rx="6"
                          fill="#5DD62C"
                          initial={{ scaleY: 0, opacity: 0.3 }}
                          animate={{ scaleY: 1, opacity: isActiveHover ? 1 : 0.85 }}
                          transition={{
                            duration: 0.62,
                            delay: 0.18 + i * 0.08,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }}
                        />
                        <text
                          x={xBase + barWidth + 4}
                          y="194"
                          textAnchor="middle"
                          fill="#000000"
                          fontSize="10.5"
                          fontWeight={isActiveHover ? '600' : '500'}
                        >
                          {camp.name.split(' ').slice(0, 2).join(' ')}
                        </text>
                      </g>
                    );
                  })}

                  {/* Dynamic ROAS Trajectory Curve Drawing */}
                  {roasLinePath && (
                    <motion.path
                      d={roasLinePath}
                      fill="none"
                      stroke="#337418"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.95 }}
                      transition={{ duration: 0.95, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}

                  {roasPoints.map((pt, idx) => (
                    <motion.circle
                      key={pt.id}
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredCampaign?.id === pt.id ? 5 : 3.8}
                      fill="#F8F8F8"
                      stroke="#0F0F0F"
                      strokeWidth="2.2"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.45 + idx * 0.08, duration: 0.24 }}
                    />
                  ))}
                </svg>

                <div className="pt-2 border-t border-[#202020]/10 flex flex-wrap items-center justify-between gap-2 text-[12px] sm:text-[12.5px]">
                  <div className="flex items-center gap-4 text-black">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#202020]" />
                      <span>Ad Spend</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#5DD62C]" />
                      <span>ROAS Bars</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[#337418] rounded-full" />
                      <span>ROAS Curve</span>
                    </span>
                  </div>
                  {hoveredCampaign && (
                    <span className="text-black font-semibold tabular-nums">
                      {hoveredCampaign.name} · {formatCurrency(hoveredCampaign.spend)} ·{' '}
                      {hoveredCampaign.leads_count} leads · {hoveredCampaign.roas}x ROAS
                    </span>
                  )}
                </div>
              </div>
            </RevealWidget>
          )}

          {showFunnelChart && (
            <RevealWidget
              delay={0.16}
              className={`${
                showCampaignChart ? 'xl:col-span-5' : 'xl:col-span-12'
              } glass-panel rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col justify-between gap-4`}
            >
              <div>
                <AppearHeading as="h2" className="text-[16px] font-semibold text-black">
                  Lead Conversion Funnel & Channel Mix
                </AppearHeading>
                <p className="text-[12.5px] text-black/65 mt-0.5">
                  Omnichannel progression from Meta & TikTok to Closed Won
                </p>
              </div>

              <div className="space-y-3.5">
                {funnelStages.map((stage, idx) => {
                  const pct = Math.max(10, Math.round((stage.count / maxFunnel) * 100));
                  const fills = ['bg-[#0F0F0F]', 'bg-[#337418]', 'bg-[#5DD62C]', 'bg-[#202020]'];
                  return (
                    <div key={stage.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-black">{stage.label}</span>
                        <span className="tabular-nums font-semibold text-black">
                          {formatNumber(stage.count)}
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-[#202020]/8 overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 0.55,
                            delay: 0.15 + idx * 0.08,
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

              <div className="pt-3 border-t border-[#202020]/10 grid grid-cols-2 gap-2.5 text-[12px] sm:text-[12.5px]">
                {(summary?.charts?.channelBreakdown || []).map((ch) => (
                  <div
                    key={ch.channel}
                    className="rounded-2xl glass-recessed px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-black/70 truncate">{ch.channel}</span>
                    <span className="font-semibold text-black tabular-nums">{ch.count}</span>
                  </div>
                ))}
              </div>
            </RevealWidget>
          )}
        </div>
      )}

      {/* Employee Performance Metrics with Dynamic Horizontal Bar Drawing */}
      {isWidgetVisible('employee_performance_chart') && permissions.reporting.viewTeamPerformance && (
        <RevealWidget delay={0.2} className="glass-panel rounded-3xl p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <AppearHeading as="h2" className="text-[16px] font-semibold text-black">
                Employee Performance Metrics
              </AppearHeading>
              <p className="text-[12.5px] text-black/65 mt-0.5">
                Leads contacted, deals closed, and won revenue per team member
              </p>
            </div>
            {permissions.dataAccess.viewOrganization && (
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('organization', 'employees')}
              >
                <span>Team</span>
              </GlassButton>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
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
                <div key={emp.id} className="rounded-2xl glass-recessed p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] sm:text-[13px]">
                    <div className="min-w-0">
                      <span className="font-semibold text-black truncate">{emp.name}</span>
                      <span className="text-black/60 ml-1.5">· {emp.role}</span>
                    </div>
                    <span className="tabular-nums font-semibold text-black shrink-0">
                      {emp.leadsContacted} contacted · {emp.dealsClosed} closed ·{' '}
                      {formatCurrency(emp.wonRevenue)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-2 rounded-full bg-[#202020]/8 overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.15 + idx * 0.06,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{ width: `${contactedPct}%`, transformOrigin: 'left' }}
                        className="h-full rounded-full bg-[#202020]"
                      />
                    </div>
                    <div className="h-2 rounded-full bg-[#202020]/8 overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          duration: 0.55,
                          delay: 0.2 + idx * 0.06,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{ width: `${closedPct}%`, transformOrigin: 'left' }}
                        className="h-full rounded-full bg-[#5DD62C]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </RevealWidget>
      )}

      {/* Customize Dashboard Slide-Over Drawer */}
      <SlideDrawer
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Customize Dashboard"
        subtitle="Prioritize KPI order and toggle dashboard analytics"
      >
        <div className="space-y-6 text-black">
          <section className="space-y-3">
            <h3 className="text-[14px] font-semibold text-black">Prioritize KPI Cards</h3>
            <p className="text-[12.5px] text-black/65">
              Reorder metrics to place your top priorities first or hide metrics you don’t need right now.
            </p>
            <div className="space-y-2">
              {preferences.kpiOrder.map((kpiId, index) => {
                const isHidden = preferences.hiddenKpis.includes(kpiId);
                return (
                  <div
                    key={kpiId}
                    className="rounded-2xl bg-[#F8F8F8] border border-[#202020]/12 px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <span
                      className={`text-[13.5px] font-medium truncate ${
                        isHidden ? 'text-black/40 line-through' : 'text-black'
                      }`}
                    >
                      {KPI_LABELS[kpiId]}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
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

          <section className="space-y-3 pt-4 border-t border-[#202020]/10">
            <h3 className="text-[14px] font-semibold text-black">
              Charts & Dashboard Sections
            </h3>
            <div className="space-y-2">
              {WIDGET_LABELS.map(({ id: widgetId, label }) => {
                const visible = preferences.visibleWidgets.includes(widgetId);
                return (
                  <div
                    key={widgetId}
                    className="rounded-2xl bg-[#F8F8F8] border border-[#202020]/12 px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <span className="text-[13.5px] font-medium text-black truncate">
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
