// Plan 03 against a real AgentFlow: an order's fifteen tasks are made by a trigger, people only set outcomes, the
// triggers open what is next, a return unlocks the order, approval fixes the P&L once, and the log cannot be edited.
import { as } from '@reflexify/agentflow-sdk/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, create, entityId, eventsOf, finish, listAll, newOrder, orderOf, patch, taskIs, taskOf, tasksOf, tryCreate, userId, waitFor, TAG } from './flow-helpers';

let orderId = '';

describe('the 15-task flow in the sandbox', () => {
  beforeAll(async () => {
    orderId = await newOrder(`${TAG}A`);
  });

  it('order_creation_makes_fifteen_tasks', async () => {
    const tasks = await waitFor('fifteen tasks', async () => {
      const found = await tasksOf(orderId);
      return found.length === 15 ? found : undefined;
    });
    expect(tasks.filter((t) => t.status === 'open').map((t) => t.task_code)).toContain('t11');
    const t11 = tasks.find((t) => t.task_code === 't11')!;
    expect(t11.role).toBe('am');
    expect(t11.am_user).toBe(userId('am'));
  });

  it('t11_can_only_be_finished_as_submitted', async () => {
    const t11 = await taskIs(orderId, 't11', 'open');
    const out = await finish(as('am'), t11, 'completed');
    expect(out.status, JSON.stringify(out.error)).toBe(422);
    expect((await taskOf(orderId, 't11'))!.status).toBe('open');
  });

  it('flow_fields_are_automatic', async () => {
    expect((await patch(as('am'), 'order', orderId, { approved: true })).status).toBe(422);
    expect((await patch(as('am'), 'order', orderId, { pending_roles: ['sd'] })).status).toBe(422);
    // Which tasks apply and whether SD must approve follow these two: only the P&L workflow writes them.
    expect((await patch(as('am'), 'order', orderId, { has_goods: false })).status).toBe(422);
    // The create form does not bind these fields, so asking for them on create changes nothing.
    const sneaky = await create(as('am'), 'order', { customer_name: TAG, am: userId('am'), approved: true });
    expect((await orderOf(sneaky.id)).approved).not.toBe(true);
  });

  it('submit_walks_to_t23_and_locks_the_order', async () => {
    const t11 = await taskIs(orderId, 't11', 'open');
    const out = await finish(as('am'), t11, 'submitted');
    expect(out.status, JSON.stringify(out.error)).toBeLessThan(300);
    const t23 = await taskIs(orderId, 't23', 'open');
    expect(t23.role).toBe('proc');
    // The work list the module's My work reads: t23 is offered to Purchasing, in the shape OrdersApi.myWork expects.
    const { data: work, response } = await as('proc').GET('/work' as never, { params: { query: { view: 'claimable' } } } as never) as { data?: any; response: Response };
    expect(response.status).toBe(200);
    const listed = (Array.isArray(work) ? work : work?.items ?? []) as { entity_id?: string; id?: string; record_id?: string }[];
    expect(listed.some((w) => w.entity_id === entityId('order_task') && (w.record_id ?? w.id) === t23.id), JSON.stringify(work)?.slice(0, 300)).toBe(true);
    // The order itself is written after the tasks, in the same run.
    const order = await waitFor('the order to be in progress', async () => {
      const o = await orderOf(orderId);
      return o.status === 'in_progress' ? o : undefined;
    });
    expect(order.pending_roles).toEqual(['proc']);
    // Sent for approval: the order and its records are fixed for the AM.
    expect((await patch(as('am'), 'order', orderId, { content: 'Đổi sau khi gửi' })).status).toBe(422);
    const lines = (await listAll(ADMIN(), 'order_line')).filter((l) => l.order === orderId);
    expect((await patch(as('am'), 'order_line', lines[0].id, { name: 'Đổi tên' })).status).toBe(422);
    expect((await tryCreate(as('am'), 'order_line', { order: orderId, line_no: 9, item_type_code: 'TB', name: 'Thêm' })).status).toBe(422);
  });

  it('only_the_role_finishes_its_task', async () => {
    const t23 = (await taskOf(orderId, 't23'))!;
    const tm = await finish(as('tm'), t23, 'completed');
    expect(tm.claim, 'tm claims a proc task').toBeGreaterThanOrEqual(400);
    expect(tm.status).toBeGreaterThanOrEqual(400);
    expect((await taskOf(orderId, 't23'))!.status).toBe('open');
  });

  it('proc_finishes_t23_and_sd_gets_t31', async () => {
    const out = await finish(as('proc'), (await taskOf(orderId, 't23'))!, 'completed');
    expect(out.status, JSON.stringify(out.error)).toBeLessThan(300);
    const t31 = await taskIs(orderId, 't31', 'open');
    expect(t31.role).toBe('sd');
  });

  it('return_without_reason_is_refused_and_with_reason_unlocks_the_order', { timeout: 420_000 }, async () => {
    const t31 = (await taskOf(orderId, 't31'))!;
    const bare = await finish(as('sd'), t31, 'returned', '');
    expect(bare.status).toBe(422);
    const out = await finish(as('sd'), t31, 'returned', 'Giá chưa hợp lý');
    expect(out.status, JSON.stringify(out.error)).toBeLessThan(300);
    await taskIs(orderId, 't11', 'open');
    expect((await taskOf(orderId, 't31'))!.status).toBe('blocked');
    await waitFor('the order to be a draft again', async () => (await orderOf(orderId)).status === 'draft');
    expect((await patch(as('am'), 'order', orderId, { content: 'Sửa sau khi bị trả lại' })).status).toBeLessThan(300);
    // The log is written last in the run.
    const logged = await waitFor('the return to be logged', async () => (await eventsOf(orderId)).find((e) => e.action === 'returned_processed'), 60);
    expect(logged.note).toBe('Giá chưa hợp lý');
    expect(logged.task_code).toBe('t31');
  });

  it('approval_sets_approved_and_fixes_the_pl_once', { timeout: 420_000 }, async () => {
    const again = await finish(as('am'), await taskIs(orderId, 't11', 'open'), 'submitted');
    expect(again.status, JSON.stringify(again.error)).toBeLessThan(300);
    await finish(as('proc'), await taskIs(orderId, 't23', 'open'), 'completed');
    const t31 = await taskIs(orderId, 't31', 'open');
    const out = await finish(as('sd'), t31, 'approved');
    expect(out.status, JSON.stringify(out.error)).toBeLessThan(300);
    await taskIs(orderId, 't40', 'open');
    expect((await taskIs(orderId, 't44', 'open')).role).toBe('proc');
    const order = await waitFor('the approval', async () => ((await orderOf(orderId)).approved === true ? await orderOf(orderId) : undefined));
    const pl = await waitFor('the P&L after approval', async () => {
      const found = (await listAll(ADMIN(), 'order_pl')).find((p) => p.order === orderId);
      return found && Date.parse(String(found.computed_at)) >= Date.parse(String(order.approved_at)) ? found : undefined;
    });
    // Two runs that race at approval may each ask for a P&L (same data, same figures): let the last one land first.
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    const settled = (await listAll(ADMIN(), 'order_pl')).find((p) => p.order === orderId)!;
    expect(settled.net_profit).toBe(pl.net_profit);
    // A later request changes nothing: the figures were fixed at approval.
    const before = settled.computed_at;
    expect((await patch(ADMIN(), 'order', orderId, { pl_requested_at: new Date().toISOString() })).status).toBeLessThan(300);
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    expect((await listAll(ADMIN(), 'order_pl')).find((p) => p.order === orderId)!.computed_at).toBe(before);
  });

  it('a_finished_tasks_outcome_cannot_be_changed', async () => {
    const t22Like = (await taskOf(orderId, 't23'))!;
    expect(t22Like.status).toBe('done');
    expect((await patch(as('proc'), 'order_task', t22Like.id, { outcome: 'approved' })).status).toBeGreaterThanOrEqual(400);
    expect((await taskOf(orderId, 't23'))!.outcome).toBe('completed');
  });

  it('events_cannot_be_edited_or_deleted', async () => {
    const [event] = await eventsOf(orderId);
    for (const who of ['sd', 'pladmin', 'am'] as const) {
      expect((await patch(as(who), 'order_event', event.id, { note: 'sửa' })).status, who).toBeGreaterThanOrEqual(400);
      const { response } = await as(who).DELETE('/entities/{entity_id}/records/{record_id}', {
        params: { path: { entity_id: entityId('order_event'), record_id: event.id }, query: { expected_updated_at: String(event.updated_at) } } as never,
      });
      expect(response.status, who).toBeGreaterThanOrEqual(400);
    }
  });

  it('close_lost_needs_a_reason_and_cancels_the_tasks', async () => {
    const id = await newOrder(`${TAG}C`);
    await waitFor('fifteen tasks', async () => ((await tasksOf(id)).length === 15 ? true : undefined));
    expect((await patch(as('am'), 'order', id, { status: 'close_lost' })).status).toBe(422);
    expect((await patch(as('am'), 'order', id, { status: 'close_lost', close_reason: 'Khách chọn nhà thầu khác' })).status).toBeLessThan(300);
    await waitFor('the tasks to be cancelled', async () => (await tasksOf(id)).filter((t) => t.status === 'open' || t.status === 'blocked').length === 0);
    expect((await eventsOf(id)).find((e) => e.action === 'close_lost')?.reason).toBe('Khách chọn nhà thầu khác');
  });

  it('parallel_completion_opens_t31_once', { timeout: 420_000 }, async () => {
    const id = await newOrder(`${TAG}P`, true);
    await waitFor('fifteen tasks', async () => ((await tasksOf(id)).length === 15 ? true : undefined));
    expect((await finish(as('am'), await taskIs(id, 't11', 'open'), 'submitted')).status).toBeLessThan(300);
    const [t22, t23] = await Promise.all([taskIs(id, 't22', 'open'), taskIs(id, 't23', 'open')]);
    // TM and Purchasing finish at the same moment: two trigger runs may read the same state.
    const [a, b] = await Promise.all([finish(as('tm'), t22, 'approved'), finish(as('proc'), t23, 'completed')]);
    expect([a.status, b.status].every((s) => s < 300), JSON.stringify([a.error, b.error])).toBe(true);
    await taskIs(id, 't31', 'open');
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    const tasks = await tasksOf(id);
    expect(tasks.filter((t) => t.task_code === 't31')).toHaveLength(1);
    expect(tasks.find((t) => t.task_code === 't31')!.status).toBe('open');
    expect(tasks.find((t) => t.task_code === 't22')!.status).toBe('done');
    expect(tasks.find((t) => t.task_code === 't23')!.status).toBe('done');
  });
});
