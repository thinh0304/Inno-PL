// @vitest-environment jsdom
// The final review's findings on plan 02b, one test each (Critical 1, Important 2–8).
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createHttpOrdersApi } from '../../src/module/http-orders-api.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import { OrdersError, type OrdersApi } from '../../src/module/orders-api.js';
import { applyCreatedIds, blankDraft, newLine, saveOrder } from '../../src/module/save-plan.js';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { fakeBackend } from './fake-backend.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { LinesTab } = await import('../../src/module/tabs/LinesTab.js');
const { PlTab } = await import('../../src/module/tabs/PlTab.js');

afterEach(cleanup);
const C = DEFAULT_CONFIG;

function twoLineDraft() {
  const draft = blankDraft('u-am');
  Object.assign(draft.order, { customer_name: 'Công ty Mẫu', internal_contract_no: 'TM-1', content: 'Thiết bị', customer_tier: 'potential', debt_days: 30 });
  draft.finance.sales_cost = 0;
  draft.lines = [1, 2].map((n) => ({ ...newLine(`new:${n}`, n, C), name: `Dòng ${n}`, unit: 'Cái', quantity: 1,
    price: { unit_price: 10, discount_pct: 0, vat_rate: 0.08, unit_cost: 8, supplier: 's1' } }));
  return draft;
}

describe('final review fixes', () => {
  it('C1: a retry after a failed save reads the order first and never duplicates', async () => {
    const api = createMemoryOrdersApi({ empty: true, failAfter: 4 });
    const draft = twoLineDraft();
    const error = await saveOrder(api, draft, null, C, false).catch((e: unknown) => e) as OrdersError;
    const retry = applyCreatedIds(draft, error.created);
    // The hook could not read the order back (the network was still down): saved is still null.
    const done = await saveOrder(api, retry, null, C, true);
    expect(done.records.lines).toHaveLength(2);
    expect(done.records.finance).toHaveLength(1);
    expect(done.records.goods_prices).toHaveLength(2);
  });

  it('C1: when the order cannot be read back, Save again writes nothing', async () => {
    const base = createMemoryOrdersApi({ empty: true, failAfter: 4 });
    const draft = twoLineDraft();
    const error = await saveOrder(base, draft, null, C, false).catch((e: unknown) => e) as OrdersError;
    const offline: OrdersApi = { ...base, load: async () => { throw new OrdersError('NETWORK', null); } };
    await expect(saveOrder(offline, applyCreatedIds(draft, error.created), null, C, true)).rejects.toMatchObject({ code: 'NETWORK' });
    // Only what the first attempt created: the retry wrote nothing.
    expect((await base.load(error.created['new:order'])).records.lines).toHaveLength(1);
  });

  it('I2: fields are read-only while a save runs, so nothing typed is lost', async () => {
    render(<OrderPage api={createMemoryOrdersApi({ delayMs: 80 })} id="o1" tab={null} lang="vi" locale="vi" theme="light" navigate={vi.fn()} />);
    const name = await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Tên mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect((screen.getByLabelText(/^Mã khách hàng/) as HTMLInputElement).readOnly).toBe(true));
    fireEvent.change(screen.getByLabelText(/^Mã khách hàng/), { target: { value: 'XYZ' } });
    await waitFor(() => expect((screen.getByLabelText(/^Mã khách hàng/) as HTMLInputElement).readOnly).toBe(false));
    expect((screen.getByLabelText(/^Mã khách hàng/) as HTMLInputElement).value).toBe('BARRIA');
  });

  it('I3: deleting a line drops its format errors, so Save is not stuck', async () => {
    render(<OrderPage api={createMemoryOrdersApi()} id="o1" tab="lines" lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ lines: LinesTab }} />);
    const qty = await screen.findByLabelText('Số lượng dòng 2');
    fireEvent.change(qty, { target: { value: 'abc' } });
    expect(screen.getByRole('button', { name: 'Lưu' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dòng 2' }));
    expect(screen.getByRole('button', { name: 'Lưu' }).getAttribute('aria-disabled')).toBe('false');
  });

  it('I4: a stale write that someone else really changed is a conflict, not an overwrite', async () => {
    const b = fakeBackend();
    const api = createHttpOrdersApi(b.host);
    const first = await api.save(twoLineDraft(), null, C);
    b.touch('order', first.draft.order.id!, { content: 'Nội dung của SA' });
    const next = structuredClone(first.draft);
    next.order.content = 'Nội dung của AM';
    await expect(api.save(next, first.records, C)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(b.all('order')[0].body.content).toBe('Nội dung của SA');
  });

  it('I5: after a save the editor sees the P&L being computed, then the official figures', async () => {
    const api = createMemoryOrdersApi({ computeDelayMs: 150 });
    render(<OrderPage api={api} id="o1" tab="pl" lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ pl: PlTab }} />);
    await screen.findByText('Báo cáo P&L đơn hàng');
    fireEvent.change(screen.getByDisplayValue('Trung tâm CNTT Bà Rịa'), { target: { value: 'Tên mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đang tính P&L chính thức…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/^Số chính thức tính lúc/)).toBeTruthy(), { timeout: 4000 });
  });

  it('I6: a new order switches tabs before it is saved', async () => {
    render(<OrderPage api={createMemoryOrdersApi()} id={null} tab={null} lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ lines: LinesTab }} />);
    const lines = await screen.findByRole('tab', { name: 'Danh mục Thiết bị / Dịch vụ' });
    fireEvent.click(lines);
    expect(lines.getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('Tổng hợp doanh thu – giá vốn')).toBeTruthy();
  });

  it('I7: a 404 of any code counts as "may not read", not as a failure', async () => {
    const b = fakeBackend((method, entity) => (method === 'QUERY' && entity === 'order_pl' ? { status: 404, type: 'NOT_FOUND' } : null));
    await expect(createHttpOrdersApi(b.host).canRead('order_pl')).resolves.toBe(false);
  });

  it('I7: what the person may not read is not even asked for', async () => {
    const b = fakeBackend((method, entity) => (method === 'QUERY' && ['order_pl', 'order_pl_goods', 'goods_line_price', 'purchase_proposal'].includes(entity)
      ? { status: 403, type: 'FORBIDDEN' } : null));
    b.seed('order', { customer_name: 'X', status: 'draft' }, 'o1');
    const api = createHttpOrdersApi(b.host);
    await api.access();
    b.POST.mockClear();
    await api.load('o1');
    const asked = b.POST.mock.calls.map(([, init]) => (init as unknown as { params: { path: { entity_id: string } } }).params.path.entity_id);
    expect(asked).not.toContain('e-order_pl');
    expect(asked).not.toContain('e-goods_line_price');
  });

  it('I8: an invalid grid cell says why, next to it', async () => {
    render(<OrderPage api={createMemoryOrdersApi()} id="o1" tab="lines" lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ lines: LinesTab }} />);
    const price = await screen.findByLabelText('Đơn giá bán dòng 1');
    await act(async () => { fireEvent.change(price, { target: { value: '21,000' } }); });
    const id = price.getAttribute('aria-describedby');
    expect(id && document.getElementById(id)?.textContent).toBe('Số tiền ≥ 0, dấu chấm phân cách nghìn');
  });
});
