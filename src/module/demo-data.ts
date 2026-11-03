// The demo's and the screen tests' sample data: the default configuration as records, a few customers, suppliers and
// staff, order TM-1040 (docs/source/TM-1040.xlsx) and a Cloud Server order.
import type { Rec } from '../order/types';
import type { ConfigRecords } from '../pl/config-records';
import type { PlConfig } from '../pl/types';
import type { StaffMember } from './orders-api.js';

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const snakeKeys = (values: object): Rec => Object.fromEntries(Object.entries(values).map(([k, v]) => [snake(k), v]));

/** The configuration as the configuration entities hold it (their seeds have the same shape). */
export function recordsFromConfig(config: PlConfig): ConfigRecords {
  return {
    item_type: config.itemTypes.map((t) => ({ ...snakeKeys(t), active: true })),
    contract_type_rate: config.contractTypeRates.map(snakeKeys),
    fin_cost_tier: config.finCostTiers.map(snakeKeys),
    vat_rate: config.vatRates.map((v, i) => ({ ...snakeKeys(v), sort_order: i + 1 })),
    pl_setting: [{ key: 'default', ...snakeKeys(config.settings) }],
    task_sla: config.taskSlas.map((t, i) => ({ ...snakeKeys(t), sort_order: i + 1 })),
    deal_stage_weight: Object.entries(config.dealStageWeights).flatMap(([set, stages]) =>
      Object.entries(stages).map(([stage, weight]) => ({ weight_set: set, stage, weight }))),
  };
}

export const DEMO_STAFF: StaffMember[] = [
  { id: 'st1', code: 'ThuanNG', name: 'Nguyễn Thuận', user: 'u-am', team: 'sales', active: true },
  { id: 'st2', code: 'LinhTK', name: 'Trần Khánh Linh', user: 'u-am2', team: 'sales', active: true },
  { id: 'st3', code: 'ThuDTH', name: 'Đỗ Thu', user: 'u-sa', team: 'sa', active: true },
  { id: 'st4', code: 'Mkt', name: 'Team Marketing', user: null, team: 'lead_source', active: true },
  { id: 'st5', code: 'KyTV', name: 'Trần Văn Kỳ', user: 'u-tm', team: 'technical', active: true },
];

export const DEMO_CUSTOMERS: Rec[] = [
  { id: 'c1', code: 'SOGTVTLD', name: 'Sở Giao thông Vận tải Lâm Đồng', tax_code: '5800123456', address: '36 Trần Phú, Đà Lạt',
    tier: 'potential', representative: 'Ông Nguyễn Văn An', representative_title: 'Giám đốc', contacts: [] },
  { id: 'c2', code: 'BARRIA', name: 'Trung tâm CNTT Bà Rịa', tax_code: '0312345678', address: '12 Lê Lợi, Bà Rịa', tier: 'vip' },
  { id: 'c3', code: 'KLM', name: 'Công ty TNHH Kim Long Minh', tax_code: '0109876543-001', address: 'KCN Tân Bình', tier: 'standard' },
];

export const DEMO_SUPPLIERS: Rec[] = [
  { id: 's1', name: 'Công ty Phân phối Sao Việt', contact_name: 'Anh Tùng', phone: '0909 123 456', email: 'tung@saoviet.vn',
    payment_terms: [{ label: 'Tạm ứng', percent: 30, days: 0 }, { label: 'Tất toán', percent: 70, days: 30 }], debt_days: 30, active: true },
  { id: 's2', name: 'Viettel IDC', contact_name: 'Chị Mai', phone: '028 3800 0000', email: 'mai@viettelidc.vn', debt_days: 15, active: true },
];

const STAGES = ['opportunity', 'clarification', 'quotation', 'negotiation', 'close'].map((stage) => ({ stage, person: 'ThuanNG' }));

/** Each order's records: the order, its lines, their prices by entity, its finance. */
export const DEMO_ORDERS: { order: Rec; lines: Rec[]; goods: Rec[]; service: Rec[]; finance: Rec }[] = [
  {
    order: { id: 'o1', number: '2026-0001', status: 'draft', stage: 1, customer: 'c2', customer_name: 'Trung tâm CNTT Bà Rịa',
      customer_code: 'BARRIA', tax_code: '0312345678', address: '12 Lê Lợi, Bà Rịa', contact_name: 'Chị Hạnh',
      contact_phone: '0909 111 222', internal_contract_no: 'TM-1040', content: 'Ổ cứng Seagate và NAS QNAP', am: 'u-am',
      inside_sales: 'u-sa', customer_tier: 'potential', debt_days: 30, is_new_order: true, quote_date: '2026-10-20',
      deal_stages: [...STAGES, { stage: 'contract', person: 'ThuDTH' }], created_at: '2026-10-20T03:00:00Z' },
    lines: [
      { id: 'l1', order: 'o1', line_no: 1, item_type_code: 'TB', co_cq: true, name: 'Ổ cứng Seagate 18TB', unit: 'Cái', quantity: 12, months: 24 },
      { id: 'l2', order: 'o1', line_no: 2, item_type_code: 'TB', co_cq: true, name: 'NAS QNAP TS-H1277AXU', unit: 'Cái', quantity: 1, months: 60 },
    ],
    goods: [
      { id: 'gp1', order: 'o1', order_line: 'l1', unit_price: 21_000_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 19_000_000, supplier: 's1' },
      { id: 'gp2', order: 'o1', order_line: 'l2', unit_price: 168_000_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 150_920_000 / 1.08, supplier: 's1' },
    ],
    service: [],
    finance: { id: 'f1', order: 'o1', sales_cost: 0 },
  },
  {
    order: { id: 'o2', number: '2026-0002', status: 'draft', stage: 1, customer: 'c1', customer_name: 'Sở Giao thông Vận tải Lâm Đồng',
      customer_code: 'SOGTVTLD', tax_code: '5800123456', contact_name: 'Anh Bình', internal_contract_no: 'DV-0912',
      content: 'Cloud Server 12 tháng', am: 'u-am', customer_tier: 'potential', debt_days: 45, is_new_order: true,
      deal_stages: [...STAGES, { stage: 'contract', person: 'ThuanNG' }], created_at: '2026-11-01T02:00:00Z' },
    lines: [{ id: 'l3', order: 'o2', line_no: 1, item_type_code: 'Cloud Server', name: 'Cloud Server 8 vCPU', unit: 'Tháng',
      quantity: 2, months: 12, start_date: '2026-12-01', end_date: '2027-11-30' }],
    goods: [],
    service: [{ id: 'sp1', order: 'o2', order_line: 'l3', unit_price: 6_500_000, discount_pct: 0, vat_rate: 0.08, unit_cost: 4_200_000, supplier: 's2' }],
    finance: { id: 'f2', order: 'o2', sales_cost: 5_000_000 },
  },
];
