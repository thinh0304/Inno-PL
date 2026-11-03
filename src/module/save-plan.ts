// Saving an order: the writes that take the saved records to the draft, in an order each write can run in
// (an order before its lines, a line before its price), and running them.
import { fieldsOf, lineGroup, refId } from '../order/records';
import type { LineDraft, OrderDraft, OrderRecords, Rec } from '../order/types';
import type { PlConfig } from '../pl/types';
import { OrdersError } from './orders-api.js';

export type WriteEntity = 'order' | 'order_line' | 'goods_line_price' | 'service_line_price' | 'order_finance';
export type SaveOp =
  | { kind: 'create'; entity: WriteEntity; key: string; body: Rec }
  | { kind: 'patch'; entity: WriteEntity; id: string; changes: Rec }
  | { kind: 'delete'; entity: WriteEntity; id: string };

/** A key standing for a record a save has not created yet: `new:order`, or a new line's own `new:…` id. */
export const NEW_ORDER = 'new:order';
export const isNew = (id: string | undefined) => !id || id.startsWith('new:');

// The order's fields a person writes; the rest (number, code, status, stage, has_goods, has_service) belong to
// AgentFlow and the workflows.
const ORDER_KEYS = ['customer', 'customer_name', 'customer_code', 'tax_code', 'address', 'contact_name', 'contact_phone',
  'contact_email', 'representative', 'representative_title', 'bank_account', 'bank_name', 'receiver_name', 'receiver_phone',
  'delivery_address', 'delivery_note', 'quote_date', 'quote_valid_until', 'exchange_rate', 'internal_contract_no',
  'customer_po_no', 'content', 'signed_on', 'am', 'sa', 'inside_sales', 'is_new_order', 'is_new_logo', 'prev_contract_no',
  'lead_source', 'customer_tier', 'debt_days', 'use_provision_fund', 'payment_count', 'customer_prepays', 'deploy_staff',
  'consult_staff', 'proposal', 'poc', 'contract_type_override', 'deal_stages'] as const;
const LINE_KEYS = ['line_no', 'item_type_code', 'co_cq', 'name', 'unit', 'quantity', 'months', 'sku', 'specs', 'start_date',
  'end_date', 'delivery_time', 'supplier_priority', 'end_user', 'note'] as const;
const PRICE_KEYS = ['unit_price', 'discount_pct', 'vat_rate', 'unit_cost', 'supplier'] as const;
const FINANCE_KEYS = ['sales_cost', 'prev_sales_cost', 'prev_revenue', 'prev_net_profit'] as const;

// An empty text is written as null; a list item's id (AgentFlow adds one) is not part of its value.
const toWrite = (value: unknown) => (value === '' || value === undefined ? null : value);
function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const { id: _id, ...rest } = item as Rec;
    // A member left empty and a member not stored at all are the same item.
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, toWrite(v)]).filter(([, v]) => v !== null)
      .sort(([a], [b]) => String(a).localeCompare(String(b))));
  });
  const v = toWrite(value);
  // A boolean left unset reads as false: writing false over nothing changes nothing.
  return v === false ? null : v;
}

function changes(keys: readonly string[], want: Rec, have: Rec | null): Rec {
  const out: Rec = {};
  for (const key of keys) {
    if (JSON.stringify(comparable(want[key])) !== JSON.stringify(comparable(have?.[key]))) out[key] = toWrite(want[key]);
  }
  return out;
}

const body = (keys: readonly string[], values: Rec): Rec =>
  Object.fromEntries(keys.map((key) => [key, toWrite(values[key])]).filter(([, value]) => value !== null));

const priceEntity = (line: LineDraft, config: PlConfig): WriteEntity =>
  lineGroup(line.item_type_code, config) === 'service' ? 'service_line_price' : 'goods_line_price';

export function savePlan(draft: OrderDraft, saved: OrderRecords | null, config: PlConfig): SaveOp[] {
  const ops: SaveOp[] = [];
  const order = draft.order as unknown as Rec;
  const orderId = isNew(draft.order.id) ? NEW_ORDER : draft.order.id!;

  if (orderId === NEW_ORDER) {
    // The create form takes no list field, so deal_stages follows in a patch.
    ops.push({ kind: 'create', entity: 'order', key: NEW_ORDER, body: body(ORDER_KEYS.filter((k) => k !== 'deal_stages'), order) });
    if (draft.order.deal_stages.length) ops.push({ kind: 'patch', entity: 'order', id: NEW_ORDER, changes: { deal_stages: draft.order.deal_stages } });
  } else {
    const diff = changes(ORDER_KEYS, order, saved ? fieldsOf(saved.order) : null);
    if (Object.keys(diff).length) ops.push({ kind: 'patch', entity: 'order', id: orderId, changes: diff });
  }

  const savedFinance = saved?.finance.map(fieldsOf)[0];
  const finance = draft.finance as unknown as Rec;
  if (savedFinance) {
    const diff = changes(FINANCE_KEYS, finance, savedFinance);
    if (Object.keys(diff).length) ops.push({ kind: 'patch', entity: 'order_finance', id: String(savedFinance.id), changes: diff });
  } else {
    ops.push({ kind: 'create', entity: 'order_finance', key: 'new:finance', body: { order: orderId, ...body(FINANCE_KEYS, finance) } });
  }

  const savedLines = new Map((saved?.lines ?? []).map(fieldsOf).map((line) => [String(line.id), line]));
  const byLine = (prices: Rec[] | undefined) => new Map((prices ?? []).map(fieldsOf).map((p) => [refId(p.order_line) ?? '', p]));
  const goods = byLine(saved?.goods_prices);
  const service = byLine(saved?.service_prices);

  const priceOps: SaveOp[] = [];
  for (const line of draft.lines) {
    const values = line as unknown as Rec;
    if (isNew(line.id) || !savedLines.has(line.id)) {
      ops.push({ kind: 'create', entity: 'order_line', key: line.id, body: { order: orderId, ...body(LINE_KEYS, values) } });
    } else {
      const diff = changes(LINE_KEYS, values, savedLines.get(line.id)!);
      if (Object.keys(diff).length) ops.push({ kind: 'patch', entity: 'order_line', id: line.id, changes: diff });
    }
    // The price lives in the entity of the line's purchase group; one left in the other entity is deleted.
    const target = priceEntity(line, config);
    const inTarget = (target === 'goods_line_price' ? goods : service).get(line.id);
    const inOther = (target === 'goods_line_price' ? service : goods).get(line.id);
    if (inOther) priceOps.push({ kind: 'delete', entity: target === 'goods_line_price' ? 'service_line_price' : 'goods_line_price', id: String(inOther.id) });
    const price = { order_line: line.id, order: orderId, ...(line.price as unknown as Rec) };
    if (inTarget) {
      const diff = changes(PRICE_KEYS, price, inTarget);
      if (Object.keys(diff).length) priceOps.push({ kind: 'patch', entity: target, id: String(inTarget.id), changes: diff });
    } else {
      priceOps.push({ kind: 'create', entity: target, key: `new:price:${line.id}`,
        body: { order_line: line.id, order: orderId, ...body(PRICE_KEYS, price) } });
    }
  }
  ops.push(...priceOps);

  // A removed line: its prices first (the line's delete would cascade to them anyway), then the line.
  const kept = new Set(draft.lines.map((line) => line.id));
  for (const id of savedLines.keys()) {
    if (kept.has(id)) continue;
    for (const [entity, prices] of [['goods_line_price', goods], ['service_line_price', service]] as const) {
      const price = prices.get(id);
      if (price) ops.push({ kind: 'delete', entity, id: String(price.id) });
    }
    ops.push({ kind: 'delete', entity: 'order_line', id });
  }
  return ops;
}

/** A blank line of the default item type, at the configured default VAT rate. */
export function newLine(id: string, lineNo: number, config: PlConfig): LineDraft {
  const vat = config.vatRates.find((rate) => rate.isDefault)?.rate ?? 0.08;
  return { id, line_no: lineNo, item_type_code: 'TB', co_cq: false, name: '', unit: '', quantity: 1, months: null, sku: '',
    specs: '', start_date: null, end_date: null, delivery_time: '', supplier_priority: '', end_user: '', note: '',
    price: { unit_price: null, discount_pct: null, vat_rate: vat, unit_cost: null, supplier: null } };
}

/** After a save that failed part way: the records it did create keep their ids, so Save again does not repeat them. */
export function applyCreatedIds(draft: OrderDraft, created: Record<string, string>): OrderDraft {
  return {
    ...draft,
    order: { ...draft.order, id: created[NEW_ORDER] ?? draft.order.id },
    lines: draft.lines.map((line) => ({ ...line, id: created[line.id] ?? line.id })),
  };
}

export interface Writer {
  create(entity: WriteEntity, body: Rec): Promise<Rec>;
  patch(entity: WriteEntity, id: string, changes: Rec): Promise<void>;
  remove(entity: WriteEntity, id: string): Promise<void>;
}

/** Runs the writes in order, putting real ids in place of temporary keys. Returns the ids it created, by key. */
export async function executeSavePlan(ops: SaveOp[], writer: Writer): Promise<Record<string, string>> {
  const created: Record<string, string> = {};
  const resolve = (value: unknown) => (typeof value === 'string' && created[value] ? created[value] : value);
  const resolved = (values: Rec) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, resolve(v)]));
  try {
    for (const op of ops) {
      if (op.kind === 'create') created[op.key] = String((await writer.create(op.entity, resolved(op.body))).id);
      else if (op.kind === 'patch') await writer.patch(op.entity, String(resolve(op.id)), resolved(op.changes));
      else await writer.remove(op.entity, String(resolve(op.id)));
    }
  } catch (error) {
    const known = error instanceof OrdersError ? error : new OrdersError('NETWORK', null);
    throw new OrdersError(known.code, known.reason, { ...known.created, ...created });
  }
  return created;
}

const DEAL_STAGES = ['opportunity', 'clarification', 'quotation', 'negotiation', 'close', 'contract'] as const;

/** A new order for `am`: a new order (BR-20), stage 1, the six deal stages without people yet. */
export function blankDraft(am: string | null): OrderDraft {
  return {
    order: { status: 'draft', stage: 1, customer: null, customer_name: '', customer_code: '', tax_code: '', address: '',
      contact_name: '', contact_phone: '', contact_email: '', representative: '', representative_title: '', bank_account: '',
      bank_name: '', receiver_name: '', receiver_phone: '', delivery_address: '', delivery_note: '', quote_date: null,
      quote_valid_until: null, exchange_rate: null, internal_contract_no: '', customer_po_no: '', content: '', signed_on: null,
      am, sa: null, inside_sales: null, is_new_order: true, is_new_logo: false, prev_contract_no: '', lead_source: null,
      customer_tier: null, debt_days: null, use_provision_fund: false, payment_count: null, customer_prepays: false,
      deploy_staff: null, consult_staff: null, proposal: false, poc: false, contract_type_override: null,
      deal_stages: DEAL_STAGES.map((stage) => ({ stage, weight: null, person: null })), has_goods: false, has_service: false },
    lines: [],
    finance: { sales_cost: null, prev_sales_cost: null, prev_revenue: null, prev_net_profit: null },
  };
}
