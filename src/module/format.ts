// How the screens show numbers and days: Vietnamese style whatever the language, as the business reads it
// (21.000.000; 12,6%; 05/11/2026). Money is whole VND.

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const DASH = '—';

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  // Round first so -0.4 shows as 0, not -0.
  const whole = Math.round(n);
  return money.format(whole === 0 ? 0 : whole);
}

export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction == null || !Number.isFinite(fraction)) return DASH;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(fraction * 100)}%`;
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : DASH;
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
