// Working days (Monday–Friday, Vietnam time, no public holidays) and the state of a task against its due time (BR-49).
import { parseTime } from '../pl/time';

const HOUR = 3_600_000;
const VN = 7 * HOUR;

export type DueState = 'on_time' | 'due_soon' | 'overdue' | 'done_on_time' | 'done_late';

const isWeekend = (vnMs: number) => [0, 6].includes(new Date(vnMs).getUTCDay());

/** `days` working days after `fromIso`, at the same time of day; null when the task has no SLA (0 days). */
export function addWorkingDays(fromIso: string, days: number): string | null {
  if (!days) return null;
  let vn = parseTime(fromIso) + VN;
  // Opened on a weekend: counting starts on Monday at 08:00.
  while (isWeekend(vn)) vn = Math.floor(vn / (24 * HOUR) + 1) * 24 * HOUR + 8 * HOUR;
  for (let left = days; left > 0;) {
    vn += 24 * HOUR;
    if (!isWeekend(vn)) left -= 1;
  }
  return new Date(vn - VN).toISOString();
}

/** Working days from `dueIso` to `untilIso`, counted up. */
function lateDaysBetween(dueIso: string, untilIso: string): number {
  let at = dueIso;
  let count = 0;
  while (parseTime(at) < parseTime(untilIso) && count < 1000) {
    at = addWorkingDays(at, 1)!;
    count += 1;
  }
  return count;
}

export function dueState(dueIso: string | null, nowIso: string, doneIso: string | null): { state: DueState | null; lateDays: number } {
  if (!dueIso) return { state: null, lateDays: 0 };
  const due = parseTime(dueIso);
  if (doneIso) {
    return parseTime(doneIso) > due
      ? { state: 'done_late', lateDays: lateDaysBetween(dueIso, doneIso) }
      : { state: 'done_on_time', lateDays: 0 };
  }
  const now = parseTime(nowIso);
  if (now > due) return { state: 'overdue', lateDays: lateDaysBetween(dueIso, nowIso) };
  return { state: due - now < 24 * HOUR ? 'due_soon' : 'on_time', lateDays: 0 };
}
