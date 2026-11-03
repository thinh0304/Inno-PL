import { describe, expect, it } from 'vitest';
import { stageBar, waitingOn, type BoardTask } from '../../src/flow/board';
import { TASKS, type TaskCode, type TaskStatus } from '../../src/flow/tasks';

/** All fifteen tasks: `blocked` unless named. */
const board = (statuses: Partial<Record<TaskCode, TaskStatus>>): BoardTask[] =>
  TASKS.map((d) => ({ task_code: d.code, role: d.role, stage: d.stage, status: statuses[d.code] ?? 'blocked' }));
const NOT_RETURNED = { status: 'in_progress' as const, returned: false };

describe('stageBar', () => {
  it('done_stage_when_all_its_tasks_are_finished', () => {
    const bar = stageBar(board({ t11: 'done', t22: 'not_applicable', t23: 'done', t31: 'skipped' }), NOT_RETURNED);
    expect(bar.map((s) => s.state).slice(0, 4)).toEqual(['done', 'done', 'done', 'current']);
    expect(bar[1]).toMatchObject({ finished: 2, total: 2 });
  });

  it('current_is_the_lowest_stage_with_unfinished_work', () => {
    const bar = stageBar(board({ t11: 'done', t22: 'done', t23: 'open' }), NOT_RETURNED);
    expect(bar.map((s) => s.state)).toEqual(['done', 'current', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']);
    expect(bar).toHaveLength(7);
    expect(bar.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('a_later_stage_with_an_open_task_is_parallel', () => {
    const bar = stageBar(board({ t11: 'done', t22: 'done', t23: 'open', t51: 'open' }), NOT_RETURNED);
    expect(bar[4].state).toBe('parallel');
    expect(bar[2].state).toBe('waiting');
  });

  it('waiting_roles_are_the_roles_of_open_tasks', () => {
    const bar = stageBar(board({ t11: 'done', t22: 'open', t23: 'open' }), NOT_RETURNED);
    expect(bar[1].waitingRoles).toEqual(['tm', 'proc']);
    expect(bar[0].waitingRoles).toEqual([]);
  });

  it('returned_marks_stage_1_when_the_draft_was_returned', () => {
    const bar = stageBar(board({ t11: 'open' }), { status: 'draft', returned: true });
    expect(bar[0]).toMatchObject({ state: 'returned', waitingRoles: ['am'] });
    expect(stageBar(board({ t11: 'open' }), { status: 'draft', returned: false })[0].state).toBe('current');
  });

  it('lost_marks_the_current_stage_and_stops_the_rest', () => {
    const bar = stageBar(board({ t11: 'done', t22: 'cancelled', t23: 'cancelled', t51: 'cancelled' }), { status: 'close_lost', returned: false });
    expect(bar.map((s) => s.state)).toEqual(['done', 'lost', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']);
  });

  it('every_stage_done_when_the_order_is_complete', () => {
    const all = Object.fromEntries(TASKS.map((d) => [d.code, 'done'])) as Record<TaskCode, TaskStatus>;
    expect(stageBar(board(all), { status: 'done', returned: false }).every((s) => s.state === 'done')).toBe(true);
  });
});

describe('waitingOn', () => {
  it('waiting_on_follows_blocked_predecessors', () => {
    const tasks = board({ t11: 'done', t22: 'not_applicable', t23: 'done', t31: 'done', t40: 'done', t44: 'open', t42: 'blocked' });
    expect(waitingOn('t42', tasks, false)).toEqual(['proc']);
    // Further back: t41 waits for t42, which waits for t44.
    expect(waitingOn('t41', tasks, false)).toEqual(['proc']);
    const prepay = board({ t41: 'done', t45: 'done', t53: 'done', t51: 'open', t61: 'blocked' });
    expect(waitingOn('t61', prepay, true)).toEqual(['acc']);
    expect(waitingOn('t61', prepay, false)).toEqual([]);
  });

  it('waiting_on_a_task_that_is_not_blocked_is_empty', () => {
    expect(waitingOn('t23', board({ t11: 'done', t23: 'open' }), false)).toEqual([]);
    expect(waitingOn('t11', board({ t11: 'open' }), false)).toEqual([]);
  });
});
