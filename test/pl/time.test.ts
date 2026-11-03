import { describe, expect, it } from 'vitest';
import { parseTime } from '../../src/pl/time';

const T = Date.UTC(2026, 10, 3, 11, 54, 44, 945);

describe('parseTime', () => {
  it('reads_the_forms_the_platform_writes', () => {
    expect(parseTime('2026-11-03T11:54:44.945Z')).toBe(T);
    expect(parseTime('2026-11-03T11:54:44.945958Z')).toBe(T);
    // Nine fractional digits and an offset, as the platform renders a datetime.
    expect(parseTime('2026-11-03T18:54:44.945958101+07:00')).toBe(T);
    expect(parseTime('2026-11-03T18:54:44.945+0700')).toBe(T);
    expect(parseTime('2026-11-03 18:54:44.945+07')).toBe(T);
  });

  it('defaults_missing_parts', () => {
    expect(parseTime('2026-11-03T11:54:44Z')).toBe(Date.UTC(2026, 10, 3, 11, 54, 44));
    expect(parseTime('2026-11-03T11:54:44')).toBe(Date.UTC(2026, 10, 3, 11, 54, 44));
    expect(parseTime('2026-11-03')).toBe(Date.UTC(2026, 10, 3));
    expect(parseTime('2026-11-03T11:54Z')).toBe(Date.UTC(2026, 10, 3, 11, 54));
  });

  it('is_nan_for_anything_else', () => {
    for (const bad of ['', 'x', '03/11/2026', null, undefined, 42]) expect(Number.isNaN(parseTime(bad as never)), String(bad)).toBe(true);
  });

  it('orders_times_across_offsets', () => {
    expect(parseTime('2026-11-03T18:55:54.078239605+07:00')).toBeGreaterThan(parseTime('2026-11-03T18:54:44.945958101+07:00'));
    expect(parseTime('2026-11-03T11:55:00Z')).toBeLessThan(parseTime('2026-11-03T18:55:00+07:00') + 1);
  });
});
