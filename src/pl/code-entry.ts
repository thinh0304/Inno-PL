// What the compute_pl Code step runs: config/code/compute_pl.js bundles this file (scripts/build-code.mjs).
import { computePl, type PlResult } from './compute';
import { configFromRecords, type ConfigRecords } from './config-records';
import { DEFAULT_CONFIG } from './defaults';
import type { PlOrderInput } from './types';

// config null → the defaults, for a run that has not read the configuration entities.
export function runComputePl(args: { input: PlOrderInput; config: ConfigRecords | null }): PlResult {
  return computePl(args.input, args.config ? configFromRecords(args.config) : DEFAULT_CONFIG);
}
