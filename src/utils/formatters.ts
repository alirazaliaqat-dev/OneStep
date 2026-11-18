export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatSlaRemaining(slaDueIso: string, status: string): string {
  if (status === 'Resolved' || status === 'Replied') return 'SLA Met';
  const dueMs = new Date(slaDueIso).getTime();
  if (Number.isNaN(dueMs)) return '15m SLA';
  const diffMins = Math.round((dueMs - Date.now()) / 60_000);
  if (diffMins <= 0) return 'SLA Due Now';
  if (diffMins < 60) return `${diffMins}m SLA left`;
  return `${Math.round(diffMins / 60)}h SLA left`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}
