import { describe, expect, it } from 'vitest';
import { applyCreatedIds, newLine, savePlan, type SaveOp } from '../../src/module/save-plan.js';
import { draftFromRecords } from '../../src/order/records';
import type { OrderDraft, OrderRecords } from '../../src/order/types';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040_RECORDS } from '../order/fixtures/tm1040-records';

const C = DEFAULT_CONFIG;
const saved = (): OrderRecords => structuredClone(TM1040_RECORDS);
const draftOf = (records: OrderRecords): OrderDraft => draftFromRecords(records, C);
const kinds = (ops: SaveOp[]) => ops.map((op) => `${op.kind} ${op.entity}`);

function freshDraft(): OrderDraft {
  const draft = draftOf(saved());
  draft.order.id = undefined;
  draft.finance.id = undefined;
  draft.lines = draft.lines.map((line, i) => ({ ...line, id: `new:l${i}`, price: { ...line.price, id: undefined, source: undefined } }));
  return draft;
}

describe('savePlan', () => {
  it('new_order_creates_in_dependency_order', () => {
    const ops = savePlan(freshDraft(), null, C);
    expect(kinds(ops)).toEqual(['create order', 'patch order', 'create order_finance', 'create order_line', 'create order_line',
      'create goods_line_price', 'create goods_line_price']);
    const [createOrder, patchOrder, , line] = ops;
    expect(createOrder).toMatchObject({ kind: 'create', key: 'new:order' });
    expect((createOrder as { body: Record<string, unknown> }).body).not.toHaveProperty('deal_stages');
    expect(patchOrder).toMatchObject({ kind: 'patch', id: 'new:order' });
    expect(Object.keys((patchOrder as { changes: object }).changes)).toEqual(['deal_stages']);
    expect((line as { body: Record<string, unknown> }).body.order).toBe('new:order');
    expect((ops[5] as { body: Record<string, unknown> }).body.order_line).toBe('new:l0');
  });

  it('unchanged_draft_has_no_ops', () => {
    expect(savePlan(draftOf(saved()), saved(), C)).toEqual([]);
  });

  it('a list item without an empty member is unchanged', () => {
    const records = saved();
    records.order.deal_stages = (records.order.deal_stages as { stage: string; person: string }[]).map(({ stage, person }) => ({ id: `i-${stage}`, stage, person }));
    expect(savePlan(draftOf(records), records, C)).toEqual([]);
  });

  it('only_changed_fields_are_patched', () => {
    const draft = draftOf(saved());
    draft.order.customer_name = 'Tên mới';
    expect(savePlan(draft, saved(), C)).toEqual([{ kind: 'patch', entity: 'order', id: 'o1', changes: { customer_name: 'Tên mới' } }]);
  });

  it('an emptied text is written as null', () => {
    const draft = draftOf(saved());
    draft.order.contact_name = '';
    expect(savePlan(draft, saved(), C)).toEqual([{ kind: 'patch', entity: 'order', id: 'o1', changes: { contact_name: null } }]);
  });

  it('a changed price is patched in its entity', () => {
    const draft = draftOf(saved());
    draft.lines[0].price.unit_price = 22_000_000;
    expect(savePlan(draft, saved(), C)).toEqual([{ kind: 'patch', entity: 'goods_line_price', id: 'p1', changes: { unit_price: 22_000_000 } }]);
  });

  it('a new line on a saved order', () => {
    const draft = draftOf(saved());
    draft.lines.push({ ...newLine('new:x', 3, C), item_type_code: 'Cloud Server', name: 'Cloud', quantity: 1, months: 12 });
    expect(kinds(savePlan(draft, saved(), C))).toEqual(['create order_line', 'create service_line_price']);
  });

  it('deleted_line_deletes_line_and_price', () => {
    const draft = draftOf(saved());
    draft.lines = draft.lines.filter((line) => line.id !== 'qnap');
    expect(savePlan(draft, saved(), C)).toEqual([
      { kind: 'delete', entity: 'goods_line_price', id: 'p2' },
      { kind: 'delete', entity: 'order_line', id: 'qnap' },
    ]);
  });

  it('moving_group_moves_the_price', () => {
    const draft = draftOf(saved());
    draft.lines[0].item_type_code = 'Cloud Server';
    expect(kinds(savePlan(draft, saved(), C))).toEqual(['patch order_line', 'delete goods_line_price', 'create service_line_price']);
  });

  it('a price left in both entities keeps the right one only', () => {
    const records = saved();
    records.service_prices = [{ ...records.goods_prices[0], id: 'stale' }];
    expect(savePlan(draftOf(records), records, C)).toEqual([{ kind: 'delete', entity: 'service_line_price', id: 'stale' }]);
  });

  it('applyCreatedIds turns temporary keys into the ids a failed save created', () => {
    const draft = applyCreatedIds(freshDraft(), { 'new:order': 'o9', 'new:l0': 'l9' });
    expect(draft.order.id).toBe('o9');
    expect(draft.lines.map((line) => line.id)).toEqual(['l9', 'new:l1']);
  });
});
