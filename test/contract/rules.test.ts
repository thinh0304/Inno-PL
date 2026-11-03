import { describe, expect, it } from 'vitest';
import { contractGate, contractSlots, latest, needsFile, prepayAmount, prepayTotal, slotKey } from '../../src/contract/rules';
import type { ContractRec, Party, Step } from '../../src/contract/types';
import { draftFromRecords } from '../../src/order/records';
import type { LineDraft, OrderDraft } from '../../src/order/types';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040_RECORDS } from '../order/fixtures/tm1040-records';

const M = 1_000_000;
const AGREED = { status: 'done' as const, outcome: 'agreed' };

const base = (): OrderDraft => draftFromRecords(structuredClone(TM1040_RECORDS));
const line = (draft: OrderDraft, supplier: string | null, quantity: number, unit_cost: number): LineDraft =>
  ({ ...draft.lines[0], id: `l-${supplier}-${quantity}-${unit_cost}`, quantity, price: { ...draft.lines[0].price, supplier, unit_cost } });
/** An order with the given lines (TM-1040's when none are given), every customer-contract field filled in. */
function order(lines?: [string | null, number, number][]): OrderDraft {
  const draft = base();
  if (lines) draft.lines = lines.map(([s, q, c]) => line(draft, s, q, c));
  Object.assign(draft.order, { address: '1 Lê Lợi', receiver_name: 'Nguyễn An', receiver_phone: '0901234567',
    delivery_address: '1 Lê Lợi', signed_on: '2026-11-03', payment_count: 1 });
  return draft;
}
let n = 0;
const rec = (party: Party, supplier: string | null, step: Step, fields: Partial<ContractRec> = {}): ContractRec => ({
  id: `c${++n}`, order: 'o1', party, supplier, step, file: `f${n}`, uploaded_by: 'u-sa', uploaded_at: '2026-11-03T09:00:00+07:00',
  source: 'upload', value: null, advance_percent: null, version: 1, ai_check: null, skip_reason: '', ...fields });

const gate = (task: 't40' | 't44' | 't41' | 't45', draft: OrderDraft, revenue: number, contracts: ContractRec[],
  extra: Partial<Parameters<typeof contractGate>[1]> = {}) =>
  contractGate(task, { slots: contractSlots(draft, revenue, contracts), draft, config: DEFAULT_CONFIG, t42: AGREED, ...extra });

describe('contractSlots', () => {
  it('slots_start_with_the_customer_then_each_supplier_in_line_order', () => {
    const slots = contractSlots(order([['s2', 1, M], ['s1', 1, M], ['s2', 1, M], [null, 1, M]]), 50 * M, []);
    expect(slots.map((s) => s.key)).toEqual(['customer', 'supplier:s2', 'supplier:s1']);
    expect(slots[0]).toMatchObject({ party: 'customer', supplier: null, expectedValue: 50 * M, present: true, orphan: false });
  });

  it('expected_value_of_a_supplier_is_the_sum_of_cost_times_quantity', () => {
    const slots = contractSlots(order([['s1', 2, M], ['s1', 3, 500_000]]), 0, []);
    expect(slots[1].expectedValue).toBe(3_500_000);
  });

  it('a_new_supplier_adds_a_slot', () => {
    const draft = order([['s1', 1, M]]);
    expect(contractSlots(draft, 0, []).map((s) => s.key)).toEqual(['customer', 'supplier:s1']);
    draft.lines.push(line(draft, 's9', 1, 30 * M));
    const slots = contractSlots(draft, 0, []);
    expect(slots.map((s) => s.key)).toEqual(['customer', 'supplier:s1', 'supplier:s9']);
    expect(gate('t44', draft, 0, [rec('supplier', 's1', 'draft')])).toEqual([
      expect.objectContaining({ code: 'draft_missing', slot: 'supplier:s9' })]);
  });

  it('a_supplier_dropped_from_the_order_no_longer_gates', () => {
    const draft = order([['s1', 1, 30 * M]]);
    const old = rec('supplier', 's7', 'draft');
    const slots = contractSlots(draft, 0, [old, rec('supplier', 's1', 'draft')]);
    expect(slots.at(-1)).toMatchObject({ key: 'supplier:s7', orphan: true, present: false, draft: old });
    expect(gate('t44', draft, 0, [old, rec('supplier', 's1', 'draft')])).toEqual([]);
  });

  it('history_keeps_every_version_newest_first', () => {
    const v1 = rec('customer', null, 'draft', { version: 1 });
    const v2 = rec('customer', null, 'draft', { version: 2 });
    const slot = contractSlots(order(), 0, [v1, v2])[0];
    expect(slot.draft).toBe(v2);
    expect(slot.history.map((c) => c.version)).toEqual([2, 1]);
  });
});

describe('review fixes', () => {
  it('service_line_suppliers_are_not_contract_slots', () => {
    // Purchasing cannot read service prices and t44 / t45 are about goods: a service subcontractor is no supplier slot.
    const draft = order([['s1', 1, 30 * M]]);
    draft.lines.push({ ...line(draft, 's5', 1, 40 * M), id: 'svc', price: { ...line(draft, 's5', 1, 40 * M).price, source: 'service' } });
    expect(contractSlots(draft, 0, []).map((s) => s.key)).toEqual(['customer', 'supplier:s1']);
    expect(gate('t44', draft, 0, [rec('supplier', 's1', 'draft')])).toEqual([]);
  });

  it('proposals_decide_the_supplier_and_the_cost', () => {
    // Purchasing buys line 1 from s2 at 30 tr, not from AM's s1 at 10 tr (FR-7.8: from the purchase order; BR-48: purchase cost).
    const draft = order([['s1', 1, 10 * M], ['s1', 2, 1 * M]]);
    const proposals = [{ order_line: draft.lines[0].id, proposed_supplier: 's2', proposed_cost: 30 * M }];
    const slots = contractSlots(draft, 0, [], proposals);
    expect(slots.map((s) => [s.key, s.expectedValue])).toEqual([['customer', 0], ['supplier:s2', 30 * M], ['supplier:s1', 2 * M]]);
    // A proposal without a supplier or a cost keeps AM's.
    const partial = contractSlots(draft, 0, [], [{ order_line: draft.lines[0].id, proposed_supplier: null, proposed_cost: null }]);
    expect(partial.map((s) => [s.key, s.expectedValue])).toEqual([['customer', 0], ['supplier:s1', 12 * M]]);
  });
});

describe('latest and needsFile', () => {
  it('slot_key_names_the_party_and_supplier', () => {
    expect(slotKey('customer', null)).toBe('customer');
    expect(slotKey('supplier', 's1')).toBe('supplier:s1');
  });

  it('latest_takes_the_highest_version_that_has_a_file', () => {
    const v1 = rec('customer', null, 'draft', { version: 1 });
    const v2 = rec('customer', null, 'draft', { version: 2, file: null });
    expect(latest([v1, v2], 'customer', null, 'draft')).toBe(v1);
    expect(latest([v1, v2], 'customer', null, 'final')).toBeNull();
  });

  it('contract_without_file_does_not_count', () => {
    const draft = order();
    expect(gate('t40', draft, 25 * M, [rec('customer', null, 'draft', { file: null })])).toEqual([
      expect.objectContaining({ code: 'draft_missing', slot: 'customer' })]);
  });

  it('limit_is_strictly_greater', () => {
    expect(needsFile(20 * M, 20 * M)).toBe(false);
    expect(needsFile(20 * M + 1, 20 * M)).toBe(true);
    expect(gate('t40', order(), 20 * M, [])).toEqual([]);
    expect(gate('t40', order(), 20 * M + 1, [])).toHaveLength(1);
  });
});

describe('contractGate', () => {
  it('t40_needs_a_customer_draft_above_the_limit_and_nothing_below', () => {
    expect(gate('t40', order(), 15 * M, [])).toEqual([]);
    expect(gate('t40', order(), 25 * M, [])).toEqual([
      { code: 'draft_missing', slot: 'customer', message: expect.any(String) }]);
    expect(gate('t40', order(), 25 * M, [rec('customer', null, 'draft')])).toEqual([]);
  });

  it('t44_needs_a_draft_for_every_supplier_above_the_limit', () => {
    const draft = order([['s1', 1, 30 * M], ['s2', 1, 30 * M]]);
    expect(gate('t44', draft, 0, [rec('supplier', 's1', 'draft')])).toEqual([
      expect.objectContaining({ code: 'draft_missing', slot: 'supplier:s2' })]);
  });

  it('value_entered_beats_the_expected_value', () => {
    const draft = order([['s1', 1, 25 * M]]);
    expect(gate('t44', draft, 0, [])).toHaveLength(1);
    // A draft uploaded without a file but with the value 10 tr: the contract is below the limit, no file needed.
    expect(gate('t44', draft, 0, [rec('supplier', 's1', 'draft', { file: null, value: 10 * M })])).toEqual([]);
  });

  it('final_gates_need_t42_agreed', () => {
    const draft = order();
    const contracts = [rec('customer', null, 'final')];
    for (const t42 of [{ status: 'done' as const, outcome: 'revise' }, { status: 'open' as const, outcome: null }]) {
      expect(gate('t41', draft, 5 * M, contracts, { t42 }).map((i) => i.code)).toEqual(['draft_not_approved']);
    }
    expect(gate('t41', draft, 5 * M, contracts)).toEqual([]);
  });

  it('t41_also_needs_the_customer_contract_fields', () => {
    const draft = order();
    draft.order.receiver_name = '';
    expect(gate('t41', draft, 5 * M, [])).toEqual([
      { code: 'order_fields', slot: null, path: 'order.receiver_name', message: expect.stringContaining('order.receiver_name') }]);
  });

  it('t41_needs_a_customer_final_above_the_limit', () => {
    expect(gate('t41', order(), 25 * M, [rec('customer', null, 'draft')]).map((i) => i.code)).toEqual(['final_missing']);
  });

  it('t45_needs_a_final_per_supplier_above_the_limit', () => {
    const draft = order([['s1', 1, 30 * M], ['s2', 1, 5 * M]]);
    expect(gate('t45', draft, 0, []).map((i) => [i.code, i.slot])).toEqual([['final_missing', 'supplier:s1']]);
    expect(gate('t45', draft, 0, [rec('supplier', 's1', 'final')])).toEqual([]);
  });

  it('blocking_findings_block_when_provided', () => {
    const draft = order();
    expect(gate('t40', draft, 5 * M, [], { blockingFindings: { customer: 1 } }).map((i) => i.code)).toEqual(['ai_blocking']);
    expect(gate('t40', draft, 5 * M, [], { blockingFindings: { 'supplier:s1': 1 } })).toEqual([]);
  });
});

describe('prepayAmount', () => {
  it('prepay_amount_rounds_and_handles_null', () => {
    expect(prepayAmount(3_500_000, 0.3)).toBe(1_050_000);
    expect(prepayAmount(3_500_000, null)).toBe(0);
    expect(prepayAmount(1_000_001, 0.5)).toBe(500_001);
  });

  it('prepay_total_sums_the_suppliers_from_their_latest_contract', () => {
    const draft = order([['s1', 1, 10 * M], ['s2', 1, 20 * M]]);
    const slots = contractSlots(draft, 0, [
      rec('supplier', 's1', 'draft', { advance_percent: 0.3 }),
      rec('supplier', 's2', 'draft', { advance_percent: 0.1, value: 30 * M }),
      rec('supplier', 's2', 'final', { advance_percent: 0.5, value: 40 * M }),
      rec('supplier', 's9', 'final', { advance_percent: 1, value: 99 * M }),
    ]);
    // s1: 10 tr × 30%; s2: the final's 40 tr × 50%; s9 is no longer on the order.
    expect(prepayTotal(slots)).toBe(3 * M + 20 * M);
    expect(prepayTotal(contractSlots(draft, 0, []))).toBe(0);
  });
});
