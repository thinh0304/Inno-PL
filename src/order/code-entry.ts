// What the compute_pl workflow's Code step runs: config/code/compute_order_pl.js bundles this file (scripts/build-code.mjs).
import { computePl } from '../pl/compute';
import { configFromRecords, type ConfigRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import { plRecordsFromResult, type PlRecordBodies } from './pl-records';
import { draftFromRecords, fieldsOf, toPlOrderInput } from './records';
import type { OrderRecords, Rec } from './types';

// existing: the order's order_pl records. A locked one (figures signed off from Excel, FR-5.7) is never recomputed.
export function runComputeOrderPl(args: { records: OrderRecords; proposals: Rec[]; existing: Rec[];
  config: ConfigRecords | null; now: string }): PlRecordBodies & { skip: boolean } {
  if ((args.existing ?? []).map(fieldsOf).some((pl) => pl.locked === true)) {
    return { skip: true, order_pl: {}, order_pl_service: {}, order_pl_goods: {}, order: { code: '', has_goods: false, has_service: false } };
  }
  const config = args.config ? configFromRecords(args.config) : DEFAULT_CONFIG;
  const draft = draftFromRecords(args.records, config);
  const result = computePl(toPlOrderInput(draft), config);
  return { skip: false, ...plRecordsFromResult(draft, result, config, args.proposals ?? [], args.now) };
}
