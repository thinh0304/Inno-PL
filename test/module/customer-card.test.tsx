// @vitest-environment jsdom
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');

afterEach(cleanup);

async function newOrder() {
  render(<OrderPage api={createMemoryOrdersApi({ empty: true })} id={null} tab={null} lang="vi" locale="vi" theme="light" navigate={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Tạo đơn hàng mới' });
  return screen.getByLabelText(/^Tên khách hàng/) as HTMLInputElement;
}

describe('suggesting a known customer (FR-1.6a)', () => {
  it('suggests_after_two_chars', async () => {
    const name = await newOrder();
    fireEvent.change(name, { target: { value: 's' } });
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(name, { target: { value: 'so giao' } });
    const option = await screen.findByRole('option', { name: /Sở Giao thông Vận tải Lâm Đồng/ });
    expect(option.textContent).toMatch(/SOGTVTLD/);
    expect(option.textContent).toMatch(/MST 5800123456/);
  });

  it('enter_fills_empty_fields_only', async () => {
    const name = await newOrder();
    fireEvent.change(screen.getByLabelText(/^Người liên hệ/), { target: { value: 'Chị Lan' } });
    fireEvent.change(name, { target: { value: 'so giao' } });
    await screen.findByRole('option', { name: /Sở Giao thông/ });
    fireEvent.keyDown(name, { key: 'ArrowDown' });
    fireEvent.keyDown(name, { key: 'Enter' });
    await waitFor(() => expect((screen.getByLabelText(/^Mã khách hàng/) as HTMLInputElement).value).toBe('SOGTVTLD'));
    expect((screen.getByLabelText(/^Mã số thuế/) as HTMLInputElement).value).toBe('5800123456');
    expect((screen.getByLabelText(/^Người liên hệ/) as HTMLInputElement).value).toBe('Chị Lan');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('differing_field_asks_to_keep_or_update', async () => {
    const name = await newOrder();
    fireEvent.change(screen.getByLabelText(/^Địa chỉ$/), { target: { value: 'Địa chỉ khác' } });
    fireEvent.change(name, { target: { value: 'so giao' } });
    fireEvent.click(await screen.findByRole('option', { name: /Sở Giao thông/ }));
    expect(await screen.findByText('Khác hồ sơ khách hàng')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật Địa chỉ' }));
    expect((screen.getByLabelText(/^Địa chỉ$/) as HTMLInputElement).value).toBe('36 Trần Phú, Đà Lạt');
  });

  it('escape_closes', async () => {
    const name = await newOrder();
    fireEvent.change(name, { target: { value: 'so giao' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(name, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
