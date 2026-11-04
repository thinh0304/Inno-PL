import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/domain/config';
import { computePl } from '../../src/domain/pl';
import { ARTIFACT_ORDERS } from './fixtures/artifact-orders';

// Số đúng: tính bằng code của artifact (computePL) với dự phòng luôn trừ, theo spec §4.6.
const EXPECTED = {
  'TM-1036': { kind: 'Thương Mại', revenue: 905690000, cost: 617618012, financeRate: 0.2, financeCost: 18375000, warranty: 1369081, licenseSupport: 194250, techSupport: 1800000, provision: 6176180, consultBonus: 13066023, netProfit: 173591454, threshold: 0.085, passed: true },
  'TM-1041': { kind: 'Thương Mại', revenue: 670800000, cost: 625000000, financeRate: 0.25, financeCost: 1666667, warranty: 1830000, licenseSupport: 440000, techSupport: 0, provision: 6250000, consultBonus: 0, netProfit: 30613333, threshold: 0.09, passed: false },
  'DV-0207': { kind: 'Dịch vụ Loại II', revenue: 264000000, cost: 140000000, financeRate: 0.2, financeCost: 2000000, warranty: 0, licenseSupport: 250000, techSupport: 0, provision: 7000000, consultBonus: 3202500, netProfit: 103547500, threshold: 0.1, passed: true },
  'TM-1050': { kind: 'Thương Mại', revenue: 115000000, cost: 90000000, financeRate: 0, financeCost: 0, warranty: 320000, licenseSupport: 0, techSupport: 0, provision: 900000, consultBonus: 0, netProfit: 23780000, threshold: 0.08, passed: true },
  'DV-0210': { kind: 'Dịch vụ Loại II', revenue: 218000000, cost: 172880000, financeRate: 0.15, financeCost: 1058824, warranty: 180000, licenseSupport: 414400, techSupport: 0, provision: 8644000, consultBonus: 864683, netProfit: 27958093, threshold: 0.11, passed: true },
} as const;

describe('computePl trên các đơn mẫu của artifact', () => {
  for (const [id, want] of Object.entries(EXPECTED)) {
    it(`${id} khớp số của artifact`, () => {
      const r = computePl(ARTIFACT_ORDERS[id], DEFAULT_CONFIG);
      expect(r.kind).toBe(want.kind);
      expect(r.revenue).toBe(want.revenue);
      expect(r.cost).toBe(want.cost);
      expect(r.financeRate).toBeCloseTo(want.financeRate, 10);
      expect(r.financeCost).toBe(want.financeCost);
      expect(r.warranty).toBe(want.warranty);
      expect(r.licenseSupport).toBe(want.licenseSupport);
      expect(r.techSupport).toBe(want.techSupport);
      expect(r.provision).toBe(want.provision);
      expect(r.consultBonus).toBe(want.consultBonus);
      expect(r.netProfit).toBe(want.netProfit);
      expect(r.threshold).toBeCloseTo(want.threshold, 10);
      expect(r.passed).toBe(want.passed);
    });
  }
});

describe('computePl: các ca biên', () => {
  it('bù quỹ cộng thẳng vào LN thuần', () => {
    const r = computePl({ ...ARTIFACT_ORDERS['TM-1041'], fundTopUp: 5_000_000 }, DEFAULT_CONFIG);
    expect(r.fundTopUp).toBe(5_000_000);
    expect(r.netProfit).toBe(35613333);
    expect(r.passed).toBe(false);
  });

  it('đơn chưa có dòng nào không ra NaN', () => {
    const r = computePl({ ...ARTIFACT_ORDERS['TM-1050'], lines: [] }, DEFAULT_CONFIG);
    expect(r.revenue).toBe(0);
    expect(r.cost).toBe(0);
    expect(r.margin).toBe(0);
    expect(r.passed).toBe(false);
    expect(Number.isFinite(r.netProfit)).toBe(true);
  });

  it('Fulfillment do người lập chọn: không trích dự phòng, ngưỡng 3%', () => {
    const r = computePl({ ...ARTIFACT_ORDERS['TM-1050'], chosenKind: 'Fulfillment' }, DEFAULT_CONFIG);
    expect(r.kind).toBe('Fulfillment');
    expect(r.provision).toBe(0);
    expect(r.threshold).toBeCloseTo(0.03, 10);
  });
});
