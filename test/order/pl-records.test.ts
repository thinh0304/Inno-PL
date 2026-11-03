import { describe, expect, it } from 'vitest';
import { runComputeOrderPl } from '../../src/order/code-entry';
import { plRecordsFromResult } from '../../src/order/pl-records';
import { draftFromRecords, toPlOrderInput } from '../../src/order/records';
import type { OrderRecords } from '../../src/order/types';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040_RECORDS } from './fixtures/tm1040-records';

const NOW = '2026-11-03T10:00:00Z';
function bodies(records: OrderRecords, proposals: Record<string, unknown>[] = []) {
  const draft = draftFromRecords(records);
  return plRecordsFromResult(draft, computePl(toPlOrderInput(draft), DEFAULT_CONFIG), DEFAULT_CONFIG, proposals, NOW);
}

describe('plRecordsFromResult', () => {
  it('tm1040_bodies', () => {
    const b = bodies(TM1040_RECORDS);
    expect(b.order_pl.net_profit).toBeCloseTo(46_272_444.44, 2);
    expect(b.order_pl.passed).toBe(true);
    expect(b.order_pl.applied_contract_type).toBe('tm_once');
    expect(b.order_pl.computed_at).toBe(NOW);
    expect(b.order_pl.source).toBe('computed');
    expect(JSON.parse(b.order_pl.kpi_split as string).map((row: { person: string }) => row.person)).toContain('ThuanNG');
    expect(JSON.parse(b.order_pl.config_snapshot as string)).toEqual(DEFAULT_CONFIG);
    expect(b.order).toEqual({ code: 'TM-2026-0001', has_goods: true, has_service: false });
    expect(b.order_pl_service.revenue).toBe(0);
    expect(b.order_pl_goods.cost).toBeCloseTo(b.order_pl.cost as number, 6);
  });

  it('service_only_order_is_dv', () => {
    const records: OrderRecords = { ...structuredClone(TM1040_RECORDS), goods_prices: [],
      lines: [{ id: 'c', line_no: 1, item_type_code: 'Cloud Server', quantity: 1, months: 12 }],
      service_prices: [{ order_line: 'c', unit_price: 10_000_000, unit_cost: 6_000_000 }] };
    const b = bodies(records);
    expect(b.order).toEqual({ code: 'DV-2026-0001', has_goods: false, has_service: true });
    expect(b.order_pl_service.revenue).toBe(120_000_000);
    expect(b.order_pl_service.recurring_revenue).toBe(120_000_000);
    expect(b.order_pl_service.internal_cost).toBe(72_000_000);
  });

  it('a price sitting in the other group\'s entity is reported', () => {
    const records = structuredClone(TM1040_RECORDS);
    records.service_prices = [records.goods_prices.shift()!];
    const out = runComputeOrderPl({ records, proposals: [], existing: [], config: null, now: NOW });
    expect(JSON.parse(out.order_pl.detail as string).misplacedPrices).toEqual(['seagate']);
    expect(JSON.parse(bodies(TM1040_RECORDS).order_pl.detail as string).misplacedPrices).toEqual([]);
  });

  it('an order with no lines has no code yet', () => {
    expect(bodies({ ...structuredClone(TM1040_RECORDS), lines: [], goods_prices: [] }).order.code).toBe('');
  });

  it('proc_saving_counts_lines_with_proposals', () => {
    const b = bodies(TM1040_RECORDS, [{ order_line: 'seagate', proposed_cost: 18_000_000, actual_cost: 17_500_000 }]);
    expect(b.order_pl_goods.proc_saving).toBe(12_000_000);
    expect(b.order_pl_goods.proposed_cost_total).toBe(216_000_000);
    expect(b.order_pl_goods.actual_cost_total).toBe(210_000_000);
    expect(b.order_pl_goods.sale_cost_total).toBeCloseTo(228_000_000 + 150_920_000 / 1.08, 4);
  });
});

describe('runComputeOrderPl', () => {
  const config = { item_type: [], contract_type_rate: [], fin_cost_tier: [], vat_rate: [], pl_setting: [], task_sla: [],
    deal_stage_weight: [] };

  it('computes from records and the configuration records', () => {
    const out = runComputeOrderPl({ records: TM1040_RECORDS, proposals: [], existing: [], config: null, now: NOW });
    expect(out.skip).toBe(false);
    expect(out.order_pl.net_profit).toBeCloseTo(46_272_444.44, 2);
    // Empty item types in the configuration make every line an unknown type.
    const unknown = runComputeOrderPl({ records: TM1040_RECORDS, proposals: [], existing: [], config, now: NOW });
    expect(JSON.parse(unknown.order_pl.detail as string).unknownItemTypes).toEqual(['TB']);
  });

  it('locked_order_is_not_recomputed', () => {
    const out = runComputeOrderPl({ records: TM1040_RECORDS, proposals: [], existing: [{ locked: true }], config: null, now: NOW });
    expect(out.skip).toBe(true);
  });
});
