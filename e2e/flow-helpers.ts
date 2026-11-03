// What the sandbox tests of the order flow share: records through the API as each person, and waiting for the triggers.
import { as, idsByKey, readSandbox } from '@reflexify/agentflow-sdk/testing';
import { expect } from 'vitest';
import type { LogicalKey } from '../src/generated/app';

export const ids = idsByKey<LogicalKey>();
export const entityId = (key: string) => ids[`entity:${key}` as LogicalKey];
export const userId = (handle: string) => readSandbox().people[handle].user_id;
export type Client = ReturnType<typeof as>;
export type Rec = Record<string, unknown> & { id: string; updated_at?: string };
export const TAG = `F${Date.now().toString().slice(-9)}`;

export const flat = (item: unknown): Rec => {
  const r = item as Record<string, unknown>;
  const body = (r.body ?? {}) as Record<string, unknown>;
  return { ...body, id: String(r.id), updated_at: String(r.updated_at ?? body.updated_at ?? '') } as Rec;
};

export async function tryCreate(client: Client, entity: string, form_payload: Record<string, unknown>) {
  const { data, error, response } = await client.POST('/entities/{entity_id}/records', {
    params: { path: { entity_id: entityId(entity) } }, body: { form_payload },
  });
  return { status: response.status, error, record: data ? flat(data) : undefined };
}

export async function create(client: Client, entity: string, form_payload: Record<string, unknown>): Promise<Rec> {
  const { status, error, record } = await tryCreate(client, entity, form_payload);
  if (!record) throw new Error(`create ${entity}: ${status} ${JSON.stringify(error)}`);
  return record;
}

export async function get(client: Client, entity: string, id: string): Promise<Rec | undefined> {
  const { data } = await client.GET('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: entityId(entity), record_id: id } },
  });
  return data ? flat(data) : undefined;
}

export async function patch(client: Client, entity: string, id: string, changes: Record<string, unknown>) {
  const current = await get(as('pladmin'), entity, id);
  const { response, error } = await client.PATCH('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: entityId(entity), record_id: id } },
    body: { changes, expected_updated_at: String(current?.updated_at ?? '') },
  });
  return { status: response.status, error };
}

export async function listAll(client: Client, entity: string): Promise<Rec[]> {
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

export const ADMIN = (): Client => as('pladmin');
export const tasksOf = async (orderId: string) => (await listAll(ADMIN(), 'order_task')).filter((t) => t.order === orderId);
export const taskOf = async (orderId: string, code: string) => (await tasksOf(orderId)).find((t) => t.task_code === code);
export const orderOf = async (orderId: string) => (await get(ADMIN(), 'order', orderId))!;
export const eventsOf = async (orderId: string) => (await listAll(ADMIN(), 'order_event')).filter((e) => e.order === orderId);

// A plain polling loop (expect.poll is not allowed in beforeAll): the triggers need a few seconds per hop.
export async function waitFor<T>(what: string, read: () => Promise<T | undefined | false>, seconds = 150): Promise<T> {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}
export const taskIs = (orderId: string, code: string, status: string) => waitFor(`${code} to be ${status}`, async () => {
  const task = await taskOf(orderId, code);
  return task?.status === status ? task : undefined;
});

// A person takes a task (if nobody holds it) and sets its outcome, as the module's act() does.
export async function finish(client: Client, task: Rec, outcome: string, reason = '') {
  const claim = await client.POST('/entities/{entity_id}/records/{record_id}/work/claim', {
    params: { path: { entity_id: entityId('order_task'), record_id: task.id } },
  });
  const status = outcome === 'not_applicable' ? 'not_applicable' : 'done';
  const done = await patch(client, 'order_task', task.id, { status, outcome, reason });
  return { claim: claim.response.status, ...done };
}

export const STAGES = [...['opportunity', 'clarification', 'quotation', 'negotiation', 'close'].map((stage) => ({ stage, person: 'ThuanNG' })),
  { stage: 'contract', person: 'ThuDTH' }];

// A goods order (TB) that passes the submit check; withService adds a service line (DVTK-O).
export async function newOrder(label: string, withService = false): Promise<string> {
  const am = as('am');
  const supplier = await create(am, 'supplier', { name: `NCC ${label}` });
  const order = await create(am, 'order', {
    customer_name: `Khách hàng ${label}`, customer_code: label, tax_code: '0312345678', contact_name: 'Chị Hạnh',
    internal_contract_no: label, content: `Đơn kiểm thử ${label}`, customer_tier: 'potential', debt_days: 30, is_new_order: true, am: userId('am'),
  });
  expect((await patch(am, 'order', order.id, { deal_stages: STAGES })).status).toBeLessThan(300);
  const line = await create(am, 'order_line', { order: order.id, line_no: 1, item_type_code: 'TB', co_cq: true, name: 'Seagate 18TB', unit: 'Cái', quantity: 12, months: 24 });
  await create(am, 'goods_line_price', { order_line: line.id, order: order.id, unit_price: 21_000_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 19_000_000, supplier: supplier.id });
  if (withService) {
    const service = await create(am, 'order_line', { order: order.id, line_no: 2, item_type_code: 'DVTK-O', name: 'Triển khai', unit: 'Gói', quantity: 1 });
    await create(am, 'service_line_price', { order_line: service.id, order: order.id, unit_price: 30_000_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 20_000_000, supplier: supplier.id });
  }
  await create(am, 'order_finance', { order: order.id, sales_cost: 0 });
  // compute_pl runs on this: has_goods / has_service are what decide which tasks apply.
  expect((await patch(am, 'order', order.id, { pl_requested_at: new Date().toISOString() })).status).toBeLessThan(300);
  await waitFor('the P&L', async () => (await listAll(ADMIN(), 'order_pl')).find((pl) => pl.order === order.id));
  return order.id;
}

