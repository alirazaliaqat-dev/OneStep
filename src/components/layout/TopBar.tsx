import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, SlidersHorizontal, RefreshCw, Plus, X } from 'lucide-react';
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
  overview: 'Overview',
  meta: 'Inbox',
  pipeline: 'Pipeline',
  hrms: 'HRMS',
  organization: 'Team & Org',
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 px-3 sm:px-4 pt-3 pb-2 lg:px-6 lg:pt-4">
      <div className="glass-panel rounded-full px-4 sm:px-5 py-2 flex items-center justify-between gap-3 md:gap-8">
        {/* Zone 1: Clean Single-Word Heading */}
        <div className="min-w-0">
          <AppearHeading
            key={activeTab}
            as="h1"
            className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-[#08131F] whitespace-nowrap truncate"
          >
            {TAB_TITLES[activeTab]}
          </AppearHeading>
        </div>

        {/* Zone 2: Airy Translucent Pill Search (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-sm items-center">
          <label htmlFor="global-workspace-search" className="sr-only">
            Search workspace
          </label>
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[#2E4F6B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="global-workspace-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full min-h-[34px] pl-9 pr-4 py-1 rounded-full bg-white/45 border border-white/80 text-[13px] text-[#08131F] placeholder:text-[#08131F]/45 focus:outline-none focus:bg-white/75 focus:border-[#2E4F6B] transition-colors"
            />
          </div>
        </div>

        {/* Zone 3: Minimal Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            aria-label={mobileSearchOpen ? 'Close search' : 'Search'}
            onClick={() => {
              triggerHaptic('light');
              setMobileSearchOpen((v) => !v);
            }}
            className="md:hidden w-9 h-9 rounded-full bg-white/45 border border-white/80 text-[#08131F] inline-flex items-center justify-center shrink-0 cursor-pointer"
          >
            {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          <button
            type="button"
            aria-label="Open Workspace Settings"
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            className="lg:hidden w-9 h-9 rounded-full bg-white/45 border border-white/80 text-[#08131F] inline-flex items-center justify-center shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <GlassButton
            variant="primary"
            size="sm"
            haptic="medium"
            onClick={onPrimaryAction}
            disabled={isSyncing && activeTab === 'overview'}
          >
            {activeTab === 'overview' ? (
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 text-[#A9BDC9] ${isSyncing ? 'animate-spin' : ''}`}
              />
            ) : (
              <Plus className="w-3.5 h-3.5 shrink-0 text-[#A9BDC9]" />
            )}
            <span>{PRIMARY_LABELS[activeTab]}</span>
          </GlassButton>
        </div>
      </div>

      {/* Expandable Mobile Search (keeps sticky header compact by default) */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="md:hidden mt-2"
          >
            <input
              id="mobile-workspace-search"
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats, deals, or team..."
              className="w-full min-h-[38px] px-4 py-1.5 rounded-full glass-sheet text-[13px] text-[#08131F] placeholder:text-[#08131F]/45 focus:outline-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
