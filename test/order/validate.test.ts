import { describe, expect, it } from 'vitest';
import { draftFromRecords } from '../../src/order/records';
import type { LineDraft, OrderDraft } from '../../src/order/types';
import { validateOrder } from '../../src/order/validate';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040_RECORDS } from './fixtures/tm1040-records';

const base = (): OrderDraft => draftFromRecords(structuredClone(TM1040_RECORDS));
const paths = (draft: OrderDraft, stage: 'draft' | 'submit' | 'customer_contract' = 'submit') =>
  validateOrder(draft, DEFAULT_CONFIG, stage).issues.map((issue) => issue.path);
const line = (fields: Partial<LineDraft>): LineDraft => ({ ...base().lines[0], id: 'x', ...fields,
  price: { ...base().lines[0].price, ...(fields.price ?? {}) } });

describe('validateOrder', () => {
  it('tm1040_submits_clean', () => {
    expect(validateOrder(base(), DEFAULT_CONFIG, 'submit')).toEqual({ issues: [], missingRequired: 0 });
  });

  it('a draft may be saved with required fields missing, never with a bad format', () => {
    const draft = base();
    draft.order.customer_name = '';
    draft.order.tax_code = '123';
    expect(paths(draft, 'draft')).toEqual(['order.tax_code']);
  });

  it('FR-1.6c customer fields are required to submit', () => {
    const draft = base();
    Object.assign(draft.order, { customer_name: '', customer_code: '', tax_code: '', contact_name: '' });
    const result = validateOrder(draft, DEFAULT_CONFIG, 'submit');
    expect(result.issues.map((issue) => issue.path)).toEqual(
      ['order.customer_name', 'order.customer_code', 'order.tax_code', 'order.contact_name']);
    expect(result.missingRequired).toBe(4);
  });

  it('FR-2.1 and FR-2.4 survey fields are required to submit', () => {
    const draft = base();
    Object.assign(draft.order, { internal_contract_no: '', content: '', am: null, customer_tier: null, debt_days: null });
    draft.finance.sales_cost = null;
    expect(paths(draft)).toEqual(['order.internal_contract_no', 'order.content', 'order.am', 'order.customer_tier',
      'order.debt_days', 'finance.sales_cost']);
  });

  it('FR-2.7 deal stage weights total 100% and each weighted stage has a person', () => {
    const draft = base();
    draft.order.deal_stages[0].weight = 0.3;
    draft.order.deal_stages[5].person = null;
    expect(paths(draft)).toEqual(['order.deal_stages', 'order.deal_stages[5].person']);
  });

  it('an order needs at least one line to submit', () => {
    const draft = base();
    draft.lines = [];
    expect(paths(draft)).toEqual(['lines']);
  });

  it('BR-21 a renewal needs last year\'s figures', () => {
    const draft = base();
    draft.order.is_new_order = false;
    draft.finance.prev_revenue = 0;
    expect(paths(draft)).toEqual(['order.prev_contract_no', 'finance.prev_sales_cost', 'finance.prev_revenue',
      'finance.prev_net_profit']);
  });

  it('BR-23 a renewal has no lead source', () => {
    const draft = base();
    Object.assign(draft.order, { is_new_order: false, prev_contract_no: 'TM-0900', lead_source: 'Mkt' });
    Object.assign(draft.finance, { prev_sales_cost: 0, prev_revenue: 100, prev_net_profit: 10 });
    expect(paths(draft)).toEqual(['order.lead_source']);
  });

  it('FR-3.5 each line needs name, unit, quantity, price and supplier', () => {
    const draft = base();
    draft.lines[0] = line({ name: '', unit: '', quantity: 0, price: { unit_price: 0, supplier: null } as never });
    expect(paths(draft)).toEqual(['lines[0].name', 'lines[0].unit', 'lines[0].quantity', 'lines[0].price.unit_price',
      'lines[0].price.supplier']);
  });

  it('FR-3.5 TB lines need CO/CQ', () => {
    const draft = base();
    draft.lines[1].co_cq = false;
    expect(paths(draft)).toEqual(['lines[1].co_cq']);
  });

  it('FR-3.5 termed lines need start and end dates', () => {
    const draft = base();
    draft.lines[0] = line({ item_type_code: 'LIC-DK', co_cq: false, start_date: null, end_date: null });
    expect(paths(draft)).toEqual(['lines[0].start_date', 'lines[0].end_date']);
  });

  it('FR-3.5 monthly lines need months > 0 matching the dates within a month', () => {
    const draft = base();
    draft.lines[0] = line({ item_type_code: 'Cloud Server', co_cq: false, months: 0,
      start_date: '2026-01-01', end_date: '2026-12-31' });
    expect(paths(draft)).toEqual(['lines[0].months']);
    draft.lines[0].months = 12;
    expect(paths(draft)).toEqual([]);
    draft.lines[0].months = 15;
    expect(paths(draft)).toEqual(['lines[0].months']);
  });

  it('an item type code missing from the configuration is an error', () => {
    const draft = base();
    draft.lines[0].item_type_code = 'XYZ';
    expect(paths(draft)).toEqual(['lines[0].item_type_code']);
  });

  it('4.8 cross-field rules', () => {
    const draft = base();
    draft.lines[0] = line({ item_type_code: 'LIC-DK', co_cq: false, start_date: '2026-05-01', end_date: '2026-04-01' });
    Object.assign(draft.order, { quote_date: '2026-11-05', quote_valid_until: '2026-11-01' });
    Object.assign(draft.finance, { prev_revenue: 100, prev_net_profit: 200 });
    expect(paths(draft)).toEqual(['order.quote_valid_until', 'finance.prev_net_profit', 'lines[0].end_date']);
  });

  it('format errors name the field', () => {
    const draft = base();
    Object.assign(draft.order, { contact_phone: '0123', contact_email: 'x', debt_days: 400 });
    draft.lines[0].price.discount_pct = 1.5;
    expect(paths(draft, 'draft')).toEqual(['order.contact_phone', 'order.contact_email', 'order.debt_days',
      'lines[0].price.discount_pct']);
  });

  it('at most 300 lines', () => {
    const draft = base();
    draft.lines = Array.from({ length: 301 }, (_, i) => ({ ...base().lines[0], id: `l${i}`, line_no: i + 1 }));
    expect(paths(draft)).toEqual(['lines']);
  });

  it('the customer contract step needs the contract fields', () => {
    expect(paths(base(), 'customer_contract')).toEqual(['order.address', 'order.receiver_name', 'order.receiver_phone',
      'order.delivery_address', 'order.signed_on', 'order.payment_count']);
  });
});
