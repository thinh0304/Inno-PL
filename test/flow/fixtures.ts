import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { addWorkingDays } from '../../src/flow/calendar';
import { applies, TASKS, type TaskCode, type TaskOutcome, type TaskStatus } from '../../src/flow/tasks';
import { advanceOrder, type AdvanceInput, type AdvanceResult, type TaskRec } from '../../src/flow/advance';

/** Tuesday 10:00 in Vietnam. */
export const NOW = '2026-11-03T03:00:00Z';
export const LIMIT = DEFAULT_CONFIG.settings.autoApproveLimit;
export const SLA = Object.fromEntries(DEFAULT_CONFIG.taskSlas.map((s) => [s.taskCode, s.slaDays])) as Record<TaskCode, number>;

/** A goods-only order of 420 million that passed its P&L threshold, in draft. */
export function order(over: Partial<AdvanceInput['order']> = {}): AdvanceInput['order'] {
  return { id: 'o1', status: 'draft', stage: 1, has_goods: true, has_service: false, customer_prepays: false, revenue: 420_000_000,
    passed: true, created_at: '2026-11-02T03:00:00Z', approved: false, approved_at: null, contract_signed: false, pending_roles: [],
    pl_requested_at: null, ...over };
}

type Spec = TaskStatus | readonly [TaskStatus, TaskOutcome] | readonly [TaskStatus, TaskOutcome, string];

/** All fifteen tasks: the ones that do not apply are not_applicable, the rest blocked, then `specs` on top. */
export function tasksWith(specs: Partial<Record<TaskCode, Spec>>, ord: AdvanceInput['order'] = order()): TaskRec[] {
  return TASKS.map((d) => {
    const spec = specs[d.code] ?? (applies(d.code, ord, LIMIT) ? 'blocked' : 'not_applicable');
    const [status, outcome = null, reason = ''] = (typeof spec === 'string' ? [spec] : spec) as [TaskStatus, TaskOutcome?, string?];
    const touched = !(status === 'blocked' || (status === 'not_applicable' && outcome === null));
    const opened = touched ? '2026-11-02T03:00:00Z' : null;
    const finished = ['done', 'skipped', 'not_applicable'].includes(status) && touched;
    return { id: `id-${d.code}`, task_code: d.code, stage: d.stage, role: d.role, status, outcome, reason, opened_at: opened,
      due_at: opened ? addWorkingDays(opened, SLA[d.code]) : null, done_at: finished ? '2026-11-02T04:00:00Z' : null,
      sla_days: SLA[d.code], due_state: finished ? 'done_on_time' : null, late_days: finished ? 0 : null };
  });
}

export function input(over: Partial<AdvanceInput> = {}): AdvanceInput {
  return { order: order(), tasks: [], slaDays: SLA, autoApproveLimit: LIMIT, now: NOW, submitIssues: [], ...over };
}

/** What the workflow does with a result: creates, then updates that still find the status they expected, then the order. */
export function apply(before: AdvanceInput, result: AdvanceResult): AdvanceInput {
  const tasks = before.tasks.map((t) => ({ ...t }));
  for (const c of result.creates) tasks.push({ ...c.set, id: `id-${c.task_code}`, task_code: c.task_code } as TaskRec);
  for (const u of result.updates) {
    const at = tasks.find((t) => t.task_code === u.task_code)!;
    if (u.expect_status === null || at.status === u.expect_status) Object.assign(at, u.set);
  }
  return { ...before, tasks, order: { ...before.order, ...result.order } };
}

export function step(before: AdvanceInput): { next: AdvanceInput; result: AdvanceResult } {
  const result = advanceOrder(before);
  return { next: apply(before, result), result };
}

export const byCode = (tasks: TaskRec[], code: TaskCode) => tasks.find((t) => t.task_code === code)!;
export const statuses = (tasks: TaskRec[]) => Object.fromEntries(tasks.map((t) => [t.task_code, t.status])) as Record<TaskCode, TaskStatus>;
export const empty = (r: AdvanceResult) => !r.creates.length && !r.updates.length && !r.events.length && !Object.keys(r.order).length;
