import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Trash2, Edit3 } from 'lucide-react';
import type { AdCampaign, CrmLead, Employee, LeadStage, QueryChannel } from '../../types/crm';
import { formatCurrency, formatRelativeTime } from '../../utils/formatters';
import { AppearHeading, GlassButton, RevealWidget, SegmentedControl, SlideDrawer } from '../ui/LiquidGlass';
import { SourceAppIcon } from '../ui/SourceAppIcon';
import { triggerHaptic } from '../../utils/haptics';

interface PipelineViewProps {
  leads: CrmLead[];
  employees: Employee[];
  campaigns: AdCampaign[];
  searchQuery: string;
  createDrawerOpen: boolean;
  onCloseCreateDrawer: () => void;
  onCreateLead: (payload: Partial<CrmLead>) => Promise<void>;
  onUpdateLead: (id: string, payload: Partial<CrmLead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
}

const PIPELINE_STAGES: LeadStage[] = ['New Lead', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won'];

export function PipelineView({
  leads,
  employees,
  campaigns,
  searchQuery,
  createDrawerOpen,
  onCloseCreateDrawer,
  onCreateLead,
  onUpdateLead,
  onDeleteLead,
}: PipelineViewProps) {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [stageFilter, setStageFilter] = useState<'All' | LeadStage>('All');
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);

  // Create form state
  const [contactName, setContactName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dealValue, setDealValue] = useState('18000');
  const [stage, setStage] = useState<LeadStage>('New Lead');
  const [ownerId, setOwnerId] = useState(employees[0]?.id || '');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || '');
  const [sourceChannel, setSourceChannel] = useState<QueryChannel>('Lead Form');
  const [notes, setNotes] = useState('');

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stageFilter !== 'All' && lead.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        lead.company.toLowerCase().includes(q) ||
        lead.contact_name.toLowerCase().includes(q) ||
        (lead.owner_name || '').toLowerCase().includes(q) ||
        (lead.campaign_name || '').toLowerCase().includes(q)
      );
    });
  }, [leads, stageFilter, searchQuery]);

  const handleAdvanceStage = async (lead: CrmLead) => {
    const idx = PIPELINE_STAGES.indexOf(lead.stage);
    if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return;
    const nextStage = PIPELINE_STAGES[idx + 1];
    await onUpdateLead(lead.id, { stage: nextStage });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !company.trim()) return;
    await onCreateLead({
      contact_name: contactName.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      deal_value: Number(dealValue) || 12000,
      stage,
      owner_id: ownerId || employees[0]?.id || null,
      campaign_id: campaignId || campaigns[0]?.id || null,
      source_channel: sourceChannel,
      notes: notes.trim(),
    });
    setContactName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setDealValue('18000');
    setNotes('');
    onCloseCreateDrawer();
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    await onUpdateLead(editingLead.id, {
      contact_name: editingLead.contact_name,
      company: editingLead.company,
      email: editingLead.email,
      phone: editingLead.phone,
      deal_value: Number(editingLead.deal_value),
      stage: editingLead.stage,
      owner_id: editingLead.owner_id,
      notes: editingLead.notes,
    });
    setEditingLead(null);
  };

  return (
    <div className="space-y-4 sm:space-y-5 text-black">
      {/* Toolbar */}
      <RevealWidget className="glass-panel rounded-3xl p-3.5 sm:p-4 md:px-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          layoutId="crm-view-mode"
          ariaLabel="CRM Pipeline View Mode"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'board', label: 'Pipeline Board' },
            { value: 'table', label: 'Lead Directory', count: filteredLeads.length },
          ]}
        />

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full">
          <SegmentedControl
            layoutId="crm-stage-filter"
            ariaLabel="Filter deals by stage"
            value={stageFilter}
            onChange={setStageFilter}
            options={[
              { value: 'All', label: 'All Stages' },
              { value: 'New Lead', label: 'New' },
              { value: 'Qualified', label: 'Qualified' },
              { value: 'Proposal Sent', label: 'Proposal' },
              { value: 'Negotiation', label: 'Negotiation' },
              { value: 'Won', label: 'Won' },
            ]}
          />
        </div>
      </RevealWidget>

      {viewMode === 'board' ? (
        <div className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-3 snap-x scrollbar-none">
          {PIPELINE_STAGES.filter((s) => stageFilter === 'All' || stageFilter === s).map((colStage, colIdx) => {
            const colLeads = filteredLeads.filter((l) => l.stage === colStage);
            const colTotal = colLeads.reduce((acc, l) => acc + Number(l.deal_value || 0), 0);
            return (
              <motion.section
                key={colStage}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28, delay: colIdx * 0.05 }}
                className={`${
                  stageFilter === 'All' ? 'w-[84vw] max-w-[290px] sm:w-[280px] shrink-0' : 'w-full max-w-xl'
                } snap-start glass-panel rounded-3xl p-4 flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#202020]/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <AppearHeading as="h2" className="text-[14px] font-semibold text-black truncate">
                      {colStage}
                    </AppearHeading>
                    <span className="text-[12px] font-medium text-black/55 tabular-nums shrink-0">
                      {colLeads.length}
                    </span>
                  </div>
                  <span className="text-[12.5px] font-semibold text-black/75 tabular-nums shrink-0">
                    {formatCurrency(colTotal)}
                  </span>
                </div>

                {colLeads.length === 0 ? (
                  <p className="text-[12.5px] text-black/55 py-8 text-center">No deals in stage</p>
                ) : (
                  <div className="space-y-3">
                    {colLeads.map((lead, cardIdx) => (
                      <motion.article
                        key={lead.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: cardIdx * 0.04 }}
                        className="rounded-2xl bg-white/95 border border-[#202020]/10 p-3.5 space-y-2.5 overflow-hidden shadow-[0_4px_12px_-6px_rgba(15,15,15,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[13.5px] font-semibold text-black truncate">
                              {lead.company}
                            </h3>
                            <p className="text-[12px] text-black/65 truncate mt-0.5">
                              {lead.contact_name}
                            </p>
                          </div>
                          <span className="text-[13px] font-semibold text-black tabular-nums shrink-0">
                            {formatCurrency(lead.deal_value)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[12px] text-black/75 min-w-0">
                          <SourceAppIcon channel={lead.source_channel} size="xs" />
                          <span className="truncate">
                            {lead.source_channel} · {lead.owner_name || 'Unassigned'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#202020]/10">
                          <GlassButton
                            variant="ghost"
                            size="sm"
                            className="!min-h-[34px] !px-2.5 !text-[12px]"
                            onClick={() => setEditingLead(lead)}
                          >
                            <Edit3 className="w-3.5 h-3.5 shrink-0" />
                            <span>Details</span>
                          </GlassButton>
                          {colStage !== 'Won' && (
                            <GlassButton
                              variant="secondary"
                              size="sm"
                              haptic="medium"
                              className="!min-h-[34px] !px-3 !text-[12px]"
                              onClick={() => handleAdvanceStage(lead)}
                            >
                              <span>Advance</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </GlassButton>
                          )}
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>
      ) : (
        <RevealWidget className="glass-panel rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F8F8]/90 text-[12px] font-semibold text-black/70 border-b border-[#202020]/10">
                  <th className="py-3 px-5">Company & Contact</th>
                  <th className="py-3 px-4">App Source</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4 text-right">Deal Value</th>
                  <th className="py-3 px-4 text-right">Updated</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020]/10 text-[13.5px]">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8F8F8] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-black">{lead.company}</div>
                      <div className="text-[12px] text-black/65">
                        {lead.contact_name} · {lead.email || lead.phone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-black">
                      <div className="inline-flex items-center gap-2 font-medium">
                        <SourceAppIcon channel={lead.source_channel} size="xs" />
                        <span>{lead.source_channel}</span>
                      </div>
                      <div className="text-[12px] text-black/65 truncate max-w-[190px] mt-0.5">
                        {lead.campaign_name || 'Direct Entry'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-black">
                      {lead.stage} · {lead.probability}%
                    </td>
                    <td className="py-3.5 px-4 text-black">{lead.owner_name || 'Unassigned'}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-black">
                      {formatCurrency(lead.deal_value)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-black/65">
                      {formatRelativeTime(lead.updated_at)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <GlassButton variant="secondary" size="sm" onClick={() => setEditingLead(lead)}>
                        <span>Inspect</span>
                      </GlassButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealWidget>
      )}

      {/* New Lead Drawer */}
      <SlideDrawer
        open={createDrawerOpen}
        onClose={onCloseCreateDrawer}
        title="New CRM Lead"
        subtitle="Add a prospect to the commercial pipeline"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Company</label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Harborview Retail"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Primary Contact</label>
            <input
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Maya Brooks"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maya@harborview.com"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (415) 555-0192"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Deal Value (USD)</label>
              <input
                type="number"
                min={0}
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black tabular-nums focus:outline-none focus:border-[#337418]"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Initial Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as LeadStage)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black focus:outline-none focus:border-[#337418]"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black focus:outline-none focus:border-[#337418]"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Ad Campaign</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black focus:outline-none focus:border-[#337418]"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Source App & Channel</label>
            <select
              value={sourceChannel}
              onChange={(e) => setSourceChannel(e.target.value as QueryChannel)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black focus:outline-none focus:border-[#337418]"
            >
              <option value="Lead Form">Facebook · Lead Form</option>
              <option value="Instagram DM">Instagram · DM</option>
              <option value="Messenger">Messenger · Chat</option>
              <option value="Ad Comment">Facebook · Ad Comment</option>
              <option value="TikTok DM">TikTok · DM</option>
              <option value="TikTok Lead">TikTok · Lead Form</option>
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Qualification notes, timeline, or contract scope..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={onCloseCreateDrawer}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Create Lead</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>

      {/* Edit Lead Drawer */}
      <SlideDrawer
        open={Boolean(editingLead)}
        onClose={() => setEditingLead(null)}
        title={editingLead?.company || 'Lead Details'}
        subtitle={editingLead ? `${editingLead.contact_name} · ${editingLead.source_channel}` : ''}
      >
        {editingLead && (
          <form onSubmit={handleEditSave} className="space-y-4 text-black">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Stage</label>
                <select
                  value={editingLead.stage}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, stage: e.target.value as LeadStage })
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="Closed Lost">Closed Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Deal Value (USD)</label>
                <input
                  type="number"
                  min={0}
                  value={editingLead.deal_value}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, deal_value: Number(e.target.value) })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Assigned Owner</label>
              <select
                value={editingLead.owner_id || ''}
                onChange={(e) => setEditingLead({ ...editingLead, owner_id: e.target.value })}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Email</label>
                <input
                  value={editingLead.email}
                  onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Phone</label>
                <input
                  value={editingLead.phone}
                  onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Deal Notes</label>
              <textarea
                rows={4}
                value={editingLead.notes}
                onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13.5px] text-black"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#202020]/10">
              <GlassButton
                variant="danger"
                size="sm"
                haptic="warning"
                onClick={async () => {
                  triggerHaptic('warning');
                  await onDeleteLead(editingLead.id);
                  setEditingLead(null);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Deal</span>
              </GlassButton>
              <div className="flex items-center gap-2">
                <GlassButton variant="secondary" size="sm" onClick={() => setEditingLead(null)}>
                  <span>Cancel</span>
                </GlassButton>
                <GlassButton type="submit" variant="primary" size="sm" haptic="success">
                  <span>Save Deal</span>
                </GlassButton>
              </div>
            </div>
          </form>
        )}
      </SlideDrawer>
    </div>
  );
}
