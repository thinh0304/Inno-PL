// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { SurveyTab } = await import('../../src/module/tabs/SurveyTab.js');

afterEach(cleanup);

async function open(id: string | null, api = createMemoryOrdersApi()) {
  render(<OrderPage api={api} id={id} tab="form" lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ form: SurveyTab }} />);
  await screen.findByText('Thông tin đơn hàng');
  return api;
}

const select = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLSelectElement;
const stageRows = () => [...document.querySelectorAll('.stages tbody tr')] as HTMLElement[];

describe('the survey tab', () => {
  it('renewal_shows_last_year_and_locks_lead_source', async () => {
    await open('o1');
    expect(screen.queryByLabelText(/^Doanh thu năm trước/)).toBeNull();
    fireEvent.change(select('Nguồn khách hàng'), { target: { value: 'Mkt' } });
    fireEvent.click(screen.getAllByRole('radio', { name: 'Không' })[0]);
    expect(await screen.findByLabelText(/^Doanh thu năm trước/)).toBeTruthy();
    expect(screen.getByLabelText(/^Số HĐ \/ PO năm trước/)).toBeTruthy();
    const lead = select('Nguồn khách hàng');
    expect(lead.value).toBe('');
    expect(lead.getAttribute('aria-disabled')).toBe('true');
  });

  it('fill_from_previous_order', async () => {
    const api = createMemoryOrdersApi();
    const earlier = await api.load('o2');
    // An earlier order of the same customer as o1 (c2), with a P&L.
    const copy = structuredClone(earlier.draft);
    copy.order.id = undefined;
    copy.order.customer = 'c2';
    copy.finance.id = undefined;
    copy.lines = copy.lines.map((l) => ({ ...l, id: `new:${l.id}`, price: { ...l.price, id: undefined, source: undefined } }));
    const prev = await api.save(copy, null, DEFAULT_CONFIG);
    await open('o1', api);
    fireEvent.click(screen.getAllByRole('radio', { name: 'Không' })[0]);
    const pick = await screen.findByLabelText(/^Lấy số liệu từ đơn trước của KH/);
    await waitFor(() => expect((pick as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(pick, { target: { value: prev.draft.order.id } });
    expect((screen.getByLabelText(/^Doanh thu năm trước/) as HTMLInputElement).value).toBe('156.000.000');
    expect((screen.getByLabelText(/^CPBH năm trước/) as HTMLInputElement).value).toBe('5.000.000');
  });

  it('consult_ticks_only_with_consultant', async () => {
    await open('o1');
    expect(screen.queryByRole('checkbox', { name: 'Proposal' })).toBeNull();
    fireEvent.change(select('NV tư vấn'), { target: { value: 'st5' } });
    expect(screen.getByRole('checkbox', { name: 'Proposal' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'PoC' })).toBeTruthy();
  });

  it('weights_follow_the_configured_set', async () => {
    await open('o1');
    expect(stageRows().map((r) => r.querySelector('.num')!.textContent)).toEqual(['20%', '30%', '10%', '10%', '20%', '10%']);
    expect(screen.getByText('Tổng').closest('tr')!.textContent).toMatch(/100%/);
    expect(document.querySelector('.stages input')).toBeNull();
    fireEvent.click(screen.getAllByRole('radio', { name: 'Không' })[0]);
    await waitFor(() => expect(screen.getByText('Tổng').closest('tr')!.textContent).toMatch(/50%/));
    expect(stageRows()[0].dataset.zero).toBe('true');
  });

  it('fulfillment_is_always_offered', async () => {
    await open('o1');
    const applied = select('Loại HĐ áp ngưỡng LN');
    expect([...applied.options].map((o) => o.textContent)).toEqual(['Tự động · Thương mại 1 lần', 'Thương mại 1 lần', 'Fulfillment']);
    expect(within(screen.getByRole('list', { name: 'Loại hợp đồng (tự nhận)' })).getByText('Thương mại 1 lần')).toBeTruthy();
  });

  it('banner_counts_this_tab', async () => {
    await open(null, createMemoryOrdersApi({ empty: true }));
    // Số HĐ nội bộ, Nội dung, Hạng KH, Số ngày công nợ, Chi phí bán hàng.
    expect(screen.getByText('Còn 5 trường bắt buộc chưa điền — các ô viền đỏ bên dưới.')).toBeTruthy();
  });
});
