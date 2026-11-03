import { describe, expect, it } from 'vitest';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { line, order } from './helpers';

const pl = (...args: Parameters<typeof order>) => computePl(order(...args), DEFAULT_CONFIG);
const tb = (unitPrice: number, unitCost: number, months: number | null = null) =>
  line('TB', { unitPrice, unitCost, months });
// Gross 4M, provision 1M, warranty 200k: net before the fund 2.8M against an 8M threshold on 100M cost.
const shortOrder = () => [tb(104_000_000, 100_000_000, 12)];

describe('applied contract type and threshold', () => {
  it('applied_type_is_largest_revenue', () => {
    const result = pl([tb(100_000_000, 90_000_000), line('DVTK-I', { unitPrice: 150_000_000, unitCost: 50_000_000 })]);
    expect(result.contractTypes).toEqual(['tm_once', 'dv_once']);
    expect(result.appliedContractType).toBe('dv_once');
  });

  it('override_present_is_used', () => {
    const result = pl([tb(100_000_000, 90_000_000), line('DVTK-I', { unitPrice: 150_000_000, unitCost: 50_000_000 })],
      { contractTypeOverride: 'tm_once' });
    expect(result.appliedContractType).toBe('tm_once');
    expect(result.threshold).toBe(0.08);
  });

  it('override_absent_from_order_is_ignored', () => {
    expect(pl([tb(100, 90)], { contractTypeOverride: 'dv_recurring' }).appliedContractType).toBe('tm_once');
  });

  it('fulfillment_can_always_be_chosen', () => {
    const result = pl([tb(100, 90)], { contractTypeOverride: 'fulfillment' });
    expect(result.appliedContractType).toBe('fulfillment');
    expect(result.threshold).toBe(0.03);
  });

  it('debt_days_raise_threshold', () => {
    const threshold = (debtDays: number | null) => pl([tb(100, 90)], { debtDays }).threshold;
    expect(threshold(60)).toBeCloseTo(0.09, 10);
    expect(threshold(44)).toBeCloseTo(0.08, 10);
    expect(threshold(75)).toBeCloseTo(0.095, 10);
    expect(threshold(20)).toBeCloseTo(0.08, 10);
    expect(threshold(null)).toBeCloseTo(0.08, 10);
  });
});

describe('provision fund draw', () => {
  it('fund_draw_tops_up_exactly', () => {
    const result = pl(shortOrder(), { useProvisionFund: true, provisionFundBalance: 50_000_000 });
    expect(result.netProfitBeforeFund).toBeCloseTo(2_800_000, 6);
    expect(result.provisionFundDraw).toBeCloseTo(5_200_000, 6);
    expect(result.netProfit).toBeCloseTo(8_000_000, 6);
    expect(result.passed).toBe(true);
  });

  it('a draw sized to the threshold passes on an uneven cost', () => {
    // With these numbers netProfit / cost comes out 1 ulp under the threshold after an exact top-up.
    const result = pl([tb(400_000_000, 150_920_000 / 1.08 + 200_000_000)],
      { salesCost: 47_428_000, useProvisionFund: true, provisionFundBalance: 1_000_000_000 });
    expect(result.provisionFundDraw).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
  });

  it('fund_draw_capped_by_balance', () => {
    const result = pl(shortOrder(), { useProvisionFund: true, provisionFundBalance: 1_000_000 });
    expect(result.provisionFundDraw).toBe(1_000_000);
    expect(result.netProfit).toBeCloseTo(3_800_000, 6);
    expect(result.passed).toBe(false);
  });

  it('empty_fund_draws_nothing', () => {
    for (const provisionFundBalance of [0, -5_000_000]) {
      const result = pl(shortOrder(), { useProvisionFund: true, provisionFundBalance });
      expect(result.provisionFundDraw).toBe(0);
      expect(result.netProfit).toBeCloseTo(2_800_000, 6);
    }
  });

  it('no_draw_when_already_passing', () => {
    const result = pl([tb(200_000_000, 100_000_000, 12)], { useProvisionFund: true, provisionFundBalance: 50_000_000 });
    expect(result.passed).toBe(true);
    expect(result.provisionFundDraw).toBe(0);
  });

  it('no draw when the fund is not chosen', () => {
    const result = pl(shortOrder(), { provisionFundBalance: 50_000_000 });
    expect(result.provisionFundDraw).toBe(0);
    expect(result.passed).toBe(false);
  });
});
