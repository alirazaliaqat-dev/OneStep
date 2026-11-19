import React from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, MessageSquareText, Kanban, UserCheck, Building2 } from 'lucide-react';
import type { WorkspaceTab } from '../../types/crm';
import { triggerHaptic } from '../../utils/haptics';

interface MobileNavProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  openQueriesCount: number;
  pendingLeavesCount?: number;
  canViewOrganization?: boolean;
}

const ALL_MOBILE_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'meta', label: 'Inbox', icon: MessageSquareText },
  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
  { id: 'hrms', label: 'HRMS', icon: UserCheck },
  { id: 'organization', label: 'Team', icon: Building2 },
];

export function MobileNav({
  activeTab,
  onSelectTab,
  openQueriesCount,
  pendingLeavesCount = 0,
  canViewOrganization = true,
}: MobileNavProps) {
  const items = canViewOrganization
    ? ALL_MOBILE_ITEMS
    : ALL_MOBILE_ITEMS.filter((item) => item.id !== 'organization');

  return (
    <motion.nav
      aria-label="Mobile Sticky Navigation"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div
        className={`pointer-events-auto glass-sheet rounded-full px-1.5 py-1 grid ${
          items.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        } gap-0.5 max-w-md mx-auto`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const badgeCount =
            item.id === 'meta'
              ? openQueriesCount
              : item.id === 'hrms'
              ? pendingLeavesCount
              : 0;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                triggerHaptic('selection');
                onSelectTab(item.id);
              }}
              className={`relative min-h-[44px] px-1 py-1 rounded-full flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 text-[10.5px] font-medium transition-colors duration-150 cursor-pointer ${
                active ? 'text-[#E8EFF3]' : 'text-[#08131F]/70 hover:text-[#08131F]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-liquid-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                  className="absolute inset-0 -z-10 rounded-full bg-[#08131F]/92 border border-white/20 shadow-[0_6px_16px_-4px_rgba(8,19,31,0.34)]"
                />
              )}
              <span className="relative inline-flex items-center justify-center">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#E8EFF3]' : 'text-[#2E4F6B]'
                  }`}
                />
                {badgeCount > 0 && (
                  <span
                    className={`ml-1 tabular-nums text-[9.5px] font-semibold ${
                      active ? 'text-[#A9BDC9]' : 'text-[#16314A]'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
