export type HapticIntensity = 'selection' | 'light' | 'medium' | 'success' | 'warning';

const STORAGE_KEY = 'clearline_haptics_enabled';

const PATTERNS: Record<HapticIntensity, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 18,
  success: [10, 28, 14],
  warning: [18, 36, 18],
};

export function getHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === null ? true : saved === 'true';
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function triggerHaptic(intensity: HapticIntensity = 'light'): void {
  if (typeof window === 'undefined') return;
  if (!getHapticsEnabled()) return;

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[intensity]);
    }
  } catch {
    // Vibration API may be restricted by browser policy; visual spring feedback remains active.
  }
}
