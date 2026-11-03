import { describe, expect, it } from 'vitest';
import { draftFromRecords, lineGroup, toPlOrderInput } from '../../src/order/records';
import type { OrderRecords } from '../../src/order/types';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040_RECORDS as F } from './fixtures/tm1040-records';

const compute = (records: OrderRecords) => computePl(toPlOrderInput(draftFromRecords(records)), DEFAULT_CONFIG);
const clone = (): OrderRecords => structuredClone(F);

describe('draftFromRecords + toPlOrderInput', () => {
  it('tm1040_records_compute_like_the_golden_case', () => {
    const result = compute(F);
    expect(result.netProfit).toBeCloseTo(46_272_444.44, 2);
    expect(result.kpiSplit.find((row) => row.person === 'ThuanNG')?.amount).toBeCloseTo(41_645_200, 2);
  });

  it('lines_are_sorted_by_line_no', () => {
    expect(draftFromRecords(F).lines.map((line) => line.id)).toEqual(['seagate', 'qnap']);
  });

  it('price_found_in_either_entity', () => {
    const records = clone();
    records.service_prices = [records.goods_prices.shift()!];
    const seagate = draftFromRecords(records).lines[0];
    expect(seagate.price.unit_price).toBe(21_000_000);
    expect(compute(records).netProfit).toBeCloseTo(46_272_444.44, 2);
  });

  it('a price in both entities: the one matching the line\'s group wins', () => {
    const records = clone();
    records.service_prices = [{ ...records.goods_prices[0], id: 'stale', unit_price: 999 }];
    expect(draftFromRecords(records, DEFAULT_CONFIG).lines[0].price.unit_price).toBe(21_000_000);
    records.lines[1].item_type_code = 'Cloud Server';
    expect(draftFromRecords(records, DEFAULT_CONFIG).lines[0].price.unit_price).toBe(999);
  });

  it('line_without_price_counts_zero', () => {
    const records = { ...clone(), goods_prices: [], finance: [] };
    const draft = draftFromRecords(records);
    expect(draft.lines[0].price.unit_price).toBeNull();
    expect(draft.finance.sales_cost).toBeNull();
    expect(compute(records).revenue).toBe(0);
  });

  it('fields_under_body_are_read', () => {
    const wrap = (row: Record<string, unknown>) => ({ id: row.id, body: row });
    const records: OrderRecords = { order: wrap(F.order), lines: F.lines.map(wrap), goods_prices: F.goods_prices.map(wrap),
      service_prices: [], finance: F.finance.map(wrap) };
    expect(compute(records).netProfit).toBeCloseTo(46_272_444.44, 2);
  });

  it('numeric_strings_are_read', () => {
    const records = clone();
    records.lines[1].quantity = '12';
    records.goods_prices[0].unit_price = '21000000';
    expect(compute(records).netProfit).toBeCloseTo(46_272_444.44, 2);
  });

  it('lead source and deal stages reach the engine; weights stay in the config', () => {
    const records = clone();
    Object.assign(records.order, { is_new_logo: true, lead_source: 'Mkt' });
    const input = toPlOrderInput(draftFromRecords(records), 5_000_000);
    expect(input.leadPerson).toBe('Mkt');
    expect(input.provisionFundBalance).toBe(5_000_000);
    expect(input.dealStages[0]).toEqual({ stage: 'opportunity', person: 'ThuanNG' });
  });

  it('line_group_follows_item_type', () => {
    expect(lineGroup('TB', DEFAULT_CONFIG)).toBe('goods');
    expect(lineGroup('Cloud Server', DEFAULT_CONFIG)).toBe('service');
    expect(lineGroup('XYZ', DEFAULT_CONFIG)).toBeNull();
  });
});
