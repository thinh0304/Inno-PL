import { describe, expect, it } from 'vitest';
import { sweepSla } from '../../src/flow/sla';

// 2026-11-04 is a Wednesday.
const task = (over: Record<string, unknown> = {}) => ({ id: 'a', status: 'open', due_at: '2026-11-04T03:00:00Z', due_state: null, late_days: null, ...over });

describe('sweepSla', () => {
  it('marks_due_soon_and_overdue', () => {
    expect(sweepSla([task()], '2026-11-03T10:00:00Z')).toEqual([{ id: 'a', due_state: 'due_soon', late_days: 0 }]);
    expect(sweepSla([task()], '2026-11-04T04:00:00Z')).toEqual([{ id: 'a', due_state: 'overdue', late_days: 1 }]);
    expect(sweepSla([task()], '2026-11-02T03:00:00Z')).toEqual([{ id: 'a', due_state: 'on_time', late_days: 0 }]);
  });

  it('only_changes_are_returned', () => {
    expect(sweepSla([task({ due_state: 'due_soon' })], '2026-11-03T10:00:00Z')).toEqual([]);
    expect(sweepSla([task({ due_state: 'overdue', late_days: 1 })], '2026-11-04T04:00:00Z')).toEqual([]);
  });

  it('untracked_tasks_are_left', () => {
    expect(sweepSla([task({ due_at: null }), task({ status: 'done' }), task({ status: 'blocked' })], '2026-11-05T03:00:00Z')).toEqual([]);
  });
});
