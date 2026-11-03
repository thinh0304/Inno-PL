import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { plRecordsFromResult } from '../../src/order/pl-records';
import { draftFromRecords, toPlOrderInput } from '../../src/order/records';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
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

  it('pl_bodies_fit_entities', () => {
    const draft = draftFromRecords(TM1040_RECORDS);
    const bodies = plRecordsFromResult(draft, computePl(toPlOrderInput(draft), DEFAULT_CONFIG), DEFAULT_CONFIG, [], 'now');
    // order: the natural key the workflow binds; locked: set by Admin, never by compute_pl.
    const notWritten: Record<string, string[]> = { order_pl: ['order', 'locked'], order_pl_service: ['order'], order_pl_goods: ['order'] };
    for (const key of ['order_pl', 'order_pl_service', 'order_pl_goods'] as const) {
      expect(Object.keys(bodies[key]).sort(), key).toEqual(fieldKeys(key).filter((f) => !notWritten[key].includes(f)).sort());
    }
  });

  it('am_cannot_write_pl', () => {
    for (const key of ['order_pl', 'order_pl_service', 'order_pl_goods']) {
      expect(opsOf(key, 'am_group'), key).toEqual(['list', 'read']);
      expect(opsOf(key, 'sa_group'), key).toEqual(['list', 'read']);
      expect(opsOf(key, 'automation_group'), key).toEqual(['create', 'list', 'read', 'update']);
      expect(entity(key).create_form, key).toBeUndefined();
    }
    // Admin locks an order's figures (FR-5.7, Thiết kế 9.1).
    expect(opsOf('order_pl', 'admin_group')).toEqual(['list', 'read', 'update']);
    expect(grantOf('order_pl', 'tm_group')).toBeUndefined();
    expect(grantOf('order_pl', 'proc_group')).toBeUndefined();
    expect(opsOf('order_pl_service', 'tm_group')).toEqual(['list', 'read']);
    expect(grantOf('order_pl_service', 'proc_group')).toBeUndefined();
    expect(opsOf('order_pl_goods', 'proc_group')).toEqual(['list', 'read']);
    expect(grantOf('order_pl_goods', 'tm_group')).toBeUndefined();
  });

  it('both have a create form', () => {
    expect(entity('order').create_form).toBeTruthy();
    expect(entity('order_line').create_form).toBeTruthy();
  });
});
