// Times as the platform writes them ("2026-11-03T18:54:44.945958101+07:00": nine fractional digits and an offset), read
// by hand so the result does not depend on how the engine running a Code step treats Date.parse.
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/** Milliseconds since the epoch; NaN when the value is not an ISO date or date-time. A time with no offset is UTC. */
export function parseTime(value: unknown): number {
  if (typeof value !== 'string') return Number.NaN;
  const m = ISO.exec(value.trim());
  if (!m) return Number.NaN;
  const [, y, mo, d, h = '0', mi = '0', s = '0', fraction = '', zone = 'Z'] = m;
  const ms = Number(`${fraction}000`.slice(0, 3));
  let offset = 0;
  if (zone.toUpperCase() !== 'Z') {
    const digits = zone.slice(1).replace(':', '');
    offset = (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || '0')) * (zone[0] === '-' ? -1 : 1);
  }
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms) - offset * 60_000;
}
