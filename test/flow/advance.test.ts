import { describe, expect, it } from 'vitest';
import { advanceOrder } from '../../src/flow/advance';
import { apply, byCode, empty, input, NOW, order, statuses, step, tasksWith } from './fixtures';

const both = () => order({ has_service: true });
const inProgress = (over = {}) => order({ status: 'in_progress', ...over });

describe('advanceOrder', () => {
  it('creates_fifteen_with_t11_open', () => {
    const { result, next } = step(input({ order: order() }));
    expect(result.creates).toHaveLength(15);
    expect(result.updates).toEqual([]);
    const s = statuses(next.tasks);
    expect(s.t11).toBe('open');
    expect([s.t22, s.t62]).toEqual(['not_applicable', 'not_applicable']);
    expect(Object.entries(s).filter(([, v]) => v === 'blocked')).toHaveLength(12);
    // t11 counts from the order's creation: Monday 10:00 + 1 working day.
    expect(byCode(next.tasks, 't11').due_at).toBe('2026-11-03T03:00:00.000Z');
    expect(result.order).toEqual({ pending_roles: ['am'] });
  });

  it('tasks_wait_for_t11_even_when_their_predecessors_do_not_apply', () => {
    // Before the first P&L the order has neither goods nor service: nothing but t11 may open.
    const ord = order({ has_goods: false, has_service: false });
    const { next } = step(input({ order: ord }));
    expect(Object.entries(statuses(next.tasks)).filter(([, v]) => v === 'open').map(([k]) => k)).toEqual(['t11']);
    expect(next.order.pending_roles).toEqual(['am']);
    // Once t11 is done the chain of tasks that do not apply is passed through to t31.
    const sent = step(input({ order: ord, tasks: tasksWith({ t11: ['done', 'submitted'] }, ord) }));
    expect(statuses(sent.next.tasks)).toMatchObject({ t31: 'open', t40: 'blocked', t71: 'blocked' });
  });

  it('submit_opens_t23_and_requests_pl', () => {
    const { result, next } = step(input({ tasks: tasksWith({ t11: ['done', 'submitted'] }) }));
    expect(next.order).toMatchObject({ status: 'in_progress', pl_requested_at: NOW, stage: 2, pending_roles: ['proc'] });
    expect(statuses(next.tasks)).toMatchObject({ t22: 'not_applicable', t23: 'open', t31: 'blocked' });
    expect(byCode(next.tasks, 't23').opened_at).toBe(NOW);
    expect(result.events).toEqual([]);
  });

  it('submit_with_missing_fields_reopens_t11', () => {
    const { result, next } = step(input({ tasks: tasksWith({ t11: ['done', 'submitted'] }),
      submitIssues: [{ path: 'order.content', message: 'x' }, { path: 'lines[0].name', message: 'y' }] }));
    expect(statuses(next.tasks)).toMatchObject({ t11: 'open', t23: 'blocked' });
    expect(byCode(next.tasks, 't11').outcome).toBeNull();
    expect(next.order.status).toBe('draft');
    expect(result.events).toEqual([{ task_code: 't11', action: 'reopened_missing_fields', note: 'order.content, lines[0].name' }]);
  });

  it('t31_waits_for_both_t22_and_t23', () => {
    const ord = inProgress({ has_service: true });
    const waiting = step(input({ order: ord, tasks: tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'approved'], t23: 'open' }, ord) }));
    expect(statuses(waiting.next.tasks).t31).toBe('blocked');
    const ready = step(input({ order: ord, tasks: tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'approved'], t23: ['done', 'completed'] }, ord) }));
    expect(statuses(ready.next.tasks).t31).toBe('open');
    expect(ready.next.order.pending_roles).toEqual(['sd']);
  });

  it('small_passing_service_order_auto_approves', () => {
    const ord = inProgress({ has_goods: false, has_service: true, revenue: 200_000_000, stage: 2 });
    const { result, next } = step(input({ order: ord, tasks: tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'approved'] }, ord) }));
    expect(byCode(next.tasks, 't31')).toMatchObject({ status: 'skipped', outcome: 'auto_approved', done_at: NOW });
    expect(statuses(next.tasks)).toMatchObject({ t40: 'open', t44: 'not_applicable', t42: 'blocked' });
    expect(result.events.map((e) => e.action)).toEqual(['auto_approved', 'approved']);
    expect(next.order).toMatchObject({ approved: true, approved_at: NOW, pl_requested_at: NOW, stage: 4 });
  });

  it('return_at_t31_resets_everything_after_t11', () => {
    const ord = inProgress({ has_service: true, stage: 3 });
    const tasks = tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'approved'], t23: ['done', 'completed'], t31: ['done', 'returned', 'Giá chưa hợp lý'] }, ord);
    const { result, next } = step(input({ order: ord, tasks }));
    expect(statuses(next.tasks)).toMatchObject({ t11: 'open', t22: 'blocked', t23: 'blocked', t31: 'blocked', t40: 'blocked' });
    expect(byCode(next.tasks, 't22')).toMatchObject({ outcome: null, done_at: null, opened_at: null });
    expect(byCode(next.tasks, 't11')).toMatchObject({ outcome: null, opened_at: NOW, due_at: '2026-11-04T03:00:00.000Z' });
    expect(next.order).toMatchObject({ status: 'draft', stage: 1, approved: false, pending_roles: ['am'] });
    expect(result.events).toEqual([{ task_code: 't31', action: 'returned_processed', note: 'Giá chưa hợp lý' }]);
  });

  it('return_needs_t22_or_t31', () => {
    const ord = inProgress({ stage: 4, approved: true });
    const tasks = tasksWith({ t11: ['done', 'submitted'], t23: ['done', 'completed'], t31: ['done', 'approved'], t40: ['done', 'returned', 'x'] }, ord);
    const { next } = step(input({ order: ord, tasks }));
    expect(byCode(next.tasks, 't40').status).toBe('done');
    expect(byCode(next.tasks, 't11').status).toBe('done');
    expect(next.order.status).toBe('in_progress');
  });

  it('revise_at_t42_reopens_drafts_only', () => {
    const ord = inProgress({ stage: 4, approved: true, approved_at: NOW });
    const tasks = tasksWith({ t11: ['done', 'submitted'], t23: ['done', 'completed'], t31: ['done', 'approved'], t40: ['done', 'completed'],
      t44: ['done', 'completed'], t42: ['done', 'revise', 'Sửa điều khoản'] }, ord);
    const { result, next } = step(input({ order: ord, tasks }));
    expect(statuses(next.tasks)).toMatchObject({ t40: 'open', t44: 'open', t42: 'blocked', t41: 'blocked', t45: 'blocked' });
    expect(result.events).toEqual([{ task_code: 't42', action: 'revise_processed', note: 'Sửa điều khoản' }]);
    expect(next.order.pending_roles).toEqual(['sa', 'proc']);
  });

  it('approval_sets_approved_at_once_and_requests_pl', () => {
    const ord = inProgress({ has_service: true, stage: 3 });
    const tasks = tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'approved'], t23: ['done', 'completed'], t31: ['done', 'approved'] }, ord);
    const first = step(input({ order: ord, tasks }));
    expect(first.next.order).toMatchObject({ approved: true, approved_at: NOW, pl_requested_at: NOW, stage: 4 });
    expect(first.result.events).toEqual([{ task_code: 't31', action: 'approved', note: '' }]);
    expect(statuses(first.next.tasks)).toMatchObject({ t40: 'open', t44: 'open' });
    const later = { ...first.next, now: '2026-11-05T03:00:00Z' };
    expect(empty(advanceOrder(later))).toBe(true);
  });

  it('prepay_holds_delivery_until_t51', () => {
    const ord = inProgress({ customer_prepays: true, stage: 5, approved: true });
    const done = { t11: ['done', 'submitted'], t23: ['done', 'completed'], t31: ['done', 'approved'], t40: ['done', 'completed'],
      t44: ['done', 'completed'], t42: ['done', 'agreed'], t41: ['done', 'completed'], t45: ['done', 'completed'], t53: ['done', 'completed'] } as const;
    const holding = step(input({ order: ord, tasks: tasksWith({ ...done, t51: 'open' }, ord) }));
    expect(byCode(holding.next.tasks, 't61').status).toBe('blocked');
    const released = step(input({ order: ord, tasks: tasksWith({ ...done, t51: ['done', 'completed'] }, ord) }));
    expect(byCode(released.next.tasks, 't61').status).toBe('open');
  });

  it('t53_not_applicable_opens_t61', () => {
    const ord = inProgress({ stage: 5, approved: true });
    const tasks = tasksWith({ t11: ['done', 'submitted'], t23: ['done', 'completed'], t31: ['done', 'approved'], t40: ['done', 'completed'],
      t44: ['done', 'completed'], t42: ['done', 'agreed'], t41: ['done', 'completed'], t45: ['done', 'completed'], t53: ['not_applicable', 'not_applicable'] }, ord);
    const { next } = step(input({ order: ord, tasks }));
    expect(byCode(next.tasks, 't53')).toMatchObject({ status: 'not_applicable', outcome: 'not_applicable' });
    expect(byCode(next.tasks, 't61').status).toBe('open');
  });

  it('close_lost_cancels_open_and_blocked', () => {
    const ord = order({ status: 'close_lost', stage: 2, pending_roles: ['proc'] });
    const tasks = tasksWith({ t11: ['done', 'submitted'], t23: 'open' }, ord);
    const { result, next } = step(input({ order: ord, tasks }));
    const s = statuses(next.tasks);
    expect(s).toMatchObject({ t11: 'done', t22: 'not_applicable', t62: 'not_applicable', t23: 'cancelled', t31: 'cancelled', t72: 'cancelled' });
    expect(result.updates.map((u) => u.task_code)).not.toContain('t11');
    expect(next.order.pending_roles).toEqual([]);
    expect(empty(advanceOrder(next))).toBe(true);
  });

  it('stage_and_pending_roles', () => {
    const ord = inProgress({ has_service: true });
    const { next } = step(input({ order: ord, tasks: tasksWith({ t11: ['done', 'submitted'] }, ord) }));
    expect(statuses(next.tasks)).toMatchObject({ t22: 'open', t23: 'open' });
    expect(next.order).toMatchObject({ stage: 2, pending_roles: ['tm', 'proc'] });
  });

  it('last_task_completes_the_order', () => {
    const ord = inProgress({ stage: 7, approved: true, contract_signed: true });
    const done = ['done', 'completed'] as const;
    const tasks = tasksWith({ t11: ['done', 'submitted'], t23: done, t31: ['done', 'approved'], t40: done, t44: done, t42: ['done', 'agreed'],
      t41: done, t45: done, t51: done, t53: done, t61: done, t71: done, t72: done }, ord);
    const { result, next } = step(input({ order: ord, tasks }));
    expect(next.order.status).toBe('done');
    expect(result.events).toEqual([{ task_code: null, action: 'completed_order', note: '' }]);
  });

  it('advance_is_idempotent', () => {
    const scenarios = [
      input({ order: order() }),
      input({ tasks: tasksWith({ t11: ['done', 'submitted'] }) }),
      input({ tasks: tasksWith({ t11: ['done', 'submitted'] }), submitIssues: [{ path: 'order.content', message: 'x' }] }),
      input({ order: both(), tasks: tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'returned', 'Sai'] }, both()) }),
    ];
    for (const s of scenarios) {
      const once = step(s);
      expect(empty(advanceOrder({ ...once.next, now: '2026-11-04T03:00:00Z' }))).toBe(true);
    }
  });

  it('concurrent_runs_converge', () => {
    const ord = inProgress({ has_service: true, stage: 2, pending_roles: ['tm', 'proc'] });
    const seen = input({ order: ord, tasks: tasksWith({ t11: ['done', 'submitted'], t22: ['done', 'approved'], t23: ['done', 'completed'] }, ord) });
    const a = advanceOrder(seen);
    const b = advanceOrder(seen);
    const once = apply(seen, a);
    const twice = apply(apply(seen, a), b);
    expect(twice.tasks).toEqual(once.tasks);
    expect(twice.tasks.filter((t) => t.task_code === 't31' && t.status === 'open')).toHaveLength(1);
  });
});
