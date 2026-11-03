import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { applies, FINISHED, needsApproval, predecessors, TASKS, type FlowOrder, type TaskCode } from '../../src/flow/tasks';

const LIMIT = DEFAULT_CONFIG.settings.autoApproveLimit;
const order = (over: Partial<FlowOrder> = {}): FlowOrder => ({ status: 'draft', has_goods: true, has_service: true,
  customer_prepays: false, revenue: 420_000_000, passed: true, ...over });

describe('the fifteen tasks', () => {
  it('fifteen_tasks_in_stages', () => {
    expect(TASKS.map((t) => `${t.code}:${t.stage}`)).toEqual(['t11:1', 't22:2', 't23:2', 't31:3', 't40:4', 't44:4', 't42:4',
      't41:4', 't45:4', 't51:5', 't53:5', 't61:6', 't62:6', 't71:7', 't72:7']);
    for (const t of TASKS) expect(t.role).toBe(DEFAULT_CONFIG.taskSlas.find((s) => s.taskCode === t.code)!.role);
  });

  it('predecessors_follow_br41', () => {
    const want: Record<TaskCode, TaskCode[]> = { t11: [], t22: ['t11'], t23: ['t11'], t31: ['t22', 't23'], t40: ['t31'], t44: ['t31'],
      t42: ['t40', 't44'], t41: ['t42'], t45: ['t42'], t51: ['t41'], t53: ['t45'], t61: ['t45', 't53'], t62: ['t41'],
      t71: ['t61', 't62'], t72: ['t71'] };
    for (const t of TASKS) expect(predecessors(t.code, order())).toEqual(want[t.code]);
  });

  it('prepay_adds_t51_before_delivery', () => {
    expect(predecessors('t61', order({ customer_prepays: true }))).toEqual(['t45', 't53', 't51']);
    expect(predecessors('t62', order({ customer_prepays: true }))).toEqual(['t41', 't51']);
  });

  it('service_and_goods_applicability', () => {
    const goodsOnly = order({ has_service: false });
    expect(TASKS.filter((t) => !applies(t.code, goodsOnly, LIMIT)).map((t) => t.code)).toEqual(['t22', 't62']);
    const serviceOnly = order({ has_goods: false });
    expect(TASKS.filter((t) => !applies(t.code, serviceOnly, LIMIT)).map((t) => t.code)).toEqual(['t23', 't44', 't45', 't53', 't61']);
  });

  it('approval_needed_over_limit_or_goods_or_failing', () => {
    const small = order({ has_goods: false, revenue: 200_000_000 });
    expect(needsApproval(small, LIMIT)).toBe(false);
    expect(needsApproval({ ...small, revenue: 300_000_001 }, LIMIT)).toBe(true);
    expect(needsApproval({ ...small, has_goods: true }, LIMIT)).toBe(true);
    expect(needsApproval({ ...small, passed: false }, LIMIT)).toBe(true);
    expect(needsApproval({ ...small, passed: null }, LIMIT)).toBe(true);
    // t31 itself always applies: it is either done by SD or auto-approved.
    expect(applies('t31', small, LIMIT)).toBe(true);
  });

  it('outcomes_per_task', () => {
    const of = (c: TaskCode) => TASKS.find((t) => t.code === c)!.outcomes;
    expect(of('t11')).toEqual(['submitted']);
    expect(of('t22')).toEqual(['approved', 'returned']);
    expect(of('t31')).toEqual(['approved', 'returned']);
    expect(of('t42')).toEqual(['agreed', 'revise']);
    expect(of('t53')).toEqual(['completed', 'not_applicable']);
    expect(of('t61')).toEqual(['completed']);
    expect([...FINISHED].sort()).toEqual(['done', 'not_applicable', 'skipped']);
  });
});
