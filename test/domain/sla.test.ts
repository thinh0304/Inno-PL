import { describe, expect, it } from 'vitest';
import { lateness, parseTime, slaState } from '../../src/domain/sla';

const NOW = Date.parse('2026-11-05T10:00:00+07:00');
describe('sla', () => {
  it('đọc thời gian có nano giây và múi giờ', () => {
    expect(parseTime('2026-11-03T18:54:44.945958101+07:00')).toBe(Date.parse('2026-11-03T18:54:44.945+07:00'));
    expect(parseTime('')).toBeNull();
  });
  it('Còn hạn / Sắp (< 24 giờ) / Quá hạn / không theo dõi', () => {
    expect(slaState('2026-11-08T10:00:00+07:00', NOW)).toBe('con_han');
    expect(slaState('2026-11-06T09:00:00+07:00', NOW)).toBe('sap');
    expect(slaState('2026-11-05T09:59:59+07:00', NOW)).toBe('qua_han');
    expect(slaState(null, NOW)).toBe('none');
  });
  it('xong đúng hạn hoặc trễ N ngày', () => {
    expect(lateness('2026-11-05T10:00:00+07:00', NOW)).toEqual({ onTime: true, daysLate: 0 });
    expect(lateness('2026-11-02T10:00:00+07:00', NOW)).toEqual({ onTime: false, daysLate: 3 });
    expect(lateness(null, NOW).onTime).toBe(true);
  });
});
