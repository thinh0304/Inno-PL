// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';
import type { LoadedOrder, OrdersApi } from '../../src/module/orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { PlTab } = await import('../../src/module/tabs/PlTab.js');
const { SuppliersTab } = await import('../../src/module/tabs/SuppliersTab.js');

afterEach(cleanup);

/** The memory API, with each loaded order passed through `change` first. */
function api(options: MemoryOptions = {}, change?: (loaded: LoadedOrder) => void): OrdersApi {
  const base = createMemoryOrdersApi(options);
  return { ...base, load: async (id) => { const loaded = await base.load(id); change?.(loaded); return loaded; } };
}

async function open(source: OrdersApi, tab: 'pl' | 'suppliers' = 'pl', id = 'o1') {
  render(<OrderPage api={source} id={id} tab={tab} lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ pl: PlTab, suppliers: SuppliersTab }} />);
}

const SD: MemoryOptions = { me: { id: 'u-sd', name: 'SD' }, access: { seesProposals: true, canCreateOrder: false } };

describe('the P&L tab', () => {
  it('tm1040_live_figures', async () => {
    await open(api());
    await screen.findByText('Báo cáo P&L đơn hàng');
    expect(screen.getAllByText('46.272.444').length).toBeGreaterThan(0);
    expect(screen.getByText('Đạt ngưỡng LN')).toBeTruthy();
    expect(screen.getByText('Ngưỡng LN tối thiểu').closest('.stat')!.textContent).toMatch(/8%/);
    expect(screen.getByText('Tỷ suất LN thuần / giá vốn').closest('.stat')!.textContent).toMatch(/12,6%/);
  });

  it('other_costs_collapse', async () => {
    await open(api());
    const toggle = await screen.findByRole('button', { name: /Chi phí khác/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Chi phí bảo hành')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('Chi phí bảo hành').closest('tr')!.textContent).toMatch(/2\.309\.407/);
    expect(screen.getByText('Chi phí dự phòng').closest('tr')!.textContent).toMatch(/3\.677\.407/);
  });

  it('formula_column_toggles', async () => {
    await open(api());
    fireEvent.click(await screen.findByRole('button', { name: 'Xem công thức' }));
    expect(screen.getByRole('columnheader', { name: 'Cách tính' })).toBeTruthy();
    expect(screen.getByText(/CPBH × r ÷ \(1 − r\)/)).toBeTruthy();
  });

  it('reader_sees_official_and_the_type_breakdown', async () => {
    await open(api(SD, (l) => { (l.official.order_pl as Record<string, unknown>).net_profit = 1_234_567; }));
    await screen.findByText('Báo cáo P&L đơn hàng');
    expect(screen.getAllByText('1.234.567').length).toBeGreaterThan(0);
    expect(screen.getByText('Doanh thu – giá vốn theo loại')).toBeTruthy();
  });

  it('stale_official_is_flagged', async () => {
    await open(api({}, (l) => { (l.official.order_pl as Record<string, unknown>).net_profit = 1; }));
    expect(await screen.findByText('Chưa tính lại — bấm Lưu để tính P&L chính thức.')).toBeTruthy();
  });

  it('locked_is_shown', async () => {
    await open(api({}, (l) => { (l.official.order_pl as Record<string, unknown>).locked = true; }));
    expect(await screen.findByText('Đã chốt số liệu (nhập từ Excel) — không tính lại.')).toBeTruthy();
  });

  it('kpi_split_names_people', async () => {
    await open(api());
    const table = (await screen.findByText('Chia chỉ tiêu kinh doanh (KPI)')).closest('section')!;
    expect(table.textContent).toMatch(/Nguyễn Thuận/);
    expect(table.textContent).toMatch(/41\.645\.200/);
  });

  it('renewal_comparison', async () => {
    await open(api({}, (l) => {
      l.draft.order.is_new_order = false;
      Object.assign(l.draft.order, { prev_contract_no: 'TM-0900' });
      Object.assign(l.draft.finance, { prev_sales_cost: 0, prev_revenue: 400_000_000, prev_net_profit: 40_000_000 });
    }));
    const card = (await screen.findByText('So sánh PO năm trước / năm nay')).closest('section')!;
    expect(card.textContent).toMatch(/TM-0900/);
    expect(card.textContent).toMatch(/400\.000\.000/);
    expect(card.textContent).toMatch(/420\.000\.000/);
  });
});

describe('the suppliers tab', () => {
  it('suppliers_of_this_order_only', async () => {
    await open(api(), 'suppliers');
    const name = await screen.findByText('Công ty Phân phối Sao Việt');
    expect(screen.queryByText('Viettel IDC')).toBeNull();
    expect(name.closest('tr')!.textContent).toMatch(/Tạm ứng 30%/);
  });
});
