import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  CalendarDays,
  Wallet,
  Award,
  Check,
  X,
  Plus,
  LogIn,
  LogOut,
} from 'lucide-react';
import type { Employee, HrmsOverviewResponse, RolePermissions } from '../../types/crm';
import { formatCurrency } from '../../utils/formatters';
import { AppearHeading, GlassButton, RevealWidget, SegmentedControl, SlideDrawer } from '../ui/LiquidGlass';
import { triggerHaptic } from '../../utils/haptics';

interface HrmsViewProps {
  hrms: HrmsOverviewResponse | null;
  employees: Employee[];
  permissions: RolePermissions;
  searchQuery: string;
  requestLeaveOpen: boolean;
  onCloseRequestLeave: () => void;
  onOpenRequestLeave: () => void;
  onClockAttendance: (payload: {
    employee_id: string;
    work_mode: string;
    action: 'in' | 'out';
  }) => Promise<void>;
  onCreateLeave: (payload: {
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) => Promise<void>;
  onUpdateLeaveStatus: (id: string, status: 'Approved' | 'Declined') => Promise<void>;
  onRunPayroll: (period: string) => Promise<void>;
  onCreateReview: (payload: {
    employee_id: string;
    reviewer_name: string;
    review_cycle: string;
    rating: number;
    attendance_score: number;
    crm_attainment_pct: number;
    summary: string;
  }) => Promise<void>;
}

type HrmsSubTab = 'attendance' | 'leaves' | 'payroll' | 'reviews';

export function HrmsView({
  hrms,
  employees,
  permissions,
  searchQuery,
  requestLeaveOpen,
  onCloseRequestLeave,
  onOpenRequestLeave,
  onClockAttendance,
  onCreateLeave,
  onUpdateLeaveStatus,
  onRunPayroll,
  onCreateReview,
}: HrmsViewProps) {
  const [subTab, setSubTab] = useState<HrmsSubTab>('attendance');
  const [clockEmployeeId, setClockEmployeeId] = useState(employees[0]?.id || 'emp_claire');
  const [clockMode, setClockMode] = useState<'On-Site' | 'Remote' | 'Hybrid'>('On-Site');
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [newReviewOpen, setNewReviewOpen] = useState(false);

  // Leave form state
  const [leaveEmpId, setLeaveEmpId] = useState(employees[0]?.id || 'emp_david');
  const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Personal' | 'Parental'>('Annual');
  const [leaveStart, setLeaveStart] = useState('2026-12-01');
  const [leaveEnd, setLeaveEnd] = useState('2026-12-02');
  const [leaveReason, setLeaveReason] = useState('');

  // Review form state
  const [revEmpId, setRevEmpId] = useState(employees[1]?.id || employees[0]?.id || '');
  const [revCycle, setRevCycle] = useState('Q4 2026');
  const [revRating, setRevRating] = useState('4.8');
  const [revAttendance, setRevAttendance] = useState('98');
  const [revAttainment, setRevAttainment] = useState('108');
  const [revSummary, setRevSummary] = useState('');

  const qLower = searchQuery.trim().toLowerCase();
  const canApproveOrManage =
    permissions.modifications.assignTasks || permissions.modifications.manageTeam;
  const canRunPayroll = permissions.modifications.manageTeam;

  const filteredAttendance = useMemo(() => {
    const rows = hrms?.attendance || [];
    if (!qLower) return rows;
    return rows.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(qLower) ||
        r.work_mode.toLowerCase().includes(qLower) ||
        r.department_name.toLowerCase().includes(qLower)
    );
  }, [hrms, qLower]);

  const filteredLeaves = useMemo(() => {
    const rows = hrms?.leaves || [];
    if (!qLower) return rows;
    return rows.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(qLower) ||
        r.leave_type.toLowerCase().includes(qLower) ||
        r.status.toLowerCase().includes(qLower)
    );
  }, [hrms, qLower]);

  const filteredPayroll = useMemo(() => {
    const rows = hrms?.payroll || [];
    if (!qLower) return rows;
    return rows.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(qLower) ||
        r.department_name.toLowerCase().includes(qLower)
    );
  }, [hrms, qLower]);

  const filteredReviews = useMemo(() => {
    const rows = hrms?.reviews || [];
    if (!qLower) return rows;
    return rows.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(qLower) ||
        r.summary.toLowerCase().includes(qLower)
    );
  }, [hrms, qLower]);

  const m = hrms?.metrics;

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;
    await onCreateLeave({
      employee_id: leaveEmpId,
      leave_type: leaveType,
      start_date: leaveStart,
      end_date: leaveEnd,
      reason: leaveReason.trim(),
    });
    setLeaveReason('');
    onCloseRequestLeave();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revSummary.trim()) return;
    await onCreateReview({
      employee_id: revEmpId,
      reviewer_name: employees[0]?.full_name || 'Claire Bennett',
      review_cycle: revCycle,
      rating: Number(revRating) || 4.7,
      attendance_score: Number(revAttendance) || 96,
      crm_attainment_pct: Number(revAttainment) || 100,
      summary: revSummary.trim(),
    });
    setRevSummary('');
    setNewReviewOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-5 text-black">
      {/* Unified HRMS Crystal-Clear Metric Strip */}
      <RevealWidget ariaLabel="HRMS Overview Metrics" className="glass-panel rounded-[28px] overflow-hidden">
        <div className="grid grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/55">
          {[
            {
              label: 'Present Today',
              value: `${m?.presentToday || 0} / ${m?.totalHeadcount || employees.length}`,
              detail: 'On-Site & Remote',
            },
            {
              label: 'Pending Leaves',
              value: String(m?.pendingLeaves || 0),
              detail: 'Awaiting review',
            },
            {
              label: 'Monthly Payroll',
              value: permissions.reporting.viewFinancialRoas
                ? formatCurrency(m?.monthlyPayrollTotal || 0)
                : 'Restricted',
              detail: 'Base + 5% CRM commission',
            },
            {
              label: 'Avg Rating',
              value: `${m?.avgRating || 4.7} / 5.0`,
              detail: 'Attendance & quota',
            },
          ].map((kpi, idx) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: idx * 0.03 }}
              className="px-5 py-4 flex flex-col justify-between gap-1.5"
            >
              <span className="text-[12px] font-medium text-[#08131F]/60">{kpi.label}</span>
              <div className="text-[24px] font-semibold tracking-tight text-[#08131F] tabular-nums leading-none">
                {kpi.value}
              </div>
              <p className="text-[11.5px] text-[#08131F]/55 truncate">{kpi.detail}</p>
            </motion.div>
          ))}
        </div>
      </RevealWidget>

      {/* HRMS Sub-Tab Bar & Contextual Actions */}
      <RevealWidget className="glass-panel rounded-full p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          layoutId="hrms-subtab-control"
          ariaLabel="HRMS Sections"
          value={subTab}
          onChange={setSubTab}
          options={[
            { value: 'attendance', label: 'Attendance', count: filteredAttendance.length },
            { value: 'leaves', label: 'Leave & Time Off', count: filteredLeaves.length },
            { value: 'payroll', label: 'Payroll & Commissions', count: filteredPayroll.length },
            { value: 'reviews', label: 'Reviews', count: filteredReviews.length },
          ]}
        />

        <div className="flex items-center gap-2 shrink-0">
          {subTab === 'leaves' && (
            <GlassButton variant="primary" size="sm" onClick={onOpenRequestLeave}>
              <Plus className="w-3.5 h-3.5" />
              <span>Request Leave</span>
            </GlassButton>
          )}
          {subTab === 'payroll' && canRunPayroll && (
            <GlassButton
              variant="primary"
              size="sm"
              haptic="success"
              disabled={runningPayroll}
              onClick={async () => {
                setRunningPayroll(true);
                try {
                  await onRunPayroll('November 2026');
                } finally {
                  setRunningPayroll(false);
                }
              }}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{runningPayroll ? 'Processing...' : 'Run Payroll'}</span>
            </GlassButton>
          )}
          {subTab === 'reviews' && canApproveOrManage && (
            <GlassButton variant="primary" size="sm" onClick={() => setNewReviewOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>Log Review</span>
            </GlassButton>
          )}
        </div>
      </RevealWidget>

      {/* Attendance & Quick Clock-In */}
      {subTab === 'attendance' && (
        <div className="space-y-4">
          <RevealWidget className="glass-panel rounded-3xl p-4 md:px-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Select employee for clock action"
                value={clockEmployeeId}
                onChange={(e) => setClockEmployeeId(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13px] font-medium text-black"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Work mode"
                value={clockMode}
                onChange={(e) => setClockMode(e.target.value as 'On-Site' | 'Remote' | 'Hybrid')}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13px] font-medium text-black"
              >
                <option value="On-Site">On-Site</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <GlassButton
                variant="primary"
                size="sm"
                haptic="success"
                onClick={() =>
                  onClockAttendance({
                    employee_id: clockEmployeeId,
                    work_mode: clockMode,
                    action: 'in',
                  })
                }
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Clock In</span>
              </GlassButton>
              <GlassButton
                variant="secondary"
                size="sm"
                haptic="medium"
                onClick={() =>
                  onClockAttendance({
                    employee_id: clockEmployeeId,
                    work_mode: clockMode,
                    action: 'out',
                  })
                }
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Clock Out</span>
              </GlassButton>
            </div>
          </RevealWidget>

          <RevealWidget delay={0.05} className="glass-panel rounded-[28px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/30 text-[12px] font-semibold text-[#08131F]/65 border-b border-white/55">
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-4">Work Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Clock In</th>
                    <th className="py-3 px-4 text-right">Clock Out</th>
                    <th className="py-3 px-5 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/45 text-[13.5px]">
                  {filteredAttendance.map((att) => (
                    <tr key={att.id} className="hover:bg-white/35 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-black">{att.employee_name}</div>
                        <div className="text-[12px] text-black/65">
                          {att.employee_title} · {att.department_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-black">{att.work_mode}</td>
                      <td className="py-3.5 px-4 font-medium text-black">{att.status}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black">
                        {att.clock_in}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black/65">
                        {att.clock_out || 'Active Shift'}
                      </td>
                      <td className="py-3.5 px-5 text-right tabular-nums font-semibold text-black">
                        {att.hours_worked}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealWidget>
        </div>
      )}

      {/* Leave & Time Off */}
      {subTab === 'leaves' && (
        <RevealWidget className="glass-panel rounded-[28px] overflow-hidden">
          <div className="divide-y divide-white/45">
            {filteredLeaves.map((lv) => (
              <div
                key={lv.id}
                className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-[14.5px] font-semibold text-black">
                    <span className="truncate">{lv.employee_name}</span>
                    <span className="text-[12px] font-medium text-black/65 shrink-0">
                      · {lv.leave_type} · {lv.days_count}d · {lv.status}
                    </span>
                  </div>
                  <p className="text-[13px] text-black/80">{lv.reason}</p>
                  <p className="text-[12px] text-black/65 tabular-nums">
                    {lv.start_date} to {lv.end_date} · {lv.leave_balance} days balance remaining
                    {lv.reviewed_by ? ` · Reviewed by ${lv.reviewed_by}` : ''}
                  </p>
                </div>

                {lv.status === 'Pending' && canApproveOrManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <GlassButton
                      variant="primary"
                      size="sm"
                      haptic="success"
                      onClick={() => onUpdateLeaveStatus(lv.id, 'Approved')}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </GlassButton>
                    <GlassButton
                      variant="danger"
                      size="sm"
                      haptic="warning"
                      onClick={() => onUpdateLeaveStatus(lv.id, 'Declined')}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </GlassButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </RevealWidget>
      )}

      {/* Payroll & CRM Commission Ledger */}
      {subTab === 'payroll' && (
        <RevealWidget className="glass-panel rounded-3xl overflow-hidden">
          {!permissions.reporting.viewFinancialRoas ? (
            <div className="p-10 text-center text-[14px] text-black/70">
              Payroll compensation figures are visible to Managers and Administrators only.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/30 text-[12px] font-semibold text-[#08131F]/65 border-b border-white/55">
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-4">Pay Period</th>
                    <th className="py-3 px-4 text-right">Base Salary</th>
                    <th className="py-3 px-4 text-right">CRM Commission</th>
                    <th className="py-3 px-4 text-right">Deductions</th>
                    <th className="py-3 px-4 text-right">Net Pay</th>
                    <th className="py-3 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/45 text-[13.5px]">
                  {filteredPayroll.map((pay) => (
                    <tr key={pay.id} className="hover:bg-white/35 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-black">{pay.employee_name}</div>
                        <div className="text-[12px] text-black/65">
                          {pay.employee_title} · {pay.department_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-black">{pay.pay_period}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black">
                        {formatCurrency(pay.base_salary)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black/75 font-medium">
                        +{formatCurrency(pay.crm_commission + pay.bonus)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-black/65">
                        -{formatCurrency(pay.deductions)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-black">
                        {formatCurrency(pay.net_pay)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-semibold text-black">
                        {pay.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RevealWidget>
      )}

      {/* Performance Reviews */}
      {subTab === 'reviews' && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReviews.map((rev, idx) => (
            <motion.article
              key={rev.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28, delay: idx * 0.04 }}
              className="glass-panel rounded-3xl p-5 space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <AppearHeading as="h3" className="text-[15.5px] font-semibold text-black truncate">
                      {rev.employee_name}
                    </AppearHeading>
                    <p className="text-[12px] text-black/65 truncate">
                      {rev.review_cycle} · {rev.department_name}
                    </p>
                  </div>
                  <span className="text-[15px] font-semibold text-black tabular-nums shrink-0">
                    {rev.rating.toFixed(1)} / 5
                  </span>
                </div>
                <p className="text-[13px] text-black/80 leading-relaxed">{rev.summary}</p>
              </div>

              <div className="pt-3 border-t border-white/55 flex items-center justify-between text-[12px] text-[#08131F]/65 tabular-nums">
                <span>Attendance {rev.attendance_score}%</span>
                <span>CRM Quota {rev.crm_attainment_pct}%</span>
              </div>
            </motion.article>
          ))}
        </section>
      )}

      {/* Request Leave Drawer */}
      <SlideDrawer
        open={requestLeaveOpen}
        onClose={onCloseRequestLeave}
        title="Request Time Off"
        subtitle="Submit leave dates for manager approval"
      >
        <form onSubmit={handleLeaveSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Employee</label>
            <select
              value={leaveEmpId}
              onChange={(e) => setLeaveEmpId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) =>
                setLeaveType(e.target.value as 'Annual' | 'Sick' | 'Personal' | 'Parental')
              }
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            >
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Personal">Personal</option>
              <option value="Parental">Parental</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">End Date</label>
              <input
                type="date"
                required
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Reason</label>
            <textarea
              required
              rows={3}
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="Brief note for coverage planning..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={onCloseRequestLeave}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              haptic="success"
              onClick={() => triggerHaptic('light')}
            >
              <span>Submit Request</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>

      {/* Log Performance Review Drawer */}
      <SlideDrawer
        open={newReviewOpen}
        onClose={() => setNewReviewOpen(false)}
        title="Log Performance Review"
        subtitle="Combine attendance discipline with CRM quota attainment"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Employee</label>
            <select
              value={revEmpId}
              onChange={(e) => setRevEmpId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Cycle</label>
              <input
                value={revCycle}
                onChange={(e) => setRevCycle(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Rating (/5)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={revRating}
                onChange={(e) => setRevRating(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">CRM Quota %</label>
              <input
                type="number"
                min="0"
                value={revAttainment}
                onChange={(e) => setRevAttainment(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Attendance Score %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={revAttendance}
              onChange={(e) => setRevAttendance(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Review Summary</label>
            <textarea
              required
              rows={3}
              value={revSummary}
              onChange={(e) => setRevSummary(e.target.value)}
              placeholder="Summarize key achievements, Meta query responsiveness, and next quarter focus..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={() => setNewReviewOpen(false)}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Save Review</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
