// @vitest-environment jsdom
// The final review's findings on plan 03b, one test each (Important 1-7, and the Minors that corrupt data or break the plan's a11y).
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createHttpOrdersApi } from '../../src/module/http-orders-api.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';
import { OrdersError, type OrdersApi, type OrderTask } from '../../src/module/orders-api.js';
import { useFlow } from '../../src/module/useFlow.js';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { fakeBackend } from './fake-backend.js';
import { testHost } from './test-host.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { FlowTab } = await import('../../src/module/tabs/FlowTab.js');
const { HistoryTab } = await import('../../src/module/tabs/HistoryTab.js');
const { App } = await import('../../src/module/App.js');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const memory = (options: MemoryOptions = {}) => createMemoryOrdersApi(options);
const taskOf = async (api: OrdersApi, code: string): Promise<OrderTask> => (await api.tasks('o1')).find((t) => t.task_code === code)!;
const page = (api: OrdersApi, tab: 'flow' | 'history' = 'flow', id: string | null = 'o1') =>
  render(<OrderPage api={api} id={id} tab={tab} lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ flow: FlowTab, history: HistoryTab }} />);
const withSa = async (options: MemoryOptions = {}) => {
  const api = memory({ me: { id: 'u-sa', name: 'Đỗ Thu' }, roles: ['sa'], ...options });
  const loaded = await api.load('o1');
  loaded.draft.order.sa = 'u-sa';
  await api.save(loaded.draft, loaded.records, DEFAULT_CONFIG);
  return api;
};

describe('I1: a saved order whose tasks are not there yet', () => {
  it('is_read_again_until_they_appear', async () => {
    const base = memory({ roles: ['am'] });
    let calls = 0;
    const api: OrdersApi = { ...base, tasks: async (id) => (++calls <= 2 ? [] : base.tasks(id)) };
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await waitFor(() => expect(result.current.tasks).toHaveLength(15), { timeout: 8000 });
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('empty_flow_offers_a_reload', async () => {
    const base = memory({ roles: ['am'] });
    let ready = false;
    const api: OrdersApi = { ...base, tasks: async (id) => (ready ? base.tasks(id) : []) };
    page(api);
    expect(await screen.findByText(/^Quy trình của đơn chưa có task/)).toBeTruthy();
    ready = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(await screen.findByRole('region', { name: 'Việc của bạn' })).toBeTruthy();
  });
});

describe('I2: what the server changed while the person has unsaved edits', () => {
  it('still_shows_in_the_page', async () => {
    const api = await withSa();
    page(api);
    fireEvent.change(await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa'), { target: { value: 'Tên đang gõ dở' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Close-lost (KH không mua)' }));
    fireEvent.change(await screen.findByLabelText('Lý do Close-lost'), { target: { value: 'Khách hủy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận Close-lost' }));
    expect(await screen.findByText(/^Đã đóng · Close-lost — lý do: Khách hủy/, {}, { timeout: 6000 })).toBeTruthy();
    // Their typing is still there (the closed order shows it read-only), and the order is no longer a draft.
    expect(screen.getAllByText('Tên đang gõ dở').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Close-lost (KH không mua)' })).toBeNull();
  });
});

describe('I3: giving up and Reload re-read the order', () => {
  it('both_call_onChanged', async () => {
    const base = memory({ roles: ['am'] });
    let frozen: OrderTask[] | null = null;
    const api: OrdersApi = { ...base, tasks: async (id) => frozen ?? base.tasks(id),
      act: async (task, outcome, ...rest) => {
        frozen = (await base.tasks(task.order)).map((t) => (t.id === task.id ? { ...t, status: 'done', outcome, done_at: null } : t));
        await base.act(task, outcome, ...rest);
      } };
    const changed = vi.fn();
    const { result } = renderHook(() => useFlow(api, 'o1', changed));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    vi.useFakeTimers();
    await act(async () => {
      const acting = result.current.act(result.current.tasks.find((t) => t.task_code === 't11')!, 'submitted', '', []);
      await vi.advanceTimersByTimeAsync(60_000);
      await acting;
    });
    expect(result.current.stale).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
    frozen = null;
    await act(async () => { result.current.reload(); await vi.advanceTimersByTimeAsync(10); });
    expect(changed).toHaveBeenCalledTimes(2);
  });
});

describe('I4: a refused action', () => {
  it('reads_the_board_again_so_the_stale_card_goes', async () => {
    const base = memory({ roles: ['proc'] });
    await base.act(await taskOf(base, 't11'), 'submitted', '', []);
    // Somebody else finished the task first: the server refuses ours.
    const api: OrdersApi = { ...base, act: async (task, outcome, ...rest) => {
      await base.act(task, outcome, ...rest);
      throw new OrdersError('WORK_NOT_CLAIMANT', 'Task đã có người nhận', {}, 403);
    } };
    page(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn thành' }));
    expect(await screen.findByText('Task đã có người nhận')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hoàn thành' })).toBeNull());
  });
});

describe('I5: the task route does not redirect', () => {
  it('shows_the_orders_flow_in_place_and_never_navigates', async () => {
    const api = memory({ roles: ['am'] });
    const [task] = await api.tasks('o1');
    const host = testHost(`/tasks/${task.id}`);
    render(<App host={host} api={api} lang="vi" locale="vi" theme="light" />);
    expect(await screen.findByRole('region', { name: 'Bảng quy trình đơn hàng' })).toBeTruthy();
    expect(host.paths).toEqual([]);
  });

  it('an_unreadable_task_shows_my_work_in_place', async () => {
    const host = testHost('/tasks/nope');
    render(<App host={host} api={memory({ roles: ['am'] })} lang="vi" locale="vi" theme="light" />);
    expect(await screen.findByRole('heading', { name: 'Việc của tôi' })).toBeTruthy();
    expect(host.paths).toEqual([]);
  });
});

describe('I6: who closed the order', () => {
  it('the_person_is_logged_with_close_lost_and_the_system_with_its_processing', async () => {
    const b = fakeBackend();
    b.seed('order', { code: 'TM-1', status: 'in_progress' }, 'o1');
    await createHttpOrdersApi(b.host).closeLost('o1', 'Khách hủy');
    expect(b.all('order_event').map((e) => e.body.action)).toEqual(['close_lost']);
    expect(b.all('order_event')[0].body).toMatchObject({ order: 'o1', reason: 'Khách hủy', actor: 'u-am' });
    // The same on the memory api: the person's line, then the workflow's.
    const api = memory();
    await api.closeLost('o1', 'Khách hủy');
    const log = await api.events('o1');
    expect(log.find((e) => e.action === 'close_lost')).toMatchObject({ actor: 'u-am', reason: 'Khách hủy' });
    expect(log.find((e) => e.action === 'close_lost_processed')).toMatchObject({ actor: null, reason: 'Khách hủy' });
  });

  it('the_history_names_both_lines', async () => {
    const api = memory();
    await api.closeLost('o1', 'Khách hủy');
    page(api, 'history');
    const list = await screen.findByRole('list', { name: 'Lịch sử xử lý' });
    expect(within(list).getByText('Đã xử lý Close-lost')).toBeTruthy();
    expect(within(list).getAllByText('Close-lost').length).toBeGreaterThan(0);
  });

  it('a_closed_banner_shows_the_reason_from_either_line', async () => {
    const api = memory();
    await api.closeLost('o1', 'Khách hủy');
    page(api);
    expect(await screen.findByText(/^Đã đóng · Close-lost — lý do: Khách hủy/)).toBeTruthy();
  });
});

describe('I7: reading the flow does not crawl My work', () => {
  it('actionable_lists_only_this_orders_tasks_from_the_work_list', async () => {
    const b = fakeBackend();
    b.seed('order', { code: 'TM-1', status: 'in_progress' }, 'o1');
    b.seed('order', { code: 'TM-2', status: 'in_progress' }, 'o2');
    b.seed('order_task', { order: 'o1', task_code: 't23', role: 'proc', status: 'open', stage: 2 }, 'task-a');
    b.seed('order_task', { order: 'o1', task_code: 't22', role: 'tm', status: 'open', stage: 2, claimed_by: 'u-am' }, 'task-b');
    b.seed('order_task', { order: 'o2', task_code: 't23', role: 'proc', status: 'open', stage: 2 }, 'task-c');
    const api = createHttpOrdersApi(b.host);
    const before = b.GET.mock.calls.filter(([path]) => String(path).includes('/records/')).length;
    const ids = await api.actionable('o1');
    expect([...ids].sort()).toEqual(['task-a', 'task-b']);
    // The work list and the order's own tasks: no record read per row.
    const reads = b.GET.mock.calls.filter(([path]) => String(path).includes('/records/')).length - before;
    expect(reads).toBe(0);
  });

  it('a_failed_work_read_is_a_failed_flow_not_an_empty_one', async () => {
    const base = memory({ roles: ['am'] });
    const api: OrdersApi = { ...base, actionable: async () => { throw new OrdersError('NETWORK', null); } };
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await waitFor(() => expect(result.current.state).toBe('failed'));
  });
});

describe('Minors that corrupt data or break the plan', () => {
  it('M1_each_task_has_its_own_note_and_it_is_cleared_when_the_outcome_stands', async () => {
    const base = memory({ roles: ['sa'] });
    // t40 and t44 are open together after approval; give SA both roles' view of t40 only.
    await base.act(await taskOf(base, 't11'), 'submitted', '', []);
    await base.act(await taskOf(base, 't23'), 'completed', '', []);
    await base.act(await taskOf(base, 't31'), 'approved', '', []);
    // Plan 04: t40 completes only with the customer's draft (BR-44).
    await base.uploadContract('o1', { party: 'customer', supplier: null, step: 'draft', file: new File(['%PDF'], 'kh.pdf'), value: null, advance_percent: null });
    const failing: OrdersApi = { ...base, act: async (...args) => { await base.act(...args); throw new OrdersError('EVENT_NOT_LOGGED', null, {}, 403); } };
    page(failing);
    fireEvent.change(await screen.findByLabelText('Ý kiến / ghi chú'), { target: { value: 'Ghi chú của T40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    expect(await screen.findByText('Kết quả đã được ghi nhưng chưa ghi được vào lịch sử.')).toBeTruthy();
    // The outcome stands, so the note went with it: it must not be sent for the next task.
    await waitFor(() => expect(screen.queryByDisplayValue('Ghi chú của T40')).toBeNull());
  });

  it('M2_a_reload_ends_the_old_wait_loop', async () => {
    const base = memory({ roles: ['am'] });
    let frozen: OrderTask[] | null = null;
    const api: OrdersApi = { ...base, tasks: async (id) => frozen ?? base.tasks(id),
      act: async (task, outcome, ...rest) => {
        frozen = (await base.tasks(task.order)).map((t) => (t.id === task.id ? { ...t, status: 'done', outcome, done_at: null } : t));
        await base.act(task, outcome, ...rest);
      } };
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    vi.useFakeTimers();
    await act(async () => {
      const acting = result.current.act(result.current.tasks.find((t) => t.task_code === 't11')!, 'submitted', '', []);
      await vi.advanceTimersByTimeAsync(2_000);
      await acting;
      // Reload while the first loop is still waiting: that loop must not go on to mark the board stale.
      result.current.reload();
      frozen = null;
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(result.current.stale).toBe(false);
    expect(result.current.busy).toBeNull();
  });

  it('M4_the_panel_says_it_is_working_while_a_task_settles', async () => {
    const base = memory({ roles: ['am'] });
    let frozen: OrderTask[] | null = null;
    const api: OrdersApi = { ...base, tasks: async (id) => frozen ?? base.tasks(id),
      act: async (task, outcome, ...rest) => {
        frozen = (await base.tasks(task.order)).map((t) => (t.id === task.id ? { ...t, status: 'done', outcome, done_at: null } : t));
        await base.act(task, outcome, ...rest);
      } };
    page(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));
    const panel = await screen.findByRole('region', { name: 'Việc của bạn' });
    await waitFor(() => expect(within(panel).getByText('Đang xử lý…')).toBeTruthy());
  });

  it('M7_the_close_lost_error_is_tied_to_its_box', async () => {
    page(await withSa());
    fireEvent.click(await screen.findByRole('button', { name: 'Close-lost (KH không mua)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận Close-lost' }));
    const box = screen.getByLabelText('Lý do Close-lost');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(box.getAttribute('aria-describedby')!)?.textContent).toBe('Cần ghi lý do Close-lost');
  });

  it('M8_the_stage_label_follows_the_language', async () => {
    const api = memory({ roles: ['am'] });
    render(<OrderPage api={api} id="o1" tab="flow" lang="en" locale="en" theme="light" navigate={vi.fn()} tabs={{ flow: FlowTab }} />);
    const list = await screen.findByRole('list', { name: 'Order stages' });
    expect(within(list).getAllByRole('listitem')[0].getAttribute('aria-label')).toMatch(/^Stage 1 /);
  });

  it('M9_history_names_the_task_and_counts_in_english_without_a_wrong_plural', async () => {
    const api = memory();
    await api.act(await taskOf(api, 't11'), 'submitted', '', []);
    page(api, 'history');
    const rows = (await screen.findByRole('list', { name: 'Lịch sử xử lý' })).querySelectorAll('li.event');
    expect(rows[0].textContent).toContain('T11 · Lập đơn hàng & gửi duyệt');
    cleanup();
    render(<OrderPage api={api} id="o1" tab="history" lang="en" locale="en" theme="light" navigate={vi.fn()} tabs={{ history: HistoryTab }} />);
    expect(await screen.findByText('1 action(s)')).toBeTruthy();
  });

  it('M10_history_is_ordered_by_time_not_by_text', async () => {
    const b = fakeBackend();
    // 18:54 at +07:00 is 11:54 UTC: later than 11:00Z although it sorts before it as text.
    b.seed('order_event', { order: 'o1', action: 'completed', at: '2026-11-03T18:54:44.945958101+07:00' }, 'e-later');
    b.seed('order_event', { order: 'o1', action: 'submitted', at: '2026-11-03T11:00:00.000Z' }, 'e-earlier');
    expect((await createHttpOrdersApi(b.host).events('o1')).map((e) => e.id)).toEqual(['e-earlier', 'e-later']);
  });
});
