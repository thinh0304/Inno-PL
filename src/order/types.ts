// One order as the screens edit it and the engine reads it. Field keys are the entities' field keys
// (config/entities/order.json, order_line.json, goods_line_price.json / service_line_price.json, order_finance.json).
import type { ContractType, CustomerTier, DealStage } from '../pl/types';

export type Rec = Record<string, unknown>;

export interface OrderFields { id?: string; number?: string; code?: string; status: 'draft' | 'in_progress' | 'done' | 'close_lost';
  stage: number; customer: string | null; customer_name: string; customer_code: string; tax_code: string; address: string;
  contact_name: string; contact_phone: string; contact_email: string; representative: string; representative_title: string;
  bank_account: string; bank_name: string; receiver_name: string; receiver_phone: string; delivery_address: string;
  delivery_note: string; quote_date: string | null; quote_valid_until: string | null; exchange_rate: number | null;
  internal_contract_no: string; customer_po_no: string; content: string; signed_on: string | null;
  am: string | null; sa: string | null; inside_sales: string | null; is_new_order: boolean; is_new_logo: boolean;
  prev_contract_no: string; lead_source: string | null; customer_tier: CustomerTier | null;
  debt_days: number | null; use_provision_fund: boolean; payment_count: number | null; customer_prepays: boolean;
  deploy_staff: string | null; consult_staff: string | null; proposal: boolean; poc: boolean;
  contract_type_override: ContractType | null;
  deal_stages: { stage: Exclude<DealStage, 'lead'>; weight: number | null; person: string | null }[];
  has_goods: boolean; has_service: boolean; }

export interface LinePrice { id?: string; unit_price: number | null; discount_pct: number | null; vat_rate: number | null;
  unit_cost: number | null; supplier: string | null; }

export interface LineDraft { id: string; line_no: number; item_type_code: string; co_cq: boolean; name: string; unit: string;
  quantity: number | null; months: number | null; sku: string; specs: string; start_date: string | null; end_date: string | null;
  delivery_time: string; supplier_priority: string; end_user: string; note: string; price: LinePrice; }

export interface FinanceFields { id?: string; sales_cost: number | null; prev_sales_cost: number | null;
  prev_revenue: number | null; prev_net_profit: number | null; }

export interface OrderDraft { order: OrderFields; lines: LineDraft[]; finance: FinanceFields; }

// What a list call or a workflow's search steps return for one order.
export interface OrderRecords { order: Rec; lines: Rec[]; goods_prices: Rec[]; service_prices: Rec[]; finance: Rec[]; }
