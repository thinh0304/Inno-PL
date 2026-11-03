// A field of a draft named by its path, as validateOrder names them: order.tax_code, finance.sales_cost,
// lines[2].unit, lines[2].price.unit_price.
import type { FormatKind } from '../order/formats';
import type { OrderDraft } from '../order/types';

const tokens = (path: string) => path.replace(/\[(\d+)\]/g, '.$1').split('.');

export function getIn(draft: OrderDraft, path: string): unknown {
  return tokens(path).reduce<unknown>((at, key) => (at == null ? undefined : (at as Record<string, unknown>)[key]), draft);
}

/** A copy of `draft` with the field at `path` set; every object on the way is copied, the rest is shared. */
export function setIn(draft: OrderDraft, path: string, value: unknown): OrderDraft {
  const keys = tokens(path);
  const write = (at: unknown, i: number): unknown => {
    const copy: Record<string, unknown> | unknown[] = Array.isArray(at) ? [...at] : { ...(at as Record<string, unknown>) };
    const key = keys[i];
    (copy as Record<string, unknown>)[key] = i === keys.length - 1 ? value : write((at as Record<string, unknown>)[key], i + 1);
    return copy;
  };
  return write(draft, 0) as OrderDraft;
}

// How each field is checked and normalised while typed (Đặc tả 4.8).
const ORDER_KINDS: Record<string, FormatKind> = {
  customer_name: 'text', customer_code: 'customer_code', tax_code: 'tax_code', address: 'text', contact_name: 'person_name',
  contact_phone: 'phone', contact_email: 'email', representative: 'person_name', representative_title: 'text',
  bank_account: 'bank_account', bank_name: 'text', receiver_name: 'person_name', receiver_phone: 'phone',
  delivery_address: 'text', quote_date: 'date', quote_valid_until: 'date', exchange_rate: 'money',
  internal_contract_no: 'contract_no', customer_po_no: 'contract_no', content: 'text', signed_on: 'date',
  prev_contract_no: 'contract_no', debt_days: 'debt_days', payment_count: 'payment_count',
};
const FINANCE_KINDS: Record<string, FormatKind> = {
  sales_cost: 'money', prev_sales_cost: 'money', prev_revenue: 'money', prev_net_profit: 'signed_money',
};
const LINE_KINDS: Record<string, FormatKind> = {
  name: 'text', unit: 'unit', quantity: 'quantity', months: 'months', sku: 'sku', start_date: 'date', end_date: 'date',
  'price.unit_price': 'money', 'price.unit_cost': 'money', 'price.discount_pct': 'percent',
};

export function kindOf(path: string): FormatKind | null {
  const [head, ...rest] = path.split('.');
  const tail = rest.join('.');
  if (head === 'order') return ORDER_KINDS[tail] ?? null;
  if (head === 'finance') return FINANCE_KINDS[tail] ?? null;
  if (/^lines\[\d+\]$/.test(head)) return LINE_KINDS[tail] ?? null;
  return null;
}
