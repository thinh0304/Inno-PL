import { describe, expect, it } from 'vitest';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040 } from './fixtures/tm1040';

const result = computePl(TM1040, DEFAULT_CONFIG);
const kpi = Object.fromEntries(result.kpiSplit.map((row) => [row.person, row.amount]));

describe('TM-1040 matches the Excel P&L', () => {
  it('revenue (PL!I17)', () => expect(result.revenue).toBeCloseTo(420_000_000, 2));
  it('cost (PL!F17)', () => expect(result.cost).toBeCloseTo(367_740_740.74, 2));
  it('gross profit (PL!K33)', () => expect(result.grossProfit).toBeCloseTo(52_259_259.26, 2));
  it('output VAT (PL!J17)', () => expect(result.vatOut).toBeCloseTo(33_600_000, 2));
  it('input VAT (PL!G17)', () => expect(result.vatIn).toBeCloseTo(29_419_259.26, 2));
  it('financial cost (PL!K38)', () => expect(result.finCost).toBeCloseTo(0, 2));
  it('warranty (PL!K41)', () => expect(result.warranty).toBeCloseTo(2_309_407.41, 2));
  it('license, tech support, deploy and consult are 0', () => {
    expect(result.licenseSupport).toBeCloseTo(0, 2);
    expect(result.techSupport).toBeCloseTo(0, 2);
    expect(result.deployBonus).toBeCloseTo(0, 2);
    expect(result.consultBonus).toBeCloseTo(0, 2);
  });
  it('provision (PL!K53)', () => expect(result.provision).toBeCloseTo(3_677_407.41, 2));
  it('net profit (PL!K56)', () => expect(result.netProfit).toBeCloseTo(46_272_444.44, 2));
  it('net margin (PL!J56)', () => expect(result.netMargin).toBeCloseTo(0.125829, 6));
  it('threshold (PL!L67)', () => expect(result.threshold).toBeCloseTo(0.08, 10));
  it('passed (PL!E67)', () => expect(result.passed).toBe(true));
  it('applied contract type', () => expect(result.appliedContractType).toBe('tm_once'));
  it('KPI ThuanNG (PL!K58)', () => expect(kpi.ThuanNG).toBeCloseTo(41_645_200, 2));
  it('KPI ThuDTH (PL!K61)', () => expect(kpi.ThuDTH).toBeCloseTo(4_627_244.44, 2));
});
