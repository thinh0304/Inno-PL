// Plan 02 against a real AgentFlow: AM enters order TM-1040 as records, the trigger runs compute_pl, and the P&L
// matches the Excel; then who may read and write what (Thiết kế 7.2), and the rules that keep records where they belong.
import { as, idsByKey, readSandbox } from '@reflexify/agentflow-sdk/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LogicalKey } from '../src/generated/app';

const ids = idsByKey<LogicalKey>();
const entityId = (key: string) => ids[`entity:${key}` as LogicalKey];
const userId = (handle: string) => readSandbox().people[handle].user_id;
type Client = ReturnType<typeof as>;
type Rec = Record<string, unknown> & { id: string; updated_at?: string };
const TAG = `E2E${Date.now()}`;

// API records carry their fields under body.
const flat = (item: unknown): Rec => {
  const r = item as Record<string, unknown>;
  const body = (r.body ?? {}) as Record<string, unknown>;
  return { ...body, id: String(r.id), updated_at: String(r.updated_at ?? body.updated_at ?? '') } as Rec;
};

async function tryCreate(client: Client, entity: string, form_payload: Record<string, unknown>) {
  const { data, error, response } = await client.POST('/entities/{entity_id}/records', {
    params: { path: { entity_id: entityId(entity) } }, body: { form_payload },
  });
  return { status: response.status, error, record: data ? flat(data) : undefined };
}

async function create(client: Client, entity: string, form_payload: Record<string, unknown>): Promise<Rec> {
  const { status, error, record } = await tryCreate(client, entity, form_payload);
  if (!record) throw new Error(`create ${entity}: ${status} ${JSON.stringify(error)}`);
  return record;
}

async function get(client: Client, entity: string, id: string): Promise<{ status: number; record?: Rec }> {
  const { data, response } = await client.GET('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: entityId(entity), record_id: id } },
  });
  return { status: response.status, record: data ? flat(data) : undefined };
}

async function patch(client: Client, entity: string, id: string, changes: Record<string, unknown>) {
  const current = (await get(as('pladmin'), entity, id)).record ?? (await get(client, entity, id)).record;
  const { response, error } = await client.PATCH('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: entityId(entity), record_id: id } },
    body: { changes, expected_updated_at: String(current?.updated_at ?? '') },
  });
  return { status: response.status, error };
}

// Every page, so records from earlier runs never push this run's out of sight.
async function listAll(client: Client, entity: string): Promise<Rec[]> {
  const rows: Rec[] = [];
  let cursor: string | undefined;
  for (;;) {
    const { data } = await client.GET('/entities/{entity_id}/records', {
      params: { path: { entity_id: entityId(entity) }, query: { limit: 100, cursor } },
    });
    rows.push(...(data?.items ?? []).map(flat));
    if (!data?.next_cursor) return rows;
    cursor = data.next_cursor;
  }
}

const ofOrder = async (client: Client, entity: string, orderId: string) =>
  (await listAll(client, entity)).filter((row) => row.order === orderId);

async function runsOf(orderId: string) {
  // The order's AM sees its runs; the sandbox owner is in none of the app's groups.
  const { data } = await as('am').GET('/entities/{entity_id}/records/{record_id}/runs', {
    params: { path: { entity_id: entityId('order'), record_id: orderId }, query: { limit: 50 } },
  });
  return (data?.items ?? []).filter((run) => run.workflow?.id === ids['workflow:compute_pl' as LogicalKey]);
}

// Ask for a computation and wait until the run it starts has settled.
async function requestPl(orderId: string) {
  const before = (await runsOf(orderId)).length;
  expect((await patch(as('am'), 'order', orderId, { pl_requested_at: new Date().toISOString() })).status).toBeLessThan(300);
  // A plain loop: expect.poll is not allowed in beforeAll.
  const deadline = Date.now() + 150_000;
  for (;;) {
    const runs = await runsOf(orderId);
    if (runs.length > before && runs.every((run) => run.completed_at !== null)) {
      return runs.reduce((latest, run) => (run.started_at > latest.started_at ? run : latest));
    }
    if (Date.now() > deadline) throw new Error(`no settled compute_pl run on order ${orderId} after 150 s (${runs.length} runs, ${before} before)`);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}

let orderId = '';
let lineIds: string[] = [];
let priceIds: string[] = [];
let proposalId = '';
let supplierId = '';

describe('orders in the sandbox', () => {
  beforeAll(async () => {
    const am = as('am');
    const customer = await create(am, 'customer', { code: TAG, name: `Khách hàng ${TAG}`, tier: 'potential' });
    supplierId = (await create(am, 'supplier', { name: `NCC ${TAG}` })).id;
    const order = await create(am, 'order', {
      customer: customer.id, customer_name: `Khách hàng ${TAG}`, customer_code: TAG, tax_code: '0312345678',
      contact_name: 'Chị Hạnh', internal_contract_no: TAG, content: `Đơn kiểm thử ${TAG}`,
      customer_tier: 'potential', debt_days: 30, is_new_order: true, am: userId('am'),
    });
    orderId = order.id;
    const stages = ['opportunity', 'clarification', 'quotation', 'negotiation', 'close'].map((stage) => ({ stage, person: 'ThuanNG' }));
    expect((await patch(am, 'order', orderId, { deal_stages: [...stages, { stage: 'contract', person: 'ThuDTH' }] })).status).toBeLessThan(300);

    const lines = [
      { line_no: 1, name: 'Seagate 18TB', quantity: 12, months: 24, unit_price: 21_000_000, unit_cost: 19_000_000 },
      { line_no: 2, name: 'QNAP TS-H1277AXU', quantity: 1, months: 60, unit_price: 168_000_000, unit_cost: 150_920_000 / 1.08 },
    ];
    lineIds = [];
    priceIds = [];
    for (const l of lines) {
      const line = await create(am, 'order_line', { order: orderId, line_no: l.line_no, item_type_code: 'TB', co_cq: true,
        name: l.name, unit: 'Cái', quantity: l.quantity, months: l.months });
      lineIds.push(line.id);
      priceIds.push((await create(am, 'goods_line_price', { order_line: line.id, order: orderId, unit_price: l.unit_price,
        discount_pct: 0, vat_rate: 0.08, unit_cost: l.unit_cost, supplier: supplierId })).id);
    }
    await create(am, 'order_finance', { order: orderId, sales_cost: 0 });
    proposalId = (await create(as('proc'), 'purchase_proposal', { order_line: lineIds[0], order: orderId, proposed_cost: 18_000_000 })).id;
    const run = await requestPl(orderId);
    expect(run.status).toBe('completed');
  });

  it('am_creates_tm1040_and_compute_pl_matches_excel', async () => {
    const [pl] = await ofOrder(as('am'), 'order_pl', orderId);
    expect(pl.net_profit as number).toBeCloseTo(46_272_444.44, 2);
    expect(pl.passed).toBe(true);
    const order = (await get(as('am'), 'order', orderId)).record!;
    expect(String(order.code)).toMatch(/^TM-/);
    expect(order.has_goods).toBe(true);
    const [goods] = await ofOrder(as('proc'), 'order_pl_goods', orderId);
    expect(goods.proc_saving).toBe(12_000_000);
  });

  it('tm_cannot_read_pl_goods_or_proposals', async () => {
    const tm = as('tm');
    expect((await get(tm, 'order', orderId)).status).toBe(200);
    expect((await get(tm, 'order_line', lineIds[0])).status).toBe(200);
    const [pl] = await ofOrder(as('am'), 'order_pl', orderId);
    for (const [entity, id] of [['order_pl', pl.id], ['goods_line_price', priceIds[0]], ['purchase_proposal', proposalId]]) {
      expect([403, 404], entity).toContain((await get(tm, entity, id)).status);
    }
  });

  it('proc_cannot_read_service_prices_or_pl', async () => {
    const proc = as('proc');
    const [pl] = await ofOrder(as('am'), 'order_pl', orderId);
    const [finance] = await ofOrder(as('am'), 'order_finance', orderId);
    for (const [entity, id] of [['order_pl', pl.id], ['order_finance', finance.id]]) {
      expect([403, 404], entity).toContain((await get(proc, entity, id)).status);
    }
    expect((await get(proc, 'goods_line_price', priceIds[0])).status).toBe(200);
    expect((await ofOrder(proc, 'order_pl_goods', orderId))).toHaveLength(1);
  });

  it('am_cannot_read_proposals', async () => {
    expect([403, 404]).toContain((await get(as('am'), 'purchase_proposal', proposalId)).status);
  });

  it('other_am_cannot_see_order', async () => {
    expect((await get(as('am2'), 'order', orderId)).status).toBe(404);
  });

  it('am_cannot_write_pl', async () => {
    const [pl] = await ofOrder(as('am'), 'order_pl', orderId);
    expect((await patch(as('am'), 'order_pl', pl.id, { net_profit: 1 })).status).toBe(403);
  });

  it('am_cannot_reassign_order', async () => {
    const { status, error } = await patch(as('am'), 'order', orderId, { am: userId('am2') });
    expect(status, JSON.stringify(error)).toBe(422);
  });

  it('sa_creates_an_order_for_a_named_am_and_keeps_access', async () => {
    const sa = as('sa');
    // am is required: an SA cannot leave it empty and become the order's AM.
    expect((await tryCreate(sa, 'order', { customer_name: TAG, sa: userId('sa') })).status).toBeGreaterThanOrEqual(400);
    const order = await create(sa, 'order', { customer_name: TAG, am: userId('am'), sa: userId('sa') });
    expect((await get(sa, 'order', order.id)).status).toBe(200);
    expect((await get(as('am'), 'order', order.id)).status).toBe(200);
  });

  it('am_cannot_attach_a_price_to_another_ams_line', async () => {
    const am2 = as('am2');
    const other = await create(am2, 'order', { customer_name: `${TAG} am2`, am: userId('am2') });
    const otherLine = await create(am2, 'order_line', { order: other.id, line_no: 1, item_type_code: 'TB', name: 'Khác', quantity: 1 });
    const { status } = await tryCreate(as('am'), 'goods_line_price', { order: orderId, order_line: otherLine.id, unit_price: 1 });
    expect(status).toBe(422);
  });

  it('a_line_cannot_move_to_another_order', async () => {
    const other = await create(as('am'), 'order', { customer_name: `${TAG} other`, am: userId('am') });
    const { status } = await patch(as('am'), 'order_line', lineIds[0], { order: other.id });
    expect(status).toBe(422);
  });

  it('locked_pl_is_kept', async () => {
    const [pl] = await ofOrder(as('am'), 'order_pl', orderId);
    expect((await patch(as('pladmin'), 'order_pl', pl.id, { locked: true })).status).toBeLessThan(300);
    expect((await patch(as('am'), 'goods_line_price', priceIds[0], { unit_price: 1 })).status).toBeLessThan(300);
    const run = await requestPl(orderId);
    expect(run.status).toBe('completed');
    const [after] = await ofOrder(as('am'), 'order_pl', orderId);
    expect(after.net_profit as number).toBeCloseTo(46_272_444.44, 2);
    expect(String(after.computed_at)).toBe(String(pl.computed_at));
  });
});
