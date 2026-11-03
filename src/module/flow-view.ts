// What the flow screens derive from the order's log and tasks, shared by the page (stage bar) and the tabs.
import { parseTime } from '../pl/time';
import type { OrderEvent } from './orders-api.js';

const lastOf = (events: OrderEvent[], action: string) => [...events].reverse().find((e) => e.action === action) ?? null;

/**
 * A draft order sent back (FR-6.3): the workflow logged `returned_processed` after the last time it was sent for approval.
 * `by` is the person's own `returned` line, with their reason.
 */
export function returnedInfo(events: OrderEvent[], status: string): { returned: boolean; by: OrderEvent | null } {
  const processed = lastOf(events, 'returned_processed');
  const submitted = lastOf(events, 'submitted');
  const returned = status === 'draft' && processed !== null && (submitted === null || parseTime(processed.at) > parseTime(submitted.at));
  return { returned, by: returned ? lastOf(events, 'returned') : null };
}

/** Why the order was closed, from the log (the order record itself carries `close_reason` only for the server). */
export const closedReason = (events: OrderEvent[]): string => lastOf(events, 'close_lost')?.reason ?? '';
