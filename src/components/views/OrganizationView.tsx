import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Edit3, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type {
  Department,
  Employee,
  Organization,
  QueryChannel,
  RolePermissions,
  RoleRecord,
} from '../../types/crm';
import { formatCurrency, getInitials } from '../../utils/formatters';
import { AppearHeading, GlassButton, RevealWidget, SegmentedControl, SlideDrawer } from '../ui/LiquidGlass';
import { triggerHaptic } from '../../utils/haptics';

interface OrganizationViewProps {
  organization: Organization | null;
  departments: Department[];
  employees: Employee[];
  roles: RoleRecord[];
  activeRole: RoleRecord;
  requestedSubTab?: 'employees' | 'departments' | 'roles';
  onSubTabChange?: (next: 'employees' | 'departments' | 'roles') => void;
  searchQuery: string;
  addMemberOpen: boolean;
  onCloseAddMember: () => void;
  onUpdateOrganization: (payload: Partial<Organization>) => Promise<void>;
  onCreateDepartment: (payload: {
    name: string;
    head_employee_id?: string;
    routing_channel: QueryChannel;
    description: string;
  }) => Promise<void>;
  onCreateEmployee: (payload: {
    full_name: string;
    email: string;
    role: string;
    role_id: string;
    title: string;
    department_id: string;
    max_capacity: number;
    monthly_quota: number;
  }) => Promise<void>;
  onUpdateEmployee: (id: string, payload: Partial<Employee>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onCreateRole: (payload: {
    name: string;
    description: string;
    permissions: RolePermissions;
  }) => Promise<void>;
  onUpdateRole: (id: string, permissions: RolePermissions) => Promise<void>;
  onDeleteRole: (id: string) => Promise<void>;
}

const DEFAULT_CUSTOM_PERMISSIONS: RolePermissions = {
  dataAccess: {
    leadsScope: 'department',
    queriesScope: 'department',
    viewCampaigns: true,
    viewOrganization: true,
  },
  modifications: {
    updateInquiries: true,
    assignTasks: false,
    manageCampaigns: false,
    manageDeals: true,
    manageAssignmentRules: false,
    manageTeam: false,
    manageRoles: false,
  },
  reporting: {
    viewExecutiveKpis: true,
    viewTeamPerformance: true,
    viewFinancialRoas: false,
    customizeDashboard: true,
  },
};

export function OrganizationView({
  organization,
  departments,
  employees,
  roles,
  activeRole,
  requestedSubTab,
  onSubTabChange,
  searchQuery,
  addMemberOpen,
  onCloseAddMember,
  onUpdateOrganization,
  onCreateDepartment,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}: OrganizationViewProps) {
  const [subTab, setSubTab] = useState<'employees' | 'departments' | 'roles'>(
    requestedSubTab || 'employees'
  );

  useEffect(() => {
    if (requestedSubTab) {
      setSubTab(requestedSubTab);
    }
  }, [requestedSubTab]);

  const handleSetSubTab = (next: 'employees' | 'departments' | 'roles') => {
    setSubTab(next);
    onSubTabChange?.(next);
  };
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [newDeptOpen, setNewDeptOpen] = useState(false);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [orgForm, setOrgForm] = useState<Partial<Organization>>({});

  // New Employee form
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRoleId, setEmpRoleId] = useState(roles[2]?.id || 'role_agent');
  const [empTitle, setEmpTitle] = useState('');
  const [empDept, setEmpDept] = useState(departments[0]?.id || 'dept_sales');
  const [empCapacity, setEmpCapacity] = useState('12');
  const [empQuota, setEmpQuota] = useState('40000');

  // New Department form
  const [deptName, setDeptName] = useState('');
  const [deptHead, setDeptHead] = useState(employees[0]?.id || '');
  const [deptChannel, setDeptChannel] = useState<QueryChannel>('Lead Form');
  const [deptDesc, setDeptDesc] = useState('');

  // New Custom Role form
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<RolePermissions>(DEFAULT_CUSTOM_PERMISSIONS);

  const canManageTeam = activeRole.permissions.modifications.manageTeam;
  const canManageRoles = activeRole.permissions.modifications.manageRoles;

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (deptFilter !== 'All' && emp.department_id !== deptFilter) return false;
      if (!q) return true;
      return (
        emp.full_name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        (emp.department_name || '').toLowerCase().includes(q)
      );
    });
  }, [employees, deptFilter, searchQuery]);

  const handleCreateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empEmail.trim()) return;
    const matchedRole = roles.find((r) => r.id === empRoleId) || roles[0];
    await onCreateEmployee({
      full_name: empName.trim(),
      email: empEmail.trim(),
      role: matchedRole?.name || 'Agent',
      role_id: matchedRole?.id || 'role_agent',
      title: empTitle.trim() || matchedRole?.name || 'Agent',
      department_id: empDept || departments[0]?.id || 'dept_sales',
      max_capacity: Number(empCapacity) || 12,
      monthly_quota: Number(empQuota) || 35000,
    });
    setEmpName('');
    setEmpEmail('');
    setEmpTitle('');
    onCloseAddMember();
  };

  const handleCreateDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    await onCreateDepartment({
      name: deptName.trim(),
      head_employee_id: deptHead || undefined,
      routing_channel: deptChannel,
      description: deptDesc.trim() || 'Cross-functional Meta CRM team.',
    });
    setDeptName('');
    setDeptDesc('');
    setNewDeptOpen(false);
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    await onCreateRole({
      name: roleName.trim(),
      description: roleDesc.trim() || 'Custom workspace access profile.',
      permissions: rolePerms,
    });
    setRoleName('');
    setRoleDesc('');
    setRolePerms(DEFAULT_CUSTOM_PERMISSIONS);
    setNewRoleOpen(false);
  };

  const toggleRoleBoolean = async (
    role: RoleRecord,
    section: 'dataAccess' | 'modifications' | 'reporting',
    key: string,
    currentVal: boolean
  ) => {
    if (!canManageRoles) return;
    triggerHaptic('selection');
    const updated: RolePermissions = {
      ...role.permissions,
      [section]: {
        ...role.permissions[section],
        [key]: !currentVal,
      },
    };
    await onUpdateRole(role.id, updated);
  };

  const cycleScope = async (
    role: RoleRecord,
    field: 'leadsScope' | 'queriesScope'
  ) => {
    if (!canManageRoles) return;
    triggerHaptic('selection');
    const order: Array<'all' | 'department' | 'assigned'> = ['all', 'department', 'assigned'];
    const current = role.permissions.dataAccess[field];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const updated: RolePermissions = {
      ...role.permissions,
      dataAccess: {
        ...role.permissions.dataAccess,
        [field]: next,
      },
    };
    await onUpdateRole(role.id, updated);
  };

  return (
    <div className="space-y-4 sm:space-y-5 text-black">
      {/* Organization Governance Card */}
      <RevealWidget className="glass-panel rounded-[28px] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-full bg-[#08131F] text-[#E8EFF3] inline-flex items-center justify-center shrink-0 shadow-[0_8px_20px_-6px_rgba(8,19,31,0.3)]">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <AppearHeading as="h2" className="text-[17px] sm:text-[18px] font-semibold text-black truncate">
              {organization?.name || 'Northline Commerce Group'}
            </AppearHeading>
            <p className="text-[12.5px] sm:text-[13px] text-black/65 truncate">
              {organization?.industry} · {organization?.timezone} · Meta BM {organization?.meta_business_id}
            </p>
            <p className="text-[12px] sm:text-[12.5px] text-black/75 tabular-nums">
              {employees.length} team members · {departments.length} departments · {roles.length} roles ·{' '}
              {organization?.sla_target_minutes || 15}m SLA target
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canManageTeam && (
            <>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOrgForm(organization || {});
                  setEditOrgOpen(true);
                }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Org</span>
              </GlassButton>
              <GlassButton variant="secondary" size="sm" onClick={() => setNewDeptOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                <span>New Dept</span>
              </GlassButton>
            </>
          )}
          {canManageRoles && (
            <GlassButton variant="primary" size="sm" onClick={() => setNewRoleOpen(true)}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>New Role</span>
            </GlassButton>
          )}
        </div>
      </RevealWidget>

      {/* Sub-Tabs & Department Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          layoutId="org-subtabs"
          ariaLabel="Organization Views"
          value={subTab}
          onChange={handleSetSubTab}
          options={[
            { value: 'employees', label: 'Employee Directory', count: employees.length },
            { value: 'departments', label: 'Departments', count: departments.length },
            { value: 'roles', label: 'Roles & Permissions', count: roles.length },
          ]}
        />

        {subTab === 'employees' && (
          <select
            aria-label="Filter employees by department"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="min-h-[38px] px-4 py-1.5 rounded-full bg-white/50 border border-white/80 text-[13px] font-medium text-[#08131F] focus:outline-none focus:border-[#2E4F6B]"
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {subTab === 'employees' && (
        <RevealWidget className="glass-panel rounded-[28px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/30 text-[12px] font-semibold text-[#08131F]/65 border-b border-white/55">
                  <th className="py-3 px-5">Employee</th>
                  <th className="py-3 px-4">Role & Department</th>
                  <th className="py-3 px-4 text-right">Contacted</th>
                  <th className="py-3 px-4 text-right">Closed</th>
                  <th className="py-3 px-4 text-right">Query Load</th>
                  <th className="py-3 px-4 text-right">Won / Quota</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/45 text-[13.5px]">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/35 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-white/65 border border-white/85 text-[#08131F] text-[12px] font-semibold inline-flex items-center justify-center shrink-0">
                          {getInitials(emp.full_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-black truncate">{emp.full_name}</div>
                          <div className="text-[12px] text-black/65 truncate">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-black inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-black/65 shrink-0" />
                        <span>{emp.role}</span>
                      </div>
                      <div className="text-[12px] text-black/65">
                        {emp.title} · {emp.department_name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-black">
                      {emp.leads_contacted || 0}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-black">
                      {emp.deals_closed || 0}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-black">
                      {emp.active_queries || 0} / {emp.max_capacity}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-black">
                      {formatCurrency(emp.won_revenue || 0)} / {formatCurrency(emp.monthly_quota)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <GlassButton
                        variant="secondary"
                        size="sm"
                        disabled={!canManageTeam}
                        onClick={() => setEditingEmployee(emp)}
                      >
                        <span>Manage</span>
                      </GlassButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealWidget>
      )}

      {subTab === 'departments' && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((dept, idx) => {
            const deptMembers = employees.filter((e) => e.department_id === dept.id);
            return (
              <motion.article
                key={dept.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: idx * 0.04 }}
                className="glass-panel rounded-3xl p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <AppearHeading as="h3" className="text-[16px] font-semibold text-black">
                      {dept.name}
                    </AppearHeading>
                    <span className="text-[12px] font-semibold text-black/70 tabular-nums shrink-0">
                      {deptMembers.length} members
                    </span>
                  </div>
                  <p className="text-[13px] text-black/75 leading-relaxed">{dept.description}</p>
                </div>

                <div className="pt-3 border-t border-white/55 space-y-2 text-[12.5px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-black/60">Department Lead</span>
                    <span className="font-semibold text-black">{dept.head_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-black/60">Default Meta Routing</span>
                    <span className="font-semibold text-black">{dept.routing_channel}</span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </section>
      )}

      {subTab === 'roles' && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {roles.map((role, idx) => (
              <motion.article
                key={role.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: idx * 0.04 }}
                className="glass-panel rounded-3xl p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <AppearHeading as="h3" className="text-[16px] font-semibold text-black truncate">
                        {role.name}
                      </AppearHeading>
                      <p className="text-[12px] text-black/65">
                        {role.isSystem ? 'Core System Role' : 'Custom Role'} ·{' '}
                        {employees.filter((e) => e.role === role.name || e.role_id === role.id).length} assigned
                      </p>
                    </div>
                    {!role.isSystem && canManageRoles && (
                      <GlassButton
                        variant="danger"
                        size="sm"
                        haptic="warning"
                        onClick={() => onDeleteRole(role.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </GlassButton>
                    )}
                  </div>
                  <p className="text-[12.5px] text-black/75 leading-relaxed">{role.description}</p>

                  {/* Data Access */}
                  <div className="pt-3 border-t border-white/55 space-y-2">
                    <div className="text-[12px] font-semibold text-black/70">Data Access</div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-black">Leads Scope</span>
                      <GlassButton
                        variant="secondary"
                        size="sm"
                        disabled={!canManageRoles}
                        onClick={() => cycleScope(role, 'leadsScope')}
                      >
                        <span className="capitalize">{role.permissions.dataAccess.leadsScope}</span>
                      </GlassButton>
                    </div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-black">Inquiries Scope</span>
                      <GlassButton
                        variant="secondary"
                        size="sm"
                        disabled={!canManageRoles}
                        onClick={() => cycleScope(role, 'queriesScope')}
                      >
                        <span className="capitalize">{role.permissions.dataAccess.queriesScope}</span>
                      </GlassButton>
                    </div>
                    {(
                      [
                        ['viewCampaigns', 'View Meta Campaigns'],
                        ['viewOrganization', 'View Organization Directory'],
                      ] as const
                    ).map(([key, label]) => {
                      const val = role.permissions.dataAccess[key];
                      return (
                        <div key={key} className="flex items-center justify-between text-[12.5px]">
                          <span className="text-black">{label}</span>
                          <GlassButton
                            variant={val ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={!canManageRoles}
                            onClick={() => toggleRoleBoolean(role, 'dataAccess', key, val)}
                          >
                            <span>{val ? 'Allowed' : 'Restricted'}</span>
                          </GlassButton>
                        </div>
                      );
                    })}
                  </div>

                  {/* Modification Capabilities */}
                  <div className="pt-3 border-t border-white/55 space-y-2">
                    <div className="text-[12px] font-semibold text-black/70">
                      Modification Capabilities
                    </div>
                    {(
                      [
                        ['updateInquiries', 'Update Inquiry Status & Reply'],
                        ['assignTasks', 'Assign Tasks & Inquiries'],
                        ['manageDeals', 'Manage CRM Pipeline Deals'],
                        ['manageCampaigns', 'Pause / Manage Meta Ads'],
                        ['manageAssignmentRules', 'Configure Routing Rules'],
                        ['manageTeam', 'Manage Team & Org'],
                        ['manageRoles', 'Create & Remove Roles'],
                      ] as const
                    ).map(([key, label]) => {
                      const val = role.permissions.modifications[key];
                      return (
                        <div key={key} className="flex items-center justify-between text-[12.5px]">
                          <span className="text-black">{label}</span>
                          <GlassButton
                            variant={val ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={!canManageRoles}
                            onClick={() => toggleRoleBoolean(role, 'modifications', key, val)}
                          >
                            <span>{val ? 'Allowed' : 'Restricted'}</span>
                          </GlassButton>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reporting Visibility */}
                  <div className="pt-3 border-t border-white/55 space-y-2">
                    <div className="text-[12px] font-semibold text-black/70">
                      Reporting Visibility
                    </div>
                    {(
                      [
                        ['viewExecutiveKpis', 'Executive KPIs & Funnel'],
                        ['viewTeamPerformance', 'Team Performance Metrics'],
                        ['viewFinancialRoas', 'Financial Spend & ROAS'],
                        ['customizeDashboard', 'Customize Dashboard'],
                      ] as const
                    ).map(([key, label]) => {
                      const val = role.permissions.reporting[key];
                      return (
                        <div key={key} className="flex items-center justify-between text-[12.5px]">
                          <span className="text-black">{label}</span>
                          <GlassButton
                            variant={val ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={!canManageRoles}
                            onClick={() => toggleRoleBoolean(role, 'reporting', key, val)}
                          >
                            <span>{val ? 'Visible' : 'Hidden'}</span>
                          </GlassButton>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {/* Add Employee Drawer */}
      <SlideDrawer
        open={addMemberOpen}
        onClose={onCloseAddMember}
        title="Add Organization Member"
        subtitle="Assign role, department, and Meta query capacity"
      >
        <form onSubmit={handleCreateEmployeeSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Full Name</label>
            <input
              required
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              placeholder="e.g. Lucas Meyer"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Work Email</label>
            <input
              required
              type="email"
              value={empEmail}
              onChange={(e) => setEmpEmail(e.target.value)}
              placeholder="lucas@northlinecommerce.com"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Access Role</label>
              <select
                value={empRoleId}
                onChange={(e) => setEmpRoleId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Department</label>
              <select
                value={empDept}
                onChange={(e) => setEmpDept(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Job Title</label>
            <input
              value={empTitle}
              onChange={(e) => setEmpTitle(e.target.value)}
              placeholder="e.g. Performance Account Executive"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Max Open Queries</label>
              <input
                type="number"
                min={1}
                value={empCapacity}
                onChange={(e) => setEmpCapacity(e.target.value)}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Monthly Quota (USD)</label>
              <input
                type="number"
                min={0}
                value={empQuota}
                onChange={(e) => setEmpQuota(e.target.value)}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={onCloseAddMember}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Add Member</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>

      {/* Edit Employee Drawer */}
      <SlideDrawer
        open={Boolean(editingEmployee)}
        onClose={() => setEditingEmployee(null)}
        title={editingEmployee?.full_name || 'Employee'}
        subtitle={editingEmployee?.email}
      >
        {editingEmployee && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onUpdateEmployee(editingEmployee.id, {
                role_id: editingEmployee.role_id || undefined,
                role: editingEmployee.role,
                title: editingEmployee.title,
                department_id: editingEmployee.department_id,
                status: editingEmployee.status,
                max_capacity: Number(editingEmployee.max_capacity),
                monthly_quota: Number(editingEmployee.monthly_quota),
              });
              setEditingEmployee(null);
            }}
            className="space-y-4 text-black"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Role</label>
                <select
                  value={editingEmployee.role_id || roles.find((r) => r.name === editingEmployee.role)?.id || ''}
                  onChange={(e) => {
                    const matched = roles.find((r) => r.id === e.target.value);
                    setEditingEmployee({
                      ...editingEmployee,
                      role_id: e.target.value,
                      role: matched?.name || editingEmployee.role,
                    });
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Status</label>
                <select
                  value={editingEmployee.status}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, status: e.target.value as 'Active' | 'Away' })
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
                >
                  <option value="Active">Active</option>
                  <option value="Away">Away</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Department</label>
              <select
                value={editingEmployee.department_id}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, department_id: e.target.value })
                }
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Title</label>
              <input
                value={editingEmployee.title}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, title: e.target.value })}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Max Queries</label>
                <input
                  type="number"
                  min={1}
                  value={editingEmployee.max_capacity}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, max_capacity: Number(e.target.value) })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-black/70 mb-1">Monthly Quota</label>
                <input
                  type="number"
                  min={0}
                  value={editingEmployee.monthly_quota}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, monthly_quota: Number(e.target.value) })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#08131F]/10">
              <GlassButton
                variant="danger"
                size="sm"
                haptic="warning"
                onClick={async () => {
                  await onDeleteEmployee(editingEmployee.id);
                  setEditingEmployee(null);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </GlassButton>
              <div className="flex items-center gap-2">
                <GlassButton variant="secondary" size="sm" onClick={() => setEditingEmployee(null)}>
                  <span>Cancel</span>
                </GlassButton>
                <GlassButton type="submit" variant="primary" size="sm" haptic="success">
                  <span>Save Changes</span>
                </GlassButton>
              </div>
            </div>
          </form>
        )}
      </SlideDrawer>

      {/* New Custom Role Drawer */}
      <SlideDrawer
        open={newRoleOpen}
        onClose={() => setNewRoleOpen(false)}
        title="Create Custom Role"
        subtitle="Define granular data access, modification & reporting rules"
      >
        <form onSubmit={handleCreateRoleSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Role Name</label>
            <input
              required
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Regional Analyst"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Description</label>
            <textarea
              rows={2}
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              placeholder="Outline responsibilities and visibility boundaries..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Leads Data Scope</label>
              <select
                value={rolePerms.dataAccess.leadsScope}
                onChange={(e) =>
                  setRolePerms({
                    ...rolePerms,
                    dataAccess: {
                      ...rolePerms.dataAccess,
                      leadsScope: e.target.value as 'all' | 'department' | 'assigned',
                    },
                  })
                }
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="all">All Organization</option>
                <option value="department">Department Only</option>
                <option value="assigned">Assigned Only</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Inquiries Scope</label>
              <select
                value={rolePerms.dataAccess.queriesScope}
                onChange={(e) =>
                  setRolePerms({
                    ...rolePerms,
                    dataAccess: {
                      ...rolePerms.dataAccess,
                      queriesScope: e.target.value as 'all' | 'department' | 'assigned',
                    },
                  })
                }
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              >
                <option value="all">All Organization</option>
                <option value="department">Department Only</option>
                <option value="assigned">Assigned Only</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#08131F]/10">
            <div className="text-[12.5px] font-semibold text-black/70">Capabilities & Reporting</div>
            {(
              [
                ['modifications', 'assignTasks', 'Can assign tasks and inquiries'],
                ['modifications', 'manageDeals', 'Can create & edit CRM deals'],
                ['modifications', 'manageCampaigns', 'Can pause & manage Meta campaigns'],
                ['reporting', 'viewTeamPerformance', 'Can view employee performance metrics'],
                ['reporting', 'viewFinancialRoas', 'Can view Ad Spend & Financial ROAS'],
              ] as const
            ).map(([section, key, label]) => {
              const checked = Boolean(
                section === 'modifications'
                  ? rolePerms.modifications[key]
                  : rolePerms.reporting[key]
              );
              return (
                <label key={key} className="flex items-center gap-2.5 text-[13px] text-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (section === 'modifications') {
                        setRolePerms({
                          ...rolePerms,
                          modifications: { ...rolePerms.modifications, [key]: e.target.checked },
                        });
                      } else {
                        setRolePerms({
                          ...rolePerms,
                          reporting: { ...rolePerms.reporting, [key]: e.target.checked },
                        });
                      }
                    }}
                    className="w-4 h-4 accent-[#08131F]"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={() => setNewRoleOpen(false)}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Create Role</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>

      {/* Edit Organization Drawer */}
      <SlideDrawer
        open={editOrgOpen}
        onClose={() => setEditOrgOpen(false)}
        title="Edit Organization Profile"
        subtitle="Global governance & SLA settings"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onUpdateOrganization(orgForm);
            setEditOrgOpen(false);
          }}
          className="space-y-4 text-black"
        >
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Organization Name</label>
            <input
              required
              value={orgForm.name || ''}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Industry</label>
            <input
              value={orgForm.industry || ''}
              onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Meta Business ID</label>
              <input
                value={orgForm.meta_business_id || ''}
                onChange={(e) => setOrgForm({ ...orgForm, meta_business_id: e.target.value })}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">SLA Target (mins)</label>
              <input
                type="number"
                min={1}
                value={orgForm.sla_target_minutes || 15}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, sla_target_minutes: Number(e.target.value) })
                }
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Timezone</label>
            <input
              value={orgForm.timezone || ''}
              onChange={(e) => setOrgForm({ ...orgForm, timezone: e.target.value })}
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={() => setEditOrgOpen(false)}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Save Profile</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>

      {/* New Department Drawer */}
      <SlideDrawer
        open={newDeptOpen}
        onClose={() => setNewDeptOpen(false)}
        title="New Department"
        subtitle="Create a team with default Meta channel routing"
      >
        <form onSubmit={handleCreateDeptSubmit} className="space-y-4 text-black">
          <div>
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Department Name</label>
            <input
              required
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="e.g. Regional Accounts"
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Department Lead</label>
              <select
                value={deptHead}
                onChange={(e) => setDeptHead(e.target.value)}
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
              <label className="block text-[12.5px] font-medium text-black/70 mb-1">Default Channel</label>
              <select
                value={deptChannel}
                onChange={(e) => setDeptChannel(e.target.value as QueryChannel)}
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
            <label className="block text-[12.5px] font-medium text-black/70 mb-1">Responsibilities</label>
            <textarea
              rows={3}
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              placeholder="Outline this department's Meta Ads or CRM focus..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/55 border border-white/80 text-[13.5px] text-black placeholder:text-black/45"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" onClick={() => setNewDeptOpen(false)}>
              <span>Cancel</span>
            </GlassButton>
            <GlassButton type="submit" variant="primary" haptic="success">
              <span>Create Department</span>
            </GlassButton>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
