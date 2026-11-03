// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import { OrdersError, type OrdersApi } from '../../src/module/orders-api.js';
import { useFlow } from '../../src/module/useFlow.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ready = async (result: { current: { state: string } }) => waitFor(() => expect(result.current.state).toBe('ready'));
const taskOf = (tasks: { id: string; task_code: string }[], code: string) => tasks.find((t) => t.task_code === code)!;

/** An api whose reads show the order as it is right after the person's write, before the workflow has run, until `release()`. */
function lagging(base: OrdersApi) {
  let frozen: Awaited<ReturnType<OrdersApi['tasks']>> | null = null;
  const api: OrdersApi = { ...base,
    tasks: async (id) => (frozen ?? base.tasks(id)),
    // The task is already done, as a read right after the write shows it, but the workflow has not touched anything yet.
    act: async (task, outcome, ...rest) => {
      const before = await base.tasks(task.order);
      frozen = before.map((t) => (t.id === task.id ? { ...t, status: 'done', outcome, done_at: null } : t));
      await base.act(task, outcome, ...rest);
    } };
  return { api, release: () => { frozen = null; } };
}

describe('useFlow', () => {
  it('loads_tasks_events_and_what_i_may_act_on', async () => {
    const api = createMemoryOrdersApi({ roles: ['am'] });
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await ready(result);
    expect(result.current.tasks).toHaveLength(15);
    expect(result.current.events).toEqual([]);
    expect(result.current.busy).toBeNull();
    expect(result.current.stale).toBe(false);
    // Only the AM's open task is offered to this person.
    expect([...result.current.actionable]).toEqual([taskOf(result.current.tasks, 't11').id]);
  });

  it('a_new_order_has_no_tasks', async () => {
    const api = createMemoryOrdersApi();
    const { result } = renderHook(() => useFlow(api, null, () => {}));
    await ready(result);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.actionable.size).toBe(0);
  });

  it('forbidden_tasks_show_a_notice', async () => {
    const base = createMemoryOrdersApi();
    const api: OrdersApi = { ...base, tasks: async () => { throw new OrdersError('FORBIDDEN', null, {}, 403); } };
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await waitFor(() => expect(result.current.state).toBe('forbidden'));
    expect(result.current.tasks).toEqual([]);
  });

  it('a_network_failure_is_a_failure_that_can_be_retried', async () => {
    const base = createMemoryOrdersApi();
    let down = true;
    const api: OrdersApi = { ...base, tasks: async (id) => { if (down) throw new OrdersError('NETWORK', null); return base.tasks(id); } };
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    down = false;
    act(() => result.current.reload());
    await ready(result);
    expect(result.current.tasks).toHaveLength(15);
  });

  it('card_is_locked_until_the_run_settles', async () => {
    const { api, release } = lagging(createMemoryOrdersApi());
    const changed = vi.fn();
    const { result } = renderHook(() => useFlow(api, 'o1', changed));
    await ready(result);
    const t11 = taskOf(result.current.tasks, 't11');
    await act(async () => { await result.current.act(t11 as never, 'submitted', '', []); });
    // The task itself is done, but the workflow has not opened the next one: still waiting, the card stays locked.
    expect(result.current.busy).toBe(t11.id);
    expect(changed).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(result.current.busy).toBeNull(), { timeout: 4000 });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(taskOf(result.current.tasks, 't23').task_code).toBe('t23');
    expect((result.current.tasks.find((t) => t.task_code === 't23'))?.status).toBe('open');
  });

  it('settling_gives_up_with_a_reload', async () => {
    const { api, release } = lagging(createMemoryOrdersApi());
    const changed = vi.fn();
    const { result } = renderHook(() => useFlow(api, 'o1', changed));
    await ready(result);
    vi.useFakeTimers();
    // The memory api waits on timers too, so time has to move while the action is in flight.
    await act(async () => {
      const acting = result.current.act(taskOf(result.current.tasks, 't11') as never, 'submitted', '', []);
      await vi.advanceTimersByTimeAsync(60_000);
      await acting;
    });
    expect(result.current.busy).toBeNull();
    expect(result.current.stale).toBe(true);
    // Giving up still lets the page read the order again: the board may be behind, and so may the header.
    expect(changed).toHaveBeenCalledTimes(1);
    release();
    await act(async () => { result.current.reload(); await vi.advanceTimersByTimeAsync(10); });
    expect(result.current.stale).toBe(false);
    expect(result.current.tasks.find((t) => t.task_code === 't23')?.status).toBe('open');
  });

  it('act_failure_clears_busy_and_rethrows', async () => {
    const api = createMemoryOrdersApi();
    const { result } = renderHook(() => useFlow(api, 'o1', () => {}));
    await ready(result);
    // t31 is not open: the stage model refuses.
    await act(async () => {
      await expect(result.current.act(taskOf(result.current.tasks, 't31') as never, 'approved', '', [])).rejects.toMatchObject({ code: 'STAGE_TRANSITION_NOT_ALLOWED' });
    });
    expect(result.current.busy).toBeNull();
  });

  it('event_not_logged_is_rethrown_but_the_board_still_catches_up', async () => {
    const base = createMemoryOrdersApi();
    const api: OrdersApi = { ...base, act: async (...args) => { await base.act(...args); throw new OrdersError('EVENT_NOT_LOGGED', null, {}, 403); } };
    const changed = vi.fn();
    const { result } = renderHook(() => useFlow(api, 'o1', changed));
    await ready(result);
    await act(async () => {
      await expect(result.current.act(taskOf(result.current.tasks, 't11') as never, 'submitted', '', [])).rejects.toMatchObject({ code: 'EVENT_NOT_LOGGED' });
    });
    await waitFor(() => expect(result.current.busy).toBeNull(), { timeout: 4000 });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('close_lost_settles_when_no_task_is_waiting_any_more', async () => {
    const changed = vi.fn();
    const api = createMemoryOrdersApi();
    const { result } = renderHook(() => useFlow(api, 'o1', changed));
    await ready(result);
    await act(async () => { await result.current.closeLost('Khách hủy'); });
    await waitFor(() => expect(result.current.busy).toBeNull(), { timeout: 4000 });
    expect(result.current.tasks.filter((t) => t.status === 'open' || t.status === 'blocked')).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
