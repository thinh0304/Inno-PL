// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');

afterEach(cleanup);

function show(id: string | null, options: MemoryOptions = {}) {
  const api = createMemoryOrdersApi(options);
  const navigate = vi.fn();
  render(<OrderPage api={api} id={id} tab={null} lang="vi" locale="vi" theme="light" navigate={navigate} />);
  return { api, navigate };
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

describe('the order page', () => {
  it('new_order_defaults_am_and_stages', async () => {
    const { api } = show(null);
    await screen.findByRole('heading', { name: 'Tạo đơn hàng mới' });
    // The person is ThuanNG (sales): the AM, and the person of every deal stage.
    expect(screen.getByText('AM · Nguyễn Thuận')).toBeTruthy();
    // No Inside Sales yet: no IS tag (staff without a user account must not match an empty field).
    expect(screen.queryByText(/^IS · /)).toBeNull();
    void api;
  });

  it('save_creates_then_navigates', async () => {
    const { api, navigate } = show(null, { empty: true });
    await screen.findByRole('heading', { name: 'Tạo đơn hàng mới' });
    type('Tên khách hàng', 'Công ty Mẫu');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const [order] = await api.list();
    expect(navigate).toHaveBeenCalledWith(`/orders/${order.id}`);
    expect(order.customerName).toBe('Công ty Mẫu');
  });

  it('save_locked_while_format_errors', async () => {
    show('o1');
    await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa');
    type('Mã số thuế', '123');
    const save = screen.getByRole('button', { name: 'Lưu' });
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('MST 10 số, hoặc 10 số-3 số (chi nhánh)')).toBeTruthy();
    expect(document.getElementById(save.getAttribute('aria-describedby')!)!.textContent).toMatch(/ô viền đỏ/);
    type('Mã số thuế', '0312 345 679');
    expect(save.getAttribute('aria-disabled')).toBe('false');
    expect(field('Mã số thuế').value).toBe('0312345679');
  });

  it('readonly_for_non_editor', async () => {
    show('o1', { me: { id: 'u-sd', name: 'SD' }, access: { seesProposals: true, canCreateOrder: false } });
    await screen.findByRole('heading', { name: 'Trung tâm CNTT Bà Rịa' });
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
    expect(screen.queryByLabelText(/^Tên khách hàng/)).toBeNull();
    expect(screen.getAllByText('Trung tâm CNTT Bà Rịa').length).toBeGreaterThan(1);
  });

  it('missing_banner_counts_customer_fields', async () => {
    show(null, { empty: true });
    await screen.findByRole('heading', { name: 'Tạo đơn hàng mới' });
    expect(screen.getByText('Còn 4 trường bắt buộc chưa điền ở Thông tin khách hàng.')).toBeTruthy();
    type('Tên khách hàng', 'Công ty Mẫu');
    expect(screen.getByText('Còn 3 trường bắt buộc chưa điền ở Thông tin khách hàng.')).toBeTruthy();
  });

  it('tabs follow the role', async () => {
    show('o1');
    await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Phiếu khảo sát', 'Danh mục Thiết bị / Dịch vụ', 'Nhà cung cấp', 'Kết quả P&L', 'Hợp đồng', 'Quy trình', 'Lịch sử']);
  });
});
