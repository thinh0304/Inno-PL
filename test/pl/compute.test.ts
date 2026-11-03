import { describe, expect, it } from 'vitest';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { line, order } from './helpers';

const cloud = () => line('Cloud Server', { unitPrice: 10_000_000, unitCost: 6_000_000, months: 12 });
const pl = (...args: Parameters<typeof order>) => computePl(order(...args), DEFAULT_CONFIG);

function numbersIn(value: unknown, path = 'result'): [string, number][] {
  if (typeof value === 'number') return [[path, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => numbersIn(child, `${path}.${key}`));
  }
  return [];
}

describe('computePl', () => {
  it('fin_cost_uses_tier_of_sales_cost_over_cost', () => {
    const vip = pl([cloud()], { salesCost: 10_000_000, customerTier: 'vip' });
    expect(vip.revenue).toBe(120_000_000);
    expect(vip.cost).toBe(72_000_000);
    expect(vip.finCostRate).toBe(0.20);
    expect(vip.finCost).toBeCloseTo(2_500_000, 6);
    const standard = pl([cloud()], { salesCost: 10_000_000, customerTier: 'standard' });
    expect(standard.finCostRate).toBe(0.30);
    expect(standard.finCost).toBeCloseTo(4_285_714.2857, 3);
    expect(standard.profitAfterSales).toBeCloseTo(48_000_000 - 10_000_000 - 4_285_714.2857, 3);
  });

  it('a ratio exactly on a tier boundary takes that tier when cost is fractional', () => {
    // LIC-NTNN cost is 80M × 1.12 = 89,600,000.00000001 in floats; 8,960,000 is exactly 10% of it.
    const result = pl([line('LIC-NTNN', { unitPrice: 100_000_000, unitCost: 80_000_000 })], { salesCost: 8_960_000 });
    expect(result.finCostRate).toBe(0.25);
  });

  it('a missing customer tier is charged as standard, the dearest tier', () => {
    const result = pl([line('TB', { unitPrice: 120_000_000, unitCost: 100_000_000 })],
      { salesCost: 20_000_000, customerTier: null as never });
    expect(result.finCostRate).toBe(0.35);
    expect(result.finCost).toBeGreaterThan(0);
  });

  it('no_sales_cost_no_fin_cost', () => {
    expect(pl([cloud()], { salesCost: 0 }).finCost).toBe(0);
    expect(pl([cloud()], { salesCost: null }).finCost).toBe(0);
  });

  it('warranty_counts_started_years', () => {
    const warranty = (months: number) => pl([line('TB', { unitCost: 100_000_000, months })]).warranty;
    expect(warranty(37)).toBeCloseTo(800_000, 6);
    expect(warranty(0)).toBe(0);
    expect(warranty(12)).toBeCloseTo(200_000, 6);
  });

  it('license_support_bases', () => {
    const result = pl([line('LIC-NTNN', { unitPrice: 100_000_000, unitCost: 80_000_000 })]);
    expect(result.licenseSupport).toBeCloseTo(448_000, 6);
  });

  it('tech_support_internal_and_outsource', () => {
    const result = pl([cloud(), line('DVTK-O', { unitPrice: 40_000_000, unitCost: 30_000_000 })]);
    expect(result.techSupport).toBeCloseTo(3_600_000 + 600_000, 6);
  });

  it('deploy_bonus_needs_staff', () => {
    const deploy = () => line('DVTK-I', { unitPrice: 50_000_000, unitCost: 10_000_000 });
    expect(pl([deploy()]).deployBonus).toBe(0);
    const staffed = pl([deploy()], { deployStaff: 'A' });
    expect(staffed.appliedContractType).toBe('dv_once');
    expect(staffed.deployBonus).toBeCloseTo(2_500_000, 6);
  });

  it('provision_always_charged', () => {
    const result = pl([line('TB', { unitPrice: 120_000_000, unitCost: 100_000_000 })]);
    expect(result.appliedContractType).toBe('tm_once');
    expect(result.provision).toBeCloseTo(1_000_000, 6);
  });

  it('consult_bonus_floor_and_extras', () => {
    const profitable = pl([line('TB', { unitPrice: 200_000_000, unitCost: 100_000_000 })],
      { consultStaff: 'B', proposal: true, poc: true });
    expect(profitable.consultBonusRate).toBeCloseTo(0.07, 10);
    const before = profitable.profitAfterSales - profitable.warranty - profitable.licenseSupport
      - profitable.techSupport - profitable.deployBonus - profitable.provision;
    expect(profitable.consultBonus).toBeCloseTo(before * 0.07, 6);
    expect(profitable.netProfitBeforeFund).toBeCloseTo(before - profitable.consultBonus, 6);
    expect(pl([line('TB', { unitPrice: 200_000_000, unitCost: 100_000_000 })], { proposal: true }).consultBonus).toBe(0);

    const losing = pl([line('TB', { unitPrice: 90_000_000, unitCost: 100_000_000 })],
      { consultStaff: 'B', proposal: true, poc: true });
    expect(losing.consultBonus).toBe(0);
  });

  it('structure_and_purchase_group_split', () => {
    const result = pl([line('TB', { unitPrice: 30_000_000, unitCost: 20_000_000 }), cloud()]);
    expect(result.byStructure.one_time).toEqual({ revenue: 30_000_000, cost: 20_000_000 });
    expect(result.byStructure.recurring).toEqual({ revenue: 120_000_000, cost: 72_000_000 });
    expect(result.byPurchaseGroup.goods).toEqual({ revenue: 30_000_000, cost: 20_000_000 });
    expect(result.byPurchaseGroup.service).toEqual({ revenue: 120_000_000, cost: 72_000_000 });
    expect(result.byType.TB.revenue).toBe(30_000_000);
    expect(result.byType['Cloud Server'].cost).toBe(72_000_000);
    expect(result.contractTypes).toEqual(['tm_once', 'dv_recurring']);
  });

  it('cost_zero_does_not_produce_nan', () => {
    const result = pl([line('DVTK-I', { unitPrice: 10_000_000, unitCost: 0 })]);
    expect(result.netMargin).toBeNull();
    expect(result.finCostRate).toBe(0.20);
    for (const [path, value] of numbersIn(result)) {
      expect(Number.isFinite(value), `${path} = ${value}`).toBe(true);
    }
  });

  it('unknown_item_type_is_reported', () => {
    const result = pl([line('XYZ', { unitPrice: 10_000_000, unitCost: 4_000_000 }),
      line('TB', { unitPrice: 5_000_000, unitCost: 3_000_000 })]);
    expect(result.unknownItemTypes).toEqual(['XYZ']);
    expect(result.revenue).toBe(15_000_000);
    expect(result.cost).toBe(7_000_000);
  });

  it('empty order computes to zero on the tm_once rates', () => {
    const result = pl([]);
    expect(result.appliedContractType).toBeNull();
    expect(result.threshold).toBe(0.08);
    expect(result.netProfit).toBe(0);
  });
});
