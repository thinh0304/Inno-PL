// The list's period filter (Đặc tả FR-1.2): all, or a year / quarter / month / week counted from today.
export type PeriodKind = 'all' | 'year' | 'quarter' | 'month' | 'week';
export interface Period { kind: PeriodKind; offset: number }
export interface Range { from: string; to: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** The days [from, to) the period covers, or null for all. `today` is yyyy-mm-dd. */
export function periodRange(today: string, period: Period): Range | null {
  const [y, m, d] = today.split('-').map(Number);
  const k = period.offset;
  switch (period.kind) {
    case 'all': return null;
    case 'year': return { from: iso(utc(y + k, 0, 1)), to: iso(utc(y + k + 1, 0, 1)) };
    case 'quarter': {
      const q = Math.floor((m - 1) / 3) + k;
      return { from: iso(utc(y, q * 3, 1)), to: iso(utc(y, q * 3 + 3, 1)) };
    }
    case 'month': return { from: iso(utc(y, m - 1 + k, 1)), to: iso(utc(y, m + k, 1)) };
    case 'week': {
      // Weeks start on Monday.
      const date = utc(y, m - 1, d);
      const monday = utc(y, m - 1, d - ((date.getUTCDay() + 6) % 7) + 7 * k);
      return { from: iso(monday), to: iso(utc(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 7)) };
    }
  }
}

export const inRange = (createdAt: string, range: Range | null) =>
  !range || (createdAt.slice(0, 10) >= range.from && createdAt.slice(0, 10) < range.to);
