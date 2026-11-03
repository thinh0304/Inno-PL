import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configFromRecords, type ConfigRecords } from '../../src/pl/config-records';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';

const ENTITIES = ['item_type', 'contract_type_rate', 'fin_cost_tier', 'vat_rate', 'pl_setting', 'task_sla',
  'deal_stage_weight'] as const;

function seeds(): ConfigRecords {
  return Object.fromEntries(ENTITIES.map((key) => {
    const entity = JSON.parse(readFileSync(new URL(`../../config/entities/${key}.json`, import.meta.url), 'utf8'));
    return [key, entity.seed];
  })) as unknown as ConfigRecords;
}

// Records come back from AgentFlow in no particular order.
const shuffled = (records: ConfigRecords): ConfigRecords =>
  Object.fromEntries(Object.entries(records).map(([key, rows]) => [key, [...rows].reverse()])) as unknown as ConfigRecords;

describe('configFromRecords', () => {
  it('seeds_match_defaults', () => {
    expect(configFromRecords(seeds())).toEqual(DEFAULT_CONFIG);
  });

  it('record order does not matter', () => {
    expect(configFromRecords(shuffled(seeds()))).toEqual(DEFAULT_CONFIG);
  });

  it('inactive_item_types_are_dropped', () => {
    const records = seeds();
    records.item_type = records.item_type.map((row) => row.code === 'Veeam' ? { ...row, active: false } : row);
    const codes = configFromRecords(records).itemTypes.map((type) => type.code);
    expect(codes).toHaveLength(12);
    expect(codes).not.toContain('Veeam');
  });

  it('missing_setting_falls_back_to_defaults', () => {
    const records = seeds();
    records.pl_setting = [];
    expect(configFromRecords(records).settings).toEqual(DEFAULT_CONFIG.settings);
  });

  it('a missing contract type rate falls back to its default', () => {
    const records = seeds();
    records.contract_type_rate = records.contract_type_rate
      .filter((row) => row.code !== 'tm_once')
      .map((row) => row.code === 'dv_once' ? { ...row, threshold: 0.35 } : row);
    const rates = configFromRecords(records).contractTypeRates;
    expect(rates.map((rate) => rate.code)).toEqual(['tm_once', 'tmdk', 'dv_once', 'dv_recurring', 'fulfillment']);
    expect(rates[0]).toEqual(DEFAULT_CONFIG.contractTypeRates[0]);
    expect(rates[2].threshold).toBe(0.35);
  });

  it('the setting record keyed "default" wins over any other', () => {
    const records = seeds();
    records.pl_setting = [{ key: 'x', warranty_rate: 0.5 }, ...records.pl_setting];
    expect(configFromRecords(records).settings.warrantyRate).toBe(0.002);
  });

  it('numbers that arrive as strings are read as numbers', () => {
    const asStrings = (rows: Record<string, unknown>[]) => rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])));
    const records = seeds();
    for (const key of ENTITIES) records[key] = asStrings(records[key]);
    expect(configFromRecords(records)).toEqual(DEFAULT_CONFIG);
  });

  it('no tier or weight records fall back to the defaults', () => {
    const records = seeds();
    records.fin_cost_tier = [];
    records.deal_stage_weight = [];
    const config = configFromRecords(records);
    expect(config.finCostTiers).toEqual(DEFAULT_CONFIG.finCostTiers);
    expect(config.dealStageWeights).toEqual(DEFAULT_CONFIG.dealStageWeights);
  });

  it('a changed setting is read', () => {
    const records = seeds();
    records.pl_setting = [{ ...records.pl_setting[0], warranty_rate: 0.003 }];
    expect(configFromRecords(records).settings.warrantyRate).toBe(0.003);
  });
});
