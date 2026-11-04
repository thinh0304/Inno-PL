// @vitest-environment jsdom
import './shims';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyOrder } from '../../src/domain/form';
import type { Api } from '../../src/module/api';
import { DonHang } from '../../src/module/screens/DonHang';

afterEach(cleanup);

const customer = {
  id: 'k1', ma_kh: 'SOGTVTLD', ten: 'Sở Giao thông Vận tải Lâm Đồng', mst: '0312345678', dia_chi: 'Đà Lạt', nguoi_dai_dien: '', chuc_vu: '', so_tk: '',
  ngan_hang: '', nguoi_lien_he: 'Anh Bình', email: '', dien_thoai: '', hang_kh: 'vip',
};
const stub = (): Api => ({
  emptyOrder: () => emptyOrder('u-am'), customers: async () => [customer], suppliers: async () => [], previousOrders: async () => [],
  linesOf: async () => [], createOrder: vi.fn(), saveOrder: vi.fn(), actOnTask: vi.fn(), loadOrder: vi.fn(),
}) as unknown as Api;

async function mount() {
  await act(async () => { render(<DonHang api={stub()} lang="vi" id={null} onBack={() => {}} onCreated={() => {}} />); });
}

describe('màn đơn: kiểm định dạng khi nhập', () => {
  it('SĐT sai bị viền đỏ và đếm vào banner; gõ +84 thì tự chuẩn hóa khi rời ô', async () => {
    await mount();
    const phone = screen.getByLabelText('Điện thoại') as HTMLInputElement;
    fireEvent.change(phone, { target: { value: '12345' } });
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('1 trường cần sửa')).toBeTruthy();
    fireEvent.change(phone, { target: { value: '+84 909 123 456' } });
    fireEvent.blur(phone);
    expect(phone.value).toBe('0909 123 456');
    expect(phone.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(/trường cần sửa/)).toBeNull();
  });

  it('trường bắt buộc còn trống chưa bị báo lỗi khi mới mở đơn', async () => {
    await mount();
    expect((screen.getByLabelText('MST') as HTMLInputElement).getAttribute('aria-invalid')).toBeNull();
  });
});

describe('màn đơn: gợi ý khách hàng cũ', () => {
  it('gõ tên không dấu thì gợi ý; chọn thì chỉ điền ô trống', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Người liên hệ'), { target: { value: 'Chị Hạnh' } });
    fireEvent.change(screen.getByLabelText('Tên khách hàng'), { target: { value: 'giao thong' } });
    await act(async () => { fireEvent.click(await screen.findByRole('option', { name: /SOGTVTLD/ })); });
    expect((screen.getByLabelText('MST') as HTMLInputElement).value).toBe('0312345678');
    expect((screen.getByLabelText('Mã KH') as HTMLInputElement).value).toBe('SOGTVTLD');
    // Ô đã nhập khác hồ sơ không bị ghi đè: hiện bảng chọn.
    expect((screen.getByLabelText('Người liên hệ') as HTMLInputElement).value).toBe('Chị Hạnh');
    expect(screen.getByText(/Chị Hạnh → Anh Bình/)).toBeTruthy();
  });
});
