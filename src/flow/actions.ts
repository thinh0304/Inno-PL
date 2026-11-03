// What a person may do with a task on the screen (FR-6.2); the server enforces the same through the rules of order_task.
import { TASKS, type TaskCode, type TaskOutcome, type TaskRole, type TaskStatus } from './tasks';

export interface TaskLike { status: TaskStatus; task_code: TaskCode; role: TaskRole; claimedBy?: string | null }

/** The outcomes to offer: only an open task of one of the person's roles, and not one somebody else holds. */
export function actionsFor(task: TaskLike, me: string, myRoles: readonly TaskRole[]): TaskOutcome[] {
  if (task.status !== 'open' || !myRoles.includes(task.role)) return [];
  if (task.claimedBy && task.claimedBy !== me) return [];
  return [...TASKS.find((t) => t.code === task.task_code)!.outcomes];
}

/** Sending a task back, and asking for the drafts to be revised, both need a reason (BR-43). */
export const needsReason = (outcome: TaskOutcome) => outcome === 'returned' || outcome === 'revise';

/** The status a task takes when its outcome is chosen: "not applicable" is the one outcome that is its own status (BR-47). */
export const statusFor = (outcome: TaskOutcome): TaskStatus => (outcome === 'not_applicable' ? 'not_applicable' : 'done');
