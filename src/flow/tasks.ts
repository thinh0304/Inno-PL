// The fifteen tasks of an order (spec Module 6, BR-40, BR-41, BR-47): who does them, what they wait for, when they apply.
import type { TaskRole } from '../pl/types';

export type { TaskRole };
export type TaskCode = 't11' | 't22' | 't23' | 't31' | 't40' | 't44' | 't42' | 't41' | 't45' | 't51' | 't53' | 't61' | 't62' | 't71' | 't72';
export type TaskStatus = 'blocked' | 'open' | 'done' | 'skipped' | 'not_applicable' | 'cancelled';
export type TaskOutcome = 'submitted' | 'approved' | 'returned' | 'agreed' | 'revise' | 'completed' | 'not_applicable' | 'auto_approved';

export interface TaskDef { code: TaskCode; stage: 1 | 2 | 3 | 4 | 5 | 6 | 7; role: TaskRole; after: TaskCode[];
  /** Outcomes the person doing it may choose (FR-6.2). */ outcomes: TaskOutcome[]; }

export interface FlowOrder { status: 'draft' | 'in_progress' | 'done' | 'close_lost'; has_goods: boolean; has_service: boolean;
  customer_prepays: boolean; revenue: number; passed: boolean | null; }

const def = (code: TaskCode, stage: TaskDef['stage'], role: TaskRole, after: TaskCode[], outcomes: TaskOutcome[] = ['completed']): TaskDef =>
  ({ code, stage, role, after, outcomes });

export const TASKS: readonly TaskDef[] = [
  def('t11', 1, 'am', [], ['submitted']),
  def('t22', 2, 'tm', ['t11'], ['approved', 'returned']),
  def('t23', 2, 'proc', ['t11']),
  def('t31', 3, 'sd', ['t22', 't23'], ['approved', 'returned']),
  def('t40', 4, 'sa', ['t31']),
  def('t44', 4, 'proc', ['t31']),
  def('t42', 4, 'sd', ['t40', 't44'], ['agreed', 'revise']),
  def('t41', 4, 'sa', ['t42']),
  def('t45', 4, 'proc', ['t42']),
  def('t51', 5, 'acc', ['t41']),
  def('t53', 5, 'acc', ['t45'], ['completed', 'not_applicable']),
  def('t61', 6, 'proc', ['t45', 't53']),
  def('t62', 6, 'tm', ['t41']),
  def('t71', 7, 'acc', ['t61', 't62']),
  def('t72', 7, 'acc', ['t71']),
];

export const FINISHED: ReadonlySet<TaskStatus> = new Set<TaskStatus>(['done', 'skipped', 'not_applicable']);

/** What a task waits for; delivery and implementation also wait for the customer's advance when there is one (BR-41). */
export function predecessors(code: TaskCode, order: FlowOrder): TaskCode[] {
  const task = TASKS.find((t) => t.code === code)!;
  return (code === 't61' || code === 't62') && order.customer_prepays ? [...task.after, 't51'] : [...task.after];
}

/** BR-40: t31 is SD's to approve when the order is large, has goods, or the P&L has not passed; otherwise it approves itself. */
export function needsApproval(order: FlowOrder, autoApproveLimit: number): boolean {
  return order.revenue > autoApproveLimit || order.has_goods || order.passed !== true;
}

export function applies(code: TaskCode, order: FlowOrder, _autoApproveLimit: number): boolean {
  if (code === 't22' || code === 't62') return order.has_service;
  if (code === 't23' || code === 't44' || code === 't45' || code === 't53' || code === 't61') return order.has_goods;
  return true;
}
