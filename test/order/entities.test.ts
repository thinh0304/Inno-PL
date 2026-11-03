import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { draftFromRecords } from '../../src/order/records';
import { TM1040_RECORDS } from './fixtures/tm1040-records';

type Field = { key: string; type: string; format?: string; required?: boolean };
type Op = { operation: string; scope?: string; record_scopes?: unknown[] };
type Grant = { principal: { id?: string }; operations: Op[] };
type Entity = { fields: Field[]; access: { grants: Grant[] }; rules?: { key: string }[]; create_form?: unknown };
export const entity = (key: string): Entity =>
  JSON.parse(readFileSync(new URL(`../../config/entities/${key}.json`, import.meta.url), 'utf8'));
export const fieldKeys = (key: string) => entity(key).fields.map((field) => field.key);
export const grantOf = (key: string, group: string) =>
  entity(key).access.grants.find((grant) => grant.principal.id === `\${param:${group}}`);
export const opsOf = (key: string, group: string) => (grantOf(key, group)?.operations ?? []).map((op) => op.operation).sort();

const MONEY = /price|cost|revenue|profit/;
const draft = draftFromRecords(TM1040_RECORDS);

describe('order and order_line', () => {
  it('order_has_no_money_fields', () => {
    for (const key of ['order', 'order_line']) {
      const money = entity(key).fields.filter((f) => f.key !== 'exchange_rate' && (f.format === 'currency' || MONEY.test(f.key)));
      expect(money.map((f) => f.key), key).toEqual([]);
    }
  });

  it('order_fields_match_draft_keys', () => {
    const keys = Object.keys(draft.order).filter((k) => k !== 'id');
    expect(keys.filter((k) => !fieldKeys('order').includes(k))).toEqual([]);
  });

  it('line_fields_match_draft_keys', () => {
    const keys = Object.keys(draft.lines[0]).filter((k) => k !== 'id' && k !== 'price');
    expect(keys.filter((k) => !fieldKeys('order_line').includes(k))).toEqual([]);
    expect(fieldKeys('order_line')).toContain('order');
  });

  it('am_is_fixed_rule_exists', () => {
    expect(entity('order').rules?.map((rule) => rule.key)).toContain('am_is_fixed');
  });

  it('AM and SA reach orders through their own people field; TM, SD, PROC, ACC read all', () => {
    const am = grantOf('order', 'am_group')!;
    expect(am.operations.find((op) => op.operation === 'read')?.record_scopes).toEqual([{ kind: 'field', field: 'am' }]);
    expect(grantOf('order', 'sa_group')!.operations.find((op) => op.operation === 'update')?.record_scopes)
      .toEqual([{ kind: 'field', field: 'sa' }]);
    for (const group of ['tm_group', 'sd_group', 'proc_group', 'acc_group']) expect(opsOf('order', group)).toEqual(['list', 'read']);
    expect(opsOf('order_line', 'am_group')).toEqual(['create', 'delete', 'list', 'read', 'update']);
  });

  it('both have a create form', () => {
    expect(entity('order').create_form).toBeTruthy();
    expect(entity('order_line').create_form).toBeTruthy();
  });
});
