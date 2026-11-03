import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDay, formatMoney, formatPercent } from '../../src/module/format.js';

describe('display formats', () => {
  it('money uses dots for thousands and no decimals', () => {
    expect(formatMoney(21_000_000)).toBe('21.000.000');
    expect(formatMoney(-2_500_000)).toBe('-2.500.000');
    expect(formatMoney(46_272_444.4444)).toBe('46.272.444');
    expect(formatMoney(0)).toBe('0');
    expect(formatMoney(null)).toBe('—');
  });

  it('percent shows a comma decimal and drops a trailing zero', () => {
    expect(formatPercent(0.125829)).toBe('12,6%');
    expect(formatPercent(0.08)).toBe('8%');
    expect(formatPercent(null)).toBe('—');
  });

  it('days and times are dd/mm/yyyy', () => {
    expect(formatDay('2026-11-05')).toBe('05/11/2026');
    expect(formatDay('2026-11-05T10:00:00Z')).toBe('05/11/2026');
    expect(formatDay(null)).toBe('—');
    expect(formatDateTime('2026-11-03T04:34:25Z', 'Asia/Ho_Chi_Minh')).toBe('03/11/2026 11:34');
  });
});
