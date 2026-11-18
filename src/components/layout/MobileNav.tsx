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
  { id: 'meta', label: 'Chats', icon: MessageSquareText },
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
      aria-label="Mobile Sticky Footer Navigation"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-2.5 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div
        className={`pointer-events-auto glass-sheet rounded-2xl px-1 py-1 grid ${
          items.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        } gap-0.5 max-w-lg mx-auto`}
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
              className={`relative min-h-[46px] px-1 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                active ? 'text-[#F8F8F8]' : 'text-black/75 hover:text-black'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-liquid-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                  className="absolute inset-0 -z-10 rounded-xl bg-[#0F0F0F] border border-[#5DD62C]/35 shadow-[0_6px_16px_-4px_rgba(15,15,15,0.34)]"
                />
              )}
              <span className="relative inline-flex items-center justify-center">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#5DD62C]' : ''}`} />
                {badgeCount > 0 && (
                  <span
                    className={`ml-1 tabular-nums text-[10px] font-semibold ${
                      active ? 'text-[#5DD62C]' : 'text-[#337418]'
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
