import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Entity = {
  fields: { key: string; type: string; required?: boolean; enum_values?: { value: string }[] }[];
  natural_key: { id: string; fields: string[] }[];
  display_field: string;
  seed?: Record<string, unknown>[];
};
const entity = (key: string): Entity =>
  JSON.parse(readFileSync(new URL(`../../config/entities/${key}.json`, import.meta.url), 'utf8'));

// The real identity of each record, so AgentFlow refuses a duplicate instead of the engine picking one at random.
const IDENTITY: Record<string, string[]> = {
  fin_cost_tier: ['tier', 'from_ratio'],
  deal_stage_weight: ['weight_set', 'stage'],
  kpi_target: ['year', 'staff'],
};

describe('natural keys', () => {
  for (const [key, fields] of Object.entries(IDENTITY)) {
    it(`${key} is keyed by ${fields.join(' + ')}, with no free-text key field`, () => {
      const e = entity(key);
      expect(e.natural_key[0].fields).toEqual(fields);
      expect(e.fields.map((field) => field.key)).not.toContain('key');
      for (const name of fields) expect(e.fields.find((field) => field.key === name)?.required).toBe(true);
      expect(e.fields.map((field) => field.key)).toContain(e.display_field);
    });
  }

  it('every seed sets its natural key, and no two seeds share one', () => {
    for (const key of ['item_type', 'contract_type_rate', 'fin_cost_tier', 'vat_rate', 'pl_setting', 'task_sla',
      'deal_stage_weight', 'business_plan']) {
      const e = entity(key);
      const keyFields = e.natural_key[0].fields;
      const keys = (e.seed ?? []).map((body) => JSON.stringify(keyFields.map((field) => body[field])));
      for (const body of e.seed ?? []) for (const field of keyFields) expect(body[field], `${key}.${field}`).toBeDefined();
      expect(new Set(keys).size, key).toBe(keys.length);
    }
  });

  it('contract_type_rate.code is one of the five contract types', () => {
    const code = entity('contract_type_rate').fields.find((field) => field.key === 'code')!;
    expect(code.type).toBe('enum');
    expect(code.enum_values!.map((value) => value.value)).toEqual(['tm_once', 'tmdk', 'dv_once', 'dv_recurring', 'fulfillment']);
  });
});
