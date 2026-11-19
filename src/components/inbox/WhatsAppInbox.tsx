import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCheck,
  CheckCircle2,
  Info,
  Send,
  UserPlus,
  Zap,
} from 'lucide-react';
import type {
  Employee,
  MetaQuery,
  QueryMessage,
  QueryStatus,
  RolePermissions,
} from '../../types/crm';
import {
  formatRelativeTime,
  formatSlaRemaining,
  getInitials,
} from '../../utils/formatters';
import { AppearHeading, GlassButton, SegmentedControl, SlideDrawer } from '../ui/LiquidGlass';
import { SourceAppIcon } from '../ui/SourceAppIcon';
import { triggerHaptic } from '../../utils/haptics';

export type WhatsAppPlatformFilter = 'All' | 'Facebook' | 'Instagram' | 'Messenger' | 'TikTok';

interface WhatsAppInboxProps {
  queries: MetaQuery[];
  employees: Employee[];
  permissions: RolePermissions;
  activeRoleName: string;
  selectedQueryId: string | null;
  onSelectQueryId: (id: string) => void;
  onAssignQuery: (queryId: string, employeeId: string | null) => Promise<void>;
  onUpdateQueryStatus: (queryId: string, status: QueryStatus) => Promise<void>;
  onSendReply: (queryId: string, body: string, authorName: string) => Promise<void>;
  onConvertToLead?: (queryId: string, company: string, dealValue: number) => Promise<void>;
  onInspectFullThread?: (queryId: string) => void;
  onOpenFullInbox?: () => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  showPlatformFilter?: boolean;
  layoutIdPrefix?: string;
}

const QUICK_REPLIES = [
  'Hi! Sharing our multi-seat pricing & rollout timeline now.',
  'Thanks for reaching out — can we schedule a 15-min demo today?',
  'I have assigned a dedicated specialist to follow up shortly.',
  'Sent your wholesale quote sheet. Let us know if you need adjustments.',
];

function formatBubbleClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function WhatsAppInbox({
  queries,
  employees,
  permissions,
  activeRoleName,
  selectedQueryId,
  onSelectQueryId,
  onAssignQuery,
  onUpdateQueryStatus,
  onSendReply,
  onConvertToLead,
  onOpenFullInbox,
  title = 'Chats',
  compact = false,
  showPlatformFilter = true,
  layoutIdPrefix = 'wa-inbox',
}: WhatsAppInboxProps) {
  const [platformFilter, setPlatformFilter] = useState<WhatsAppPlatformFilter>('All');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const platformCounts = useMemo(() => {
    const counts = {
      All: queries.length,
      Facebook: 0,
      Instagram: 0,
      Messenger: 0,
      TikTok: 0,
    };
    for (const q of queries) {
      if (q.channel === 'Messenger') counts.Messenger += 1;
      else if (q.platform === 'Facebook') counts.Facebook += 1;
      else if (q.platform === 'Instagram') counts.Instagram += 1;
      else if (q.platform === 'TikTok') counts.TikTok += 1;
    }
    return counts;
  }, [queries]);

  const visibleQueries = useMemo(() => {
    if (!showPlatformFilter || platformFilter === 'All') return queries;
    return queries.filter((q) => {
      if (platformFilter === 'Messenger') return q.channel === 'Messenger';
      if (platformFilter === 'Facebook') return q.platform === 'Facebook' && q.channel !== 'Messenger';
      if (platformFilter === 'Instagram') return q.platform === 'Instagram';
      if (platformFilter === 'TikTok') return q.platform === 'TikTok';
      return true;
    });
  }, [queries, showPlatformFilter, platformFilter]);

  const activeQuery = useMemo(() => {
    return (
      visibleQueries.find((q) => q.id === selectedQueryId) ||
      visibleQueries[0] ||
      null
    );
  }, [visibleQueries, selectedQueryId]);

  const messages: QueryMessage[] = useMemo(() => {
    if (!activeQuery?.messages_json) return [];
    try {
      return JSON.parse(activeQuery.messages_json) as QueryMessage[];
    } catch {
      return [];
    }
  }, [activeQuery]);

  useEffect(() => {
    if (!activeQuery) return;
    const id = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return () => clearTimeout(id);
  }, [activeQuery?.id, messages.length]);

  const getLastMessage = (qry: MetaQuery): QueryMessage | null => {
    try {
      const list = JSON.parse(qry.messages_json) as QueryMessage[];
      return list[list.length - 1] || null;
    } catch {
      return null;
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeQuery || !replyDraft.trim() || !permissions.modifications.updateInquiries) return;
    setSending(true);
    try {
      const author =
        activeQuery.assigned_employee_name ||
        employees.find((emp) => emp.role === activeRoleName)?.full_name ||
        `${activeRoleName} Desk`;
      await onSendReply(activeQuery.id, replyDraft.trim(), author);
      setReplyDraft('');
      setQuickRepliesOpen(false);
    } finally {
      setSending(false);
    }
  };

  const chatHeightClass = compact ? 'h-[470px] lg:h-[500px]' : 'h-[560px] lg:h-[600px]';

  return (
    <div className="glass-panel rounded-[28px] overflow-hidden flex flex-col text-[#08131F]">
      {/* Calm Single-Row Filter Bar */}
      <div className="px-5 py-3.5 border-b border-white/55 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AppearHeading as="h2" className="text-[15.5px] font-semibold text-[#08131F] whitespace-nowrap">
            {title}
          </AppearHeading>
          <span className="text-[12.5px] text-[#08131F]/55 tabular-nums whitespace-nowrap">
            {visibleQueries.length} active
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
          {showPlatformFilter && (
            <SegmentedControl
              layoutId={`${layoutIdPrefix}-platform`}
              ariaLabel="Filter chats by platform"
              value={platformFilter}
              onChange={(next) => {
                setPlatformFilter(next);
                setMobileShowChat(false);
              }}
              options={[
                { value: 'All', label: 'All', count: platformCounts.All },
                {
                  value: 'Facebook',
                  label: 'Facebook',
                  icon: <SourceAppIcon app="Facebook" size="xs" />,
                },
                {
                  value: 'Instagram',
                  label: 'Instagram',
                  icon: <SourceAppIcon app="Instagram" size="xs" />,
                },
                {
                  value: 'Messenger',
                  label: 'Messenger',
                  icon: <SourceAppIcon app="Messenger" size="xs" />,
                },
                {
                  value: 'TikTok',
                  label: 'TikTok',
                  icon: <SourceAppIcon app="TikTok" size="xs" />,
                },
              ]}
            />
          )}

          {onOpenFullInbox && (
            <GlassButton variant="secondary" size="sm" onClick={onOpenFullInbox}>
              <span>All Inbox</span>
            </GlassButton>
          )}
        </div>
      </div>

      {/* WhatsApp Responsive Split Pane */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${chatHeightClass} min-h-0`}>
        {/* Left: Clean Chats List */}
        <div
          className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r border-white/55 flex flex-col min-h-0 h-full bg-white/15 ${
            mobileShowChat && activeQuery ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {visibleQueries.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#08131F]/60 my-auto">
              No chats in this channel.
            </div>
          ) : (
            <div className="divide-y divide-white/45 flex-1 min-h-0 overflow-y-auto">
              {visibleQueries.map((qry, index) => {
                const selected = activeQuery?.id === qry.id;
                const lastMsg = getLastMessage(qry);
                const lastIsAgent = lastMsg?.sender === 'agent';
                const preview = lastMsg?.body || qry.message_preview || qry.subject;
                const isUnread = qry.status === 'New';

                return (
                  <motion.button
                    key={qry.id}
                    type="button"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.2) }}
                    onClick={() => {
                      triggerHaptic('selection');
                      onSelectQueryId(qry.id);
                      setMobileShowChat(true);
                    }}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer flex items-center gap-3 ${
                      selected
                        ? 'bg-white/55'
                        : 'hover:bg-white/30 active:bg-white/45'
                    }`}
                  >
                    {/* Avatar + Source App Badge */}
                    <div className="relative shrink-0">
                      <span className="w-10 h-10 rounded-full bg-white/65 border border-white/85 text-[#08131F] text-[12.5px] font-semibold inline-flex items-center justify-center">
                        {getInitials(qry.customer_name)}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-[5px] ring-2 ring-[#E8EFF3]">
                        <SourceAppIcon
                          platform={qry.platform}
                          channel={qry.channel}
                          size="xs"
                        />
                      </span>
                    </div>

                    {/* Name, Timestamp & Preview */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-[#08131F] truncate">
                          {qry.customer_name}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums shrink-0 ${
                            isUnread ? 'text-[#16314A] font-semibold' : 'text-[#08131F]/50'
                          }`}
                        >
                          {formatRelativeTime(qry.updated_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] text-[#08131F]/65 truncate flex items-center gap-1 min-w-0">
                          {lastIsAgent && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#2E4F6B] shrink-0" />
                          )}
                          <span className="truncate">{preview}</span>
                        </p>

                        {isUnread && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#08131F] text-[#E8EFF3] text-[10.5px] font-semibold inline-flex items-center justify-center tabular-nums shrink-0">
                            1
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Clean WhatsApp Chat Experience */}
        <div
          className={`lg:col-span-7 flex flex-col min-h-0 h-full ${
            !mobileShowChat && activeQuery ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {activeQuery ? (
            <>
              {/* Clean Single-Row Chat Header */}
              <div className="px-4 py-3 border-b border-white/55 bg-white/30 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label="Back to chats list"
                    onClick={() => {
                      triggerHaptic('light');
                      setMobileShowChat(false);
                    }}
                    className="lg:hidden w-9 h-9 rounded-full bg-white/55 border border-white/80 text-[#08131F] inline-flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDetailsOpen(true);
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <span className="w-9 h-9 rounded-full bg-white/70 border border-white/85 text-[#08131F] text-[12px] font-semibold inline-flex items-center justify-center">
                        {getInitials(activeQuery.customer_name)}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-[5px] ring-2 ring-[#E8EFF3]">
                        <SourceAppIcon
                          platform={activeQuery.platform}
                          channel={activeQuery.channel}
                          size="xs"
                        />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-[#08131F] truncate group-hover:underline">
                        {activeQuery.customer_name}
                      </h3>
                      <p className="text-[11.5px] text-[#08131F]/60 truncate">
                        {activeQuery.channel} · {activeQuery.assigned_employee_name || 'Unassigned'} · {activeQuery.status}
                      </p>
                    </div>
                  </button>
                </div>

                {/* Minimal Header Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {onConvertToLead && permissions.modifications.manageDeals && (
                    <GlassButton
                      variant="primary"
                      size="sm"
                      haptic="success"
                      className="hidden sm:inline-flex"
                      disabled={converting || activeQuery.status === 'Resolved'}
                      onClick={async () => {
                        setConverting(true);
                        try {
                          await onConvertToLead(
                            activeQuery.id,
                            activeQuery.customer_handle || activeQuery.customer_name,
                            18000
                          );
                        } finally {
                          setConverting(false);
                        }
                      }}
                    >
                      {activeQuery.status === 'Resolved' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#A9BDC9]" />
                          <span>Converted</span>
                        </>
                      ) : (
                        <>
                          <BriefcaseBusiness className="w-3.5 h-3.5 shrink-0 text-[#A9BDC9]" />
                          <span>Convert</span>
                        </>
                      )}
                    </GlassButton>
                  )}

                  <GlassButton
                    variant="secondary"
                    size="sm"
                    aria-label="Chat details and assignment"
                    onClick={() => setDetailsOpen(true)}
                  >
                    <Info className="w-3.5 h-3.5 shrink-0 text-[#2E4F6B]" />
                    <span>Details</span>
                  </GlassButton>
                </div>
              </div>

              {/* Serene Translucent Message Canvas */}
              <div className="flex-1 min-h-0 overflow-y-auto whatsapp-wallpaper px-4 sm:px-5 py-4 space-y-2.5">
                <div className="flex justify-center pb-1">
                  <span className="text-[11px] font-medium text-[#08131F]/55">
                    {activeQuery.platform} · {activeQuery.ad_creative_name || activeQuery.subject}
                  </span>
                </div>

                {messages.map((msg) => {
                  const isAgent = msg.sender === 'agent';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[82%] sm:max-w-[74%] px-3.5 py-2.5 text-[13.5px] leading-snug text-[#08131F] backdrop-blur-md ${
                          isAgent
                            ? 'bg-[#2E4F6B]/16 border border-white/75 rounded-2xl rounded-tr-[4px]'
                            : 'bg-white/72 border border-white/90 rounded-2xl rounded-tl-[4px]'
                        }`}
                      >
                        <p className="text-[#08131F] break-words">{msg.body}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-[#08131F]/50 tabular-nums">
                          <span>{formatBubbleClock(msg.timestamp)}</span>
                          {isAgent && <CheckCheck className="w-3.5 h-3.5 text-[#16314A]" />}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Popover Strip */}
              <AnimatePresence>
                {quickRepliesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16 }}
                    className="px-3.5 py-2 border-t border-white/55 bg-white/45 backdrop-blur-md flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0"
                  >
                    {QUICK_REPLIES.map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          setReplyDraft(tpl);
                          setQuickRepliesOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-full bg-white/65 hover:bg-white/90 border border-white/85 text-[12px] font-medium text-[#08131F] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {tpl}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* WhatsApp Pill Composer */}
              <form
                onSubmit={handleSend}
                className="px-3.5 py-2.5 border-t border-white/55 bg-white/30 backdrop-blur-md flex items-center gap-2 shrink-0"
              >
                <button
                  type="button"
                  aria-label="Toggle quick reply templates"
                  disabled={!permissions.modifications.updateInquiries}
                  onClick={() => {
                    triggerHaptic('selection');
                    setQuickRepliesOpen((v) => !v);
                  }}
                  className={`w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors disabled:opacity-40 ${
                    quickRepliesOpen
                      ? 'bg-[#08131F] text-[#E8EFF3]'
                      : 'bg-white/55 border border-white/80 text-[#2E4F6B] hover:bg-white/80'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </button>

                <label htmlFor={`${layoutIdPrefix}-composer`} className="sr-only">
                  Type a message
                </label>
                <input
                  id={`${layoutIdPrefix}-composer`}
                  type="text"
                  disabled={!permissions.modifications.updateInquiries}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder={`Message ${activeQuery.customer_name}...`}
                  className="flex-1 min-w-0 min-h-[38px] px-4 py-1.5 rounded-full bg-white/60 border border-white/85 text-[13.5px] text-[#08131F] placeholder:text-[#08131F]/45 focus:outline-none focus:bg-white/85 focus:border-[#2E4F6B]"
                />

                <motion.button
                  type="submit"
                  aria-label="Send message"
                  whileTap={{ scale: 0.92 }}
                  disabled={
                    sending ||
                    !replyDraft.trim() ||
                    !permissions.modifications.updateInquiries
                  }
                  onClick={() => triggerHaptic('success')}
                  className="w-9 h-9 rounded-full bg-[#08131F] hover:bg-[#16314A] text-[#E8EFF3] inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 shadow-[0_6px_14px_-4px_rgba(8,19,31,0.36)] transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </form>
            </>
          ) : (
            <div className="p-10 text-center text-[13.5px] text-[#08131F]/55 my-auto">
              Select a chat to reply.
            </div>
          )}
        </div>
      </div>

      {/* Chat Info & Assignment Drawer */}
      <SlideDrawer
        open={detailsOpen && Boolean(activeQuery)}
        onClose={() => setDetailsOpen(false)}
        title={activeQuery?.customer_name || 'Chat Details'}
        subtitle={activeQuery ? `${activeQuery.platform} · ${activeQuery.channel}` : undefined}
      >
        {activeQuery && (
          <div className="space-y-5 text-[#08131F]">
            <section className="glass-panel-subtle rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <SourceAppIcon
                  platform={activeQuery.platform}
                  channel={activeQuery.channel}
                  size="md"
                />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#08131F] truncate">
                    {activeQuery.customer_name}
                  </h3>
                  <p className="text-[12.5px] text-[#08131F]/60 truncate">
                    {activeQuery.customer_handle}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[#08131F]/10 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="text-[#08131F]/60">Email</span>
                  <span className="font-medium truncate">
                    {activeQuery.customer_email || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#08131F]/60">Phone</span>
                  <span className="font-medium tabular-nums">
                    {activeQuery.customer_phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#08131F]/60">SLA Timer</span>
                  <span className="font-semibold text-[#2E4F6B] tabular-nums">
                    {formatSlaRemaining(activeQuery.sla_due_at, activeQuery.status)}
                  </span>
                </div>
              </div>
            </section>

            <section className="glass-panel-subtle rounded-2xl p-4 space-y-1.5">
              <h4 className="text-[13px] font-semibold text-[#08131F]">Ad Creative & Campaign</h4>
              <p className="text-[13px] font-medium text-[#08131F]">
                {activeQuery.ad_creative_name || 'Direct Channel Message'}
              </p>
              <p className="text-[12.5px] text-[#08131F]/60">
                {activeQuery.campaign_name || activeQuery.platform} ·{' '}
                {activeQuery.ad_creative_format || activeQuery.channel}
              </p>
            </section>

            <section className="glass-panel-subtle rounded-2xl p-4 space-y-3">
              <h4 className="text-[13px] font-semibold text-[#08131F]">Routing & Status</h4>
              <div>
                <label className="block text-[12px] font-medium text-[#08131F]/65 mb-1">
                  Assigned Specialist
                </label>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#2E4F6B] shrink-0" />
                  <select
                    aria-label="Assign chat specialist"
                    disabled={!permissions.modifications.assignTasks}
                    value={activeQuery.assigned_employee_id || ''}
                    onChange={(e) => {
                      triggerHaptic('medium');
                      onAssignQuery(activeQuery.id, e.target.value || null);
                    }}
                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-white/60 border border-white/85 text-[13px] font-medium text-[#08131F] disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.active_queries || 0}/{emp.max_capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#08131F]/65 mb-1">
                  Status
                </label>
                <select
                  aria-label="Update chat status"
                  disabled={!permissions.modifications.updateInquiries}
                  value={activeQuery.status}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    onUpdateQueryStatus(activeQuery.id, e.target.value as QueryStatus);
                  }}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white/60 border border-white/85 text-[13px] font-medium text-[#08131F] disabled:opacity-60"
                >
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Replied">Replied</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </section>

            {onConvertToLead && permissions.modifications.manageDeals && (
              <GlassButton
                variant="primary"
                className="w-full"
                haptic="success"
                disabled={converting || activeQuery.status === 'Resolved'}
                onClick={async () => {
                  setConverting(true);
                  try {
                    await onConvertToLead(
                      activeQuery.id,
                      activeQuery.customer_handle || activeQuery.customer_name,
                      18000
                    );
                    setDetailsOpen(false);
                  } finally {
                    setConverting(false);
                  }
                }}
              >
                <BriefcaseBusiness className="w-4 h-4 shrink-0 text-[#A9BDC9]" />
                <span>
                  {activeQuery.status === 'Resolved'
                    ? 'Already Converted'
                    : 'Convert to CRM Deal'}
                </span>
              </GlassButton>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
