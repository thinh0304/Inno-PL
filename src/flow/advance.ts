// The order's flow, as one pure step: the tasks and the order as they are -> what to create, change and log.
// It is idempotent (a second run over its own result changes nothing), so a trigger that fires on its own writes ends there.
import { addWorkingDays, dueState } from './calendar';
import { applies, FINISHED, needsApproval, predecessors, TASKS, type FlowOrder, type TaskCode, type TaskOutcome, type TaskRole,
  type TaskStatus } from './tasks';

export type EventAction = 'auto_approved' | 'reopened_missing_fields' | 'returned_processed' | 'revise_processed' | 'approved' | 'completed_order';

export interface TaskRec { id: string; task_code: TaskCode; stage: number; role: TaskRole; status: TaskStatus; outcome: TaskOutcome | null;
  reason: string; opened_at: string | null; due_at: string | null; done_at: string | null; sla_days: number | null;
  due_state?: string | null; late_days?: number | null; }

export interface AdvanceInput {
  order: FlowOrder & { id: string; stage: number; created_at: string; approved: boolean; approved_at: string | null;
    contract_signed: boolean; pending_roles: TaskRole[]; pl_requested_at: string | null };
  tasks: TaskRec[]; slaDays: Record<TaskCode, number>; autoApproveLimit: number; now: string;
  /** Issues of validateOrder(..., 'submit'): the server's own check of a submission (BR-42). */
  submitIssues: { path: string; message: string }[];
}

export interface TaskChange { id: string | null; task_code: TaskCode; expect_status: TaskStatus | null; set: Partial<TaskRec> }
export type OrderPatch = Partial<{ status: FlowOrder['status']; stage: number; approved: boolean; approved_at: string;
  contract_signed: boolean; pending_roles: TaskRole[]; pl_requested_at: string }>;
export interface AdvanceResult { creates: TaskChange[]; updates: TaskChange[]; order: OrderPatch;
  events: { task_code: TaskCode | null; action: EventAction; note: string }[]; }

const TASK_FIELDS = ['status', 'outcome', 'reason', 'opened_at', 'due_at', 'done_at', 'sla_days', 'due_state', 'late_days'] as const;
const ORDER_FIELDS = ['status', 'stage', 'approved', 'approved_at', 'contract_signed', 'pending_roles', 'pl_requested_at'] as const;
const stageOf = (code: TaskCode) => TASKS.find((t) => t.code === code)!.stage;

export function advanceOrder(input: AdvanceInput): AdvanceResult {
  const { now, autoApproveLimit } = input;
  const ord = { ...input.order, pending_roles: [...input.order.pending_roles] };
  const events: AdvanceResult['events'] = [];
  const cur = new Map<TaskCode, TaskRec>();
  const orig = new Map<TaskCode, TaskRec>();
  for (const t of input.tasks) {
    orig.set(t.task_code, { ...t });
    cur.set(t.task_code, { ...t });
  }

  const slaOf = (t: TaskRec) => t.sla_days ?? input.slaDays[t.task_code] ?? 0;
  const flow = (): FlowOrder => ord;
  const reset = (t: TaskRec, status: TaskStatus) => Object.assign(t, { status, outcome: null, reason: '', opened_at: null, due_at: null,
    done_at: null, due_state: null, late_days: null });
  const open = (t: TaskRec, at = now) => Object.assign(t, { status: 'open' as const, outcome: null, reason: '', opened_at: at,
    due_at: addWorkingDays(at, slaOf(t)), done_at: null, due_state: null, late_days: null });

  // Tasks the order does not have yet (a new order has none): t11 opens from the order's creation.
  const created: TaskCode[] = [];
  for (const d of TASKS) {
    if (cur.has(d.code)) continue;
    const t: TaskRec = { id: '', task_code: d.code, stage: d.stage, role: d.role, status: 'blocked', outcome: null, reason: '',
      opened_at: null, due_at: null, done_at: null, sla_days: input.slaDays[d.code] ?? 0, due_state: null, late_days: null };
    if (d.code === 't11') open(t, ord.created_at);
    cur.set(d.code, t);
    created.push(d.code);
  }
  const get = (code: TaskCode) => cur.get(code)!;
  // A task is passed when it is done, or skipped, or does not apply and everything before it is passed (so a task whose
  // predecessors all do not apply still waits for t11); a person's "not applicable" (t53) is a real finish.
  const passed = (code: TaskCode): boolean => {
    const t = get(code);
    if (t.status === 'done' || t.status === 'skipped') return true;
    return t.status === 'not_applicable' && (t.outcome === 'not_applicable' || predecessors(code, flow()).every(passed));
  };
  const snapshot = () => JSON.stringify([[...cur.values()], ord, events.length]);

  for (let pass = 0; pass < 20; pass++) {
    const before = snapshot();

    if (ord.status === 'close_lost') {
      for (const t of cur.values()) if (t.status === 'open' || t.status === 'blocked') t.status = 'cancelled';
      ord.pending_roles = [];
      if (before === snapshot()) break;
      continue;
    }

    // Returned by TM (t22) or SD (t31): everything after t11 starts again.
    const returned = TASKS.map((d) => get(d.code)).find((t) =>
      (t.task_code === 't22' || t.task_code === 't31') && t.status === 'done' && t.outcome === 'returned');
    if (returned) {
      events.push({ task_code: returned.task_code, action: 'returned_processed', note: returned.reason });
      for (const t of cur.values()) if (t.task_code !== 't11') reset(t, 'blocked');
      open(get('t11'));
      ord.status = 'draft';
      ord.approved = false;
    }

    // SD asks for the drafts to be revised (t42): the drafting tasks open again.
    const t42 = get('t42');
    if (t42.status === 'done' && t42.outcome === 'revise') {
      events.push({ task_code: 't42', action: 'revise_processed', note: t42.reason });
      reset(t42, 'blocked');
      for (const code of ['t40', 't44'] as const) if (get(code).status !== 'not_applicable') open(get(code));
    }

    // Sent for approval: the server checks the submission itself, whatever the screen did (BR-42).
    const t11 = get('t11');
    // t11 finished some other way (the rule on order_task refuses it, but a run does not rely on that): it is still open.
    if (t11.status === 'done' && t11.outcome !== 'submitted' && ord.status === 'draft') open(t11);
    if (t11.status === 'done' && t11.outcome === 'submitted' && ord.status === 'draft') {
      if (input.submitIssues.length) {
        open(t11);
        events.push({ task_code: 't11', action: 'reopened_missing_fields', note: input.submitIssues.map((i) => i.path).join(', ') });
      } else {
        ord.status = 'in_progress';
        ord.pl_requested_at = now;
      }
    }

    // What applies depends on the order's content, so tasks not yet reached are judged again (a person's "not applicable" stands).
    for (const d of TASKS) {
      const t = get(d.code);
      if (t.status === 'blocked' || (t.status === 'not_applicable' && t.outcome !== 'not_applicable')) {
        t.status = applies(d.code, flow(), autoApproveLimit) ? 'blocked' : 'not_applicable';
      }
    }

    // Work whose predecessors are no longer passed goes back (a run that read a return half applied, a task finished at the
    // moment of a return): the tasks are in flow order, so one pass settles the whole chain.
    for (const d of TASKS) {
      const t = get(d.code);
      if (d.code === 't11' || !['open', 'done', 'skipped'].includes(t.status)) continue;
      if (!predecessors(d.code, flow()).every(passed)) reset(t, 'blocked');
    }

    // Open what has all its predecessors finished; t31 approves itself when the order does not need SD (BR-40).
    for (const d of TASKS) {
      const t = get(d.code);
      // Nothing but t11 opens while the order is a draft: it has not been sent for approval (or has been returned).
      if (t.status !== 'blocked' || ord.status === 'draft' || !predecessors(d.code, flow()).every(passed)) continue;
      open(t);
      if (d.code === 't31' && !needsApproval(flow(), autoApproveLimit)) {
        t.status = 'skipped';
        t.outcome = 'auto_approved';
        events.push({ task_code: 't31', action: 'auto_approved', note: '' });
      }
    }

    // A finished task gets its finish time and how it stood against its due time.
    for (const t of cur.values()) {
      if (!FINISHED.has(t.status) || t.done_at !== null || t.opened_at === null) continue;
      const due = dueState(t.due_at, now, now);
      Object.assign(t, { done_at: now, due_state: due.state, late_days: due.lateDays });
    }

    // The order follows its tasks.
    const all = TASKS.map((d) => get(d.code));
    const unfinished = all.filter((t) => !FINISHED.has(t.status) && t.status !== 'cancelled');
    ord.stage = unfinished.length ? Math.min(...unfinished.map((t) => stageOf(t.task_code))) : 7;
    const approved = all.filter((t) => stageOf(t.task_code) <= 3).every((t) => FINISHED.has(t.status));
    if (approved && !ord.approved) {
      // Approval fixes the P&L once (design 13.6): one more computation is requested here.
      Object.assign(ord, { approved: true, approved_at: now, pl_requested_at: now });
      events.push({ task_code: 't31', action: 'approved', note: '' });
    } else if (!approved && ord.approved) ord.approved = false;
    ord.contract_signed = get('t41').status === 'done';
    ord.pending_roles = TASKS.filter((d) => get(d.code).status === 'open').map((d) => d.role).filter((r, i, a) => a.indexOf(r) === i);
    if (ord.status === 'in_progress' && all.every((t) => FINISHED.has(t.status))) {
      ord.status = 'done';
      events.push({ task_code: null, action: 'completed_order', note: '' });
    }

    if (before === snapshot()) break;
  }

  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const creates: TaskChange[] = created.map((code) => {
    const { id: _id, ...rest } = get(code);
    return { id: null, task_code: code, expect_status: null, set: rest };
  });
  const updates: TaskChange[] = [];
  for (const [code, was] of orig) {
    const is = get(code);
    const set: Record<string, unknown> = {};
    for (const f of TASK_FIELDS) if (!same(was[f], is[f])) set[f] = is[f];
    if (Object.keys(set).length) updates.push({ id: was.id, task_code: code, expect_status: was.status, set: set as Partial<TaskRec> });
  }
  const order: Record<string, unknown> = {};
  for (const f of ORDER_FIELDS) if (!same(input.order[f], ord[f])) order[f] = ord[f];
  return { creates, updates, order: order as OrderPatch, events };
}
