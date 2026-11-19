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
      initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
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
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
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
    'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-full font-medium transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none select-none cursor-pointer';

  const sizing =
    size === 'sm'
      ? 'min-h-[38px] md:min-h-[34px] px-3.5 py-1.5 text-[12.5px] sm:text-[13px]'
      : 'min-h-[42px] md:min-h-[38px] px-4 py-2 text-[13.5px]';

  const variants: Record<NonNullable<GlassButtonProps['variant']>, string> = {
    primary:
      'bg-[#08131F]/92 backdrop-blur-md text-[#E8EFF3] hover:bg-[#16314A] shadow-[0_10px_24px_-8px_rgba(8,19,31,0.38),inset_0_1px_0_rgba(232,239,243,0.22)] border border-white/25',
    secondary:
      'bg-white/45 backdrop-blur-xl text-[#08131F] border border-white/80 hover:bg-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_6px_18px_-8px_rgba(8,19,31,0.12)]',
    ghost:
      'bg-transparent text-[#08131F]/75 hover:bg-white/40 hover:text-[#08131F]',
    danger:
      'bg-[#16314A]/10 backdrop-blur-md text-[#08131F] border border-[#16314A]/20 hover:bg-[#16314A]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
  };

  return (
    <motion.button
      type={type}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
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
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 p-1 rounded-full bg-white/30 border border-white/75 backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(8,19,31,0.05),inset_0_-1px_0_rgba(255,255,255,0.75)] overflow-x-auto scrollbar-none max-w-full ${className}`}
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
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 min-h-[36px] md:min-h-[32px] px-3 py-1 rounded-full text-[12.5px] font-medium transition-colors duration-150 cursor-pointer ${
              active ? 'text-[#E8EFF3] font-semibold' : 'text-[#08131F]/70 hover:text-[#08131F]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                className="absolute inset-0 -z-10 rounded-full bg-[#08131F]/92 border border-white/20 shadow-[0_6px_16px_-4px_rgba(8,19,31,0.3)]"
              />
            )}
            {opt.icon && <span className="inline-flex items-center shrink-0">{opt.icon}</span>}
            <span className="whitespace-nowrap">{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span className="tabular-nums text-[11px] opacity-75">{opt.count}</span>
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
        <div
          className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="fixed inset-0 bg-[#08131F]/22 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%', opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.85 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.85 }}
            className="relative z-10 w-full sm:max-w-lg h-[92dvh] sm:h-full rounded-t-3xl sm:rounded-none glass-sheet flex flex-col overflow-hidden text-[#08131F]"
          >
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-[#08131F]/10">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-tight text-[#08131F] truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-[12.5px] text-[#08131F]/65 truncate mt-0.5">{subtitle}</p>
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
