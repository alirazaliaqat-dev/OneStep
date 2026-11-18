import React, { useEffect } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { X } from 'lucide-react';
import { triggerHaptic, type HapticIntensity } from '../../utils/haptics';

interface AppearHeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function AppearHeading({
  as = 'h2',
  delay = 0,
  className = '',
  children,
}: AppearHeadingProps) {
  const Tag = motion[as];
  return (
    <Tag
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </Tag>
  );
}

interface RevealWidgetProps {
  as?: 'section' | 'div' | 'article';
  delay?: number;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function RevealWidget({
  as = 'section',
  delay = 0,
  className = '',
  ariaLabel,
  children,
}: RevealWidgetProps) {
  const Tag = motion[as];
  return (
    <Tag
      aria-label={ariaLabel}
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9, delay }}
      className={className}
    >
      {children}
    </Tag>
  );
}

interface GlassButtonProps
  extends Omit<
    HTMLMotionProps<'button'>,
    'children' | 'ref'
  > {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  haptic?: HapticIntensity;
  entranceDelay?: number;
  children: React.ReactNode;
}

export function GlassButton({
  variant = 'secondary',
  size = 'md',
  haptic = 'light',
  entranceDelay = 0,
  className = '',
  onClick,
  children,
  type = 'button',
  ...props
}: GlassButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer';

  const sizing =
    size === 'sm'
      ? 'min-h-[40px] md:min-h-[36px] px-3 sm:px-3.5 py-2 text-[12.5px] sm:text-[13px]'
      : 'min-h-[44px] md:min-h-[40px] px-4 py-2 text-[13.5px]';

  const variants: Record<NonNullable<GlassButtonProps['variant']>, string> = {
    primary:
      'bg-[#0F0F0F] backdrop-blur-md text-[#F8F8F8] hover:bg-[#202020] shadow-[0_10px_24px_-6px_rgba(15,15,15,0.34),inset_0_1px_0_rgba(248,248,248,0.18)] border border-[#5DD62C]/35',
    secondary:
      'bg-[#F8F8F8]/92 backdrop-blur-xl text-black border border-[#202020]/12 hover:bg-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.98),0_6px_16px_-6px_rgba(15,15,15,0.1)]',
    ghost:
      'bg-transparent text-black/80 hover:bg-[#F8F8F8]/80 hover:text-black',
    danger:
      'bg-[#202020]/8 backdrop-blur-md text-black border border-[#202020]/18 hover:bg-[#202020]/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
  };

  return (
    <motion.button
      type={type}
      initial={{ opacity: 0, scale: 0.94, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28, delay: entranceDelay }}
      className={`${base} ${sizing} ${variants[variant]} ${className}`}
      onClick={(e) => {
        triggerHaptic(haptic);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  layoutId: string;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 rounded-2xl bg-[#0F0F0F]/[0.05] border border-white/80 backdrop-blur-2xl shadow-[inset_0_1px_2px_rgba(15,15,15,0.06),inset_0_-1px_0_rgba(255,255,255,0.75)] overflow-x-auto scrollbar-none max-w-full ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => {
              if (!active) {
                triggerHaptic('selection');
                onChange(opt.value);
              }
            }}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 min-h-[40px] md:min-h-[34px] px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors duration-150 cursor-pointer ${
              active ? 'text-black font-semibold' : 'text-black/70 hover:text-black'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                className="absolute inset-0 -z-10 rounded-xl bg-white/95 backdrop-blur-xl border border-[#5DD62C]/35 shadow-[0_6px_16px_-4px_rgba(15,15,15,0.12),inset_0_1.5px_0_rgba(255,255,255,1)]"
              />
            )}
            {opt.icon && <span className="inline-flex items-center shrink-0">{opt.icon}</span>}
            <span className="whitespace-nowrap">{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span className="tabular-nums text-[11.5px] opacity-70">({opt.count})</span>
            )}
          </button>
        );
      })}
    </motion.div>
  );
}

interface SlideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function SlideDrawer({ open, onClose, title, subtitle, children }: SlideDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        triggerHaptic('light');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="fixed inset-0 bg-[#0F0F0F]/25 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%', opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.85 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.85 }}
            className="relative z-10 w-full sm:max-w-lg h-[92dvh] sm:h-full rounded-t-3xl sm:rounded-none glass-sheet flex flex-col overflow-hidden text-black"
          >
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-[#202020]/10">
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold tracking-tight text-black truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-[12.5px] text-black/65 truncate mt-0.5">{subtitle}</p>
                )}
              </div>
              <GlassButton
                variant="secondary"
                size="sm"
                aria-label="Close panel"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </GlassButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 pb-8">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
