// Plan 03b against a real AgentFlow: the module's own OrdersApi (the one the screens use) reading and acting on the flow
// as each person. The host is the sandbox client of that person; /app/objects only answers the app's own caller, so the
// object ids come from the sandbox ids instead.
import { beforeAll, describe, expect, it } from 'vitest';
import type { OrdersApi } from '../src/module/orders-api';
import { ADMIN, newOrder, patch, TAG, userId, waitFor } from './flow-helpers';
import { moduleApi } from './module-helpers';

const taskOf = async (api: OrdersApi, orderId: string, code: string) => (await api.tasks(orderId)).find((t) => t.task_code === code);
const until = (api: OrdersApi, orderId: string, code: string, status: string) =>
  waitFor(`${code} to be ${status}`, async () => {
    const task = await taskOf(api, orderId, code);
    return task?.status === status ? task : undefined;
  });

let orderId = '';

describe('the module’s OrdersApi on the sandbox', () => {
  beforeAll(async () => {
    orderId = await newOrder(`${TAG}M`);
  });

  it('module_reads_tasks_and_my_work', async () => {
    const am = moduleApi('am');
    const tasks = await waitFor('fifteen tasks', async () => {
      const found = await am.tasks(orderId);
      return found.length === 15 ? found : undefined;
    });
    const t11 = tasks.find((t) => t.task_code === 't11')!;
    expect(t11).toMatchObject({ status: 'open', role: 'am', order: orderId });
    expect(await am.task(t11.id)).toMatchObject({ id: t11.id, task_code: 't11' });
    expect(await am.task('00000000-0000-0000-0000-000000000000')).toBeNull();
    // The AM of the order is offered its t11; another AM is not (it is routed to the order's own AM).
    expect((await am.myWork()).some((w) => w.task.id === t11.id)).toBe(true);
    expect((await moduleApi('am2').myWork()).some((w) => w.task.id === t11.id)).toBe(false);
  });

  it('module_acts_through_the_flow_and_logs_it', async () => {
    const am = moduleApi('am');
    const proc = moduleApi('proc');
    const sd = moduleApi('sd');
    await am.act((await taskOf(am, orderId, 't11'))!, 'submitted', '', []);
    const t23 = await until(proc, orderId, 't23', 'open');
    expect((await proc.myWork()).some((w) => w.task.id === t23.id)).toBe(true);
    await proc.act(t23, 'completed', '', []);
    const t31 = await until(sd, orderId, 't31', 'open');
    expect((await sd.myWork()).some((w) => w.task.id === t31.id)).toBe(true);
    await sd.act(t31, 'returned', 'Giá chưa hợp lý', []);
    await until(am, orderId, 't11', 'open');
    const log = await waitFor('the return in the log', async () => {
      const events = await am.events(orderId);
      return events.some((e) => e.action === 'returned_processed') ? events : undefined;
    });
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(['submitted', 'completed', 'returned', 'returned_processed']));
    expect(log.find((e) => e.action === 'returned')).toMatchObject({ reason: 'Giá chưa hợp lý', role: 'sd', task_code: 't31', actor: userId('sd') });
    expect(log.find((e) => e.action === 'returned_processed')).toMatchObject({ actor: null });
  });

  it('module_logs_ignored_warnings_with_the_action', async () => {
    const am = moduleApi('am');
    const t11 = await until(am, orderId, 't11', 'open');
    await am.act(t11, 'submitted', 'Vẫn gửi', [{ source: 'system', level: 'warning', text: 'LN thuần thấp' }]);
    const logged = await waitFor('the ignored warning', async () => (await am.events(orderId)).filter((e) => e.action === 'ignored_warnings').at(-1));
    expect(logged.warnings).toEqual([expect.objectContaining({ source: 'system', level: 'warning', text: 'LN thuần thấp' })]);
  });

  it('module_close_lost_cancels_the_tasks', async () => {
    const id = await newOrder(`${TAG}L`);
    expect((await patch(ADMIN(), 'order', id, { sa: userId('sa') })).status).toBeLessThan(300);
    const sa = moduleApi('sa');
    await waitFor('fifteen tasks', async () => ((await sa.tasks(id)).length === 15 ? true : undefined));
    await sa.closeLost(id, 'Khách chọn nhà thầu khác');
    await waitFor('the tasks to be cancelled', async () => (await sa.tasks(id)).every((t) => t.status !== 'open' && t.status !== 'blocked'));
    const closed = await waitFor('the reason in the log', async () => (await sa.events(id)).find((e) => e.action === 'close_lost'));
    expect(closed.reason).toBe('Khách chọn nhà thầu khác');
  });

  it('module_tasks_of_an_order_one_may_not_read_are_empty_not_an_error', async () => {
    expect(await moduleApi('outsider').tasks(orderId)).toEqual([]);
    expect(await moduleApi('outsider').task('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('module_my_work_never_throws_for_a_person_with_no_work', async () => {
    expect(Array.isArray(await moduleApi('acc').myWork())).toBe(true);
    expect(Array.isArray(await moduleApi('sa').myWork())).toBe(true);
  });
});
