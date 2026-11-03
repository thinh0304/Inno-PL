import { describe, expect, it } from 'vitest';
import { needsWhy, taskWarnings, warningsApply } from '../../src/flow/warnings';
import { TASKS, type TaskCode, type TaskStatus } from '../../src/flow/tasks';
import type { OrderTask } from '../../src/module/orders-api';

const task = (code: TaskCode, status: TaskStatus, over: Partial<OrderTask> = {}): OrderTask => {
  const d = TASKS.find((t) => t.code === code)!;
  return { id: `id-${code}`, order: 'o1', task_code: code, stage: d.stage, role: d.role, status, outcome: null, reason: '', opened_at: null,
    due_at: null, done_at: null, sla_days: 1, due_state: null, late_days: null, claimedBy: null, ...over };
};
const ctx = (over = {}) => ({ tasks: [] as OrderTask[], now: '2026-11-03T03:00:00Z', passed: true as boolean | null, customerPrepays: false, ...over });

describe('taskWarnings', () => {
  it('late_warning_when_overdue_with_working_days', () => {
    // Due Friday 10:00 in Vietnam; now is the next Tuesday at that time.
    const t = task('t23', 'open', { due_at: '2026-11-06T03:00:00Z' });
    expect(taskWarnings(t, ctx({ now: '2026-11-10T03:00:00Z' }))).toEqual([{ code: 'late', level: 'warning', days: 2 }]);
    expect(taskWarnings(t, ctx({ now: '2026-11-05T03:00:00Z' }))).toEqual([]);
  });

  it('prepay_warning_only_at_t53_before_t51', () => {
    const t53 = task('t53', 'open');
    const without = ctx({ customerPrepays: true, tasks: [task('t51', 'open')] });
    expect(taskWarnings(t53, without)).toEqual([{ code: 'prepay_before_customer', level: 'warning' }]);
    expect(taskWarnings(t53, ctx({ customerPrepays: true, tasks: [task('t51', 'done')] }))).toEqual([]);
    expect(taskWarnings(t53, ctx({ customerPrepays: false, tasks: [task('t51', 'open')] }))).toEqual([]);
    expect(taskWarnings(task('t61', 'open'), without)).toEqual([]);
  });

  it('t53_warning_shows_the_prepay_amount', () => {
    const without = ctx({ customerPrepays: true, tasks: [task('t51', 'open')], prepayAmount: 1_050_000 });
    expect(taskWarnings(task('t53', 'open'), without)).toEqual([{ code: 'prepay_before_customer', level: 'warning', amount: 1_050_000 }]);
  });

  it('t53_warning_clears_when_the_customer_prepaid', () => {
    expect(taskWarnings(task('t53', 'open'), ctx({ customerPrepays: true, tasks: [task('t51', 'done')], prepayAmount: 1_050_000 }))).toEqual([]);
  });

  it('below_threshold_is_critical_at_t31_and_a_warning_at_t11', () => {
    expect(taskWarnings(task('t31', 'open'), ctx({ passed: false }))).toEqual([{ code: 'below_threshold', level: 'critical' }]);
    expect(taskWarnings(task('t11', 'open'), ctx({ passed: false }))).toEqual([{ code: 'below_threshold', level: 'warning' }]);
    expect(taskWarnings(task('t31', 'open'), ctx({ passed: null }))).toEqual([]);
    expect(taskWarnings(task('t31', 'open'), ctx({ passed: true }))).toEqual([]);
    expect(taskWarnings(task('t23', 'open'), ctx({ passed: false }))).toEqual([]);
  });

  it('no_warnings_on_a_task_that_is_not_open', () => {
    expect(taskWarnings(task('t31', 'blocked'), ctx({ passed: false }))).toEqual([]);
    expect(taskWarnings(task('t31', 'done', { due_at: '2026-11-01T03:00:00Z' }), ctx({ passed: false }))).toEqual([]);
  });

  it('warnings_do_not_apply_to_returned_or_revise', () => {
    expect(warningsApply('returned')).toBe(false);
    expect(warningsApply('revise')).toBe(false);
    for (const outcome of ['submitted', 'approved', 'agreed', 'completed', 'not_applicable'] as const) expect(warningsApply(outcome), outcome).toBe(true);
  });

  it('needs_why_only_for_critical', () => {
    expect(needsWhy([{ code: 'late', level: 'warning', days: 1 }])).toBe(false);
    expect(needsWhy([{ code: 'late', level: 'warning', days: 1 }, { code: 'below_threshold', level: 'critical' }])).toBe(true);
    expect(needsWhy([])).toBe(false);
  });
});
