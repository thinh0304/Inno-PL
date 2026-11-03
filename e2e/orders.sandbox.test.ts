// Plan 02 against a real AgentFlow: AM enters order TM-1040 as records, the trigger runs compute_pl, and the P&L
// matches the Excel; then who may read and write what (Thiết kế 7.2).
import { as, idsByKey, readSandbox } from '@reflexify/agentflow-sdk/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LogicalKey } from '../src/generated/app';

const ids = idsByKey<LogicalKey>();
const entityId = (key: string) => ids[`entity:${key}` as LogicalKey];
type Client = ReturnType<typeof as>;
type Rec = Record<string, unknown> & { id: string; updated_at?: string };
const TAG = `E2E${Date.now()}`;

// API records carry their fields under body.
const flat = (item: unknown): Rec => {
  const r = item as Record<string, unknown>;
  return { ...(r.body as Record<string, unknown> ?? {}), id: String(r.id), updated_at: String(r.updated_at ?? (r.body as Rec | undefined)?.updated_at ?? '') } as Rec;
};

async function create(client: Client, entity: string, form_payload: Record<string, unknown>): Promise<Rec> {
  const { data, error, response } = await client.POST('/entities/{entity_id}/records', {
    params: { path: { entity_id: entityId(entity) } }, body: { form_payload },
  });
  if (!data) throw new Error(`create ${entity}: ${response.status} ${JSON.stringify(error)}`);
  return flat(data);
}

async function get(client: Client, entity: string, id: string): Promise<{ status: number; record?: Rec }> {
  const { data, response } = await client.GET('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: entityId(entity), record_id: id } },
  });
  return { status: response.status, record: data ? flat(data) : undefined };
}

async function patch(client: Client, entity: string, id: string, changes: Record<string, unknown>) {
  const current = await get(as('pladmin'), entity, id).then((r) => r.record) ?? await get(client, entity, id).then((r) => r.record);
  const { response, error } = await client.PATCH('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: entityId(entity), record_id: id } },
    body: { changes, expected_updated_at: String(current?.updated_at ?? '') },
  });
  return { status: response.status, error };
}

async function list(client: Client, entity: string): Promise<{ status: number; rows: Rec[] }> {
  const { data, response } = await client.GET('/entities/{entity_id}/records', {
    params: { path: { entity_id: entityId(entity) }, query: { limit: 100 } },
  });
  return { status: response.status, rows: (data?.items ?? []).map(flat) };
}

const ofOrder = (rows: Rec[], orderId: string) => rows.filter((row) => row.order === orderId);

async function waitForPl(orderId: string, after?: string): Promise<Rec> {
  let found: Rec | undefined;
  await expect.poll(async () => {
    found = ofOrder((await list(as('am'), 'order_pl')).rows, orderId)[0];
    return Boolean(found && (!after || String(found.computed_at) > after));
  }, { timeout: 120_000, interval: 3_000 }).toBe(true);
  return found!;
}

let orderId = '';
let lineIds: string[] = [];

describe('orders in the sandbox', () => {
  beforeAll(async () => {
    const am = as('am');
    const customer = await create(am, 'customer', { code: TAG, name: `Khách hàng ${TAG}`, tier: 'potential' });
    const supplier = await create(am, 'supplier', { name: `NCC ${TAG}` });
    const order = await create(am, 'order', {
      customer: customer.id, customer_name: `Khách hàng ${TAG}`, customer_code: TAG, tax_code: '0312345678',
      contact_name: 'Chị Hạnh', internal_contract_no: TAG, content: `Đơn kiểm thử ${TAG}`,
      customer_tier: 'potential', debt_days: 30, is_new_order: true,
    });
    orderId = order.id;
    const stages = ['opportunity', 'clarification', 'quotation', 'negotiation', 'close'].map((stage) => ({ stage, person: 'ThuanNG' }));
    expect((await patch(am, 'order', orderId, { deal_stages: [...stages, { stage: 'contract', person: 'ThuDTH' }] })).status).toBeLessThan(300);

    const lines = [
      { line_no: 1, name: 'Seagate 18TB', quantity: 12, months: 24, unit_price: 21_000_000, unit_cost: 19_000_000 },
      { line_no: 2, name: 'QNAP TS-H1277AXU', quantity: 1, months: 60, unit_price: 168_000_000, unit_cost: 150_920_000 / 1.08 },
    ];
    lineIds = [];
    for (const l of lines) {
      const line = await create(am, 'order_line', { order: orderId, line_no: l.line_no, item_type_code: 'TB', co_cq: true,
        name: l.name, unit: 'Cái', quantity: l.quantity, months: l.months });
      lineIds.push(line.id);
      await create(am, 'goods_line_price', { order_line: line.id, order: orderId, unit_price: l.unit_price, discount_pct: 0,
        vat_rate: 0.08, unit_cost: l.unit_cost, supplier: supplier.id });
    }
    await create(am, 'order_finance', { order: orderId, sales_cost: 0 });
    expect((await patch(am, 'order', orderId, { pl_requested_at: new Date().toISOString() })).status).toBeLessThan(300);
  });

  it('am_creates_tm1040_and_compute_pl_matches_excel', async () => {
    const pl = await waitForPl(orderId);
    expect(pl.net_profit as number).toBeCloseTo(46_272_444.44, 2);
    expect(pl.passed).toBe(true);
    const order = (await get(as('am'), 'order', orderId)).record!;
    expect(String(order.code)).toMatch(/^TM-/);
    expect(order.has_goods).toBe(true);
  });

  it('tm_cannot_read_pl_goods_or_proposals', async () => {
    const tm = as('tm');
    expect((await get(tm, 'order', orderId)).status).toBe(200);
    expect((await get(tm, 'order_line', lineIds[0])).status).toBe(200);
    for (const entity of ['order_pl', 'goods_line_price', 'purchase_proposal']) {
      const { status, rows } = await list(tm, entity);
      expect(status === 403 || ofOrder(rows, orderId).length === 0, `${entity}: ${status}`).toBe(true);
    }
  });

  it('proc_cannot_read_service_prices_or_pl', async () => {
    const proc = as('proc');
    for (const entity of ['service_line_price', 'order_pl', 'order_finance']) {
      const { status, rows } = await list(proc, entity);
      expect(status === 403 || ofOrder(rows, orderId).length === 0, `${entity}: ${status}`).toBe(true);
    }
    expect(ofOrder((await list(proc, 'goods_line_price')).rows, orderId)).toHaveLength(2);
    expect(ofOrder((await list(proc, 'order_pl_goods')).rows, orderId)).toHaveLength(1);
  });

  it('other_am_cannot_see_order', async () => {
    expect((await get(as('am2'), 'order', orderId)).status).toBe(404);
  });

  it('am_cannot_write_pl', async () => {
    const pl = ofOrder((await list(as('am'), 'order_pl')).rows, orderId)[0];
    const { status } = await patch(as('am'), 'order_pl', pl.id, { net_profit: 1 });
    expect(status).toBe(403);
  });

  it('am_cannot_reassign_order', async () => {
    const am2 = readSandbox().people.am2.user_id;
    const { status, error } = await patch(as('am'), 'order', orderId, { am: am2 });
    expect(status, JSON.stringify(error)).toBe(422);
  });

  it('locked_pl_is_kept', async () => {
    const pl = ofOrder((await list(as('am'), 'order_pl')).rows, orderId)[0];
    expect((await patch(as('pladmin'), 'order_pl', pl.id, { locked: true })).status).toBeLessThan(300);
    const price = ofOrder((await list(as('am'), 'goods_line_price')).rows, orderId)[0];
    expect((await patch(as('am'), 'goods_line_price', price.id, { unit_price: 1 })).status).toBeLessThan(300);
    const asked = new Date().toISOString();
    expect((await patch(as('am'), 'order', orderId, { pl_requested_at: asked })).status).toBeLessThan(300);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    const after = ofOrder((await list(as('am'), 'order_pl')).rows, orderId)[0];
    expect(after.net_profit as number).toBeCloseTo(46_272_444.44, 2);
    expect(String(after.computed_at)).toBe(String(pl.computed_at));
  });
});
