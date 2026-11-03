// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { LinesTab } = await import('../../src/module/tabs/LinesTab.js');

afterEach(cleanup);

async function open(id: string, api = createMemoryOrdersApi()) {
  render(<OrderPage api={api} id={id} tab="lines" lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ lines: LinesTab }} />);
  await screen.findByText('Tổng hợp doanh thu – giá vốn');
  return api;
}

const rows = () => [...document.querySelectorAll('.lines tbody tr.line')] as HTMLElement[];
const cell = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;
const typeInto = (label: string, value: string) => {
  const input = cell(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
};

describe('the lines tab', () => {
  it('line_totals_follow_the_engine', async () => {
    await open('o1');
    expect(within(rows()[0]).getByText('252.000.000')).toBeTruthy();
    expect(screen.getByText('Tổng').closest('tr')!.textContent).toMatch(/420\.000\.000/);
    expect(screen.getByRole('row', { name: /^Doanh thu/ }).textContent).toMatch(/420\.000\.000/);
  });

  it('monthly_service_multiplies_months', async () => {
    await open('o2');
    expect(within(rows()[0]).getByText('156.000.000')).toBeTruthy();
  });

  it('vietnamese_numbers_in_the_grid', async () => {
    await open('o1');
    const price = typeInto('Đơn giá bán dòng 1', '22.000.000');
    expect(price.value).toBe('22.000.000');
    fireEvent.blur(price);
    expect(cell('Đơn giá bán dòng 1').value).toBe('22.000.000');
    expect(within(rows()[0]).getByText('264.000.000')).toBeTruthy();
    const bad = typeInto('Đơn giá bán dòng 1', '21,000');
    expect(bad.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Lưu' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('a space typed between words stays while typing', async () => {
    await open('o1');
    const name = typeInto('Hàng hóa / Dịch vụ dòng 1', 'Ổ cứng ');
    expect(name.value).toBe('Ổ cứng ');
    fireEvent.change(name, { target: { value: 'Ổ cứng  Seagate ' } });
    fireEvent.blur(name);
    expect(cell('Hàng hóa / Dịch vụ dòng 1').value).toBe('Ổ cứng Seagate');
  });

  it('co_cq_only_for_tb', async () => {
    await open('o1');
    expect(cell('CO/CQ dòng 1')).toBeTruthy();
    fireEvent.change(cell('Loại dòng 1'), { target: { value: 'Cloud Server' } });
    expect(screen.queryByLabelText('CO/CQ dòng 1')).toBeNull();
  });

  it('termed_type_shows_dates', async () => {
    await open('o1');
    fireEvent.change(cell('Loại dòng 1'), { target: { value: 'LIC-DK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết dòng 1' }));
    expect(cell('Ngày bắt đầu dòng 1')).toBeTruthy();
    expect(cell('Ngày kết thúc dòng 1')).toBeTruthy();
  });

  it('add_supplier_inline', async () => {
    await open('o1');
    fireEvent.change(cell('Nhà cung cấp dòng 1'), { target: { value: '__new' } });
    fireEvent.change(await screen.findByLabelText('Tên NCC'), { target: { value: 'NCC Mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu NCC mới' }));
    await waitFor(() => expect((cell('Nhà cung cấp dòng 1') as HTMLSelectElement).selectedOptions[0].textContent).toBe('NCC Mới'));
  });

  it('group_by_supplier', async () => {
    await open('o1');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gộp theo NCC' }));
    expect(await screen.findByText(/Công ty Phân phối Sao Việt · 2 sản phẩm/)).toBeTruthy();
  });

  it('add_and_delete_lines', async () => {
    await open('o1');
    fireEvent.click(screen.getByRole('button', { name: /Thêm dòng/ }));
    expect(rows()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dòng 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dòng 2' }));
    expect(rows()).toHaveLength(1);
  });
});
