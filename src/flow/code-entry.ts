// What the flow workflows' Code steps run: config/code/advance_order.js and config/code/sla_sweep.js bundle this file
// (scripts/build-code.mjs). Records go in as the platform returns them; flat lists come out for the For Each steps.
import { draftFromRecords, fieldsOf } from '../order/records';
import type { OrderRecords, Rec } from '../order/types';
import { validateOrder } from '../order/validate';
import { configFromRecords, parseNumber, type ConfigRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import { advanceOrder, type AdvanceInput, type AdvanceResult, type TaskRec } from './advance';
import { sweepSla, type SweepTask } from './sla';
import { TASKS, type TaskCode, type TaskOutcome, type TaskRole, type TaskStatus } from './tasks';

const optStr = (value: unknown) => (value == null || value === '' ? null : String(value));
const bool = (value: unknown) => value === true || value === 'true';

function taskFromRecord(record: Rec): TaskRec {
  const r = fieldsOf(record);
  return { id: String(r.id ?? ''), task_code: String(r.task_code) as TaskCode, stage: parseNumber(r.stage) ?? 0, role: String(r.role) as TaskRole,
    status: String(r.status ?? 'blocked') as TaskStatus, outcome: optStr(r.outcome) as TaskOutcome | null, reason: String(r.reason ?? ''),
    opened_at: optStr(r.opened_at), due_at: optStr(r.due_at), done_at: optStr(r.finished_at), sla_days: parseNumber(r.sla_days) ?? null,
    due_state: optStr(r.due_state), late_days: parseNumber(r.late_days) ?? null };
}

const TASK_VALUES = ['status', 'outcome', 'reason', 'opened_at', 'due_at', 'finished_at', 'sla_days', 'due_state', 'late_days'] as const;
const values = (t: TaskRec) => Object.fromEntries(TASK_VALUES.map((f) => [f, f === 'finished_at' ? t.done_at ?? null : (t as unknown as Rec)[f] ?? null]));

export interface AdvanceOutput extends AdvanceResult {
  /** The order's seven flow fields as they stand after this run (what the update step writes), and whether any changed. */
  order_fields: Record<string, unknown>;
  order_changed: boolean;
  create_list: Rec[];
  update_list: Rec[];
  event_list: Rec[];
}

export function runAdvance(args: { order: Rec; tasks: Rec[]; pl: Rec[]; lines: Rec[]; goods_prices: Rec[]; service_prices: Rec[]; finance: Rec[];
  config: ConfigRecords | null; now: string }): AdvanceOutput {
  const config = args.config ? configFromRecords(args.config) : DEFAULT_CONFIG;
  const records: OrderRecords = { order: args.order, lines: args.lines ?? [], goods_prices: args.goods_prices ?? [],
    service_prices: args.service_prices ?? [], finance: args.finance ?? [] };
  const draft = draftFromRecords(records, config);
  const raw = fieldsOf(args.order);
  const pl = (args.pl ?? []).map(fieldsOf)[0];
  const order: AdvanceInput['order'] = { id: String(raw.id ?? ''), status: draft.order.status, stage: draft.order.stage,
    has_goods: draft.order.has_goods, has_service: draft.order.has_service, customer_prepays: draft.order.customer_prepays,
    revenue: parseNumber(pl?.revenue) ?? 0, passed: pl?.passed == null ? null : bool(pl.passed),
    created_at: String((args.order as Rec).created_at ?? raw.created_at ?? args.now), approved: bool(raw.approved),
    approved_at: optStr(raw.approved_at), contract_signed: bool(raw.contract_signed),
    pending_roles: (Array.isArray(raw.pending_roles) ? raw.pending_roles : []).map(String) as TaskRole[], pl_requested_at: optStr(raw.pl_requested_at) };
  const slaDays = Object.fromEntries(config.taskSlas.map((s) => [s.taskCode, s.slaDays])) as Record<TaskCode, number>;
  const tasks = (args.tasks ?? []).map(taskFromRecord);
  const submitIssues = validateOrder(draft, config, 'submit').issues.filter((i) => i.severity === 'error');
  const result = advanceOrder({ order, tasks, slaDays, autoApproveLimit: config.settings.autoApproveLimit, now: args.now, submitIssues });

  const idOf = (code: TaskCode | null) => tasks.find((t) => t.task_code === code)?.id ?? null;
  const roleOf = (code: TaskCode | null) => TASKS.find((t) => t.code === code)?.role ?? null;
  const now = { ...order, ...result.order };
  return { ...result,
    order_fields: { status: now.status, stage: now.stage, approved: now.approved, approved_at: now.approved_at,
      contract_signed: now.contract_signed, pending_roles: now.pending_roles, pl_requested_at: now.pl_requested_at },
    order_changed: Object.keys(result.order).length > 0,
    create_list: result.creates.map((c) => ({ task_code: c.task_code, stage: c.set.stage, role: c.set.role, am_user: draft.order.am, ...values(c.set as TaskRec) })),
    update_list: result.updates.map((u) => {
      const full = { ...tasks.find((t) => t.task_code === u.task_code)!, ...u.set } as TaskRec;
      return { id: u.id, task_code: u.task_code, expect_status: u.expect_status, ...values(full) };
    }),
    event_list: result.events.map((e) => ({ task_code: e.task_code, task_id: idOf(e.task_code), role: roleOf(e.task_code), action: e.action,
      note: e.note, at: args.now })) };
}

export function runSlaSweep(args: { tasks: Rec[]; now: string }): { update_list: Rec[] } {
  const tasks: SweepTask[] = (args.tasks ?? []).map(taskFromRecord);
  return { update_list: sweepSla(tasks, args.now) };
}
