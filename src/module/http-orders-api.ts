// The orders over AgentFlow's published record operations, through the host's client, as the signed-in person.
import { AgentFlowError, getAppObjects, ok, type AppHost } from '@reflexify/agentflow-sdk';
import { byNewest, contractBody, contractFromRecord, nextVersion } from '../contract/records';
import { statusFor } from '../flow/actions';
import { TASKS } from '../flow/tasks';
import { draftFromRecords, fieldsOf, lineGroup, refId } from '../order/records';
import type { OrderRecords, Rec } from '../order/types';
import { configFromRecords, parseNumber, type ConfigRecords } from '../pl/config-records';
import { parseTime } from '../pl/time';
import { probeAccess } from './access.js';
import { OrdersError, type Access, type LoadedOrder, type OrderEvent, type OrderSummary, type OrderTask, type OrdersApi, type StaffMember,
  type WorkItem } from './orders-api.js';
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

const optStr = (value: unknown) => (value == null || value === '' ? null : String(value));
const byFlow = (a: OrderTask, b: OrderTask) => TASKS.findIndex((t) => t.code === a.task_code) - TASKS.findIndex((t) => t.code === b.task_code);

function taskOf(record: Rec): OrderTask {
  const t = fieldsOf(record);
  return { id: String(t.id), order: refId(t.order) ?? '', task_code: t.task_code as OrderTask['task_code'], stage: parseNumber(t.stage) ?? 0,
    role: t.role as OrderTask['role'], status: (t.status ?? 'blocked') as OrderTask['status'], outcome: optStr(t.outcome) as OrderTask['outcome'],
    reason: String(t.reason ?? ''), opened_at: optStr(t.opened_at), due_at: optStr(t.due_at), done_at: optStr(t.finished_at),
    sla_days: parseNumber(t.sla_days) ?? null, due_state: optStr(t.due_state), late_days: parseNumber(t.late_days) ?? null,
    claimedBy: refId(t.claimed_by) };
}

export function createHttpOrdersApi(host: Pick<AppHost, 'api' | 'context'> & Partial<Pick<AppHost, 'apiUrl'>>): OrdersApi & { canRead(entity: string): Promise<boolean> } {
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
    async tasks(orderId: string) {
      return (await ofOrder('order_task', orderId)).map(taskOf).sort(byFlow);
    },
    async events(orderId: string) {
      return (await ofOrder('order_event', orderId)).map(fieldsOf).map((e): OrderEvent => ({ id: String(e.id), order: orderId,
        task_code: optStr(e.task_code), at: String(e.at ?? ''), actor: refId(e.actor), role: optStr(e.role), action: String(e.action ?? ''),
        note: String(e.note ?? ''), reason: String(e.reason ?? ''), warnings: (Array.isArray(e.warnings) ? e.warnings : []) as OrderEvent['warnings'] }))
        // By time, not by text: client and workflow write times in different forms.
        .sort((a, b) => parseTime(a.at) - parseTime(b.at));
    },
    async act(task, outcome, reason, warnings) {
      const me = self.me().id;
      // The task is offered to a group until somebody takes it; only its holder may finish it (WORK_NOT_CLAIMANT).
      if (task.claimedBy !== me) {
        const entity_id = await entityId('order_task');
        await call(api.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id, record_id: task.id } } } as never) as never);
      }
      await getRecord('order_task', task.id);
      await patch('order_task', task.id, { status: statusFor(outcome), outcome, reason });
      const log = { order: task.order, task: task.id, task_code: task.task_code, role: task.role, actor: me, at: new Date().toISOString() };
      try {
        await writer.create('order_event' as never, { ...log, action: outcome, reason });
        if (warnings.length) await writer.create('order_event' as never, { ...log, action: 'ignored_warnings', warnings });
      } catch (error) {
        // The task is finished: only its log line is missing, which the screen says instead of calling the action failed.
        const known = toOrdersError(error);
        throw new OrdersError('EVENT_NOT_LOGGED', known.reason, {}, known.status);
      }
    },
    async task(id: string) {
      try {
        return taskOf(await getRecord('order_task', id));
      } catch (error) {
        if (NOT_FOR_THEM(toOrdersError(error))) return null;
        throw error;
      }
    },
    async contracts(orderId: string) {
      const list = (await ofOrder('contract', orderId)).map(contractFromRecord).sort(byNewest);
      // The record holds only the file's id (F-26): its name comes from the file's own metadata.
      await Promise.all(list.map(async (c) => {
        if (!c.file) { c.file_name = null; return; }
        try {
          const meta = await call(api.GET('/attachments/{attachment_id}', { params: { path: { attachment_id: c.file } } }) as never) as { original_filename?: string };
          c.file_name = meta.original_filename ?? null;
        } catch {
          c.file_name = null;
        }
      }));
      return list;
    },
    async uploadContract(orderId, input) {
      const form = new FormData();
      form.append('file', input.file, input.file.name);
      let meta: { id: string; original_filename?: string };
      try {
        meta = await call(api.POST('/attachments', { body: form as never, bodySerializer: (body: unknown) => body as FormData } as never) as never);
      } catch (error) {
        const known = toOrdersError(error);
        // F-25: AgentFlow does not let an installed app upload files.
        if (known.code === 'APP_CEILING_DENIED') throw new OrdersError('UPLOAD_NOT_ALLOWED', known.reason, {}, known.status);
        throw new OrdersError('UPLOAD_FAILED', known.reason, {}, known.status);
      }
      const existing = (await ofOrder('contract', orderId)).map(contractFromRecord);
      const version = nextVersion(existing, input.party, input.supplier, input.step);
      const made = contractFromRecord(await writer.create('contract' as never,
        contractBody(orderId, input, meta.id, self.me().id, new Date().toISOString(), version)));
      return { ...made, file_name: meta.original_filename ?? input.file.name };
    },
    contractFileUrl(contract) {
      return contract.file && host.apiUrl ? host.apiUrl(`/attachments/${encodeURIComponent(contract.file)}/download`) : null;
    },
    async logEvent(orderId: string, event) {
      await writer.create('order_event' as never, { order: orderId, ...event, actor: self.me().id, at: new Date().toISOString() });
    },
    async myWork() {
      const entity = await entityId('order_task');
      const items: WorkItem[] = [];
      const seen = new Set<string>();
      const orders = new Map<string, Rec>();
      for (const view of ['mine', 'claimable'] as const) {
        let listed: unknown;
        try {
          listed = await call(api.GET('/work' as never, { params: { query: { view } } } as never) as never);
        } catch (error) {
          if (NOT_FOR_THEM(error)) continue;
          throw error;
        }
        const list = (Array.isArray(listed) ? listed : (listed as { items?: unknown[] } | null)?.items ?? []) as
          { entity_id?: string; id?: string; record_id?: string }[];
        for (const row of list) {
          const id = row.record_id ?? row.id;
          if (row.entity_id !== entity || !id || seen.has(id)) continue;
          const task = taskOf(await getRecord('order_task', id));
          if (task.status !== 'open') continue;
          seen.add(id);
          if (!orders.has(task.order)) {
            try {
              orders.set(task.order, fieldsOf(await getRecord('order', task.order)));
            } catch (error) {
              // Offered to the whole group but on an order this person may not read: not theirs to take.
              if (NOT_FOR_THEM(error)) continue;
              throw error;
            }
          }
          const order = orders.get(task.order)!;
          items.push({ task, orderCode: String(order.code ?? ''), customerName: String(order.customer_name ?? ''), mine: view === 'mine' });
        }
      }
      return items;
    },
    async actionable(orderId: string) {
      const ids = new Set((await ofOrder('order_task', orderId)).map((t) => String(t.id)));
      const entity = await entityId('order_task');
      const mine = new Set<string>();
      for (const view of ['mine', 'claimable'] as const) {
        let listed: unknown;
        try {
          listed = await call(api.GET('/work' as never, { params: { query: { view } } } as never) as never);
        } catch (error) {
          if (NOT_FOR_THEM(error)) continue;
          throw error;
        }
        const list = (Array.isArray(listed) ? listed : (listed as { items?: unknown[] } | null)?.items ?? []) as
          { entity_id?: string; id?: string; record_id?: string }[];
        for (const row of list) {
          const id = row.record_id ?? row.id;
          if (row.entity_id === entity && id && ids.has(id)) mine.add(id);
        }
      }
      return mine;
    },
    async closeLost(orderId: string, reason: string) {
      await getRecord('order', orderId);
      await patch('order', orderId, { status: 'close_lost', close_reason: reason });
      // The workflow logs its processing of it; the person's own line (who, and why) is written here, as for a return.
      try {
        await writer.create('order_event' as never, { order: orderId, action: 'close_lost', reason, actor: self.me().id, at: new Date().toISOString() });
      } catch (error) {
        const known = toOrdersError(error);
        throw new OrdersError('EVENT_NOT_LOGGED', known.reason, {}, known.status);
      }
    },
  };
  return self;
}
