import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bundle } from '../../scripts/build-code.mjs';
import { runComputeOrderPl } from '../../src/order/code-entry';
import { TM1040_RECORDS } from './fixtures/tm1040-records';

const committed = readFileSync(new URL('../../config/code/compute_order_pl.js', import.meta.url), 'utf8');
const main = new Function(`${committed}; return main;`)() as (inputs: Record<string, unknown>) => ReturnType<typeof runComputeOrderPl>;
const NOW = '2026-11-03T10:00:00Z';

describe('config/code/compute_order_pl.js', () => {
  it('bundle_is_fresh', async () => {
    expect(await bundle('compute_order_pl')).toBe(committed);
  });

  it('bundle_main_matches_library', () => {
    const { order, lines, goods_prices, service_prices, finance } = TM1040_RECORDS;
    const out = main({ order, lines, goods_prices, service_prices, finance, proposals: [], existing: [], config: null, now: NOW });
    expect(out).toEqual(runComputeOrderPl({ records: TM1040_RECORDS, proposals: [], existing: [], config: null, now: NOW }));
    expect(out.order_pl.net_profit).toBeCloseTo(46_272_444.44, 2);
  });

  it('bundle_reads_only_declared_inputs', () => {
    const names = new Set([...committed.matchAll(/\binputs\s*(?:\.\s*(\w+)|\[)/g)].map((match) => match[1] ?? '['));
    expect([...names].sort()).toEqual(['config', 'existing', 'finance', 'goods_prices', 'lines', 'now', 'order',
      'proposals', 'service_prices']);
  });
});
