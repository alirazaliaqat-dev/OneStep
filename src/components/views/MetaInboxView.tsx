import React, { useEffect, useMemo, useState } from 'react';
import {
  Link2,
  RefreshCw,
  Pause,
  Play,
  Wand2,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import type {
  AdCampaign,
  AssignmentRule,
  Employee,
  MetaQuery,
  MetaStatusResponse,
  QueryChannel,
  QueryPlatform,
  QueryStatus,
  RolePermissions,
  TikTokStatusResponse,
} from '../../types/crm';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { AppearHeading, GlassButton, RevealWidget, SegmentedControl, SlideDrawer } from '../ui/LiquidGlass';
import { SourceAppIcon } from '../ui/SourceAppIcon';
import { WhatsAppInbox } from '../inbox/WhatsAppInbox';

interface MetaInboxViewProps {
  queries: MetaQuery[];
  campaigns: AdCampaign[];
  employees: Employee[];
  assignmentRules: AssignmentRule[];
  permissions: RolePermissions;
  metaStatus: MetaStatusResponse | null;
  tiktokStatus?: TikTokStatusResponse | null;
  requestedSubTab?: MetaSubTab;
  onSubTabChange?: (next: MetaSubTab) => void;
  selectedQueryId: string | null;
  onSelectQueryId: (id: string | null) => void;
  searchQuery: string;
  logDrawerOpen: boolean;
  onCloseLogDrawer: () => void;
  onAssignQuery: (queryId: string, employeeId: string | null) => Promise<void>;
  onUpdateQueryStatus: (queryId: string, status: QueryStatus) => Promise<void>;
  onSendReply: (queryId: string, body: string, authorName: string) => Promise<void>;
  onConvertToLead: (queryId: string, company: string, dealValue: number) => Promise<void>;
  onCreateQuery: (payload: {
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
  }) => Promise<void>;
  onRunAutoAssign: () => Promise<void>;
  onCreateRule: (payload: {
    name: string;
    channel: string;
    platform: string;
    campaign_id: string;
    strategy: string;
    target_employee_id?: string | null;
    priority_override: string;
  }) => Promise<void>;
  onToggleRule: (rule: AssignmentRule) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onToggleCampaignStatus: (campaign: AdCampaign) => Promise<void>;
  onConnectMeta: () => void;
  onSyncMeta: () => Promise<void>;
  onConnectTikTok?: () => void;
  onSyncTikTok?: () => Promise<void>;
}

export type MetaSubTab = 'queries' | 'campaigns' | 'rules';
type ChannelFilter = 'All' | QueryChannel;

export function MetaInboxView({
  queries,
  campaigns,
  employees,
  assignmentRules,
  permissions,
  metaStatus,
  tiktokStatus,
  requestedSubTab,
  onSubTabChange,
  selectedQueryId,
  onSelectQueryId,
  searchQuery,
  logDrawerOpen,
  onCloseLogDrawer,
  onAssignQuery,
  onUpdateQueryStatus,
  onSendReply,
  onConvertToLead,
  onCreateQuery,
  onRunAutoAssign,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
  onToggleCampaignStatus,
  onConnectMeta,
  onSyncMeta,
}: MetaInboxViewProps) {
  const [subTab, setSubTab] = useState<MetaSubTab>(requestedSubTab || 'queries');

  useEffect(() => {
    if (requestedSubTab) {
      setSubTab(requestedSubTab);
    }
  }, [requestedSubTab]);

  const handleSetSubTab = (next: MetaSubTab) => {
    setSubTab(next);
    onSubTabChange?.(next);
  };

  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('All');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);

  // New Query form state
  const [newCustomer, setNewCustomer] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newChannel, setNewChannel] = useState<QueryChannel>('Lead Form');
  const [newPlatform, setNewPlatform] = useState<QueryPlatform>('Instagram');
  const [newCampaignId, setNewCampaignId] = useState(campaigns[0]?.id || 'cmp_q4_b2b');
  const [newCreativeName, setNewCreativeName] = useState('Q4 Story Reel — Direct Demo CTA');
  const [newCreativeFormat, setNewCreativeFormat] = useState('Vertical Video · 9:16');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [autoAssignOnCreate, setAutoAssignOnCreate] = useState(true);

  // New Rule form state
  const [ruleName, setRuleName] = useState('');
  const [ruleChannel, setRuleChannel] = useState<'Any' | QueryChannel>('Lead Form');
  const [rulePlatform, setRulePlatform] = useState<'Any' | QueryPlatform>('Any');
  const [ruleCampaignId, setRuleCampaignId] = useState('Any');
  const [ruleStrategy, setRuleStrategy] = useState<'least_loaded' | 'specific_agent' | 'round_robin'>('least_loaded');
  const [ruleAgentId, setRuleAgentId] = useState(employees[0]?.id || '');
  const [rulePriority, setRulePriority] = useState('High');

  const isConnected = metaStatus?.connection?.status === 'Connected';
  const isTikTokConnected = tiktokStatus?.connection?.status === 'Connected';

  const filteredQueries = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return queries.filter((item) => {
      if (channelFilter !== 'All' && item.channel !== channelFilter) return false;
      if (onlyUnassigned && item.assigned_employee_id) return false;
      if (!qLower) return true;
      return (
        item.customer_name.toLowerCase().includes(qLower) ||
        item.subject.toLowerCase().includes(qLower) ||
        item.channel.toLowerCase().includes(qLower) ||
        (item.ad_creative_name || '').toLowerCase().includes(qLower) ||
        (item.campaign_name || '').toLowerCase().includes(qLower)
      );
    });
  }, [queries, channelFilter, onlyUnassigned, searchQuery]);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.trim() || !newSubject.trim() || !newMessage.trim()) return;
    await onCreateQuery({
      customer_name: newCustomer.trim(),
      customer_handle: newHandle.trim() || newCustomer.trim(),
      customer_email: newEmail.trim(),
      customer_phone: newPhone.trim(),
      channel: newChannel,
      platform: newPlatform,
      ad_creative_name: newCreativeName.trim() || 'Meta Ad Creative',
      ad_creative_format: newCreativeFormat.trim() || 'Instant Lead Form',
      ad_set_name: 'Primary Ad Set',
      priority: 'High',
      campaign_id: newCampaignId,
      subject: newSubject.trim(),
      message: newMessage.trim(),
      auto_assign: autoAssignOnCreate,
    });
    setNewCustomer('');
    setNewHandle('');
    setNewEmail('');
    setNewPhone('');
    setNewSubject('');
    setNewMessage('');
    onCloseLogDrawer();
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    await onCreateRule({
      name: ruleName.trim(),
      channel: ruleChannel,
      platform: rulePlatform,
      campaign_id: ruleCampaignId,
      strategy: ruleStrategy,
      target_employee_id: ruleStrategy === 'specific_agent' ? ruleAgentId : null,
      priority_override: rulePriority,
    });
    setRuleName('');
    setNewRuleOpen(false);
  };

  const subTabs: Array<{ value: MetaSubTab; label: string; count: number }> = [
    { value: 'queries', label: 'Omnichannel Chats', count: queries.length },
  ];
  if (permissions.dataAccess.viewCampaigns) {
    subTabs.push({ value: 'campaigns', label: 'Ad Campaigns', count: campaigns.length });
  }
  if (permissions.modifications.manageAssignmentRules) {
    subTabs.push({ value: 'rules', label: 'Auto-Assign Rules', count: assignmentRules.length });
  }

  return (
    <div className="space-y-4 sm:space-y-5 text-black">
      {/* Omnichannel Command Strip */}
      <RevealWidget className="glass-panel rounded-full p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          layoutId="meta-subtab-control"
          ariaLabel="Omnichannel Workspace Views"
          value={subTab}
          onChange={handleSetSubTab}
          options={subTabs}
        />

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {permissions.modifications.assignTasks && subTab === 'queries' && (
            <GlassButton
              variant="secondary"
              size="sm"
              disabled={autoAssigning}
              onClick={async () => {
                setAutoAssigning(true);
                try {
                  await onRunAutoAssign();
                } finally {
                  setAutoAssigning(false);
                }
              }}
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>Run Auto-Assign</span>
            </GlassButton>
          )}

          {subTab === 'rules' && permissions.modifications.manageAssignmentRules && (
            <GlassButton variant="primary" size="sm" onClick={() => setNewRuleOpen(true)}>
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>New Rule</span>
            </GlassButton>
          )}

          {permissions.dataAccess.viewCampaigns &&
            (isConnected ? (
              <GlassButton
                variant="secondary"
                size="sm"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await onSyncMeta();
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync Meta</span>
              </GlassButton>
            ) : (
              <GlassButton variant="secondary" size="sm" onClick={onConnectMeta}>
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>Connect Meta</span>
              </GlassButton>
            ))}
        </div>
      </RevealWidget>

      {subTab === 'queries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              layoutId="meta-channel-filter"
              ariaLabel="Filter queries by Meta and TikTok channel"
              value={channelFilter}
              onChange={setChannelFilter}
              options={[
                { value: 'All', label: 'All' },
                {
                  value: 'Lead Form',
                  label: 'Lead Forms',
                  icon: <SourceAppIcon app="Facebook" size="xs" />,
                },
                {
                  value: 'Instagram DM',
                  label: 'Instagram DMs',
                  icon: <SourceAppIcon app="Instagram" size="xs" />,
                },
                {
                  value: 'Messenger',
                  label: 'Messenger',
                  icon: <SourceAppIcon app="Messenger" size="xs" />,
                },
                {
                  value: 'Ad Comment',
                  label: 'Ad Comments',
                  icon: <SourceAppIcon app="Facebook" size="xs" />,
                },
                {
                  value: 'TikTok DM',
                  label: 'TikTok DMs',
                  icon: <SourceAppIcon app="TikTok" size="xs" />,
                },
                {
                  value: 'TikTok Lead',
                  label: 'TikTok Leads',
                  icon: <SourceAppIcon app="TikTok" size="xs" />,
                },
              ]}
            />

            <GlassButton
              variant={onlyUnassigned ? 'primary' : 'secondary'}
              size="sm"
              haptic="selection"
              onClick={() => setOnlyUnassigned((v) => !v)}
            >
              <span>{onlyUnassigned ? 'Showing Unassigned' : 'Unassigned Only'}</span>
            </GlassButton>
          </div>

          <RevealWidget delay={0.05}>
            <WhatsAppInbox
              layoutIdPrefix="full-inbox-wa"
              showPlatformFilter={false}
              title="Omnichannel Messaging Inbox"
              subtitle={`Facebook · Instagram · Messenger · TikTok (${filteredQueries.length} matching)`}
              queries={filteredQueries}
              employees={employees}
              permissions={permissions}
              activeRoleName="Team"
              selectedQueryId={selectedQueryId}
              onSelectQueryId={(id) => onSelectQueryId(id)}
              onAssignQuery={onAssignQuery}
              onUpdateQueryStatus={onUpdateQueryStatus}
              onSendReply={onSendReply}
              onConvertToLead={onConvertToLead}
            />
          </RevealWidget>
        </div>
      )}

      {subTab === 'campaigns' && (
        <RevealWidget className="glass-panel rounded-[28px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/55 flex items-center justify-between gap-4">
            <AppearHeading as="h2" className="text-[15.5px] font-semibold text-[#08131F]">
              Ad Campaigns
            </AppearHeading>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/30 text-[12px] font-semibold text-[#08131F]/65 border-b border-white/55">
                  <th className="py-3 px-5">Campaign</th>
                  <th className="py-3 px-4">Objective</th>
                  <th className="py-3 px-4 text-right">Daily Budget</th>
                  <th className="py-3 px-4 text-right">Spend</th>
                  <th className="py-3 px-4 text-right">Leads</th>
                  <th className="py-3 px-4 text-right">CPL</th>
                  <th className="py-3 px-4 text-right">ROAS</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/45 text-[13.5px]">
                {campaigns.map((camp) => {
                  const cpl = camp.leads_count > 0 ? Math.round(camp.spend / camp.leads_count) : 0;
                  return (
                    <tr key={camp.id} className="hover:bg-white/35 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <SourceAppIcon platform={camp.platform} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-black truncate">{camp.name}</div>
                            <div className="text-[12px] text-black/65">{camp.platform}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-black">{camp.objective}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-medium text-black">
                        {formatCurrency(camp.daily_budget)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-black">
                        {formatCurrency(camp.spend)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black">
                        {formatNumber(camp.leads_count)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black/75">
                        {formatCurrency(cpl)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-black">
                        {camp.roas}x
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          haptic="medium"
                          disabled={!permissions.modifications.manageCampaigns}
                          onClick={() => onToggleCampaignStatus(camp)}
                        >
                          {camp.status === 'Active' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </>
                          )}
                        </GlassButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </RevealWidget>
      )}

      {subTab === 'rules' && (
        <RevealWidget className="glass-panel rounded-[28px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/55 flex items-center justify-between gap-4">
            <AppearHeading as="h2" className="text-[15.5px] font-semibold text-[#08131F]">
              Auto-Assign Rules
            </AppearHeading>
          </div>

          <div className="divide-y divide-white/45">
            {assignmentRules.map((rule) => (
              <div
                key={rule.id}
                className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-[14.5px] font-semibold text-black">
                    <Sparkles className="w-4 h-4 text-black/65 shrink-0" />
                    <span className="truncate">{rule.name}</span>
                  </div>
                  <p className="text-[12.5px] text-black/65">
                    Channel: {rule.channel} · Platform: {rule.platform} · Strategy:{' '}
                    {rule.strategy === 'specific_agent'
                      ? `Specific (${rule.target_employee_name || 'Agent'})`
                      : rule.strategy === 'round_robin'
                        ? 'Round Robin'
                        : 'Least Loaded Agent'}
                    {rule.target_department_name ? ` · ${rule.target_department_name}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <GlassButton
                    variant={rule.is_active ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => onToggleRule(rule)}
                  >
                    <span>{rule.is_active ? 'Active' : 'Paused'}</span>
                  </GlassButton>
                  <GlassButton
                    variant="danger"
                    size="sm"
                    haptic="warning"
                    onClick={() => onDeleteRule(rule.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        </RevealWidget>
      )}

      {/* Log / Import Omnichannel Query Drawer */}
      <SlideDrawer
        open={logDrawerOpen}
        onClose={onCloseLogDrawer}
        title="Import Ad & Social Inquiry"
        subtitle="Captures contact, creative viewed, campaign & auto-assigns agent"
      >
        <form onSubmit={handleLogSubmit} className="space-y-4 text-black">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Lead Name</label>
              <input
                required
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="e.g. Jordan Mercer"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Company / Handle</label>
              <input
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@jordan.studio"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jordan@company.com"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Phone</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+1 (555) 210-8940"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Platform</label>
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value as QueryPlatform)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Inquiry Channel</label>
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as QueryChannel)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="Lead Form">Lead Form</option>
                <option value="Instagram DM">Instagram DM</option>
                <option value="Messenger">Messenger</option>
                <option value="Ad Comment">Ad Comment</option>
                <option value="TikTok DM">TikTok DM</option>
                <option value="TikTok Lead">TikTok Lead</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Campaign</label>
            <select
              value={newCampaignId}
              onChange={(e) => setNewCampaignId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">
                Ad Creative Viewed
              </label>
              <input
                value={newCreativeName}
                onChange={(e) => setNewCreativeName(e.target.value)}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">
                Creative Format
              </label>
              <input
                value={newCreativeFormat}
                onChange={(e) => setNewCreativeFormat(e.target.value)}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Inquiry Subject</label>
            <input
              required
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Pricing inquiry for Q1 rollout"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Message</label>
            <textarea
              required
              rows={3}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Customer's inquiry message..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>

          <label className="flex items-center gap-2.5 text-[13px] font-medium text-black cursor-pointer">
            <input
              type="checkbox"
              checked={autoAssignOnCreate}
              onChange={(e) => setAutoAssignOnCreate(e.target.checked)}
              className="w-4 h-4 accent-[#08131F]"
            />
            <span>Automatically assign to sales agent via active routing rules</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={onCloseLogDrawer}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Import Query</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>

      {/* New Assignment Rule Drawer */}
      <SlideDrawer
        open={newRuleOpen}
        onClose={() => setNewRuleOpen(false)}
        title="New Auto-Assignment Rule"
        subtitle="Route incoming Meta & TikTok inquiries automatically"
      >
        <form onSubmit={handleRuleSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Rule Name</label>
            <input
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. TikTok DMs → Inbound Team"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Channel Match</label>
              <select
                value={ruleChannel}
                onChange={(e) => setRuleChannel(e.target.value as 'Any' | QueryChannel)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="Any">Any Channel</option>
                <option value="Lead Form">Lead Form</option>
                <option value="Instagram DM">Instagram DM</option>
                <option value="Messenger">Messenger</option>
                <option value="Ad Comment">Ad Comment</option>
                <option value="TikTok DM">TikTok DM</option>
                <option value="TikTok Lead">TikTok Lead</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Platform Match</label>
              <select
                value={rulePlatform}
                onChange={(e) => setRulePlatform(e.target.value as 'Any' | QueryPlatform)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="Any">Any Platform</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Campaign Match</label>
            <select
              value={ruleCampaignId}
              onChange={(e) => setRuleCampaignId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            >
              <option value="Any">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Routing Strategy</label>
              <select
                value={ruleStrategy}
                onChange={(e) =>
                  setRuleStrategy(e.target.value as 'least_loaded' | 'specific_agent' | 'round_robin')
                }
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="least_loaded">Least Loaded Agent</option>
                <option value="round_robin">Round Robin</option>
                <option value="specific_agent">Specific Agent</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Priority Override</label>
              <select
                value={rulePriority}
                onChange={(e) => setRulePriority(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="Keep">Keep Incoming</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Standard">Standard</option>
              </select>
            </div>
          </div>

          {ruleStrategy === 'specific_agent' && (
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Target Agent</label>
              <select
                value={ruleAgentId}
                onChange={(e) => setRuleAgentId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={() => setNewRuleOpen(false)}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Save Rule</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
