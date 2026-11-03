// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';
import { OrdersError } from '../../src/module/orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderListScreen } = await import('../../src/module/OrderListScreen.js');

afterEach(cleanup);

function show(options: MemoryOptions = {}, lang: 'vi' | 'en' = 'vi', wrap = (api: ReturnType<typeof createMemoryOrdersApi>) => api) {
  const api = wrap(createMemoryOrdersApi(options));
  const onOpen = vi.fn();
  const onNew = vi.fn();
  render(<OrderListScreen api={api} lang={lang} locale={lang} theme="light" onOpen={onOpen} onNew={onNew} today="2026-11-03" />);
  return { api, onOpen, onNew };
}

const rows = () => [...document.querySelectorAll('tbody tr')] as HTMLElement[];

describe('the order list', () => {
  it('lists_orders_newest_first', async () => {
    const { onOpen } = show();
    await screen.findByText('Sở Giao thông Vận tải Lâm Đồng');
    expect(rows().map((r) => r.querySelector('.customer-name')!.textContent)).toEqual(['Sở Giao thông Vận tải Lâm Đồng', 'Trung tâm CNTT Bà Rịa']);
    expect(within(rows()[1]).getByText('420.000.000')).toBeTruthy();
    expect(within(rows()[0]).getByText(/^DV-/)).toBeTruthy();
    fireEvent.click(within(rows()[1]).getByText('Trung tâm CNTT Bà Rịa'));
    expect(onOpen).toHaveBeenCalledWith('o1');
  });

  it('revenue_hidden_without_pl_access', async () => {
    show({ access: { seesPl: false, seesGoodsPrices: true, seesProposals: true, canCreateOrder: false } });
    await screen.findByText('Trung tâm CNTT Bà Rịa');
    expect(screen.queryByText('Doanh thu (VNĐ)')).toBeNull();
    expect(screen.getByText('Dòng thuộc bạn')).toBeTruthy();
    expect(within(rows()[1]).getByText('2')).toBeTruthy();
  });

  it('filters_by_status_and_period', async () => {
    show();
    await screen.findByText('Trung tâm CNTT Bà Rịa');
    fireEvent.click(screen.getByRole('radio', { name: 'Tháng' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByText('Sở Giao thông Vận tải Lâm Đồng')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kỳ trước' }));
    await waitFor(() => expect(screen.queryByText('Trung tâm CNTT Bà Rịa')).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: 'Tất cả' }));
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'done' } });
    await screen.findByText('Không có đơn hàng nào khớp bộ lọc.');
  });

  it('new_button_only_for_sales', async () => {
    const { onNew } = show();
    fireEvent.click(await screen.findByRole('button', { name: /Tạo đơn hàng mới/ }));
    expect(onNew).toHaveBeenCalled();
    cleanup();
    show({ access: { canCreateOrder: false } });
    await screen.findByText('Trung tâm CNTT Bà Rịa');
    expect(screen.queryByRole('button', { name: /Tạo đơn hàng mới/ })).toBeNull();
  });

  it('admin_deletes_after_confirm', async () => {
    const { api } = show({ access: { isAdmin: true, canCreateOrder: false } });
    await screen.findByText('Trung tâm CNTT Bà Rịa');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa đơn Trung tâm CNTT Bà Rịa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa đơn' }));
    await waitFor(() => expect(screen.queryByText('Trung tâm CNTT Bà Rịa')).toBeNull());
    expect((await api.list()).map((o) => o.id)).toEqual(['o2']);
  });

  it('empty_and_error_states', async () => {
    show({ empty: true });
    await screen.findByText('Chưa có đơn hàng nào');
    cleanup();
    show({}, 'en', (api) => ({ ...api, list: async () => { throw new OrdersError('NETWORK', null); } }));
    await screen.findByText("Couldn't reach AgentFlow. Check your connection.");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
