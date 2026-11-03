import { describe, expect, it } from 'vitest';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { chooseWeightSet, splitKpi } from '../../src/pl/kpi';
import type { PlOrderInput } from '../../src/pl/types';
import { line, order } from './helpers';

const weights = DEFAULT_CONFIG.dealStageWeights;
// Five first stages to ThuanNG, Contract · Payment · Support to ThuDTH, as in TM-1040.
const stages: PlOrderInput['dealStages'] = [
  { stage: 'opportunity', person: 'ThuanNG' }, { stage: 'clarification', person: 'ThuanNG' },
  { stage: 'quotation', person: 'ThuanNG' }, { stage: 'negotiation', person: 'ThuanNG' },
  { stage: 'close', person: 'ThuanNG' }, { stage: 'contract', person: 'ThuDTH' },
];
const byPerson = (split: { person: string; weight: number; amount: number }[]) =>
  Object.fromEntries(split.map((row) => [row.person, row]));

describe('chooseWeightSet', () => {
  it('service orders use the DVDK sets, everything else the TM sets', () => {
    expect(chooseWeightSet('dv_once', true)).toBe('new_dvdk');
    expect(chooseWeightSet('dv_recurring', false)).toBe('dvdk');
    expect(chooseWeightSet('tm_once', true)).toBe('new_tm');
    expect(chooseWeightSet('tmdk', false)).toBe('tmdk');
    expect(chooseWeightSet('fulfillment', true)).toBe('new_tm');
    expect(chooseWeightSet(null, false)).toBe('tmdk');
  });
});

describe('splitKpi', () => {
  it('new_tm_split_am_and_inside_sales', () => {
    const { weightSet, split } = splitKpi(order([], { dealStages: stages }), weights, 100, 'tm_once');
    expect(weightSet).toBe('new_tm');
    expect(split.map((row) => row.person)).toEqual(['ThuanNG', 'ThuDTH']);
    expect(byPerson(split).ThuanNG.weight).toBeCloseTo(0.9, 10);
    expect(byPerson(split).ThuanNG.amount).toBeCloseTo(90, 10);
    expect(byPerson(split).ThuDTH.weight).toBeCloseTo(0.1, 10);
    expect(byPerson(split).ThuDTH.amount).toBeCloseTo(10, 10);
  });

  it('new_logo_adds_lead_weight', () => {
    const { split } = splitKpi(order([], { dealStages: stages, isNewLogo: true, leadPerson: 'Mkt' }),
      weights, 100, 'tm_once');
    expect(split[0].person).toBe('Mkt');
    expect(byPerson(split).Mkt.weight).toBeCloseTo(0.3, 10);
    expect(byPerson(split).Mkt.amount).toBeCloseTo(30, 10);
    expect(split.reduce((total, row) => total + row.weight, 0)).toBeCloseTo(1.3, 10);
  });

  it('lead person without new logo gets nothing', () => {
    const { split } = splitKpi(order([], { dealStages: stages, leadPerson: 'Mkt' }), weights, 100, 'tm_once');
    expect(split.map((row) => row.person)).toEqual(['ThuanNG', 'ThuDTH']);
  });

  it('renewal_totals_half', () => {
    const { weightSet, split } = splitKpi(
      order([], { dealStages: stages, isNewOrder: false, isNewLogo: true, leadPerson: 'Mkt' }), weights, 100, 'tm_once');
    expect(weightSet).toBe('tmdk');
    expect(split.map((row) => row.person)).toEqual(['ThuanNG', 'ThuDTH']);
    expect(split.reduce((total, row) => total + row.weight, 0)).toBeCloseTo(0.5, 10);
  });

  it('service_orders_use_dvdk_sets', () => {
    const { weightSet, split } = splitKpi(order([], { dealStages: stages }), weights, 100, 'dv_recurring');
    expect(weightSet).toBe('new_dvdk');
    expect(byPerson(split).ThuDTH.weight).toBeCloseTo(0.15, 10);
  });

  it('blank_person_is_skipped', () => {
    const { split } = splitKpi(order([], {
      dealStages: [{ stage: 'close', person: null }, { stage: 'contract', person: 'ThuDTH' }],
      isNewLogo: true, leadPerson: null,
    }), weights, 100, 'tm_once');
    expect(split).toEqual([{ person: 'ThuDTH', weight: 0.1, amount: 10 }]);
  });

  it('computePl splits the net profit after the fund draw', () => {
    const result = computePl(order([line('TB', { unitPrice: 104_000_000, unitCost: 100_000_000, months: 12 })],
      { dealStages: stages, useProvisionFund: true, provisionFundBalance: 50_000_000 }), DEFAULT_CONFIG);
    expect(result.weightSet).toBe('new_tm');
    expect(byPerson(result.kpiSplit).ThuanNG.amount).toBeCloseTo(result.netProfit * 0.9, 6);
    expect(byPerson(result.kpiSplit).ThuanNG.amount).toBeCloseTo(7_200_000, 6);
  });
});
