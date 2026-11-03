// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import { OrdersError, type OrdersApi, type OrderTask } from '../../src/module/orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { HistoryTab } = await import('../../src/module/tabs/HistoryTab.js');

afterEach(cleanup);

const show = (api: OrdersApi) => render(<OrderPage api={api} id="o1" tab="history" lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ history: HistoryTab }} />);
const taskOf = async (api: OrdersApi, code: string): Promise<OrderTask> => (await api.tasks('o1')).find((t) => t.task_code === code)!;
const log = () => screen.findByRole('list', { name: 'Lịch sử xử lý' });
const rows = async () => (await log()).querySelectorAll<HTMLElement>(':scope > li.event');

async function returnedOrder() {
  const api = createMemoryOrdersApi();
  await api.act(await taskOf(api, 't11'), 'submitted', '', []);
  await api.act(await taskOf(api, 't23'), 'completed', '', []);
  await api.act(await taskOf(api, 't31'), 'returned', 'Giá chưa hợp lý', []);
  return api;
}

describe('the history tab (FR-6.9, FR-6.10)', () => {
  it('history_lists_newest_first_with_who_what_and_why', async () => {
    show(await returnedOrder());
    const items = [...(await rows())];
    // Newest first: the workflow's own line for the return, then the person's.
    expect(items[0].textContent).toContain('Đã xử lý trả lại');
    const returned = items.find((li) => li.getAttribute('data-action') === 'returned')!;
    expect(returned.textContent).toContain('Nguyễn Thuận');
    expect(returned.textContent).toContain('Trả lại');
    expect(returned.textContent).toContain('T31');
    expect(returned.textContent).toContain('Lý do: Giá chưa hợp lý');
    expect(returned.textContent).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    expect(items.at(-1)!.getAttribute('data-action')).toBe('submitted');
  });

  it('system_lines_show_as_system', async () => {
    show(await returnedOrder());
    const processed = [...(await rows())].find((li) => li.getAttribute('data-action') === 'returned_processed')!;
    expect(processed.textContent).toContain('Hệ thống');
    expect(processed.textContent).not.toContain('Nguyễn Thuận');
  });

  it('ignored_warnings_list_each_warning_with_source_and_level', async () => {
    const api = createMemoryOrdersApi();
    await api.act(await taskOf(api, 't11'), 'submitted', 'Vẫn gửi', [
      { source: 'system', level: 'warning', text: 'LN thuần thấp' }, { source: 'ai', level: 'critical', text: 'AI khuyến nghị trả lại' }]);
    show(api);
    const ignored = [...(await rows())].find((li) => li.getAttribute('data-action') === 'ignored_warnings')!;
    const warnings = within(ignored).getAllByRole('listitem');
    expect(warnings).toHaveLength(2);
    expect(warnings[0].textContent).toContain('Hệ thống');
    expect(warnings[0].textContent).toContain('Cảnh báo');
    expect(warnings[0].textContent).toContain('LN thuần thấp');
    expect(warnings[1].textContent).toContain('AI');
    expect(warnings[1].textContent).toContain('Nghiêm trọng');
    expect(warnings[1].textContent).toContain('AI khuyến nghị trả lại');
  });

  it('filter_shows_only_ignored_warnings_and_counts_them', async () => {
    const api = createMemoryOrdersApi();
    await api.act(await taskOf(api, 't11'), 'submitted', '', [{ source: 'system', level: 'warning', text: 'LN thuần thấp' }]);
    show(api);
    const filter = await screen.findByRole('button', { name: /^Chỉ cảnh báo bị bỏ qua/ });
    expect(filter.textContent).toContain('1');
    expect(filter.getAttribute('aria-pressed')).toBe('false');
    expect((await rows()).length).toBeGreaterThan(1);
    fireEvent.click(filter);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chỉ cảnh báo bị bỏ qua/ }).getAttribute('aria-pressed')).toBe('true'));
    const only = [...(await rows())];
    expect(only).toHaveLength(1);
    expect(only[0].getAttribute('data-action')).toBe('ignored_warnings');
  });

  it('empty_history_says_so', async () => {
    show(createMemoryOrdersApi());
    expect(await screen.findByText('Chưa có thao tác nào.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Lịch sử xử lý' })).toBeNull();
  });

  it('a_filter_with_no_match_says_so', async () => {
    const api = createMemoryOrdersApi();
    await api.act(await taskOf(api, 't11'), 'submitted', '', []);
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: /^Chỉ cảnh báo bị bỏ qua/ }));
    expect(await screen.findByText('Không có mục nào.')).toBeTruthy();
  });

  it('the_history_of_an_order_the_person_may_not_read_says_so', async () => {
    const base = createMemoryOrdersApi();
    show({ ...base, tasks: async () => { throw new OrdersError('FORBIDDEN', null, {}, 403); } });
    expect(await screen.findByText('Bạn không có quyền xem quy trình của đơn này.')).toBeTruthy();
  });
});
