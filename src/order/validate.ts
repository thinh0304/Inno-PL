// Required fields and cross-field rules of an order: Đặc tả FR-1.6c, FR-2.1–2.8, FR-3.5, BR-21, BR-23, 4.8.
// 'draft' checks formats only (a draft may be incomplete); 'submit' (t11) adds what sending for approval needs;
// 'customer_contract' (t41, plan 03) adds the fields that come from the signed contract.
import type { PlConfig } from '../pl/types';
import { checkFormat, type FormatKind } from './formats';
import type { LineDraft, OrderDraft } from './types';

export interface FieldIssue { path: string; message: string; severity: 'error' | 'warning' }
export type ValidationStage = 'draft' | 'submit' | 'customer_contract';

const MAX_LINES = 300;
const REQUIRED = 'Bắt buộc';

type Check = { path: string; value: unknown; kind?: FormatKind; required?: boolean };

const isEmpty = (value: unknown) => value === null || value === undefined || value === ''
  || (Array.isArray(value) && value.length === 0);

// Whole months between two ISO dates, with the days as a fraction of a 30-day month.
function monthsBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm) + (ed - sd) / 30;
}

export function validateOrder(draft: OrderDraft, config: PlConfig, stage: ValidationStage): { issues: FieldIssue[]; missingRequired: number } {
  const issues: FieldIssue[] = [];
  let missingRequired = 0;
  const submit = stage !== 'draft';
  const error = (path: string, message: string) => issues.push({ path, message, severity: 'error' });
  const missing = (path: string) => { error(path, REQUIRED); missingRequired += 1; };

  // One field: required when asked and empty; otherwise its format.
  const field = ({ path, value, kind, required }: Check) => {
    if (isEmpty(value)) { if (required && submit) missing(path); return; }
    if (kind && typeof value === 'string') {
      const result = checkFormat(kind, value);
      if (!result.ok) error(path, result.message!);
    }
  };
  const integer = (path: string, value: number | null, min: number, max: number, required: boolean, message: string) => {
    if (value === null) { if (required && submit) missing(path); return; }
    if (!Number.isInteger(value) || value < min || value > max) error(path, message);
  };

  const { order, finance } = draft;
  const renewal = !order.is_new_order;
  const contract = stage === 'customer_contract';

  field({ path: 'order.customer_name', value: order.customer_name, kind: 'text', required: true });
  field({ path: 'order.customer_code', value: order.customer_code, kind: 'customer_code', required: true });
  field({ path: 'order.tax_code', value: order.tax_code, kind: 'tax_code', required: true });
  field({ path: 'order.contact_name', value: order.contact_name, kind: 'person_name', required: true });
  field({ path: 'order.contact_phone', value: order.contact_phone, kind: 'phone' });
  field({ path: 'order.contact_email', value: order.contact_email, kind: 'email' });
  field({ path: 'order.address', value: order.address, kind: 'text', required: contract });
  field({ path: 'order.representative', value: order.representative, kind: 'person_name' });
  field({ path: 'order.representative_title', value: order.representative_title, kind: 'text' });
  field({ path: 'order.bank_account', value: order.bank_account, kind: 'bank_account' });
  field({ path: 'order.bank_name', value: order.bank_name, kind: 'text' });
  field({ path: 'order.receiver_name', value: order.receiver_name, kind: 'person_name', required: contract });
  field({ path: 'order.receiver_phone', value: order.receiver_phone, kind: 'phone', required: contract });
  field({ path: 'order.delivery_address', value: order.delivery_address, kind: 'text', required: contract });
  field({ path: 'order.quote_date', value: order.quote_date, kind: 'date' });
  field({ path: 'order.quote_valid_until', value: order.quote_valid_until, kind: 'date' });
  if (order.quote_date && order.quote_valid_until && order.quote_valid_until <= order.quote_date) {
    error('order.quote_valid_until', 'Hiệu lực báo giá phải sau ngày báo giá');
  }
  field({ path: 'order.internal_contract_no', value: order.internal_contract_no, kind: 'contract_no', required: true });
  field({ path: 'order.customer_po_no', value: order.customer_po_no, kind: 'contract_no' });
  field({ path: 'order.content', value: order.content, kind: 'text', required: true });
  field({ path: 'order.signed_on', value: order.signed_on, kind: 'date', required: contract });
  field({ path: 'order.am', value: order.am, required: true });
  field({ path: 'order.prev_contract_no', value: order.prev_contract_no, kind: 'contract_no', required: renewal });
  if (renewal && order.lead_source) error('order.lead_source', 'Đơn tái ký không có nguồn khách hàng (BR-23)');
  field({ path: 'order.customer_tier', value: order.customer_tier, required: true });
  integer('order.debt_days', order.debt_days, 0, 365, true, 'Công nợ là số nguyên 0–365 ngày');
  integer('order.payment_count', order.payment_count, 1, 12, contract, 'Số lần thanh toán là số nguyên 1–12');
  if (submit) {
    const total = order.deal_stages.reduce((sum, s) => sum + (s.weight ?? 0), 0);
    if (Math.abs(total - 1) > 1e-9) error('order.deal_stages', 'Tổng hệ số các giai đoạn deal phải bằng 100%');
    order.deal_stages.forEach((s, i) => {
      if ((s.weight ?? 0) > 0 && !s.person) missing(`order.deal_stages[${i}].person`);
    });
  }

  const money = (path: string, value: number | null, required: boolean, signed = false) => {
    if (value === null) { if (required && submit) missing(path); return; }
    if (!signed && value < 0) error(path, 'Số tiền ≥ 0');
  };
  money('finance.sales_cost', finance.sales_cost, true);
  money('finance.prev_sales_cost', finance.prev_sales_cost, renewal);
  if (renewal && submit && finance.prev_revenue !== null && finance.prev_revenue <= 0) {
    error('finance.prev_revenue', 'Doanh thu năm trước phải > 0');
  } else {
    money('finance.prev_revenue', finance.prev_revenue, renewal);
  }
  money('finance.prev_net_profit', finance.prev_net_profit, renewal, true);
  if (finance.prev_net_profit !== null && finance.prev_revenue !== null && finance.prev_net_profit > finance.prev_revenue) {
    error('finance.prev_net_profit', 'LN thuần năm trước không lớn hơn doanh thu năm trước');
  }

  if (submit && draft.lines.length === 0) missing('lines');
  if (draft.lines.length > MAX_LINES) error('lines', `Một đơn có tối đa ${MAX_LINES} dòng`);
  draft.lines.forEach((line, i) => lineIssues(line, `lines[${i}]`));

  function lineIssues(line: LineDraft, at: string) {
    const type = config.itemTypes.find((t) => t.code === line.item_type_code);
    if (!type) { error(`${at}.item_type_code`, 'Mã loại không có trong cấu hình'); return; }
    if (submit && type.code === 'TB' && !line.co_cq) missing(`${at}.co_cq`);
    field({ path: `${at}.name`, value: line.name, kind: 'text', required: true });
    field({ path: `${at}.unit`, value: line.unit, kind: 'unit', required: true });
    if (line.quantity === null || line.quantity === 0) { if (submit) missing(`${at}.quantity`); }
    else if (!Number.isInteger(line.quantity) || line.quantity < 0) error(`${at}.quantity`, 'Số lượng là số nguyên > 0');
    if (type.monthly && (line.months ?? 0) <= 0) { if (submit) missing(`${at}.months`); }
    else if (line.months !== null) {
      if (!Number.isInteger(line.months) || line.months < 0 || line.months > 120) error(`${at}.months`, 'Số tháng là số nguyên 0–120');
      else if (type.monthly && line.start_date && line.end_date
        && Math.abs(monthsBetween(line.start_date, line.end_date) - line.months) > 1) {
        error(`${at}.months`, 'Số tháng phải khớp ngày bắt đầu – kết thúc (lệch tối đa 1 tháng)');
      }
    }
    field({ path: `${at}.sku`, value: line.sku, kind: 'sku' });
    field({ path: `${at}.start_date`, value: line.start_date, kind: 'date', required: type.termed });
    field({ path: `${at}.end_date`, value: line.end_date, kind: 'date', required: type.termed });
    if (line.start_date && line.end_date && line.end_date <= line.start_date) {
      error(`${at}.end_date`, 'Ngày kết thúc phải sau ngày bắt đầu');
    }
    const { price } = line;
    if (price.unit_price === null || price.unit_price <= 0) {
      if (price.unit_price !== null && price.unit_price < 0) error(`${at}.price.unit_price`, 'Giá bán không âm');
      else if (submit) missing(`${at}.price.unit_price`);
    }
    if (price.unit_cost !== null && price.unit_cost < 0) error(`${at}.price.unit_cost`, 'Giá mua không âm');
    if (price.discount_pct !== null && (price.discount_pct < 0 || price.discount_pct > 1)) {
      error(`${at}.price.discount_pct`, 'Chiết khấu 0–100%');
    }
    if (submit && !price.supplier) missing(`${at}.price.supplier`);
  }

  return { issues, missingRequired };
}
