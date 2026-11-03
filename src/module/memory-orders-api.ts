// The orders in memory, for the demo and the screen tests. Records have AgentFlow's shape ({ id, body, updated_at }),
// saving runs the real save plan, and setting pl_requested_at runs the same computation compute_pl runs.
import { byNewest, contractBody, contractFromRecord, nextVersion } from '../contract/records';
import { isSigningField } from '../contract/rules';
import { statusFor, needsReason } from '../flow/actions';
import { runAdvance } from '../flow/code-entry';
import { TASKS, type TaskRole } from '../flow/tasks';
import { runComputeOrderPl } from '../order/code-entry';
import { draftFromRecords, lineGroup, refId } from '../order/records';
import type { OrderDraft, OrderRecords, Rec } from '../order/types';
import { configFromRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import type { PlConfig } from '../pl/types';
import { DEMO_CUSTOMERS, DEMO_ORDERS, DEMO_STAFF, DEMO_SUPPLIERS, recordsFromConfig } from './demo-data.js';
import { OrdersError, type Access, type LoadedOrder, type OrderEvent, type OrderSummary, type OrderTask, type OrdersApi, type Person,
  type WorkItem } from './orders-api.js';
import { executeSavePlan, savePlan, type WriteEntity } from './save-plan.js';

type Stored = { id: string; body: Rec; updated_at: string };
const ENTITIES = ['contract', 'order', 'order_line', 'goods_line_price', 'service_line_price', 'order_finance', 'purchase_proposal',
  'order_pl', 'order_pl_service', 'order_pl_goods', 'order_task', 'order_event', 'customer', 'supplier'] as const;
const TASK_VALUES = ['status', 'outcome', 'reason', 'opened_at', 'due_at', 'finished_at', 'due_state', 'late_days'];
const ALL_ROLES: TaskRole[] = ['am', 'sa', 'tm', 'sd', 'proc', 'acc'];

export interface MemoryOptions {
  empty?: boolean;
  /** The next save fails once, after this many writes (Review Focus 1). */
  failAfter?: number;
  access?: Partial<Access>;
  me?: Person;
  delayMs?: number;
  /** compute_pl runs this long after pl_requested_at changes, as a trigger does (0: at once). */
  computeDelayMs?: number;
  /** The task roles this person is in (My work offers them the open tasks of these roles). */
  roles?: TaskRole[];
  /** Uploads are refused as AgentFlow refuses them for an installed app (F-25). */
  refuseUploads?: boolean;
}

const ALL: Access = { seesPl: true, seesGoodsPrices: true, seesServicePrices: true, seesProposals: false, seesPlService: true,
  seesPlGoods: true, seesContracts: true, canCreateOrder: true, isAdmin: false };

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

  // What the flow triggers do after a write: init_order_tasks, advance_order (until a run changes nothing, as the
  // trigger on its own writes would end), compute_pl when advance asks for one more P&L.
  const reconcile = (orderId: string) => {
    for (let pass = 0; pass < 8; pass++) {
      const order = table('order').get(orderId);
      if (!order) return;
      const out = runAdvance({ order: order as unknown as Rec, tasks: rows('order_task', orderId) as unknown as Rec[],
        pl: rows('order_pl', orderId) as unknown as Rec[], lines: rows('order_line', orderId) as unknown as Rec[],
        goods_prices: rows('goods_line_price', orderId) as unknown as Rec[], service_prices: rows('service_line_price', orderId) as unknown as Rec[],
        finance: rows('order_finance', orderId) as unknown as Rec[], contracts: rows('contract', orderId) as unknown as Rec[], config, now: now() });
      for (const item of out.create_list) put('order_task', item as Rec);
      for (const item of out.update_list) {
        const row = table('order_task').get(String(item.id));
        // Like the update step's expect: a task that has moved on since it was read is left as it is.
        if (!row || row.body.status !== item.expect_status) continue;
        for (const key of TASK_VALUES) row.body[key] = item[key];
        row.updated_at = now();
      }
      const asked = out.order.pl_requested_at;
      if (out.order_changed) Object.assign(order.body, out.order_fields, out.status_changed ? { status: out.order_status } : {});
      for (const e of out.event_list) put('order_event', { order: orderId, task: e.task_id, task_code: e.task_code, role: e.role, action: e.action, note: e.note, at: e.at, warnings: [] });
      if (asked) compute(orderId);
      if (!out.create_list.length && !out.update_list.length && !out.order_changed && !out.event_list.length) return;
    }
  };
  for (const [id, row] of table('order')) if (row.body.status === 'draft') reconcile(id);

  // Uploaded files by attachment id, and the download link made for each (once).
  const files = new Map<string, File>();
  const links = new Map<string, string | null>();

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

  const who = (): Person => options.me ?? { id: 'u-am', name: 'Nguyễn Thuận' };
  const taskViews = (orderId: string): OrderTask[] => rows('order_task', orderId).map(({ id, body }): OrderTask => ({ id, order: orderId,
    task_code: body.task_code as OrderTask['task_code'], stage: Number(body.stage ?? 0), role: body.role as OrderTask['role'],
    status: body.status as OrderTask['status'], outcome: (body.outcome ?? null) as OrderTask['outcome'], reason: String(body.reason ?? ''),
    opened_at: (body.opened_at ?? null) as string | null, due_at: (body.due_at ?? null) as string | null,
    done_at: (body.finished_at ?? null) as string | null, sla_days: (body.sla_days ?? null) as number | null,
    due_state: (body.due_state ?? null) as string | null, late_days: (body.late_days ?? null) as number | null,
    claimedBy: refId(body.claimed_by) })).sort((a, b) => TASKS.findIndex((t) => t.code === a.task_code) - TASKS.findIndex((t) => t.code === b.task_code));

  const api: OrdersApi = {
    me: who,
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
      const fresh = !table('order').get(id)!.body.created_at;
      table('order').get(id)!.body.created_at ??= now();
      await writer.patch('order', id, { pl_requested_at: now() });
      if (options.computeDelayMs) setTimeout(() => compute(id), options.computeDelayMs);
      else compute(id);
      if (fresh) reconcile(id);
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
    async tasks(orderId) {
      await wait();
      return taskViews(orderId);
    },
    async events(orderId) {
      await wait();
      return rows('order_event', orderId).map(({ id, body }): OrderEvent => ({ id, order: orderId, task_code: (body.task_code as string | null) ?? null,
        at: String(body.at ?? ''), actor: refId(body.actor), role: (body.role as string | null) ?? null, action: String(body.action),
        note: String(body.note ?? ''), reason: String(body.reason ?? ''), warnings: (body.warnings ?? []) as OrderEvent['warnings'] }))
        .sort((a, b) => a.at.localeCompare(b.at));
    },
    async act(task, outcome, reason, warnings) {
      await wait();
      const row = table('order_task').get(task.id);
      const me = who().id;
      // The refusals the server gives: the stage model, the outcome rules and the work claim (plan 03, order_task).
      if (!row || row.body.status !== 'open') throw new OrdersError('STAGE_TRANSITION_NOT_ALLOWED', 'Task không còn chờ làm', {}, 422);
      if (!TASKS.find((t) => t.code === task.task_code)!.outcomes.includes(outcome)) throw new OrdersError('ENTITY_VALIDATION_RULE_FAILED', 'Kết quả không hợp lệ cho task này', {}, 422);
      if (needsReason(outcome) && !reason.trim()) throw new OrdersError('ENTITY_VALIDATION_RULE_FAILED', 'Trả lại hoặc yêu cầu sửa phải có lý do', {}, 422);
      if (row.body.claimed_by && row.body.claimed_by !== me) throw new OrdersError('WORK_NOT_CLAIMANT', null, {}, 403);
      Object.assign(row.body, { claimed_by: me, status: statusFor(outcome), outcome, reason });
      row.updated_at = now();
      const orderId = refId(row.body.order)!;
      const log = { order: orderId, task: row.id, task_code: row.body.task_code, role: row.body.role, actor: me, at: now() };
      put('order_event', { ...log, action: outcome, reason, note: '', warnings: [] });
      if (warnings.length) put('order_event', { ...log, action: 'ignored_warnings', reason: '', note: '', warnings });
      reconcile(orderId);
    },
    async myWork() {
      await wait();
      const me = who().id;
      const roles = options.roles ?? ALL_ROLES;
      const items: WorkItem[] = [];
      for (const orderId of table('order').keys()) {
        const order = table('order').get(orderId)!.body;
        for (const task of taskViews(orderId)) {
          if (task.status !== 'open') continue;
          const mine = task.claimedBy === me;
          if (!mine && !(task.claimedBy === null && roles.includes(task.role))) continue;
          items.push({ task, orderCode: String(order.code ?? ''), customerName: String(order.customer_name ?? ''), mine });
        }
      }
      return items.sort((a, b) => Number(b.mine) - Number(a.mine));
    },
    async task(id) {
      await wait();
      const row = table('order_task').get(id);
      return row ? taskViews(refId(row.body.order)!).find((t) => t.id === id) ?? null : null;
    },
    async logEvent(orderId, event) {
      await wait();
      put('order_event', { order: orderId, task: null, task_code: null, role: null, actor: who().id, at: now(), note: '', reason: '', warnings: [], ...event });
    },
    async actionable(orderId) {
      return new Set((await api.myWork()).filter((w) => w.task.order === orderId).map((w) => w.task.id));
    },
    async contracts(orderId) {
      await wait();
      return rows('contract', orderId).map((row) => {
        const c = contractFromRecord(row);
        return { ...c, file_name: c.file ? files.get(c.file)?.name ?? null : null };
      }).sort(byNewest);
    },
    async uploadContract(orderId, input) {
      await wait();
      if (options.refuseUploads) throw new OrdersError('UPLOAD_NOT_ALLOWED', null, {}, 403);
      const id = `att-${++n}`;
      files.set(id, input.file);
      const version = nextVersion(rows('contract', orderId).map(contractFromRecord), input.party, input.supplier, input.step);
      const row = put('contract', contractBody(orderId, input, id, who().id, now(), version));
      reconcile(orderId);
      return { ...contractFromRecord(row), file_name: input.file.name };
    },
    async saveSigning(orderId, fields) {
      await wait();
      if (!Object.keys(fields).every(isSigningField)) throw new OrdersError('NOT_SIGNING_FIELD', null);
      const order = table('order').get(orderId);
      if (!order) throw new OrdersError('ENTITY_RECORD_NOT_FOUND', null, {}, 404);
      // The rule on order: signed is signed (signing_fields_locked_after_signing).
      if (order.body.contract_signed === true) throw new OrdersError('ENTITY_VALIDATION_RULE_FAILED', 'Hợp đồng khách hàng đã ký — thông tin ký không sửa được', {}, 422);
      Object.assign(order.body, fields);
      order.updated_at = now();
    },
    contractFileUrl(contract) {
      if (!contract.file || !files.has(contract.file)) return null;
      if (!links.has(contract.file)) {
        links.set(contract.file, typeof URL.createObjectURL === 'function' ? URL.createObjectURL(files.get(contract.file)!) : null);
      }
      return links.get(contract.file)!;
    },
    async closeLost(orderId, reason) {
      await wait();
      const order = table('order').get(orderId);
      if (!order) throw new OrdersError('ENTITY_RECORD_NOT_FOUND', null, {}, 404);
      if (!reason.trim()) throw new OrdersError('STAGE_TRANSITION_NOT_ALLOWED', 'Cần ghi lý do Close-lost', {}, 422);
      if (order.body.contract_signed === true) throw new OrdersError('ENTITY_VALIDATION_RULE_FAILED', 'Đã ký HĐ khách hàng — không Close-lost được', {}, 422);
      Object.assign(order.body, { status: 'close_lost', close_reason: reason });
      order.updated_at = now();
      put('order_event', { order: orderId, task: null, task_code: null, role: null, actor: who().id, at: now(), action: 'close_lost', reason, note: '', warnings: [] });
      put('order_event', { order: orderId, task: null, task_code: null, role: null, at: now(), action: 'close_lost_processed', reason, note: '', warnings: [] });
      reconcile(orderId);
    },
  };
  return api;
}
