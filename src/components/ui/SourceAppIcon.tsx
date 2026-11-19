import React from 'react';

export type SourceAppType = 'Facebook' | 'Instagram' | 'Messenger' | 'TikTok' | 'Direct';

export function resolveSourceApp(
  platform?: string | null,
  channel?: string | null
): SourceAppType {
  const ch = (channel || '').toLowerCase();
  const pl = (platform || '').toLowerCase();

  if (ch.includes('messenger') || pl.includes('messenger')) return 'Messenger';
  if (ch.includes('instagram') || pl.includes('instagram')) return 'Instagram';
  if (ch.includes('tiktok') || pl.includes('tiktok')) return 'TikTok';
  if (
    pl.includes('facebook') ||
    pl.includes('meta') ||
    ch.includes('lead form') ||
    ch.includes('ad comment')
  ) {
    return 'Facebook';
  }
  return 'Direct';
}

interface SourceAppIconProps {
  platform?: string | null;
  channel?: string | null;
  app?: SourceAppType;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function SourceAppIcon({
  platform,
  channel,
  app,
  size = 'sm',
  showLabel = false,
  className = '',
}: SourceAppIconProps) {
  const resolved = app || resolveSourceApp(platform, channel);

  const boxClass =
    size === 'xs'
      ? 'w-[18px] h-[18px] rounded-[5px]'
      : size === 'md'
        ? 'w-9 h-9 rounded-xl'
        : 'w-7 h-7 rounded-[9px]';

  const iconClass =
    size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-[18px] h-[18px]' : 'w-4 h-4';

  const surfaceClass: Record<SourceAppType, string> = {
    Facebook:
      'bg-[#2E4F6B] text-[#E8EFF3] shadow-[0_4px_10px_-3px_rgba(8,19,31,0.3),inset_0_1px_0_rgba(255,255,255,0.28)]',
    Instagram:
      'bg-[#16314A] text-[#E8EFF3] border border-white/25 shadow-[0_4px_10px_-3px_rgba(8,19,31,0.3),inset_0_1px_0_rgba(255,255,255,0.24)]',
    Messenger:
      'bg-[#5F7F98] text-[#E8EFF3] border border-white/30 shadow-[0_4px_10px_-3px_rgba(8,19,31,0.26),inset_0_1px_0_rgba(255,255,255,0.3)]',
    TikTok:
      'bg-[#08131F] text-[#E8EFF3] border border-white/25 shadow-[0_4px_10px_-3px_rgba(8,19,31,0.36),inset_0_1px_0_rgba(255,255,255,0.22)]',
    Direct:
      'bg-white/60 text-[#08131F] border border-white/80',
  };

  const renderGlyph = () => {
    if (resolved === 'Facebook') {
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M13.8 21v-8.2h2.75l.41-3.2H13.8V7.56c0-.93.26-1.56 1.59-1.56h1.69V3.14c-.29-.04-1.3-.14-2.47-.14-2.44 0-4.11 1.49-4.11 4.23v2.37H7.75v3.2h2.75V21h3.3z" />
        </svg>
      );
    }

    if (resolved === 'Instagram') {
      return (
        <svg
          viewBox="0 0 24 24"
          className={iconClass}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    }

    if (resolved === 'Messenger') {
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M12 2.75c-5.11 0-9.25 3.84-9.25 8.57 0 2.7 1.34 5.1 3.44 6.67v3.26l3.15-1.73c.84.23 1.73.36 2.66.36 5.11 0 9.25-3.84 9.25-8.56S17.11 2.75 12 2.75zm.92 11.53l-2.36-2.51-4.59 2.51 5.05-5.36 2.41 2.51 4.54-2.51-5.05 5.36z" />
        </svg>
      );
    }

    if (resolved === 'TikTok') {
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M16.6 5.82A4.3 4.3 0 0 1 15.54 3h-3.1v12.4a2.6 2.6 0 1 1-1.85-2.49V9.74a5.72 5.72 0 1 0 4.95 5.66V9.13a7.34 7.34 0 0 0 4.3 1.38V7.42a4.32 4.32 0 0 1-3.24-1.6z" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  };

  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
      <span
        title={`Source: ${resolved}`}
        aria-label={`${resolved} source`}
        className={`${boxClass} ${surfaceClass[resolved]} inline-flex items-center justify-center shrink-0`}
      >
        {renderGlyph()}
      </span>
      {showLabel && (
        <span className="text-[12px] font-medium text-black whitespace-nowrap">
          {resolved}
        </span>
      )}
    </span>
  );
}
