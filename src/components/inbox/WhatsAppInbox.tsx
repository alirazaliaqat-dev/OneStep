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
  onInspectFullThread,
  onOpenFullInbox,
  title = 'Omnichannel Chats',
  subtitle,
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

  const chatHeightClass = compact ? 'h-[500px] lg:h-[520px]' : 'h-[560px] lg:h-[600px]';

  return (
    <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
      {/* Top Omnichannel Filter Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#202020]/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <AppearHeading as="h2" className="text-[16px] md:text-[17px] font-semibold text-black truncate">
            {title}
          </AppearHeading>
          <p className="text-[12px] sm:text-[12.5px] text-black/65 mt-0.5 truncate">
            {subtitle ||
              `Facebook · Instagram · Messenger · TikTok (${visibleQueries.length} active)`}
          </p>
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
                  count: platformCounts.Facebook,
                  icon: <SourceAppIcon app="Facebook" size="xs" />,
                },
                {
                  value: 'Instagram',
                  label: 'Instagram',
                  count: platformCounts.Instagram,
                  icon: <SourceAppIcon app="Instagram" size="xs" />,
                },
                {
                  value: 'Messenger',
                  label: 'Messenger',
                  count: platformCounts.Messenger,
                  icon: <SourceAppIcon app="Messenger" size="xs" />,
                },
                {
                  value: 'TikTok',
                  label: 'TikTok',
                  count: platformCounts.TikTok,
                  icon: <SourceAppIcon app="TikTok" size="xs" />,
                },
              ]}
            />
          )}

          {onOpenFullInbox && (
            <GlassButton variant="secondary" size="sm" onClick={onOpenFullInbox}>
              <span>Full Inbox</span>
            </GlassButton>
          )}
        </div>
      </div>

      {/* WhatsApp Responsive Split Pane (Mobile Master <-> Chat Switch, Desktop Side-by-Side) */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${chatHeightClass} min-h-0`}>
        {/* Left: WhatsApp Chats List */}
        <div
          className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#202020]/10 flex flex-col min-h-0 h-full bg-[#F8F8F8]/55 ${
            mobileShowChat && activeQuery ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-2.5 border-b border-[#202020]/8 flex items-center justify-between text-[12px] text-black/65 shrink-0">
            <span className="font-semibold text-black">Chats ({visibleQueries.length})</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#5DD62C]" />
              <span>Meta & TikTok Live</span>
            </span>
          </div>

          {visibleQueries.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-black/65 my-auto">
              No chats match this filter in your {activeRoleName} scope.
            </div>
          ) : (
            <div className="divide-y divide-[#202020]/8 flex-1 min-h-0 overflow-y-auto">
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.24) }}
                    onClick={() => {
                      triggerHaptic('selection');
                      onSelectQueryId(qry.id);
                      setMobileShowChat(true);
                    }}
                    className={`w-full text-left px-3.5 py-3 transition-colors cursor-pointer flex items-center gap-3 ${
                      selected
                        ? 'bg-[#5DD62C]/14'
                        : 'hover:bg-white/75 active:bg-[#5DD62C]/10'
                    }`}
                  >
                    {/* 44px WhatsApp Avatar + Corner Source App Icon */}
                    <div className="relative shrink-0">
                      <span className="w-11 h-11 rounded-full bg-white border border-[#202020]/12 text-black text-[13px] font-semibold inline-flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                        {getInitials(qry.customer_name)}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-[6px] ring-2 ring-[#F8F8F8]">
                        <SourceAppIcon
                          platform={qry.platform}
                          channel={qry.channel}
                          size="xs"
                        />
                      </span>
                    </div>

                    {/* Name, Timestamp, Last Message Preview & Unread Badge */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-black truncate">
                          {qry.customer_name}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums shrink-0 ${
                            isUnread ? 'text-[#337418] font-semibold' : 'text-black/55'
                          }`}
                        >
                          {formatRelativeTime(qry.updated_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] text-black/70 truncate flex items-center gap-1 min-w-0">
                          {lastIsAgent && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#337418] shrink-0" />
                          )}
                          <span className="truncate">{preview}</span>
                        </p>

                        {isUnread ? (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#5DD62C] text-[#0F0F0F] text-[11px] font-bold inline-flex items-center justify-center tabular-nums shrink-0 shadow-xs">
                            1
                          </span>
                        ) : (
                          <span className="text-[11px] text-black/50 whitespace-nowrap shrink-0">
                            {qry.assigned_employee_name?.split(' ')[0] || 'Open'}
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

        {/* Right: Authentic WhatsApp Chat View */}
        <div
          className={`lg:col-span-7 flex flex-col min-h-0 h-full ${
            !mobileShowChat && activeQuery ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {activeQuery ? (
            <>
              {/* WhatsApp Chat Top Bar */}
              <div className="px-3 sm:px-4 py-2.5 border-b border-[#202020]/10 bg-white/80 backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label="Back to chats list"
                    onClick={() => {
                      triggerHaptic('light');
                      setMobileShowChat(false);
                    }}
                    className="lg:hidden min-w-[38px] min-h-[38px] rounded-full bg-[#F8F8F8] border border-[#202020]/10 hover:bg-white text-black inline-flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform"
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
                      <span className="w-10 h-10 rounded-full bg-[#F8F8F8] border border-[#202020]/12 text-black text-[12.5px] font-semibold inline-flex items-center justify-center">
                        {getInitials(activeQuery.customer_name)}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-[5px] ring-2 ring-white">
                        <SourceAppIcon
                          platform={activeQuery.platform}
                          channel={activeQuery.channel}
                          size="xs"
                        />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14.5px] font-semibold text-black truncate group-hover:underline">
                        {activeQuery.customer_name}
                      </h3>
                      <p className="text-[11.5px] text-black/65 truncate flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#5DD62C] shrink-0" />
                        <span className="truncate">
                          online · {activeQuery.channel} ·{' '}
                          {activeQuery.assigned_employee_name || 'Unassigned'}
                        </span>
                      </p>
                    </div>
                  </button>
                </div>

                {/* Compact Right Header Actions (Always Single-Line) */}
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
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#5DD62C]" />
                          <span>Converted</span>
                        </>
                      ) : (
                        <>
                          <BriefcaseBusiness className="w-3.5 h-3.5 shrink-0 text-[#5DD62C]" />
                          <span>Convert Deal</span>
                        </>
                      )}
                    </GlassButton>
                  )}

                  {onInspectFullThread && (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      className="hidden xl:inline-flex"
                      onClick={() => onInspectFullThread(activeQuery.id)}
                    >
                      <span>Open Thread</span>
                    </GlassButton>
                  )}

                  <GlassButton
                    variant="secondary"
                    size="sm"
                    aria-label="Chat details and assignment"
                    onClick={() => setDetailsOpen(true)}
                  >
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Details</span>
                  </GlassButton>
                </div>
              </div>

              {/* Subtle Context Strip for Attribution & Status */}
              <div className="px-3.5 sm:px-4 py-1.5 border-b border-[#202020]/8 bg-[#F8F8F8]/95 flex items-center justify-between gap-2 text-[11.5px] text-black/75 shrink-0">
                <span className="truncate font-medium">
                  {activeQuery.subject} · {activeQuery.ad_creative_name || activeQuery.platform}
                </span>
                <span className="shrink-0 font-semibold text-[#337418] tabular-nums">
                  {activeQuery.status}
                </span>
              </div>

              {/* WhatsApp Wallpaper Chat Canvas */}
              <div className="flex-1 min-h-0 overflow-y-auto whatsapp-wallpaper px-3 sm:px-5 py-4 space-y-2.5">
                <div className="flex justify-center pb-1">
                  <span className="px-3 py-1 rounded-full bg-white/92 border border-[#202020]/10 text-[11px] font-medium text-black/65 shadow-xs">
                    Today · {activeQuery.platform} {activeQuery.channel}
                  </span>
                </div>

                {messages.map((msg) => {
                  const isAgent = msg.sender === 'agent';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[84%] sm:max-w-[74%] px-3.5 py-2 text-[13.5px] leading-snug text-black shadow-[0_2px_8px_-2px_rgba(15,15,15,0.08)] ${
                          isAgent
                            ? 'bg-[#5DD62C]/18 border border-[#337418]/28 rounded-2xl rounded-tr-[4px]'
                            : 'bg-white/95 border border-[#202020]/10 rounded-2xl rounded-tl-[4px]'
                        }`}
                      >
                        <p className="text-[11px] font-semibold text-black/60 mb-0.5">
                          {msg.author}
                        </p>
                        <p className="text-black break-words">{msg.body}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-black/55 tabular-nums">
                          <span>{formatBubbleClock(msg.timestamp)}</span>
                          {isAgent && <CheckCheck className="w-3.5 h-3.5 text-[#337418]" />}
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
                    className="px-3 py-2 border-t border-[#202020]/10 bg-white/95 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0"
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
                        className="px-3 py-1.5 rounded-full bg-[#F8F8F8] hover:bg-[#5DD62C]/20 border border-[#202020]/12 text-[12px] font-medium text-black whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {tpl}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* WhatsApp Bottom Pill Composer */}
              <form
                onSubmit={handleSend}
                className="px-3 py-2.5 border-t border-[#202020]/10 bg-white/90 backdrop-blur-xl flex items-center gap-2 shrink-0"
              >
                <button
                  type="button"
                  aria-label="Toggle quick reply templates"
                  disabled={!permissions.modifications.updateInquiries}
                  onClick={() => {
                    triggerHaptic('selection');
                    setQuickRepliesOpen((v) => !v);
                  }}
                  className={`w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors disabled:opacity-40 ${
                    quickRepliesOpen
                      ? 'bg-[#0F0F0F] text-[#5DD62C]'
                      : 'bg-[#F8F8F8] border border-[#202020]/12 text-black hover:bg-[#5DD62C]/20'
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
                  placeholder={`Message ${activeQuery.customer_name} on ${activeQuery.channel}...`}
                  className="flex-1 min-w-0 min-h-[40px] px-4 py-2 rounded-full bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
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
                  className="w-10 h-10 rounded-full bg-[#337418] hover:bg-[#5DD62C] text-[#F8F8F8] hover:text-[#0F0F0F] inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-45 shadow-[0_6px_14px_-4px_rgba(51,116,24,0.42)] transition-colors"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </form>
            </>
          ) : (
            <div className="p-10 text-center text-[13.5px] text-black/65 my-auto">
              Select a conversation on the left to start chatting in real time.
            </div>
          )}
        </div>
      </div>

      {/* Chat Info, Attribution, Specialist Assignment & Deal Conversion Drawer */}
      <SlideDrawer
        open={detailsOpen && Boolean(activeQuery)}
        onClose={() => setDetailsOpen(false)}
        title={activeQuery?.customer_name || 'Chat Details'}
        subtitle={activeQuery ? `${activeQuery.platform} · ${activeQuery.channel}` : undefined}
      >
        {activeQuery && (
          <div className="space-y-5 text-black">
            <section className="glass-panel-subtle rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <SourceAppIcon
                  platform={activeQuery.platform}
                  channel={activeQuery.channel}
                  size="md"
                />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-black truncate">
                    {activeQuery.customer_name}
                  </h3>
                  <p className="text-[12.5px] text-black/65 truncate">
                    {activeQuery.customer_handle}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[#202020]/10 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="text-black/60">Email</span>
                  <span className="font-medium text-black truncate">
                    {activeQuery.customer_email || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-black/60">Phone</span>
                  <span className="font-medium text-black tabular-nums">
                    {activeQuery.customer_phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-black/60">SLA Timer</span>
                  <span className="font-semibold text-[#337418] tabular-nums">
                    {formatSlaRemaining(activeQuery.sla_due_at, activeQuery.status)}
                  </span>
                </div>
              </div>
            </section>

            <section className="glass-panel-subtle rounded-2xl p-4 space-y-2">
              <h4 className="text-[13.5px] font-semibold text-black">Ad Creative & Campaign</h4>
              <p className="text-[13px] font-medium text-black">
                {activeQuery.ad_creative_name || 'Direct Channel Message'}
              </p>
              <p className="text-[12.5px] text-black/65">
                {activeQuery.campaign_name || activeQuery.platform} ·{' '}
                {activeQuery.ad_creative_format || activeQuery.channel}
              </p>
            </section>

            <section className="glass-panel-subtle rounded-2xl p-4 space-y-3">
              <h4 className="text-[13.5px] font-semibold text-black">Routing & Status</h4>
              <div>
                <label className="block text-[12px] font-medium text-black/65 mb-1">
                  Assigned Specialist
                </label>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-black/65 shrink-0" />
                  <select
                    aria-label="Assign chat specialist"
                    disabled={!permissions.modifications.assignTasks}
                    value={activeQuery.assigned_employee_id || ''}
                    onChange={(e) => {
                      triggerHaptic('medium');
                      onAssignQuery(activeQuery.id, e.target.value || null);
                    }}
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13px] font-medium text-black disabled:opacity-60"
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
                <label className="block text-[12px] font-medium text-black/65 mb-1">
                  Conversation Status
                </label>
                <select
                  aria-label="Update chat status"
                  disabled={!permissions.modifications.updateInquiries}
                  value={activeQuery.status}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    onUpdateQueryStatus(activeQuery.id, e.target.value as QueryStatus);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13px] font-medium text-black disabled:opacity-60"
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
                <BriefcaseBusiness className="w-4 h-4 shrink-0 text-[#5DD62C]" />
                <span>
                  {activeQuery.status === 'Resolved'
                    ? 'Already Converted to Deal'
                    : 'Convert Chat to CRM Deal'}
                </span>
              </GlassButton>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
