// The orders in memory, for the demo and the screen tests. Records have AgentFlow's shape ({ id, body, updated_at }),
// saving runs the real save plan, and setting pl_requested_at runs the same computation compute_pl runs.
import { runComputeOrderPl } from '../order/code-entry';
import { draftFromRecords, lineGroup, refId } from '../order/records';
import type { OrderDraft, OrderRecords, Rec } from '../order/types';
import { configFromRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import type { PlConfig } from '../pl/types';
import { DEMO_CUSTOMERS, DEMO_ORDERS, DEMO_STAFF, DEMO_SUPPLIERS, recordsFromConfig } from './demo-data.js';
import { OrdersError, type Access, type LoadedOrder, type OrderSummary, type OrdersApi, type Person } from './orders-api.js';
import { executeSavePlan, savePlan, type WriteEntity } from './save-plan.js';

type Stored = { id: string; body: Rec; updated_at: string };
const ENTITIES = ['order', 'order_line', 'goods_line_price', 'service_line_price', 'order_finance', 'purchase_proposal',
  'order_pl', 'order_pl_service', 'order_pl_goods', 'customer', 'supplier'] as const;

export interface MemoryOptions {
  empty?: boolean;
  /** The next save fails once, after this many writes (Review Focus 1). */
  failAfter?: number;
  access?: Partial<Access>;
  me?: Person;
  delayMs?: number;
}

const ALL: Access = { seesPl: true, seesGoodsPrices: true, seesServicePrices: true, seesProposals: false, seesPlService: true,
  seesPlGoods: true, canCreateOrder: true, isAdmin: false };

// "Sở Giao" finds "So giao": search ignores case and Vietnamese diacritics.
const fold = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export function createMemoryOrdersApi(options: MemoryOptions = {}) {
  const config = recordsFromConfig(DEFAULT_CONFIG);
  const store = new Map<string, Map<string, Stored>>(ENTITIES.map((e) => [e, new Map()]));
  let clock = Date.parse('2026-11-03T03:00:00Z');
  let n = 0;
  let writes = 0;
  const now = () => new Date((clock += 1000)).toISOString();
  const wait = () => new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 0));
  const table = (entity: string) => store.get(entity)!;
  const put = (entity: string, body: Rec, id = `${entity}-${++n}`): Stored => {
    const row = { id, body: { ...body, id }, updated_at: now() };
    table(entity).set(id, row);
    return row;
  };
  const rows = (entity: string, orderId?: string) =>
    [...table(entity).values()].filter((row) => orderId === undefined || refId(row.body.order) === orderId);

  for (const c of DEMO_CUSTOMERS) put('customer', c, String(c.id));
  for (const s of DEMO_SUPPLIERS) put('supplier', s, String(s.id));
  if (!options.empty) {
    for (const o of DEMO_ORDERS) {
      put('order', o.order, String(o.order.id));
      for (const l of o.lines) put('order_line', l, String(l.id));
      for (const p of o.goods) put('goods_line_price', p, String(p.id));
      for (const p of o.service) put('service_line_price', p, String(p.id));
      put('order_finance', o.finance, String(o.finance.id));
    }
  }

  const records = (orderId: string): OrderRecords => ({
    order: table('order').get(orderId) as unknown as Rec,
    lines: rows('order_line', orderId) as unknown as Rec[],
    goods_prices: rows('goods_line_price', orderId) as unknown as Rec[],
    service_prices: rows('service_line_price', orderId) as unknown as Rec[],
    finance: rows('order_finance', orderId) as unknown as Rec[],
  });

  // What compute_pl does when an order's pl_requested_at changes.
  const compute = (orderId: string) => {
    const out = runComputeOrderPl({ records: records(orderId), proposals: rows('purchase_proposal', orderId) as unknown as Rec[],
      existing: rows('order_pl', orderId) as unknown as Rec[], config, now: now() });
    if (out.skip) return;
    for (const entity of ['order_pl', 'order_pl_service', 'order_pl_goods'] as const) {
      const existing = rows(entity, orderId)[0];
      if (existing) Object.assign(existing.body, out[entity]);
      else put(entity, { order: orderId, ...out[entity] });
    }
    Object.assign(table('order').get(orderId)!.body, out.order);
  };
  for (const id of table('order').keys()) compute(id);

  let failAfter = options.failAfter;
  const failIfDue = () => {
    writes += 1;
    if (failAfter !== undefined && writes > failAfter) {
      failAfter = undefined;
      throw new OrdersError('NETWORK', null);
    }
  };
  const writer = {
    async create(entity: WriteEntity, body: Rec) { failIfDue(); return put(entity, body) as unknown as Rec; },
    async patch(entity: WriteEntity, id: string, changes: Rec) {
      failIfDue();
      const row = table(entity).get(id);
      if (!row) throw new OrdersError('ENTITY_RECORD_NOT_FOUND', null);
      Object.assign(row.body, changes);
      row.updated_at = now();
    },
    async remove(entity: WriteEntity, id: string) { failIfDue(); table(entity).delete(id); },
  };

  const official = (orderId: string) => ({
    order_pl: (rows('order_pl', orderId)[0]?.body ?? null),
    order_pl_service: (rows('order_pl_service', orderId)[0]?.body ?? null),
    order_pl_goods: (rows('order_pl_goods', orderId)[0]?.body ?? null),
  });
  const cfg = (): PlConfig => configFromRecords(config);
  const load = (id: string): LoadedOrder => {
    if (!table('order').has(id)) throw new OrdersError('ENTITY_RECORD_NOT_FOUND', null);
    const r = records(id);
    return { draft: draftFromRecords(r, cfg()), records: r, official: official(id),
      proposals: rows('purchase_proposal', id).map((row) => row.body) };
  };
  const access: Access = { ...ALL, ...options.access };

  const api: OrdersApi = {
    me: () => options.me ?? { id: 'u-am', name: 'Nguyễn Thuận' },
    async access() { await wait(); return access; },
    async config() { await wait(); return config; },
    async staff() { await wait(); return DEMO_STAFF; },
    async suppliers() { await wait(); return rows('supplier').map((row) => row.body); },
    async createSupplier(input) { await wait(); return put('supplier', { ...input, active: true }).body; },
    async list() {
      await wait();
      const out: OrderSummary[] = rows('order').map(({ id, body }) => {
        const pl = official(id).order_pl;
        const lines = rows('order_line', id).map((row) => row.body);
        const mine = access.seesPl ? null : lines.filter((line) =>
          lineGroup(String(line.item_type_code), cfg()) === (access.seesProposals ? 'goods' : 'service')).length;
        return { id, code: String(body.code ?? ''), customerName: String(body.customer_name ?? ''),
          customerCode: String(body.customer_code ?? ''), am: refId(body.am), sa: refId(body.sa),
          status: (body.status ?? 'draft') as OrderSummary['status'], stage: Number(body.stage ?? 1),
          createdAt: String(body.created_at ?? ''), revenue: access.seesPl ? Number(pl?.revenue ?? 0) : null,
          passed: access.seesPl ? (pl?.passed as boolean | undefined) ?? null : null, myLines: mine };
      });
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async load(id) { await wait(); return load(id); },
    async findCustomers(text) {
      await wait();
      const q = fold(text.trim());
      if (q.length < 2) return [];
      return rows('customer').map((row) => row.body)
        .filter((c) => [c.name, c.code, c.tax_code].some((v) => fold(v).includes(q)))
        .slice(0, 6)
        .map((c) => ({ id: String(c.id), code: String(c.code ?? ''), name: String(c.name ?? ''), taxCode: String(c.tax_code ?? ''),
          address: String(c.address ?? ''), tier: (c.tier ?? null) as never, record: c }));
    },
    async previousOrders(customerId, beforeId) {
      await wait();
      return rows('order').filter((row) => refId(row.body.customer) === customerId && row.id !== beforeId)
        .map((row) => ({ id: row.id, code: String(row.body.code ?? ''), finance: load(row.id).draft.finance, pl: official(row.id).order_pl }));
    },
    async save(draft: OrderDraft, saved, plConfig) {
      await wait();
      const created = await executeSavePlan(savePlan(draft, saved, plConfig), writer);
      const id = draft.order.id && !draft.order.id.startsWith('new:') ? draft.order.id : created['new:order'];
      table('order').get(id)!.body.created_at ??= now();
      await writer.patch('order', id, { pl_requested_at: now() });
      compute(id);
      return load(id);
    },
    async saveProposal(lineId, orderId, fields) {
      await wait();
      const existing = rows('purchase_proposal', orderId).find((row) => refId(row.body.order_line) === lineId);
      if (existing) Object.assign(existing.body, fields);
      const row = existing ?? put('purchase_proposal', { order_line: lineId, order: orderId, ...fields });
      compute(orderId);
      return row.body;
    },
    async deleteOrder(id) {
      await wait();
      for (const entity of ENTITIES) for (const row of rows(entity, id)) table(entity).delete(row.id);
      table('order').delete(id);
    },
  };
  return api;
}
