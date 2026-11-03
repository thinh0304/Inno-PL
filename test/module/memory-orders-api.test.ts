import { describe, expect, it } from 'vitest';
import { recordsFromConfig } from '../../src/module/demo-data.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import { OrdersError } from '../../src/module/orders-api.js';
import { applyCreatedIds, blankDraft, newLine } from '../../src/module/save-plan.js';
import { configFromRecords } from '../../src/pl/config-records';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import type { OrderDraft } from '../../src/order/types';

const C = DEFAULT_CONFIG;

function tm1040Draft(api: ReturnType<typeof createMemoryOrdersApi>): OrderDraft {
  void api;
  const draft = blankDraft('u-am');
  Object.assign(draft.order, { customer_name: 'Công ty Mẫu', customer_code: 'MAU', tax_code: '0312345678', contact_name: 'Chị Hạnh',
    internal_contract_no: 'TM-1040', content: 'Ổ cứng và NAS', customer_tier: 'potential', debt_days: 30 });
  draft.finance.sales_cost = 0;
  draft.lines = [
    { ...newLine('new:a', 1, C), name: 'Seagate 18TB', unit: 'Cái', co_cq: true, quantity: 12, months: 24,
      price: { unit_price: 21_000_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 19_000_000, supplier: 's1' } },
    { ...newLine('new:b', 2, C), name: 'QNAP TS-H1277AXU', unit: 'Cái', co_cq: true, quantity: 1, months: 60,
      price: { unit_price: 168_000_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 150_920_000 / 1.08, supplier: 's1' } },
  ];
  return draft;
}

describe('the demo configuration', () => {
  it('reads back as the defaults', () => {
    expect(configFromRecords(recordsFromConfig(C))).toEqual(C);
  });
});

describe('the in-memory orders', () => {
  it('save_requests_pl_and_official_matches_excel', async () => {
    const api = createMemoryOrdersApi({ empty: true });
    const saved = await api.save(tm1040Draft(api), null, C);
    expect(saved.draft.order.id).toBeTruthy();
    expect(saved.official.order_pl?.net_profit as number).toBeCloseTo(46_272_444.44, 2);
    expect(String(saved.draft.order.code)).toMatch(/^TM-/);
    expect((await api.list()).map((o) => o.id)).toEqual([saved.draft.order.id]);
  });

  it('retry_after_partial_failure_completes', async () => {
    const api = createMemoryOrdersApi({ empty: true, failAfter: 3 });
    const draft = tm1040Draft(api);
    const error = await api.save(draft, null, C).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrdersError);
    const created = (error as OrdersError).created;
    expect(created['new:order']).toBeTruthy();
    const retry = applyCreatedIds(draft, created);
    const loaded = await api.load(created['new:order']);
    const done = await api.save(retry, loaded.records, C);
    expect(done.records.lines).toHaveLength(2);
    expect(done.records.goods_prices).toHaveLength(2);
    expect(done.records.finance).toHaveLength(1);
    expect(done.official.order_pl?.net_profit as number).toBeCloseTo(46_272_444.44, 2);
  });

  it('finds customers by name, code or tax code, ignoring diacritics', async () => {
    const api = createMemoryOrdersApi();
    expect((await api.findCustomers('so giao')).map((c) => c.code)).toContain('SOGTVTLD');
    expect((await api.findCustomers('03123')).length).toBeGreaterThan(0);
    expect(await api.findCustomers('x')).toEqual([]);
  });

  it('a proposal recomputes the purchasing KPI', async () => {
    const api = createMemoryOrdersApi();
    const order = (await api.list()).find((o) => o.code.startsWith('TM-'))!;
    const loaded = await api.load(order.id);
    const line = loaded.draft.lines[0];
    await api.saveProposal(line.id, order.id, { proposed_cost: (line.price.unit_cost ?? 0) - 1_000_000, proposed_supplier: null, note: '' });
    expect((await api.load(order.id)).official.order_pl_goods?.proc_saving).toBe((line.quantity ?? 0) * 1_000_000);
  });
});
