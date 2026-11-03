// The orders over AgentFlow's published record operations, through the host's client, as the signed-in person.
import { AgentFlowError, getAppObjects, ok, type AppHost } from '@reflexify/agentflow-sdk';
import { draftFromRecords, fieldsOf, lineGroup, refId } from '../order/records';
import type { OrderRecords, Rec } from '../order/types';
import { configFromRecords, type ConfigRecords } from '../pl/config-records';
import { probeAccess } from './access.js';
import { OrdersError, type Access, type LoadedOrder, type OrderSummary, type OrdersApi, type StaffMember } from './orders-api.js';
import { executeSavePlan, isNew, NEW_ORDER, savePlan, type Writer } from './save-plan.js';

type Filter = { field: string; op: string; value?: unknown };
const CONFIG_KEYS = ['item_type', 'contract_type_rate', 'fin_cost_tier', 'vat_rate', 'pl_setting', 'task_sla', 'deal_stage_weight'] as const;

function toOrdersError(error: unknown): OrdersError {
  if (error instanceof OrdersError) return error;
  if (!(error instanceof AgentFlowError)) return new OrdersError('NETWORK', null);
  // A field's own message is the most precise; a refusal's detail starts with its code, which people do not read.
  const field = (error.fieldErrors?.[0] as { message?: unknown } | undefined)?.message;
  const said = typeof field === 'string' ? field : error.detail ?? null;
  return new OrdersError(error.code, said ? said.replace(/^[A-Z][A-Z0-9_]+:\s*/, '') : null, {}, error.status);
}

async function call<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  try {
    return await ok(request);
  } catch (error) {
    throw toOrdersError(error);
  }
}

// 403: no grant for it; 404: nothing the person may read. Either way the screen shows less, not a failure.
const NOT_FOR_THEM = (error: unknown) => error instanceof OrdersError && (error.status === 403 || error.status === 404
  || /^(FORBIDDEN|HTTP_403|HTTP_404|ENTITY_NOT_FOUND|ENTITY_RECORD_NOT_FOUND|.*_FORBIDDEN|.*_DENIED)$/.test(error.code));

export function createHttpOrdersApi(host: Pick<AppHost, 'api' | 'context'>): OrdersApi & { canRead(entity: string): Promise<boolean> } {
  const api = host.api;
  const objects = getAppObjects(api);
  // Each record's updated_at as last read, for the next PATCH (a stale one is 409 STALE_VERSION).
  const versions = new Map<string, string>();
  // Each record's fields as last read: a stale write retries only when the fields it changes are still as read.
  const snapshots = new Map<string, Rec>();

  async function entityId(key: string): Promise<string> {
    // A failed load is not kept, so the next call asks again and Try again can recover.
    await objects.load().catch((error: unknown) => {
      throw toOrdersError(error);
    });
    const id = objects.id(`entity:${key}`);
    if (!id) throw new OrdersError('NOT_INSTALLED', `entity:${key}`);
    return id;
  }

  const remember = (record: { id: string; updated_at?: string; body?: unknown }) => {
    if (record.updated_at) versions.set(record.id, record.updated_at);
    if (record.body && typeof record.body === 'object') snapshots.set(record.id, { ...(record.body as Rec) });
    return record;
  };

  async function query(key: string, filters: Filter[] = [], options: { sort?: string; dir?: 'asc' | 'desc'; q?: string; limit?: number } = {}): Promise<Rec[]> {
    const entity_id = await entityId(key);
    const items: Rec[] = [];
    let cursor: string | null = null;
    do {
      const page: { items: unknown[]; next_cursor: string | null } = await call(api.POST('/entities/{entity_id}/records/query', {
        params: { path: { entity_id } },
        body: { filter: { field_filters: filters, ...(options.q ? { q: options.q } : {}) }, sort: options.sort ?? 'created_at',
          dir: options.dir ?? 'desc', limit: options.limit ?? 200, cursor } as never,
      }) as never);
      items.push(...(page.items as { id: string; updated_at?: string }[]).map(remember) as unknown as Rec[]);
      cursor = options.limit ? null : page.next_cursor;
    } while (cursor);
    return items;
  }

  const tolerant = (promise: Promise<Rec[]>) => promise.catch((error: unknown) => {
    if (NOT_FOR_THEM(error)) return [] as Rec[];
    throw error;
  });
  const ofOrder = (key: string, orderId: string) => tolerant(query(key, [{ field: 'order', op: 'eq', value: orderId }]));

  async function getRecord(key: string, id: string): Promise<Rec> {
    const entity_id = await entityId(key);
    return remember(await call(api.GET('/entities/{entity_id}/records/{record_id}', { params: { path: { entity_id, record_id: id } } }) as never)) as unknown as Rec;
  }

  async function patch(key: string, id: string, changes: Rec, retried = false): Promise<void> {
    const entity_id = await entityId(key);
    try {
      remember(await call(api.PATCH('/entities/{entity_id}/records/{record_id}', {
        params: { path: { entity_id, record_id: id } }, body: { changes, expected_updated_at: versions.get(id) ?? '' },
      }) as never));
    } catch (error) {
      // Another writer (compute_pl writing the order's code) moved updated_at on: read the record again, write once more.
      if (!retried && error instanceof OrdersError && error.code === 'STALE_VERSION') {
        const before = snapshots.get(id) ?? {};
        const now = fieldsOf(await getRecord(key, id));
        const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        // Someone else changed a field this write changes too: report it rather than overwrite it.
        if (Object.keys(changes).some((k) => !same(now[k], before[k]) && !same(now[k], changes[k]))) throw new OrdersError('CONFLICT', null, {}, 409);
        return patch(key, id, changes, true);
      }
      throw error;
    }
  }

  const writer: Writer = {
    async create(key, body) {
      const entity_id = await entityId(key);
      return remember(await call(api.POST('/entities/{entity_id}/records', { params: { path: { entity_id } }, body: { form_payload: body } }) as never)) as unknown as Rec;
    },
    patch: (key, id, changes) => patch(key, id, changes),
    async remove(key, id) {
      const entity_id = await entityId(key);
      await call(api.DELETE('/entities/{entity_id}/records/{record_id}', {
        params: { path: { entity_id, record_id: id }, query: { expected_updated_at: versions.get(id) ?? '' } } as never,
      }) as never);
    },
  };

  let accessOnce: Promise<Access> | null = null;
  let configOnce: Promise<ConfigRecords> | null = null;
  let staffOnce: Promise<StaffMember[]> | null = null;

  const self: OrdersApi & { canRead(entity: string): Promise<boolean> } = {
    me: () => ({ id: host.context.person.id, name: host.context.person.name ?? '' }),
    async canRead(key: string) {
      try {
        await query(key, [], { limit: 1 });
        return true;
      } catch (error) {
        if (NOT_FOR_THEM(error)) return false;
        throw error;
      }
    },
    access: () => {
      accessOnce ??= probeAccess(self).catch((error: unknown) => {
        accessOnce = null;
        throw error;
      });
      return accessOnce;
    },
    config: () => {
      configOnce ??= Promise.all(CONFIG_KEYS.map((key) => query(key, [], { sort: 'created_at', dir: 'asc' }).then((rows) => rows.map(fieldsOf))))
        .then((lists) => Object.fromEntries(CONFIG_KEYS.map((key, i) => [key, lists[i]])) as unknown as ConfigRecords)
        .catch((error: unknown) => {
          configOnce = null;
          throw error;
        });
      return configOnce;
    },
    staff: () => {
      staffOnce ??= tolerant(query('staff', [], { sort: 'created_at', dir: 'asc' })).then((rows) => rows.map(fieldsOf).map((s) => ({
        id: String(s.id), code: String(s.code ?? ''), name: String(s.name ?? s.code ?? ''), user: refId(s.user),
        team: String(s.team ?? 'other'), active: s.active !== false,
      })));
      return staffOnce;
    },
    async suppliers() {
      return (await tolerant(query('supplier', [], { sort: 'created_at', dir: 'asc' }))).map(fieldsOf);
    },
    async createSupplier(input: { name: string; contact_name?: string; phone?: string }) {
      return fieldsOf(await writer.create('supplier' as never, input));
    },
    async list(): Promise<OrderSummary[]> {
      const [orders, access] = await Promise.all([query('order'), self.access()]);
      const pls = access.seesPl ? (await tolerant(query('order_pl'))).map(fieldsOf) : [];
      const plOf = new Map(pls.map((pl) => [refId(pl.order) ?? '', pl]));
      // Purchasing and Technical see how many lines are theirs instead of money (FR-1.1).
      let mine: Map<string, number> | null = null;
      if (!access.seesPl) {
        const config = configFromRecords(await self.config());
        const want = access.seesProposals || access.seesGoodsPrices ? 'goods' : 'service';
        mine = new Map();
        for (const line of (await tolerant(query('order_line'))).map(fieldsOf)) {
          if (lineGroup(String(line.item_type_code), config) !== want) continue;
          const order = refId(line.order) ?? '';
          mine.set(order, (mine.get(order) ?? 0) + 1);
        }
      }
      return orders.map((record) => {
        const o = fieldsOf(record);
        const id = String(o.id);
        const pl = plOf.get(id);
        return { id, code: String(o.code ?? ''), customerName: String(o.customer_name ?? ''), customerCode: String(o.customer_code ?? ''),
          am: refId(o.am), sa: refId(o.sa), status: (o.status ?? 'draft') as OrderSummary['status'], stage: Number(o.stage ?? 1),
          createdAt: String(o.created_at ?? (record as Rec).created_at ?? ''),
          revenue: access.seesPl ? (typeof pl?.revenue === 'number' ? pl.revenue : null) : null,
          passed: access.seesPl && typeof pl?.passed === 'boolean' ? pl.passed : null,
          myLines: mine ? mine.get(id) ?? 0 : null };
      });
    },
    async load(id: string): Promise<LoadedOrder> {
      const access = await self.access();
      const none = Promise.resolve([] as Rec[]);
      const [order, lines, goods, service, finance, pl, plService, plGoods, proposals, config] = await Promise.all([
        getRecord('order', id), ofOrder('order_line', id),
        access.seesGoodsPrices ? ofOrder('goods_line_price', id) : none, access.seesServicePrices ? ofOrder('service_line_price', id) : none,
        access.seesPl ? ofOrder('order_finance', id) : none, access.seesPl ? ofOrder('order_pl', id) : none,
        access.seesPlService ? ofOrder('order_pl_service', id) : none, access.seesPlGoods ? ofOrder('order_pl_goods', id) : none,
        access.seesProposals ? ofOrder('purchase_proposal', id) : none, self.config(),
      ]);
      const records: OrderRecords = { order, lines, goods_prices: goods, service_prices: service, finance };
      const first = (rows: Rec[]) => (rows[0] ? fieldsOf(rows[0]) : null);
      return { draft: draftFromRecords(records, configFromRecords(config)), records,
        official: { order_pl: first(pl), order_pl_service: first(plService), order_pl_goods: first(plGoods) },
        proposals: proposals.map(fieldsOf) };
    },
    async findCustomers(text: string) {
      if (text.trim().length < 2) return [];
      const rows = await tolerant(query('customer', [], { q: text.trim(), limit: 6 }));
      return rows.map(fieldsOf).map((c) => ({ id: String(c.id), code: String(c.code ?? ''), name: String(c.name ?? ''),
        taxCode: String(c.tax_code ?? ''), address: String(c.address ?? ''), tier: (c.tier ?? null) as never, record: c }));
    },
    async previousOrders(customerId: string, beforeId: string | null) {
      const orders = (await tolerant(query('order', [{ field: 'customer', op: 'eq', value: customerId }]))).map(fieldsOf)
        .filter((o) => o.id !== beforeId);
      return Promise.all(orders.map(async (o) => {
        const id = String(o.id);
        const [finance, pl] = await Promise.all([ofOrder('order_finance', id), ofOrder('order_pl', id)]);
        const f = finance[0] ? fieldsOf(finance[0]) : {};
        const num = (v: unknown) => (typeof v === 'number' ? v : null);
        return { id, code: String(o.code ?? ''), finance: { sales_cost: num(f.sales_cost), prev_sales_cost: num(f.prev_sales_cost),
          prev_revenue: num(f.prev_revenue), prev_net_profit: num(f.prev_net_profit) }, pl: pl[0] ? fieldsOf(pl[0]) : null };
      }));
    },
    async save(draft, saved, config) {
      const created = await executeSavePlan(savePlan(draft, saved, config), writer);
      const id = isNew(draft.order.id) ? created[NEW_ORDER] : draft.order.id!;
      try {
        // compute_pl's trigger starts on this change (plan 02): the screens never start the workflow themselves.
        await patch('order', id, { pl_requested_at: new Date().toISOString() });
      } catch (error) {
        const known = toOrdersError(error);
        throw new OrdersError(known.code, known.reason, created);
      }
      return self.load(id);
    },
    async saveProposal(lineId: string, orderId: string, fields: { proposed_cost: number | null; proposed_supplier: string | null; note: string }) {
      const existing = (await query('purchase_proposal', [{ field: 'order_line', op: 'eq', value: lineId }]))[0];
      if (existing) {
        await patch('purchase_proposal', String(existing.id), fields);
        return fieldsOf(await getRecord('purchase_proposal', String(existing.id)));
      }
      return fieldsOf(await writer.create('purchase_proposal' as never, { order_line: lineId, order: orderId, ...fields }));
    },
    async deleteOrder(id: string) {
      await getRecord('order', id);
      await writer.remove('order', id);
    },
  };
  return self;
}
