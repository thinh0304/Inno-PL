// The warnings the system itself raises before a task is finished (FR-6.10, FR-6.6, FR-6.8): coded here, worded by the screen.
import type { OrderTask } from '../module/orders-api';
import { dueState } from './calendar';
import { FINISHED, type TaskOutcome } from './tasks';

export type WarningCode = 'late' | 'prepay_before_customer' | 'below_threshold';
export interface FlowWarning { code: WarningCode; level: 'warning' | 'critical'; days?: number;
  /** The advance owed to the suppliers by their contracts (FR-6.8), on the prepay warning. */ amount?: number }

export function taskWarnings(task: OrderTask, ctx: { tasks: OrderTask[]; now: string; passed: boolean | null; customerPrepays: boolean;
  prepayAmount?: number }): FlowWarning[] {
  if (task.status !== 'open') return [];
  const out: FlowWarning[] = [];
  const due = dueState(task.due_at, ctx.now, null);
  if (due.state === 'overdue') out.push({ code: 'late', level: 'warning', days: due.lateDays });
  if (task.task_code === 't53' && ctx.customerPrepays) {
    const t51 = ctx.tasks.find((t) => t.task_code === 't51');
    if (t51 && !FINISHED.has(t51.status)) {
      out.push({ code: 'prepay_before_customer', level: 'warning', ...(ctx.prepayAmount ? { amount: ctx.prepayAmount } : {}) });
    }
  }
  // Sending an order whose P&L is below its threshold is worth a line; approving it is worth a reason.
  if (ctx.passed === false && (task.task_code === 't11' || task.task_code === 't31')) {
    out.push({ code: 'below_threshold', level: task.task_code === 't31' ? 'critical' : 'warning' });
  }
  return out;
}

/** A critical warning needs a reason before the person goes on (FR-6.10). */
export const needsWhy = (warnings: FlowWarning[]) => warnings.some((w) => w.level === 'critical');

/** Returning an order, or asking for a revision, is acting on the warnings, not going on in spite of them. */
export const warningsApply = (outcome: TaskOutcome) => outcome !== 'returned' && outcome !== 'revise';
