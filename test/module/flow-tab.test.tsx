// @vitest-environment jsdom
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';
import { OrdersError, type OrdersApi, type OrderTask } from '../../src/module/orders-api.js';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { FlowTab } = await import('../../src/module/tabs/FlowTab.js');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function show(api: OrdersApi, tab: 'flow' | 'history' = 'flow', id = 'o1') {
  render(<OrderPage api={api} id={id} tab={tab} lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ flow: FlowTab }} />);
  return api;
}
const memory = (options: MemoryOptions = {}) => createMemoryOrdersApi(options);
const taskOf = async (api: OrdersApi, code: string, id = 'o1'): Promise<OrderTask> => (await api.tasks(id)).find((t) => t.task_code === code)!;
const walkTo = async (api: OrdersApi, ...steps: [string, Parameters<OrdersApi['act']>[1], string?][]) => {
  for (const [code, outcome, reason] of steps) await api.act(await taskOf(api, code), outcome, reason ?? '', []);
};
const yourWork = () => screen.findByRole('region', { name: 'Việc của bạn' });
const card = (code: string) => screen.getByRole('article', { name: new RegExp(`^${code.toUpperCase()} · `) });
/** The order as the server computed its P&L, below the threshold. */
const failing = (base: OrdersApi): OrdersApi => ({ ...base,
  load: async (id) => { const l = await base.load(id); return { ...l, official: { ...l.official, order_pl: { ...(l.official.order_pl ?? {}), passed: false } } }; } });
/** Reads show the order right after the person's write, before the workflow has run, until `release()`. */
function lagging(base: OrdersApi) {
  let frozen: OrderTask[] | null = null;
  const api: OrdersApi = { ...base, tasks: async (id) => frozen ?? base.tasks(id),
    act: async (task, outcome, ...rest) => {
      const before = await base.tasks(task.order);
      frozen = before.map((t) => (t.id === task.id ? { ...t, status: 'done', outcome, done_at: null } : t));
      await base.act(task, outcome, ...rest);
    } };
  return { api, release: () => { frozen = null; } };
}

describe('the stage bar and the board', () => {
  it('stage_bar_shows_seven_stages_with_who_is_awaited', async () => {
    show(memory({ roles: ['am'] }));
    const list = await screen.findByRole('list', { name: 'Các giai đoạn của đơn' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[0].getAttribute('aria-label')).toBe('GĐ1 Khởi tạo đơn hàng: Đang xử lý · chờ AM');
    expect(items[1].getAttribute('aria-label')).toBe('GĐ2 Thẩm định: Chờ');
  });

  it('board_cards_show_status_due_and_who_they_wait_for', async () => {
    show(memory({ roles: ['am'] }));
    await screen.findByRole('region', { name: 'Bảng quy trình đơn hàng' });
    expect(within(card('t11')).getByText('Đang chờ làm')).toBeTruthy();
    expect(within(card('t11')).getByText(/^Hạn \d{2}\/\d{2}\/2026/)).toBeTruthy();
    expect(within(card('t31')).getByText(/Chưa tới lượt/)).toBeTruthy();
    expect(within(card('t31')).getByText('Chờ AM')).toBeTruthy();
    expect(within(card('t11')).getByText('AM')).toBeTruthy();
  });
});

describe('your work', () => {
  it('your_work_lists_open_tasks_with_buttons_by_role', async () => {
    const api = memory({ roles: ['proc'] });
    await walkTo(api, ['t11', 'submitted']);
    show(api);
    const panel = await yourWork();
    expect(within(panel).getByRole('button', { name: 'Hoàn thành' })).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Duyệt' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Gửi duyệt' })).toBeNull();
  });

  it('no_buttons_without_the_role_or_when_held_by_someone_else', async () => {
    const api = memory({ roles: ['am'] });
    await walkTo(api, ['t11', 'submitted']);
    show(api);
    const panel = await yourWork();
    expect(within(panel).queryByRole('button')).toBeNull();
    expect(within(panel).getByText('Không có việc nào đang chờ bạn.')).toBeTruthy();
    expect(within(panel).getByText('Đang chờ PROC xử lý.')).toBeTruthy();
    cleanup();
    // The same task held by Trần Văn Kỳ: the card says so, and nobody else gets its buttons.
    const base = memory({ roles: ['proc'] });
    await walkTo(base, ['t11', 'submitted']);
    show({ ...base, tasks: async (id) => (await base.tasks(id)).map((t) => (t.task_code === 't23' ? { ...t, claimedBy: 'u-tm' } : t)), myWork: async () => [] });
    expect(await within(await screen.findByRole('article', { name: /^T23 · / })).findByText('Do Trần Văn Kỳ giữ')).toBeTruthy();
    expect(within(await yourWork()).queryByRole('button')).toBeNull();
  });

  it('submit_is_locked_while_unsaved_or_incomplete', async () => {
    show(memory({ roles: ['am'] }));
    const submit = await screen.findByRole('button', { name: 'Gửi duyệt' });
    expect(submit.getAttribute('aria-disabled')).toBe('false');
    fireEvent.change(screen.getByDisplayValue('Trung tâm CNTT Bà Rịa'), { target: { value: 'Tên mới' } });
    expect(screen.getByRole('button', { name: 'Gửi duyệt' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Lưu thay đổi trước khi gửi duyệt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi duyệt' }));
    expect(await screen.findByRole('button', { name: 'Gửi duyệt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi duyệt' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi duyệt' }).getAttribute('aria-disabled')).toBe('false'));
  });

  it('submit_is_locked_while_required_fields_are_missing', async () => {
    const api = memory({ roles: ['am'] });
    const loaded = await api.load('o1');
    loaded.draft.order.content = '';
    await api.save(loaded.draft, loaded.records, DEFAULT_CONFIG);
    show(api);
    const submit = await screen.findByRole('button', { name: 'Gửi duyệt' });
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/^Còn \d+ mục chưa hợp lệ hoặc còn thiếu$/)).toBeTruthy();
    const spy = vi.spyOn(api, 'act');
    fireEvent.click(submit);
    expect(spy).not.toHaveBeenCalled();
  });

  it('submit_moves_the_order_on', async () => {
    const api = memory({ roles: ['am'] });
    const spy = vi.spyOn(api, 'act');
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));
    await waitFor(() => expect(within(card('t23')).getByText('Đang chờ làm')).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0].slice(1, 3)).toEqual(['submitted', '']);
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));
    expect(within(card('t11')).getByText('Đã xong')).toBeTruthy();
  });

  it('double_press_acts_once', async () => {
    const api = memory({ roles: ['am'] });
    const spy = vi.spyOn(api, 'act');
    show(api);
    const button = await screen.findByRole('button', { name: 'Gửi duyệt' });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    await waitFor(() => expect(within(card('t23')).getByText('Đang chờ làm')).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('reasons and warnings', () => {
  it('reason_rules', async () => {
    const api = memory({ roles: ['sd'] });
    await walkTo(api, ['t11', 'submitted'], ['t23', 'completed']);
    const spy = vi.spyOn(api, 'act');
    show(api);
    const panel = await yourWork();
    // Sending back needs a reason: empty and spaces are refused, with the message tied to the box.
    fireEvent.click(within(panel).getByRole('button', { name: 'Trả lại' }));
    expect(await screen.findByText('Cần ghi lý do để trả lại hoặc yêu cầu sửa')).toBeTruthy();
    const note = screen.getByLabelText('Ý kiến / ghi chú');
    expect(note.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(note.getAttribute('aria-describedby')!)?.textContent).toBe('Cần ghi lý do để trả lại hoặc yêu cầu sửa');
    fireEvent.change(note, { target: { value: '   ' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Trả lại' }));
    expect(spy).not.toHaveBeenCalled();
    fireEvent.change(note, { target: { value: ' Giá chưa hợp lý ' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Trả lại' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0].slice(1, 4)).toEqual(['returned', 'Giá chưa hợp lý', []]);
  });

  it('a_plain_warning_is_listed_and_logged_without_a_reason', async () => {
    const base = failing(memory({ roles: ['am'] }));
    const spy = vi.spyOn(base, 'act');
    show(base);
    // t11 with a P&L below the threshold: a warning, logged, no reason needed. (The demo order is also past its SLA by the
    // real clock, so the box may list a second, late warning: the count is not the point.)
    expect(await screen.findByText(/^⚠ \d+ cảnh báo sẽ được ghi vào lịch sử nếu bạn tiếp tục$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi duyệt' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0][3]).toEqual(expect.arrayContaining([{ source: 'system', level: 'warning', text: expect.stringContaining('thấp hơn ngưỡng') }]));
    await waitFor(() => expect(within(card('t23')).getByText('Đang chờ làm')).toBeTruthy());
    const logged = (await base.events('o1')).find((e) => e.action === 'ignored_warnings')!.warnings;
    expect(logged.every((w) => w.source === 'system' && w.level === 'warning')).toBe(true);
    expect(logged.some((w) => w.text.includes('thấp hơn ngưỡng'))).toBe(true);
  });

  it('a_critical_warning_needs_a_reason_to_go_on', async () => {
    const base = failing(memory({ roles: ['sd'] }));
    await walkTo(base, ['t11', 'submitted'], ['t23', 'completed']);
    const spy = vi.spyOn(base, 'act');
    show(base);
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    expect(await screen.findByText('Có cảnh báo nghiêm trọng — cần ghi lý do để tiếp tục')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Ý kiến / ghi chú'), { target: { value: 'SD chấp nhận' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0].slice(1, 3)).toEqual(['approved', 'SD chấp nhận']);
    expect(spy.mock.calls[0][3]).toEqual(expect.arrayContaining([{ source: 'system', level: 'critical', text: expect.stringContaining('thấp hơn ngưỡng') }]));
  });
});

describe('waiting for the workflow', () => {
  it('card_is_locked_until_the_run_settles', async () => {
    const { api, release } = lagging(memory({ roles: ['am'] }));
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));
    const t11 = await screen.findByRole('article', { name: /^T11 · / });
    await waitFor(() => expect(within(t11).getByText('Đang xử lý…')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).toBeNull();
    release();
    await waitFor(() => expect(within(card('t23')).getByText('Đang chờ làm')).toBeTruthy(), { timeout: 6000 });
    expect(within(card('t11')).queryByText('Đang xử lý…')).toBeNull();
  });

  it('settling_gives_up_with_a_reload', async () => {
    const { api, release } = lagging(memory({ roles: ['am'] }));
    show(api);
    const submit = await screen.findByRole('button', { name: 'Gửi duyệt' });
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(submit); await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByText('Chưa cập nhật — quy trình có thể vẫn đang chạy.')).toBeTruthy();
    vi.useRealTimers();
    release();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    await waitFor(() => expect(within(card('t23')).getByText('Đang chờ làm')).toBeTruthy());
    expect(screen.queryByText('Chưa cập nhật — quy trình có thể vẫn đang chạy.')).toBeNull();
  });

  it('event_not_logged_is_reported_but_the_task_is_done', async () => {
    const base = memory({ roles: ['am'] });
    show({ ...base, act: async (...args) => { await base.act(...args); throw new OrdersError('EVENT_NOT_LOGGED', null, {}, 403); } });
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));
    expect(await screen.findByText('Kết quả đã được ghi nhưng chưa ghi được vào lịch sử.')).toBeTruthy();
    await waitFor(() => expect(within(card('t23')).getByText('Đang chờ làm')).toBeTruthy());
  });

  it('a_refused_action_says_why_and_unlocks_the_card', async () => {
    const base = memory({ roles: ['am'] });
    show({ ...base, act: async () => { throw new OrdersError('ENTITY_VALIDATION_RULE_FAILED', 'Đơn đã gửi duyệt — không sửa được', {}, 422); } });
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));
    expect(await screen.findByText('Đơn đã gửi duyệt — không sửa được')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi duyệt' }).getAttribute('aria-disabled')).toBe('false');
  });
});

describe('returned and closed orders', () => {
  it('returned_order_shows_who_sent_it_back_and_why', async () => {
    const api = memory();
    await walkTo(api, ['t11', 'submitted'], ['t23', 'completed'], ['t31', 'returned', 'Giá chưa hợp lý']);
    show(api);
    expect(await screen.findByText(/↩ Nguyễn Thuận trả lại lúc .+ \(T31\): “Giá chưa hợp lý”/)).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Các giai đoạn của đơn' });
    expect(within(list).getAllByRole('listitem')[0].getAttribute('aria-label')).toMatch(/^GĐ1 Khởi tạo đơn hàng: Bị trả lại/);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi duyệt' }));
    await waitFor(() => expect(screen.queryByText(/↩ Nguyễn Thuận trả lại/)).toBeNull());
    expect(within(list).getAllByRole('listitem')[0].getAttribute('aria-label')).not.toMatch(/Bị trả lại/);
  });

  it('close_lost_needs_a_reason_and_closes_the_order', async () => {
    const api = memory({ me: { id: 'u-sa', name: 'Đỗ Thu' }, roles: ['sa'] });
    const loaded = await api.load('o1');
    loaded.draft.order.sa = 'u-sa';
    await api.save(loaded.draft, loaded.records, DEFAULT_CONFIG);
    const spy = vi.spyOn(api, 'closeLost');
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Close-lost (KH không mua)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận Close-lost' }));
    expect(await screen.findByText('Cần ghi lý do Close-lost')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Lý do Close-lost'), { target: { value: 'Khách chọn nhà thầu khác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận Close-lost' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('o1', 'Khách chọn nhà thầu khác'));
    expect(await screen.findByText(/^Đã đóng · Close-lost — lý do: Khách chọn nhà thầu khác/, {}, { timeout: 6000 })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Các giai đoạn của đơn' });
    expect(within(list).getAllByRole('listitem')[0].getAttribute('aria-label')).toMatch(/Close-lost/);
  });

  it('only_the_orders_sales_admin_may_close_lost', async () => {
    show(memory({ roles: ['am'] }));
    await yourWork();
    expect(screen.queryByRole('button', { name: 'Close-lost (KH không mua)' })).toBeNull();
  });

  it('closed_order_has_no_actions', async () => {
    const api = memory();
    await api.closeLost('o1', 'Khách hủy');
    show(api);
    expect(await screen.findByText(/^Đã đóng · Close-lost — lý do: Khách hủy/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Việc của bạn' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Lịch sử' })).toBeTruthy();
  });

  it('forbidden_flow_shows_a_notice', async () => {
    const base = memory();
    show({ ...base, tasks: async () => { throw new OrdersError('FORBIDDEN', null, {}, 403); } });
    expect(await screen.findByText('Bạn không có quyền xem quy trình của đơn này.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Các giai đoạn của đơn' })).toBeNull();
  });
});
