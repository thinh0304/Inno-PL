import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';

describe('DEFAULT_CONFIG', () => {
  it('weights without lead sum to 100% for new orders and 50% for renewals', () => {
    const sumWithoutLead = (set: keyof typeof DEFAULT_CONFIG.dealStageWeights) =>
      Object.entries(DEFAULT_CONFIG.dealStageWeights[set])
        .filter(([stage]) => stage !== 'lead')
        .reduce((total, [, weight]) => total + weight, 0);
    expect(sumWithoutLead('new_tm')).toBeCloseTo(1, 10);
    expect(sumWithoutLead('new_dvdk')).toBeCloseTo(1, 10);
    expect(sumWithoutLead('tmdk')).toBeCloseTo(0.5, 10);
    expect(sumWithoutLead('dvdk')).toBeCloseTo(0.5, 10);
  });

  it('has one default VAT rate, 8%', () => {
    const defaults = DEFAULT_CONFIG.vatRates.filter((vat) => vat.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].rate).toBe(0.08);
  });

  it('has 13 item types with unique codes and 8 tiers per customer tier', () => {
    const codes = DEFAULT_CONFIG.itemTypes.map((type) => type.code);
    expect(codes).toHaveLength(13);
    expect(new Set(codes).size).toBe(13);
    for (const tier of ['vip', 'potential', 'standard'] as const) {
      expect(DEFAULT_CONFIG.finCostTiers.filter((row) => row.tier === tier)).toHaveLength(8);
    }
  });

  it('has the 15 tasks with the spec SLA', () => {
    const sla = Object.fromEntries(DEFAULT_CONFIG.taskSlas.map((task) => [task.taskCode, task.slaDays]));
    expect(sla).toEqual({
      t11: 1, t22: 1, t23: 1, t31: 1, t40: 2, t44: 1, t42: 1, t41: 3,
      t45: 2, t51: 3, t53: 2, t61: 7, t62: 7, t71: 2, t72: 1,
    });
    expect(DEFAULT_CONFIG.taskSlas.reduce((total, task) => total + task.slaDays, 0)).toBe(35);
  });
});
