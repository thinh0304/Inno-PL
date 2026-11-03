// The hourly sweep: how each open task stands against its due time (due soon / overdue, and how many working days late).
import { dueState } from './calendar';

export interface SweepTask { id: string; status: string; due_at: string | null; due_state?: string | null; late_days?: number | null }

/** Only the tasks whose state changed; tasks with no due time (no SLA) and tasks that are not open are left alone. */
export function sweepSla(tasks: SweepTask[], now: string): { id: string; due_state: string | null; late_days: number }[] {
  const changed: { id: string; due_state: string | null; late_days: number }[] = [];
  for (const t of tasks) {
    if (t.status !== 'open' || !t.due_at) continue;
    const next = dueState(t.due_at, now, null);
    if ((t.due_state ?? null) === next.state && (t.late_days ?? 0) === next.lateDays) continue;
    changed.push({ id: t.id, due_state: next.state, late_days: next.lateDays });
  }
  return changed;
}
