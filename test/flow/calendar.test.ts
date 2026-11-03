import { describe, expect, it } from 'vitest';
import { addWorkingDays, dueState } from '../../src/flow/calendar';

// 2026-11-02 is a Monday; times are written in UTC, Vietnam is UTC+7.
describe('working days', () => {
  it('monday_plus_two_is_wednesday', () => {
    expect(addWorkingDays('2026-11-02T03:00:00Z', 2)).toBe('2026-11-04T03:00:00.000Z');
  });
  it('friday_plus_one_is_monday', () => {
    expect(addWorkingDays('2026-11-06T08:00:00Z', 1)).toBe('2026-11-09T08:00:00.000Z');
  });
  it('saturday_start_counts_from_monday', () => {
    // Saturday 10:00 in Vietnam: counting starts Monday 08:00, so one day later is Tuesday 08:00.
    expect(addWorkingDays('2026-11-07T03:00:00Z', 1)).toBe('2026-11-10T01:00:00.000Z');
  });
  it('zero_days_is_not_tracked', () => {
    expect(addWorkingDays('2026-11-02T03:00:00Z', 0)).toBeNull();
  });
  it('vietnam_midnight_is_not_utc_midnight', () => {
    // Friday 18:00 UTC is already Saturday 01:00 in Vietnam.
    expect(addWorkingDays('2026-11-06T18:00:00Z', 1)).toBe('2026-11-10T01:00:00.000Z');
  });
});

describe('due state', () => {
  const due = '2026-11-04T03:00:00Z';
  it('due_soon_under_24_hours', () => {
    expect(dueState(due, '2026-11-03T10:00:00Z', null)).toEqual({ state: 'due_soon', lateDays: 0 });
    expect(dueState(due, '2026-11-02T10:00:00Z', null)).toEqual({ state: 'on_time', lateDays: 0 });
  });
  it('overdue_after_due', () => {
    expect(dueState(due, '2026-11-04T04:00:00Z', null)).toEqual({ state: 'overdue', lateDays: 1 });
  });
  it('done_late_counts_working_days', () => {
    expect(dueState('2026-11-06T03:00:00Z', '2026-11-12T00:00:00Z', '2026-11-10T03:00:00Z')).toEqual({ state: 'done_late', lateDays: 2 });
    expect(dueState(due, '2026-11-12T00:00:00Z', '2026-11-03T03:00:00Z')).toEqual({ state: 'done_on_time', lateDays: 0 });
  });
  it('untracked_has_no_state', () => {
    expect(dueState(null, '2026-11-12T00:00:00Z', null)).toEqual({ state: null, lateDays: 0 });
  });
});
