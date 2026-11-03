// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');

afterEach(cleanup);

describe('logging the suggestions people keep (FR-1.6a)', () => {
  it('keeping_a_field_is_logged_as_ignored_suggestion', async () => {
    const api = createMemoryOrdersApi();
    render(<OrderPage api={api} id="o1" tab={null} lang="vi" locale="vi" theme="light" navigate={vi.fn()} />);
    const name = await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa');
    fireEvent.change(screen.getByLabelText(/^Địa chỉ$/), { target: { value: 'Địa chỉ khác' } });
    fireEvent.change(name, { target: { value: 'so giao' } });
    fireEvent.click(await screen.findByRole('option', { name: /Sở Giao thông/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Giữ Địa chỉ' }));
    await waitFor(async () => expect((await api.events('o1')).map((e) => e.action)).toContain('ignored_suggestion'));
    expect((await api.events('o1')).find((e) => e.action === 'ignored_suggestion')).toMatchObject({ note: 'Giữ nguyên: Địa chỉ', actor: 'u-am' });
  });

  it('updating_a_field_is_not_logged', async () => {
    const api = createMemoryOrdersApi();
    render(<OrderPage api={api} id="o1" tab={null} lang="vi" locale="vi" theme="light" navigate={vi.fn()} />);
    const name = await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa');
    fireEvent.change(screen.getByLabelText(/^Địa chỉ$/), { target: { value: 'Địa chỉ khác' } });
    fireEvent.change(name, { target: { value: 'so giao' } });
    fireEvent.click(await screen.findByRole('option', { name: /Sở Giao thông/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cập nhật Địa chỉ' }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await api.events('o1')).map((e) => e.action)).not.toContain('ignored_suggestion');
  });

  it('keeping_a_field_on_a_new_order_is_logged_after_the_first_save', async () => {
    const api = createMemoryOrdersApi({ empty: true });
    const navigate = vi.fn();
    render(<OrderPage api={api} id={null} tab={null} lang="vi" locale="vi" theme="light" navigate={navigate} />);
    const name = (await screen.findByLabelText(/^Tên khách hàng/)) as HTMLInputElement;
    fireEvent.change(screen.getByLabelText(/^Địa chỉ$/), { target: { value: 'Địa chỉ khác' } });
    fireEvent.change(name, { target: { value: 'so giao' } });
    fireEvent.click(await screen.findByRole('option', { name: /Sở Giao thông/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Giữ Địa chỉ' }));
    // Nothing to attach it to yet.
    expect(await api.list()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const [order] = await api.list();
    await waitFor(async () => expect((await api.events(order.id)).map((e) => e.action)).toContain('ignored_suggestion'));
  });
});
