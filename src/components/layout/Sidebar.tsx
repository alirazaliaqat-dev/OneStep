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
} from 'lucide-react';
import type {
  MetaStatusResponse,
  Organization,
  RoleRecord,
  TikTokStatusResponse,
  WorkspaceTab,
} from '../../types/crm';
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
  roles,
  activeRole,
  activeRoleId,
  onChangeActiveRole,
  onOpenSettings,
}: SidebarProps) {
  const perms = activeRole.permissions;

  const coreItems: NavEntry[] = [
    { key: 'overview', tab: 'overview', label: 'Overview', icon: LayoutGrid },
    {
      key: 'meta:queries',
      tab: 'meta',
      subTab: 'queries',
      label: 'Inbox',
      icon: MessageSquareText,
      badge: openQueriesCount,
    },
    { key: 'pipeline', tab: 'pipeline', label: 'Pipeline', icon: Kanban },
    {
      key: 'hrms',
      tab: 'hrms',
      label: 'HRMS',
      icon: UserCheck,
      badge:
        perms.modifications.assignTasks || perms.modifications.manageTeam
          ? pendingLeavesCount
          : 0,
    },
  ];

  const growthItems: NavEntry[] = [];
  if (perms.dataAccess.viewCampaigns) {
    growthItems.push({
      key: 'meta:campaigns',
      tab: 'meta',
      subTab: 'campaigns',
      label: 'Campaigns',
      icon: Megaphone,
    });
  }
  if (perms.modifications.manageAssignmentRules) {
    growthItems.push({
      key: 'meta:rules',
      tab: 'meta',
      subTab: 'rules',
      label: 'Routing Rules',
      icon: Wand2,
    });
  }

  const governanceItems: NavEntry[] = [];
  if (perms.dataAccess.viewOrganization) {
    governanceItems.push({
      key: 'organization:employees',
      tab: 'organization',
      subTab: 'employees',
      label: 'Team & Org',
      icon: Building2,
    });
  }
  if (perms.modifications.manageRoles) {
    governanceItems.push({
      key: 'organization:roles',
      tab: 'organization',
      subTab: 'roles',
      label: 'Roles',
      icon: KeyRound,
    });
  }

  const renderGroup = (title: string, items: NavEntry[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="px-3.5 text-[11px] font-medium text-[#08131F]/48">{title}</p>
        <div className="space-y-0.5">
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
                className={`relative w-full min-h-[38px] px-3.5 py-2 rounded-full inline-flex items-center justify-between gap-2 whitespace-nowrap shrink-0 text-[13.5px] font-medium transition-colors duration-150 cursor-pointer ${
                  active
                    ? 'text-[#E8EFF3]'
                    : 'text-[#08131F]/80 hover:text-[#08131F] hover:bg-white/40'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="desktop-sidebar-liquid-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                    className="absolute inset-0 -z-10 rounded-full bg-[#08131F]/92 border border-white/20 shadow-[0_10px_24px_-8px_rgba(8,19,31,0.38)]"
                  />
                )}
                <span className="inline-flex items-center gap-2.5 min-w-0 whitespace-nowrap">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#E8EFF3]' : 'text-[#2E4F6B]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`tabular-nums text-[11.5px] font-semibold shrink-0 ${
                      active ? 'text-[#A9BDC9]' : 'text-[#2E4F6B]'
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
      className="hidden lg:flex lg:flex-col lg:w-[238px] lg:shrink-0 h-screen sticky top-0 p-4 select-none"
    >
      <div className="glass-panel rounded-[28px] flex flex-col h-full p-4 justify-between overflow-y-auto text-[#08131F]">
        <div className="space-y-6">
          {/* Clean Wordmark */}
          <div className="px-2 pt-1">
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                triggerHaptic('selection');
                onNavigateSection('overview');
              }}
              className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 text-[#08131F] font-semibold text-[16.5px] tracking-tight"
            >
              <span className="w-8 h-8 rounded-full bg-[#08131F] text-[#E8EFF3] inline-flex items-center justify-center shadow-[0_6px_14px_-4px_rgba(8,19,31,0.35)]">
                <Link2 className="w-4 h-4" />
              </span>
              <span>Clearline</span>
            </a>
          </div>

          <nav className="space-y-5" aria-label="Workspace Sections">
            {renderGroup('Workspace', coreItems)}
            {renderGroup('Ads', growthItems)}
            {renderGroup('Organization', governanceItems)}
          </nav>
        </div>

        {/* Minimal Role Switcher + Setup */}
        <div className="space-y-2.5 pt-4 mt-4 border-t border-white/55">
          <select
            id="sidebar-role-select"
            aria-label="Switch active role view"
            value={activeRoleId}
            onChange={(e) => {
              triggerHaptic('selection');
              onChangeActiveRole(e.target.value);
            }}
            className="w-full min-h-[36px] px-3.5 py-1.5 rounded-full bg-white/45 border border-white/75 text-[12.5px] font-medium text-[#08131F] focus:outline-none focus:border-[#2E4F6B] cursor-pointer"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            className="w-full min-h-[38px] px-3.5 py-2 rounded-full bg-white/45 hover:bg-white/70 border border-white/80 text-[#08131F] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-[#2E4F6B]" />
            <span>Settings</span>
          </motion.button>
        </div>
      </div>
    </aside>
  );
}
