// One order's flow as the screens read it: its tasks and log, which tasks this person may act on, and the wait after an
// action until the trigger-run workflow has caught up (the screens never open tasks themselves).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { statusFor } from '../flow/actions';
import type { TaskOutcome } from '../flow/tasks';
import { OrdersError, type IgnoredWarning, type OrderEvent, type OrderTask, type OrdersApi } from './orders-api.js';

export interface FlowHook {
  /** forbidden: reading the tasks was refused (403 / 404): the person has no part in this order's flow. */
  state: 'loading' | 'ready' | 'failed' | 'forbidden';
  tasks: OrderTask[];
  events: OrderEvent[];
  /** Ids of this order's tasks this person may act on: held by them, or offered to a group they are in. */
  actionable: ReadonlySet<string>;
  /** The task being acted on, until the board shows what the workflow did about it. */
  busy: string | null;
  /** The wait for the workflow ran out: the board may be behind. */
  stale: boolean;
  act(task: OrderTask, outcome: TaskOutcome, reason: string, warnings: IgnoredWarning[]): Promise<void>;
  closeLost(reason: string): Promise<void>;
  reload(): void;
}

// Seconds after an action at which the board is read again (the workflow takes a few seconds, sometimes tens).
const DELAYS = [0, 1000, 2000, 3000, 5000, 8000, 13000, 20000];
const NO_IDS: ReadonlySet<string> = new Set();

export function useFlow(api: OrdersApi, orderId: string | null, onChanged: () => void): FlowHook {
  const [state, setState] = useState<FlowHook['state']>(orderId ? 'loading' : 'ready');
  const [tasks, setTasks] = useState<OrderTask[]>([]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [actionable, setActionable] = useState<ReadonlySet<string>>(NO_IDS);
  const [busy, setBusy] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(true);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const reads = useRef(0);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, [stop]);

  /** Reads the flow again; null when it could not be read (the state says why). */
  const read = useCallback(async (): Promise<OrderTask[] | null> => {
    if (!orderId) return [];
    const mine = ++reads.current;
    try {
      const [nextTasks, nextEvents, work] = await Promise.all([api.tasks(orderId), api.events(orderId), api.myWork().catch(() => [])]);
      if (!alive.current || mine !== reads.current) return nextTasks;
      setTasks(nextTasks);
      setEvents(nextEvents);
      setActionable(new Set(work.filter((w) => w.task.order === orderId).map((w) => w.task.id)));
      setState('ready');
      return nextTasks;
    } catch (error) {
      if (!alive.current || mine !== reads.current) return null;
      setState(error instanceof OrdersError && (error.status === 403 || error.status === 404) ? 'forbidden' : 'failed');
      return null;
    }
  }, [api, orderId]);

  useEffect(() => {
    setTasks([]);
    setEvents([]);
    setActionable(NO_IDS);
    setState(orderId ? 'loading' : 'ready');
    void read();
  }, [read, orderId]);

  const reload = useCallback(() => {
    stop();
    setStale(false);
    setBusy(null);
    void read();
  }, [read, stop]);

  /** Reads until `done(tasks)`, then lets the page read the order again; after the last read, gives up as stale. */
  const settle = useCallback((done: (tasks: OrderTask[]) => boolean) => {
    stop();
    let step = 0;
    const tick = async () => {
      const now = await read();
      if (!alive.current) return;
      if (now && done(now)) {
        setBusy(null);
        changed.current();
        return;
      }
      if (++step >= DELAYS.length) {
        setBusy(null);
        setStale(true);
        return;
      }
      timers.current.push(setTimeout(tick, DELAYS[step]));
    };
    timers.current.push(setTimeout(tick, DELAYS[0]));
  }, [read, stop]);

  const act = useCallback(async (task: OrderTask, outcome: TaskOutcome, reason: string, warnings: IgnoredWarning[]) => {
    setBusy(task.id);
    setStale(false);
    let logged: unknown = null;
    try {
      await api.act(task, outcome, reason, warnings);
    } catch (error) {
      // The outcome stands when only its log line was refused: wait for the workflow, then say so.
      if (!(error instanceof OrdersError && error.code === 'EVENT_NOT_LOGGED')) {
        setBusy(null);
        throw error;
      }
      logged = error;
    }
    // The workflow has dealt with the task when it has stamped the finish time on it, or taken it back (a return).
    const finished = statusFor(outcome);
    settle((now) => {
      const after = now.find((t) => t.id === task.id);
      return !!after && (after.done_at !== null || after.status !== finished);
    });
    if (logged) throw logged;
  }, [api, settle]);

  const closeLost = useCallback(async (reason: string) => {
    if (!orderId) return;
    setBusy('order');
    setStale(false);
    try {
      await api.closeLost(orderId, reason);
    } catch (error) {
      setBusy(null);
      throw error;
    }
    settle((now) => now.every((t) => t.status !== 'open' && t.status !== 'blocked'));
  }, [api, orderId, settle]);

  return useMemo(() => ({ state, tasks, events, actionable, busy, stale, act, closeLost, reload }),
    [state, tasks, events, actionable, busy, stale, act, closeLost, reload]);
}
