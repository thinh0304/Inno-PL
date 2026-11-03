// What the order's flow looks like at a glance: the seven stages (FR-6.1) and who a blocked task is waiting for.
import type { OrderTask } from '../module/orders-api';
import { FINISHED, predecessors, TASKS, type FlowOrder, type TaskCode, type TaskRole } from './tasks';

export type StageState = 'done' | 'current' | 'parallel' | 'waiting' | 'returned' | 'lost';
export interface StageInfo { stage: 1 | 2 | 3 | 4 | 5 | 6 | 7; state: StageState; finished: number; total: number; waitingRoles: TaskRole[] }
export type BoardTask = Pick<OrderTask, 'task_code' | 'status' | 'role' | 'stage'>;

const STAGES = [1, 2, 3, 4, 5, 6, 7] as const;
const ORDER_OF = new Map(TASKS.map((t, i) => [t.code, i]));
const unique = <T,>(items: T[]) => items.filter((x, i) => items.indexOf(x) === i);

/**
 * The seven stages: done when every task of the stage is finished; current is the first stage with unfinished work
 * (returned for a draft sent back, lost for a Close-lost order); a later stage with an open task runs in parallel.
 */
export function stageBar(tasks: BoardTask[], order: { status: FlowOrder['status']; returned: boolean }): StageInfo[] {
  const flowOrder = [...tasks].sort((a, b) => ORDER_OF.get(a.task_code)! - ORDER_OF.get(b.task_code)!);
  const info = STAGES.map((stage) => {
    const own = flowOrder.filter((t) => t.stage === stage);
    return { stage, own, finished: own.filter((t) => FINISHED.has(t.status)).length, total: own.length };
  });
  const isDone = (i: { finished: number; total: number }) => i.total > 0 && i.finished === i.total;
  const current = info.findIndex((i) => !isDone(i));
  return info.map((i, index): StageInfo => {
    const waitingRoles = unique(i.own.filter((t) => t.status === 'open').map((t) => t.role));
    let state: StageState = 'waiting';
    if (isDone(i)) state = 'done';
    else if (index === current) state = order.status === 'close_lost' ? 'lost' : order.returned ? 'returned' : 'current';
    else if (current >= 0 && index > current && order.status !== 'close_lost' && waitingRoles.length) state = 'parallel';
    return { stage: i.stage, state, finished: i.finished, total: i.total, waitingRoles };
  });
}

/** The roles of the nearest open tasks before `code`, going back through the blocked ones; empty for a task that is not blocked. */
export function waitingOn(code: TaskCode, tasks: BoardTask[], customerPrepays: boolean): TaskRole[] {
  const byCode = new Map(tasks.map((t) => [t.task_code, t]));
  if (byCode.get(code)?.status !== 'blocked') return [];
  const flow = { customer_prepays: customerPrepays } as FlowOrder;
  const found = new Set<TaskCode>();
  const seen = new Set<TaskCode>();
  const walk = (at: TaskCode) => {
    for (const p of predecessors(at, flow)) {
      if (seen.has(p)) continue;
      seen.add(p);
      const t = byCode.get(p);
      if (!t || FINISHED.has(t.status)) continue;
      if (t.status === 'open') found.add(p);
      else walk(p);
    }
  };
  walk(code);
  return unique(TASKS.filter((t) => found.has(t.code)).map((t) => t.role));
}
