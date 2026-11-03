// What the compute_pl workflow's Code step runs: config/code/compute_order_pl.js bundles this file (scripts/build-code.mjs).
import { parseTime } from '../pl/time';
import { computePl } from '../pl/compute';
import { configFromRecords, type ConfigRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import { plRecordsFromResult, type PlRecordBodies } from './pl-records';
import { draftFromRecords, fieldsOf, toPlOrderInput } from './records';
import type { OrderRecords, Rec } from './types';

// existing: the order's order_pl records. A locked one (figures signed off from Excel, FR-5.7) is never recomputed,
// and neither is an approved order's once the computation its approval asked for has run.
export function runComputeOrderPl(args: { records: OrderRecords; proposals: Rec[]; existing: Rec[];
  config: ConfigRecords | null; now: string }): PlRecordBodies & { skip: boolean } {
  const existing = (args.existing ?? []).map(fieldsOf);
  const skipped = { skip: true, order_pl: {}, order_pl_service: {}, order_pl_goods: {}, order: { code: '', has_goods: false, has_service: false } };
  if (existing.some((pl) => pl.locked === true)) return skipped;
  // Approval fixes the P&L: the computation it asked for (computed_at at or after approved_at) is the last one.
  const order = fieldsOf(args.records.order);
  const approvedAt = parseTime(String(order.approved_at ?? ''));
  const computedAt = Math.max(...existing.map((pl) => parseTime(String(pl.computed_at ?? ''))));
  if ((order.approved === true || order.approved === 'true') && computedAt >= approvedAt) return skipped;
  const config = args.config ? configFromRecords(args.config) : DEFAULT_CONFIG;
  const draft = draftFromRecords(args.records, config);
  const result = computePl(toPlOrderInput(draft), config);
  return { skip: false, ...plRecordsFromResult(draft, result, config, args.proposals ?? [], args.now) };
}
