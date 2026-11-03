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

  it('prices_live_outside_order', () => {
    for (const key of ['goods_line_price', 'service_line_price']) {
      expect(fieldKeys(key), key).toEqual(expect.arrayContaining(['order_line', 'order', 'unit_price', 'unit_cost',
        'discount_pct', 'vat_rate', 'supplier']));
    }
    expect(fieldKeys('order_finance')).toEqual(expect.arrayContaining(['order', 'sales_cost', 'prev_sales_cost',
      'prev_revenue', 'prev_net_profit']));
  });

  it('purchase_proposal_hidden_from_am_and_tm', () => {
    for (const group of ['am_group', 'sa_group', 'tm_group', 'admin_group']) expect(grantOf('purchase_proposal', group)).toBeUndefined();
    expect(opsOf('purchase_proposal', 'proc_group')).toEqual(['create', 'list', 'read', 'update']);
    expect(opsOf('purchase_proposal', 'sd_group')).toEqual(['list', 'read']);
  });

  it('tm_reads_service_but_not_goods_prices', () => {
    expect(opsOf('service_line_price', 'tm_group')).toEqual(['list', 'read']);
    expect(grantOf('goods_line_price', 'tm_group')).toBeUndefined();
  });

  it('proc_reads_goods_but_not_service_prices', () => {
    expect(opsOf('goods_line_price', 'proc_group')).toEqual(['list', 'read']);
    expect(grantOf('service_line_price', 'proc_group')).toBeUndefined();
    expect(grantOf('order_finance', 'proc_group')).toBeUndefined();
    expect(grantOf('order_finance', 'tm_group')).toBeUndefined();
  });

  it('shared_records_have_create_forms', () => {
    for (const key of ['customer', 'supplier', 'staff', 'goods_line_price', 'service_line_price', 'order_finance',
      'purchase_proposal']) expect(entity(key).create_form, key).toBeTruthy();
  });

  it('both have a create form', () => {
    expect(entity('order').create_form).toBeTruthy();
    expect(entity('order_line').create_form).toBeTruthy();
  });
});
