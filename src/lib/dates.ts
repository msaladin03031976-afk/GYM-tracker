/** Week starts on Sunday (Saudi Arabia). Change to 1 for Monday. */
export const WEEK_STARTS_ON = 0;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (r.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDays(r, -diff);
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return parseISO(s).toLocaleDateString('en-GB', opts);
}

export function fmtShort(s: string): string {
  return parseISO(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtLong(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export type RangeKey = '7d' | '30d' | '90d' | '6m' | '12m' | 'all';

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6m', label: '6M' },
  { key: '12m', label: '12M' },
  { key: 'all', label: 'All' },
];

/** Earliest date (inclusive) for a range, or null for all time. */
export function rangeStart(key: RangeKey): string | null {
  const now = new Date();
  switch (key) {
    case '7d': return toISO(addDays(now, -6));
    case '30d': return toISO(addDays(now, -29));
    case '90d': return toISO(addDays(now, -89));
    case '6m': { const d = new Date(now); d.setMonth(d.getMonth() - 6); return toISO(d); }
    case '12m': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return toISO(d); }
    default: return null;
  }
}
