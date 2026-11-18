import React from 'react';
import { motion } from 'motion/react';
import { Search, SlidersHorizontal, RefreshCw, Plus } from 'lucide-react';
import type { WorkspaceTab } from '../../types/crm';
import { AppearHeading, GlassButton } from '../ui/LiquidGlass';
import { triggerHaptic } from '../../utils/haptics';

interface TopBarProps {
  activeTab: WorkspaceTab;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPrimaryAction: () => void;
  onOpenSettings: () => void;
  isSyncing?: boolean;
}

const TAB_TITLES: Record<WorkspaceTab, string> = {
  overview: 'Command Overview',
  meta: 'Omnichannel Inbox',
  pipeline: 'CRM Pipeline',
  hrms: 'HRMS & People Ops',
  organization: 'Employees & Org',
};

const PRIMARY_LABELS: Record<WorkspaceTab, string> = {
  overview: 'Sync',
  meta: 'Import',
  pipeline: 'New Lead',
  hrms: 'Leave',
  organization: 'Add Staff',
};

export function TopBar({
  activeTab,
  searchQuery,
  onSearchChange,
  onPrimaryAction,
  onOpenSettings,
  isSyncing = false,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-1.5 lg:px-6 lg:pt-4">
      <div className="glass-panel rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 md:gap-8">
        {/* Zone 1: Single-line animated workspace heading */}
        <div className="min-w-0 flex-1 md:flex-none">
          <AppearHeading
            key={activeTab}
            as="h1"
            className="text-[15.5px] sm:text-[17px] md:text-[18px] font-semibold tracking-tight text-black whitespace-nowrap truncate"
          >
            {TAB_TITLES[activeTab]}
          </AppearHeading>
        </div>

        {/* Zone 2: Live workspace filter search */}
        <div className="hidden md:flex flex-1 max-w-md items-center">
          <label htmlFor="global-workspace-search" className="sr-only">
            Search queries, leads, campaigns, or employees
          </label>
          <div className="relative w-full">
            <Search className="w-4 h-4 text-black/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="global-workspace-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats, deals, campaigns, or team..."
              className="w-full min-h-[38px] pl-10 pr-4 py-1.5 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-[13px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418] focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Zone 3: Primary action + mobile setup trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Open Workspace Setup"
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            className="lg:hidden min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#F8F8F8] border border-[#202020]/12 text-black inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 text-[12.5px] font-medium cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
            <span>Setup</span>
          </motion.button>

          <GlassButton
            variant="primary"
            size="sm"
            haptic="medium"
            onClick={onPrimaryAction}
            disabled={isSyncing && activeTab === 'overview'}
          >
            {activeTab === 'overview' ? (
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-[#5DD62C] ${isSyncing ? 'animate-spin' : ''}`} />
            ) : (
              <Plus className="w-3.5 h-3.5 shrink-0 text-[#5DD62C]" />
            )}
            <span>{PRIMARY_LABELS[activeTab]}</span>
          </GlassButton>
        </div>
      </div>

      {/* Compact mobile search bar */}
      <div className="md:hidden mt-1.5">
        <label htmlFor="mobile-workspace-search" className="sr-only">
          Search workspace
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-black/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="mobile-workspace-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chats, deals, or team..."
            className="w-full min-h-[38px] pl-10 pr-4 py-1.5 rounded-xl glass-panel-subtle text-[13px] text-black placeholder:text-black/45 focus:outline-none focus:border-[#337418]"
          />
        </div>
      </div>
    </header>
  );
}
