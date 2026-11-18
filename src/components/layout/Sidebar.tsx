import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutGrid,
  MessageSquareText,
  Kanban,
  UserCheck,
  Building2,
  Megaphone,
  Wand2,
  KeyRound,
  SlidersHorizontal,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import type { MetaStatusResponse, Organization, RoleRecord, TikTokStatusResponse, WorkspaceTab } from '../../types/crm';
import { triggerHaptic } from '../../utils/haptics';

export type SidebarSectionKey =
  | 'overview'
  | 'meta:queries'
  | 'meta:campaigns'
  | 'meta:rules'
  | 'pipeline'
  | 'hrms'
  | 'organization:employees'
  | 'organization:roles';

interface SidebarProps {
  activeSection: SidebarSectionKey;
  onNavigateSection: (tab: WorkspaceTab, subTab?: string) => void;
  openQueriesCount: number;
  pendingLeavesCount?: number;
  organization: Organization | null;
  metaStatus: MetaStatusResponse | null;
  tiktokStatus: TikTokStatusResponse | null;
  roles: RoleRecord[];
  activeRole: RoleRecord;
  activeRoleId: string;
  onChangeActiveRole: (roleId: string) => void;
  onOpenSettings: () => void;
}

interface NavEntry {
  key: SidebarSectionKey;
  tab: WorkspaceTab;
  subTab?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function Sidebar({
  activeSection,
  onNavigateSection,
  openQueriesCount,
  pendingLeavesCount = 0,
  organization,
  metaStatus,
  tiktokStatus,
  roles,
  activeRole,
  activeRoleId,
  onChangeActiveRole,
  onOpenSettings,
}: SidebarProps) {
  const perms = activeRole.permissions;
  const isMetaConnected = metaStatus?.connection?.status === 'Connected';
  const isTikTokConnected = tiktokStatus?.connection?.status === 'Connected';

  const coreItems: NavEntry[] = [
    { key: 'overview', tab: 'overview', label: 'Overview & Chats', icon: LayoutGrid },
    {
      key: 'meta:queries',
      tab: 'meta',
      subTab: 'queries',
      label: 'Omnichannel Inbox',
      icon: MessageSquareText,
      badge: openQueriesCount,
    },
    { key: 'pipeline', tab: 'pipeline', label: 'CRM Pipeline', icon: Kanban },
    {
      key: 'hrms',
      tab: 'hrms',
      label: 'HRMS & Attendance',
      icon: UserCheck,
      badge: perms.modifications.assignTasks || perms.modifications.manageTeam ? pendingLeavesCount : 0,
    },
  ];

  const growthItems: NavEntry[] = [];
  if (perms.dataAccess.viewCampaigns) {
    growthItems.push({
      key: 'meta:campaigns',
      tab: 'meta',
      subTab: 'campaigns',
      label: 'Ad Campaigns',
      icon: Megaphone,
    });
  }
  if (perms.modifications.manageAssignmentRules) {
    growthItems.push({
      key: 'meta:rules',
      tab: 'meta',
      subTab: 'rules',
      label: 'Auto-Assign Rules',
      icon: Wand2,
    });
  }

  const governanceItems: NavEntry[] = [];
  if (perms.dataAccess.viewOrganization) {
    governanceItems.push({
      key: 'organization:employees',
      tab: 'organization',
      subTab: 'employees',
      label: 'Employees & Org',
      icon: Building2,
    });
  }
  if (perms.modifications.manageRoles) {
    governanceItems.push({
      key: 'organization:roles',
      tab: 'organization',
      subTab: 'roles',
      label: 'Roles & Permissions',
      icon: KeyRound,
    });
  }

  const roleScopeSummary = [
    perms.dataAccess.queriesScope === 'all' ? 'All Queries' : 'Assigned Queries',
    perms.reporting.viewFinancialRoas ? 'Financial ROAS' : 'Standard Metrics',
  ].join(' · ');

  const renderGroup = (title: string, items: NavEntry[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="px-3 text-[11.5px] font-semibold text-black/60 tracking-tight">{title}</p>
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <motion.button
                key={item.key}
                type="button"
                whileTap={{ scale: 0.98 }}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  triggerHaptic('selection');
                  onNavigateSection(item.tab, item.subTab);
                }}
                className={`relative w-full min-h-[40px] px-3.5 py-2 rounded-2xl inline-flex items-center justify-between gap-2 whitespace-nowrap shrink-0 text-[13.5px] font-medium transition-colors duration-150 cursor-pointer ${
                  active ? 'text-[#F8F8F8]' : 'text-black/85 hover:text-black hover:bg-[#F8F8F8]/75'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="desktop-sidebar-liquid-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                    className="absolute inset-0 -z-10 rounded-2xl bg-[#0F0F0F] shadow-[0_10px_24px_-8px_rgba(15,15,15,0.36),inset_0_1px_0_rgba(248,248,248,0.16)] border border-[#5DD62C]/30"
                  />
                )}
                <span className="inline-flex items-center gap-2.5 min-w-0 whitespace-nowrap">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#5DD62C]' : ''}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`tabular-nums text-[11.5px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-[#5DD62C] text-[#0F0F0F]' : 'text-black/75'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      aria-label="Role-Based Sidebar Navigation"
      className="hidden lg:flex lg:flex-col lg:w-[268px] lg:shrink-0 h-screen sticky top-0 p-4 select-none"
    >
      <div className="glass-panel rounded-3xl flex flex-col h-full p-4 justify-between overflow-y-auto text-black">
        <div className="space-y-5">
          {/* Brand Wordmark */}
          <div className="px-2 pt-1 flex items-center justify-between gap-2">
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                triggerHaptic('selection');
                onNavigateSection('overview');
              }}
              className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 text-black font-semibold text-[17px] tracking-tight"
            >
              <span className="w-8 h-8 rounded-xl bg-[#0F0F0F] text-[#5DD62C] border border-[#5DD62C]/35 inline-flex items-center justify-center shadow-[0_6px_14px_-4px_rgba(15,15,15,0.32)]">
                <Link2 className="w-4 h-4" />
              </span>
              <span>Clearline</span>
            </a>
          </div>

          {/* Active Role Scope Summary */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl glass-recessed px-3.5 py-2.5 space-y-0.5"
          >
            <div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-black">
              <span className="truncate">{activeRole.name}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-[#337418] shrink-0" />
            </div>
            <p className="text-[11.5px] text-black/65 truncate">{roleScopeSummary}</p>
          </motion.div>

          <nav className="space-y-4" aria-label="Role-Filtered Workspace Sections">
            {renderGroup('Workspace', coreItems)}
            {renderGroup('Ads & Automation', growthItems)}
            {renderGroup('Organization & Access', governanceItems)}
          </nav>
        </div>

        {/* Role View Switcher + Channel Integrations & Setup */}
        <div className="space-y-3 pt-4 mt-4 border-t border-[#202020]/10">
          <div className="px-2 space-y-0.5">
            <p className="text-[12.5px] font-semibold text-black truncate">
              {organization?.name || 'Northline Commerce'}
            </p>
            <p className="text-[11.5px] text-black/65 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5DD62C] shrink-0" />
              <span className="truncate">
                {isMetaConnected ? 'Meta Live' : 'Meta Ready'} · {isTikTokConnected ? 'TikTok Live' : 'TikTok Ready'}
              </span>
            </p>
          </div>

          <div className="px-1">
            <label
              htmlFor="sidebar-role-select"
              className="flex items-center gap-1.5 text-[11.5px] font-medium text-black/70 mb-1 px-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#337418]" />
              <span>Switch User Role</span>
            </label>
            <select
              id="sidebar-role-select"
              value={activeRoleId}
              onChange={(e) => {
                triggerHaptic('selection');
                onChangeActiveRole(e.target.value);
              }}
              className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[12.5px] font-medium text-black focus:outline-none focus:border-[#337418]"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-2xl bg-[#F8F8F8] hover:bg-white border border-[#202020]/12 text-black text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_12px_-4px_rgba(15,15,15,0.08)]"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0 text-black" />
            <span>
              {perms.modifications.manageCampaigns || perms.modifications.manageTeam
                ? 'Channels & Setup'
                : 'Preferences'}
            </span>
          </motion.button>
        </div>
      </div>
    </aside>
  );
}
