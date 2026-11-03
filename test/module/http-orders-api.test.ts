import { describe, expect, it } from 'vitest';
import { createHttpOrdersApi } from '../../src/module/http-orders-api.js';
import { OrdersError } from '../../src/module/orders-api.js';
import { blankDraft, newLine } from '../../src/module/save-plan.js';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { fakeBackend } from './fake-backend.js';

const C = DEFAULT_CONFIG;

function smallDraft() {
  const draft = blankDraft('u-am');
  Object.assign(draft.order, { customer_name: 'Công ty Mẫu', internal_contract_no: 'TM-1', content: 'Thiết bị', customer_tier: 'potential', debt_days: 30 });
  draft.finance.sales_cost = 0;
  draft.lines = [{ ...newLine('new:a', 1, C), name: 'Ổ cứng', unit: 'Cái', quantity: 2,
    price: { unit_price: 10, discount_pct: 0, vat_rate: 0.08, unit_cost: 8, supplier: null } }];
  return draft;
}

describe('the orders over the published operations', () => {
  it('ids_are_read_once_per_api', async () => {
    const b = fakeBackend();
    const api = createHttpOrdersApi(b.host);
    await api.list();
    await api.list();
    expect(b.GET.mock.calls.filter(([path]) => path === '/app/objects')).toHaveLength(1);
  });

  it('records_are_read_from_body', async () => {
    const b = fakeBackend();
    b.seed('order', { code: 'TM-2026-0001', customer_name: 'Công ty Mẫu', customer_code: 'MAU', am: 'u-am', status: 'draft', stage: 1,
      created_at: '2026-11-01T00:00:00Z' }, 'o1');
    b.seed('order_pl', { order: 'o1', revenue: 420_000_000, passed: true });
    const [summary] = await createHttpOrdersApi(b.host).list();
    expect(summary).toMatchObject({ id: 'o1', code: 'TM-2026-0001', customerName: 'Công ty Mẫu', revenue: 420_000_000, passed: true });
  });

  it('save_sets_pl_requested_at_last', async () => {
    const b = fakeBackend();
    const loaded = await createHttpOrdersApi(b.host).save(smallDraft(), null, C);
    expect(b.all('order')).toHaveLength(1);
    expect(b.all('order_line')).toHaveLength(1);
    expect(b.all('goods_line_price')).toHaveLength(1);
    const last = b.PATCH.mock.calls.at(-1)![1] as { body: { changes: Record<string, unknown> } };
    expect(Object.keys(last.body.changes)).toEqual(['pl_requested_at']);
    expect(loaded.draft.order.id).toBe(b.all('order')[0].id);
  });

  it('stale_version_is_retried_once', async () => {
    const b = fakeBackend();
    const api = createHttpOrdersApi(b.host);
    const first = await api.save(smallDraft(), null, C);
    // compute_pl writes the order's code meanwhile: the order's updated_at moves on.
    b.touch('order', first.draft.order.id!, { code: 'TM-2026-0001' });
    const next = structuredClone(first.draft);
    next.order.customer_name = 'Tên mới';
    const second = await api.save(next, first.records, C);
    expect(second.draft.order.customer_name).toBe('Tên mới');
  });

  it('a second stale answer is reported', async () => {
    const b = fakeBackend((method, entity) => (method === 'PATCH' && entity === 'order'
      ? { status: 409, type: 'STALE_VERSION', detail: 'STALE_VERSION: the record changed' } : null));
    const error = await createHttpOrdersApi(b.host).save(smallDraft(), null, C).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrdersError);
    expect(error).toMatchObject({ code: 'STALE_VERSION' });
    expect((error as OrdersError).created['new:order']).toBeTruthy();
  });

  it('refusal_reason_is_agentflows_sentence', async () => {
    const b = fakeBackend((method, entity) => (method === 'POST' && entity === 'order'
      ? { status: 422, type: 'ENTITY_VALIDATION_RULE_FAILED', detail: 'ENTITY_VALIDATION_RULE_FAILED: AM chỉ tạo đơn cho chính mình' } : null));
    const error = await createHttpOrdersApi(b.host).save(smallDraft(), null, C).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'ENTITY_VALIDATION_RULE_FAILED', reason: 'AM chỉ tạo đơn cho chính mình' });
  });

  it('what the person may not read loads as empty, not as a failure', async () => {
    const b = fakeBackend((method, entity) => (['order_pl', 'goods_line_price', 'order_finance'].includes(entity) && method === 'QUERY'
      ? { status: 403, type: 'FORBIDDEN' } : null));
    b.seed('order', { customer_name: 'X', am: 'u-other', status: 'draft' }, 'o1');
    b.seed('order_line', { order: 'o1', line_no: 1, item_type_code: 'TB', name: 'Ổ cứng', quantity: 1 });
    const loaded = await createHttpOrdersApi(b.host).load('o1');
    expect(loaded.official.order_pl).toBeNull();
    expect(loaded.records.goods_prices).toEqual([]);
    expect(loaded.draft.lines).toHaveLength(1);
  });
});
