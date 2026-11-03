import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { computeLine } from '../../src/pl/line';
import type { ItemType, PlLineInput } from '../../src/pl/types';

const settings = DEFAULT_CONFIG.settings;
const type = (code: string): ItemType => DEFAULT_CONFIG.itemTypes.find((item) => item.code === code)!;
const line = (fields: Partial<PlLineInput>): PlLineInput => ({
  id: 'l1', itemTypeCode: 'TB', quantity: null, months: null, unitPrice: null,
  discountPct: null, vatRate: 0.08, unitCost: null, ...fields,
});

describe('computeLine', () => {
  it('tm1040_line1', () => {
    const result = computeLine(line({ quantity: 12, unitPrice: 21_000_000, unitCost: 19_000_000, months: 24 }),
      type('TB'), settings);
    expect(result.revenue).toBe(252_000_000);
    expect(result.cost).toBe(228_000_000);
    expect(result.vatOut).toBeCloseTo(20_160_000, 6);
    expect(result.vatIn).toBeCloseTo(18_240_000, 6);
    expect(result.profit).toBe(24_000_000);
  });

  it('monthly_service_multiplies_months', () => {
    const result = computeLine(line({ itemTypeCode: 'Cloud Server', quantity: 1, unitPrice: 10_000_000,
      unitCost: 6_000_000, months: 12 }), type('Cloud Server'), settings);
    expect(result.revenue).toBe(120_000_000);
    expect(result.cost).toBe(72_000_000);
    expect(result.vatIn).toBe(0);
  });

  it('termed_license_is_whole_period', () => {
    const result = computeLine(line({ itemTypeCode: 'LIC-DK', quantity: 2, unitPrice: 50_000_000, months: 12,
      unitCost: 40_000_000 }), type('LIC-DK'), settings);
    expect(result.revenue).toBe(100_000_000);
    expect(result.cost).toBe(80_000_000);
    expect(result.vatOut).toBe(0);
  });

  it('foreign_adds_contractor_tax', () => {
    const result = computeLine(line({ itemTypeCode: 'LIC-NTNN', quantity: 1, unitPrice: 100_000_000,
      unitCost: 80_000_000 }), type('LIC-NTNN'), settings);
    expect(result.cost).toBeCloseTo(89_600_000, 6);
  });

  it('discount_applies_to_revenue_only', () => {
    const result = computeLine(line({ quantity: 1, unitPrice: 100_000_000, discountPct: 0.1, unitCost: 70_000_000 }),
      type('TB'), settings);
    expect(result.revenue).toBe(90_000_000);
    expect(result.cost).toBe(70_000_000);
  });

  it('missing VAT rate falls back to 8%', () => {
    const result = computeLine(line({ quantity: 1, unitPrice: 100, unitCost: 50, vatRate: null }), type('TB'), settings);
    expect(result.vatOut).toBeCloseTo(8, 10);
    expect(result.vatIn).toBeCloseTo(4, 10);
  });

  it('blank_numbers_count_as_zero', () => {
    const blank = line({ itemTypeCode: 'Cloud Server', vatRate: null });
    const result = computeLine(blank, type('Cloud Server'), settings);
    expect(result).toMatchObject({ revenue: 0, cost: 0, vatOut: 0, vatIn: 0, profit: 0 });
    const undefinedNumbers = { ...blank, quantity: undefined, months: undefined } as unknown as PlLineInput;
    expect(computeLine(undefinedNumbers, type('Cloud Server'), settings).revenue).toBe(0);
  });

  it('unknown_item_type_is_reported', () => {
    const result = computeLine(line({ itemTypeCode: 'XYZ', quantity: 1, unitPrice: 10, unitCost: 5, months: 12 }),
      null, settings);
    expect(result.itemType).toBeNull();
    expect(result.itemTypeCode).toBe('XYZ');
    expect(result.revenue).toBe(10);
    expect(result.cost).toBe(5);
  });
});
