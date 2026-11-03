// Order TM-1040 (docs/source/TM-1040.xlsx) as the records AgentFlow holds: the same input as test/pl/fixtures/tm1040.ts.
import type { OrderRecords } from '../../../src/order/types';

export const TM1040_RECORDS: OrderRecords = {
  order: {
    id: 'o1', number: '2026-0001', status: 'draft', stage: 1,
    customer_name: 'Công ty TNHH Mẫu', customer_code: 'MAU', tax_code: '0312345678', contact_name: 'Chị Hạnh',
    internal_contract_no: 'TM-1040', content: 'Ổ cứng Seagate và NAS QNAP', am: 'u-am',
    customer_tier: 'potential', debt_days: 30, is_new_order: true, is_new_logo: false, lead_source: null,
    use_provision_fund: false, proposal: false, poc: false, deploy_staff: null, consult_staff: null,
    contract_type_override: null,
    deal_stages: [
      { stage: 'opportunity', weight: 0.2, person: 'ThuanNG' }, { stage: 'clarification', weight: 0.3, person: 'ThuanNG' },
      { stage: 'quotation', weight: 0.1, person: 'ThuanNG' }, { stage: 'negotiation', weight: 0.1, person: 'ThuanNG' },
      { stage: 'close', weight: 0.2, person: 'ThuanNG' }, { stage: 'contract', weight: 0.1, person: 'ThuDTH' },
    ],
  },
  lines: [
    { id: 'qnap', order: 'o1', line_no: 2, item_type_code: 'TB', co_cq: true, name: 'QNAP TS-H1277AXU', unit: 'Cái',
      quantity: 1, months: 60 },
    { id: 'seagate', order: 'o1', line_no: 1, item_type_code: 'TB', co_cq: true, name: 'Seagate 18TB', unit: 'Cái',
      quantity: 12, months: 24 },
  ],
  goods_prices: [
    { id: 'p1', order_line: 'seagate', order: 'o1', unit_price: 21_000_000, discount_pct: 0, vat_rate: 0.08,
      unit_cost: 19_000_000, supplier: 's1' },
    { id: 'p2', order_line: 'qnap', order: 'o1', unit_price: 168_000_000, discount_pct: 0, vat_rate: 0.08,
      unit_cost: 150_920_000 / 1.08, supplier: 's1' },
  ],
  service_prices: [],
  finance: [{ id: 'f1', order: 'o1', sales_cost: 0 }],
};
