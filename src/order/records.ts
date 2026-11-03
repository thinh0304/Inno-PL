// An order's records → OrderDraft → the engine's PlOrderInput. The screens (plan 02b) and compute_pl both use it.
import { parseNumber } from '../pl/config-records';
import type { ContractType, CustomerTier, PlConfig, PlOrderInput, PurchaseGroup } from '../pl/types';
import type { FinanceFields, LineDraft, LinePrice, OrderDraft, OrderFields, OrderRecords, Rec } from './types';

// A record's fields may sit at its top level (list calls), or under body / fields.
function fieldsOf(record: unknown): Rec {
  const r = (record ?? {}) as Rec;
  const inner = (r.body ?? r.fields) as Rec | undefined;
  return inner && typeof inner === 'object' ? { id: r.id, ...inner } : r;
}

const str = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const optStr = (value: unknown) => (value == null || value === '' ? null : str(value));
const num = (value: unknown) => parseNumber(value) ?? null;
const bool = (value: unknown) => value === true || value === 'true';
// A reference reads as the id, or as an object carrying one.
const ref = (value: unknown) => (value && typeof value === 'object' ? optStr((value as Rec).id) : optStr(value));

function orderFields(r: Rec): OrderFields {
  const stages = Array.isArray(r.deal_stages) ? (r.deal_stages as Rec[]) : [];
  return {
    id: optStr(r.id) ?? undefined, number: optStr(r.number) ?? undefined, code: optStr(r.code) ?? undefined,
    status: (optStr(r.status) ?? 'draft') as OrderFields['status'], stage: num(r.stage) ?? 1, customer: ref(r.customer),
    customer_name: str(r.customer_name), customer_code: str(r.customer_code), tax_code: str(r.tax_code), address: str(r.address),
    contact_name: str(r.contact_name), contact_phone: str(r.contact_phone), contact_email: str(r.contact_email),
    representative: str(r.representative), representative_title: str(r.representative_title),
    bank_account: str(r.bank_account), bank_name: str(r.bank_name), receiver_name: str(r.receiver_name),
    receiver_phone: str(r.receiver_phone), delivery_address: str(r.delivery_address), delivery_note: str(r.delivery_note),
    quote_date: optStr(r.quote_date), quote_valid_until: optStr(r.quote_valid_until), exchange_rate: num(r.exchange_rate),
    internal_contract_no: str(r.internal_contract_no), customer_po_no: str(r.customer_po_no), content: str(r.content),
    signed_on: optStr(r.signed_on), am: ref(r.am), sa: ref(r.sa), inside_sales: ref(r.inside_sales),
    // "Có phải đơn hàng mới?" defaults to yes (BR-20).
    is_new_order: r.is_new_order == null ? true : bool(r.is_new_order), is_new_logo: bool(r.is_new_logo),
    prev_contract_no: str(r.prev_contract_no), lead_source: optStr(r.lead_source),
    customer_tier: optStr(r.customer_tier) as CustomerTier | null, debt_days: num(r.debt_days),
    use_provision_fund: bool(r.use_provision_fund), payment_count: num(r.payment_count), customer_prepays: bool(r.customer_prepays),
    deploy_staff: ref(r.deploy_staff), consult_staff: ref(r.consult_staff), proposal: bool(r.proposal), poc: bool(r.poc),
    contract_type_override: optStr(r.contract_type_override) as ContractType | null,
    deal_stages: stages.map((s) => ({ stage: str(s.stage) as OrderFields['deal_stages'][number]['stage'],
      weight: num(s.weight), person: optStr(s.person) })),
    has_goods: bool(r.has_goods), has_service: bool(r.has_service),
  };
}

function linePrice(r: Rec | undefined): LinePrice {
  if (!r) return { unit_price: null, discount_pct: null, vat_rate: null, unit_cost: null, supplier: null };
  return { id: optStr(r.id) ?? undefined, unit_price: num(r.unit_price), discount_pct: num(r.discount_pct),
    vat_rate: num(r.vat_rate), unit_cost: num(r.unit_cost), supplier: ref(r.supplier) };
}

function lineDraft(r: Rec, price: Rec | undefined): LineDraft {
  return {
    id: str(r.id), line_no: num(r.line_no) ?? 0, item_type_code: str(r.item_type_code), co_cq: bool(r.co_cq),
    name: str(r.name), unit: str(r.unit), quantity: num(r.quantity), months: num(r.months), sku: str(r.sku),
    specs: str(r.specs), start_date: optStr(r.start_date), end_date: optStr(r.end_date), delivery_time: str(r.delivery_time),
    supplier_priority: str(r.supplier_priority), end_user: str(r.end_user), note: str(r.note), price: linePrice(price),
  };
}

function financeFields(r: Rec | undefined): FinanceFields {
  return { id: optStr(r?.id) ?? undefined, sales_cost: num(r?.sales_cost), prev_sales_cost: num(r?.prev_sales_cost),
    prev_revenue: num(r?.prev_revenue), prev_net_profit: num(r?.prev_net_profit) };
}

export function draftFromRecords(r: OrderRecords): OrderDraft {
  // A line's price may sit in either price entity: its item type can move between goods and service after it was priced.
  const prices = new Map<string, Rec>();
  for (const price of [...r.goods_prices, ...r.service_prices].map(fieldsOf)) {
    const line = ref(price.order_line);
    if (line) prices.set(line, price);
  }
  const lines = r.lines.map(fieldsOf).map((line) => lineDraft(line, prices.get(str(line.id))))
    .sort((a, b) => a.line_no - b.line_no);
  return { order: orderFields(fieldsOf(r.order)), lines, finance: financeFields(r.finance.map(fieldsOf)[0]) };
}

// Deal-stage weights come from the configuration, not the order; the fund balance (plan 07) defaults to 0.
export function toPlOrderInput(draft: OrderDraft, provisionFundBalance = 0): PlOrderInput {
  const { order } = draft;
  return {
    lines: draft.lines.map((line) => ({ id: line.id, itemTypeCode: line.item_type_code, quantity: line.quantity,
      months: line.months, unitPrice: line.price.unit_price, discountPct: line.price.discount_pct,
      vatRate: line.price.vat_rate, unitCost: line.price.unit_cost })),
    customerTier: order.customer_tier as CustomerTier, debtDays: order.debt_days, salesCost: draft.finance.sales_cost,
    contractTypeOverride: order.contract_type_override, deployStaff: order.deploy_staff, consultStaff: order.consult_staff,
    proposal: order.proposal, poc: order.poc, useProvisionFund: order.use_provision_fund, provisionFundBalance,
    isNewOrder: order.is_new_order, isNewLogo: order.is_new_logo, leadPerson: order.lead_source,
    dealStages: order.deal_stages.map(({ stage, person }) => ({ stage, person })),
  };
}

export function lineGroup(code: string, config: PlConfig): PurchaseGroup | null {
  return config.itemTypes.find((type) => type.code === code)?.purchaseGroup ?? null;
}
