import { describe, expect, it } from 'vitest';
import { createHttpOrdersApi } from '../../src/module/http-orders-api.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import type { OrderTask, OrdersApi } from '../../src/module/orders-api.js';
import { blankDraft, newLine } from '../../src/module/save-plan.js';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { fakeBackend } from './fake-backend.js';

const task = async (api: OrdersApi, id: string, code: string): Promise<OrderTask> => (await api.tasks(id)).find((t) => t.task_code === code)!;
const status = async (api: OrdersApi, id: string, code: string) => (await task(api, id, code)).status;

describe('the flow through the memory API', () => {
  it('a_new_order_gets_fifteen_tasks_with_t11_open', async () => {
    const api = createMemoryOrdersApi({ empty: true });
    const draft = blankDraft('u-am');
    Object.assign(draft.order, { customer_name: 'Công ty Mẫu', internal_contract_no: 'TM-1', content: 'Thiết bị', customer_tier: 'potential', debt_days: 30 });
    draft.finance.sales_cost = 0;
    draft.lines = [{ ...newLine('new:1', 1, DEFAULT_CONFIG), name: 'Dòng 1', unit: 'Cái', quantity: 1,
      price: { unit_price: 10, discount_pct: 0, vat_rate: 0.08, unit_cost: 8, supplier: 's1' } }];
    const saved = await api.save(draft, null, DEFAULT_CONFIG);
    const tasks = await api.tasks(saved.draft.order.id!);
    expect(tasks).toHaveLength(15);
    expect(tasks.filter((t) => t.status === 'open').map((t) => t.task_code)).toEqual(['t11']);
    expect(saved.draft.order.status).toBe('draft');
  });

  it('submit_then_approve_walks_the_flow', async () => {
    const api = createMemoryOrdersApi();
    expect(await status(api, 'o1', 't11')).toBe('open');
    await api.act(await task(api, 'o1', 't11'), 'submitted', '', []);
    expect((await api.load('o1')).draft.order.status).toBe('in_progress');
    expect(await status(api, 'o1', 't23')).toBe('open');
    await api.act(await task(api, 'o1', 't23'), 'completed', '', []);
    expect(await status(api, 'o1', 't31')).toBe('open');
    await api.act(await task(api, 'o1', 't31'), 'approved', '', []);
    const loaded = await api.load('o1');
    expect(loaded.records.order).toMatchObject({ body: { approved: true, stage: 4 } });
    expect(await status(api, 'o1', 't40')).toBe('open');
    expect(await status(api, 'o1', 't44')).toBe('open');
    // The P&L was computed once more for the approval, and it is later than the approval.
    const body = (loaded.records.order as unknown as { body: { approved_at: string } }).body;
    expect(Date.parse(String(loaded.official.order_pl!.computed_at))).toBeGreaterThanOrEqual(Date.parse(body.approved_at));
    const log = await api.events('o1');
    expect(log.map((e) => e.action)).toEqual(['submitted', 'completed', 'approved', 'approved']);
  });

  it('returning_needs_a_reason_and_reopens_t11', async () => {
    const api = createMemoryOrdersApi();
    await api.act(await task(api, 'o1', 't11'), 'submitted', '', []);
    await api.act(await task(api, 'o1', 't23'), 'completed', '', []);
    await expect(api.act(await task(api, 'o1', 't31'), 'returned', ' ', [])).rejects.toMatchObject({ code: 'ENTITY_VALIDATION_RULE_FAILED' });
    await api.act(await task(api, 'o1', 't31'), 'returned', 'Giá chưa hợp lý', []);
    expect(await status(api, 'o1', 't11')).toBe('open');
    expect(await status(api, 'o1', 't23')).toBe('blocked');
    expect((await api.load('o1')).draft.order.status).toBe('draft');
    expect((await api.events('o1')).map((e) => e.action)).toContain('returned_processed');
  });

  it('ignored_warnings_are_logged_with_the_action', async () => {
    const api = createMemoryOrdersApi();
    await api.act(await task(api, 'o1', 't11'), 'submitted', '', [{ source: 'system', level: 'warning', text: 'Lãi gộp thấp' }]);
    const log = await api.events('o1');
    expect(log.find((e) => e.action === 'ignored_warnings')!.warnings).toEqual([{ source: 'system', level: 'warning', text: 'Lãi gộp thấp' }]);
  });

  it('close_lost_cancels_the_tasks_and_logs_why', async () => {
    const api = createMemoryOrdersApi();
    await expect(api.closeLost('o1', '')).rejects.toMatchObject({ code: 'STAGE_TRANSITION_NOT_ALLOWED' });
    await api.closeLost('o1', 'Khách chọn nhà thầu khác');
    expect((await api.tasks('o1')).filter((t) => t.status === 'open' || t.status === 'blocked')).toEqual([]);
    expect((await api.events('o1')).find((e) => e.action === 'close_lost')!.reason).toBe('Khách chọn nhà thầu khác');
  });

  it('my_work_lists_held_tasks_first', async () => {
    const api = createMemoryOrdersApi({ roles: ['am'] });
    const work = await api.myWork();
    expect(work.map((w) => [w.task.task_code, w.mine])).toEqual([['t11', false], ['t11', false]]);
    await api.act(await task(api, 'o2', 't11'), 'submitted', '', []);
    expect((await api.myWork()).every((w) => w.task.role === 'am')).toBe(true);
  });
});

describe('the flow through the HTTP API', () => {
  const openTask = (b: ReturnType<typeof fakeBackend>, over: Record<string, unknown> = {}) =>
    b.seed('order_task', { order: 'o1', task_code: 't22', role: 'tm', status: 'open', stage: 2, ...over }, 'task-1');

  it('act_claims_then_patches_then_logs', async () => {
    const b = fakeBackend();
    b.seed('order', { code: 'TM-1', customer_name: 'X', status: 'in_progress' }, 'o1');
    openTask(b);
    const api = createHttpOrdersApi(b.host);
    const [t] = await api.tasks('o1');
    await api.act(t, 'returned', 'Thiếu thông số', [{ source: 'ai', level: 'warning', text: 'x' }]);
    const claim = b.POST.mock.calls.find(([path]) => String(path).endsWith('/work/claim'));
    expect(claim).toBeTruthy();
    expect(b.all('order_task')[0].body).toMatchObject({ claimed_by: 'u-am', status: 'done', outcome: 'returned', reason: 'Thiếu thông số' });
    expect(b.all('order_event').map((e) => e.body.action)).toEqual(['returned', 'ignored_warnings']);
    expect(b.all('order_event')[0].body).toMatchObject({ order: 'o1', task: 'task-1', task_code: 't22', role: 'tm', actor: 'u-am', reason: 'Thiếu thông số' });
  });

  it('a_task_held_by_me_is_not_claimed_again', async () => {
    const b = fakeBackend();
    openTask(b, { claimed_by: 'u-am' });
    const api = createHttpOrdersApi(b.host);
    await api.act((await api.tasks('o1'))[0], 'approved', '', []);
    expect(b.POST.mock.calls.some(([path]) => String(path).endsWith('/work/claim'))).toBe(false);
    expect(b.all('order_task')[0].body.status).toBe('done');
  });

  it('my_work_reads_the_work_list', async () => {
    const b = fakeBackend();
    b.seed('order', { code: 'TM-1', customer_name: 'Công ty A', status: 'in_progress' }, 'o1');
    openTask(b, { claimed_by: 'u-am' });
    b.seed('order_task', { order: 'o1', task_code: 't23', role: 'proc', status: 'open', stage: 2 }, 'task-2');
    const work = await createHttpOrdersApi(b.host).myWork();
    expect(work.map((w) => [w.task.id, w.mine, w.orderCode, w.customerName])).toEqual([
      ['task-1', true, 'TM-1', 'Công ty A'], ['task-2', false, 'TM-1', 'Công ty A']]);
  });

  it('close_lost_writes_the_status_and_reason', async () => {
    const b = fakeBackend();
    b.seed('order', { code: 'TM-1', status: 'in_progress' }, 'o1');
    await createHttpOrdersApi(b.host).closeLost('o1', 'Khách hủy');
    expect(b.all('order')[0].body).toMatchObject({ status: 'close_lost', close_reason: 'Khách hủy' });
  });

  it('tasks_are_returned_in_flow_order', async () => {
    const b = fakeBackend();
    b.seed('order_task', { order: 'o1', task_code: 't31', status: 'blocked' });
    b.seed('order_task', { order: 'o1', task_code: 't11', status: 'done' });
    expect((await createHttpOrdersApi(b.host).tasks('o1')).map((t) => t.task_code)).toEqual(['t11', 't31']);
  });
});
