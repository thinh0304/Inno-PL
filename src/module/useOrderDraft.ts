// One order being edited: the draft, what is typed but not yet valid, the live P&L, the issues, and saving.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkFormat } from '../order/formats';
import { fieldsOf, toPlOrderInput } from '../order/records';
import type { OrderDraft } from '../order/types';
import { validateOrder, type FieldIssue } from '../order/validate';
import { computePl, type PlResult } from '../pl/compute';
import { parseTime } from '../pl/time';
import { configFromRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import type { PlConfig } from '../pl/types';
import { isEditor } from './access.js';
import { OrdersError, type Access, type LoadedOrder, type OrdersApi, type Person, type StaffMember } from './orders-api.js';
import { getIn, kindOf, setIn } from './paths.js';
import { applyCreatedIds, blankDraft, saveOrder, savePlan } from './save-plan.js';

interface Ready { config: PlConfig; access: Access; staff: StaffMember[]; me: Person }
export type DraftState = 'loading' | 'ready' | 'failed';

export interface OrderDraftHook {
  state: DraftState;
  loadError: unknown;
  draft: OrderDraft;
  saved: LoadedOrder | null;
  config: PlConfig;
  access: Access | null;
  staff: StaffMember[];
  me: Person;
  editor: boolean;
  live: PlResult;
  /** Required-field and cross-field issues for sending for approval, with format errors of what is being typed first. */
  issues: FieldIssue[];
  issueAt(path: string): string | null;
  /** What is typed in a field that is not valid yet (shown as typed, not saved). */
  rawAt(path: string): string | undefined;
  formatErrors: number;
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  /** compute_pl is running after a save: the official P&L is on its way. */
  computing: boolean;
  set(path: string, raw: string | boolean | number | null): void;
  setDraft(update: (draft: OrderDraft) => OrderDraft): void;
  /** Removes a line, with what is typed but not valid in it; the lines after it keep theirs. */
  removeLine(id: string): void;
  save(): Promise<LoadedOrder>;
  reload(): void;
  /** Reads the order again without showing the loading state (after a write a trigger follows up on). */
  refresh(): void;
}

/** A new order: the person is its AM when they are in Sales; an SA names an AM and is the order's SA (plan 02). */
function newDraft(me: Person, staff: StaffMember[]): OrderDraft {
  const mine = staff.find((s) => s.user === me.id);
  const draft = blankDraft(mine?.team === 'sales' ? me.id : null);
  if (mine?.team === 'sa') draft.order.sa = me.id;
  // BR-30: the AM holds the five first stages; the last is Inside Sales' when there is one.
  const person = mine?.team === 'sales' ? mine.code : null;
  draft.order.deal_stages = draft.order.deal_stages.map((s) => ({ ...s, person }));
  return draft;
}

export function useOrderDraft(api: OrdersApi, id: string | null): OrderDraftHook {
  const me = useMemo(() => api.me(), [api]);
  const [state, setState] = useState<DraftState>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [draft, setDraftState] = useState<OrderDraft>(() => blankDraft(null));
  const [saved, setSaved] = useState<LoadedOrder | null>(null);
  const [raw, setRaw] = useState<Record<string, { text: string; message: string }>>({});
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState(false);
  const inFlight = useRef(false);
  // A save failed part way: the next one reads the order back first (saveOrder), so nothing is created twice.
  const reread = useRef(false);
  const reads = useRef(0);
  const polls = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The latest draft and saved order, for reads that land after a render.
  const latest = useRef({ draft, saved });
  latest.current = { draft, saved };
  useEffect(() => () => polls.current.forEach(clearTimeout), []);

  const reload = useCallback(() => {
    const mine = ++reads.current;
    setState('loading');
    Promise.all([api.config(), api.access(), api.staff(), id ? api.load(id) : Promise.resolve(null)]).then(
      ([configRecords, access, staff, loaded]) => {
        if (mine !== reads.current) return;
        setReady({ config: configFromRecords(configRecords), access, staff, me });
        setSaved(loaded);
        setDraftState(loaded ? loaded.draft : newDraft(me, staff));
        setRaw({});
        setState('ready');
      },
      (error: unknown) => {
        if (mine !== reads.current) return;
        setLoadError(error);
        setState('failed');
      },
    );
  }, [api, id, me]);
  useEffect(reload, [reload]);

  // Reads the order again quietly. The draft follows only when nothing was edited since; the saved order always does.
  const refresh = useCallback((orderId: string | null = id) => {
    if (!orderId) return Promise.resolve(null);
    return api.load(orderId).then((loaded) => {
      const { draft: now, saved: before } = latest.current;
      const edited = ready ? savePlan(now, before?.records ?? null, ready.config).length > 0 : false;
      setSaved(loaded);
      if (!edited) setDraftState(loaded.draft);
      return loaded;
    }, () => null);
  }, [api, id, ready]);

  // Until the configuration loads, the defaults stand in (nothing is shown or saved before then).
  const config = ready?.config ?? DEFAULT_CONFIG;
  const live = useMemo(() => computePl(toPlOrderInput(draft), config), [draft, config]);
  const issues = useMemo(() => {
    if (!ready) return [];
    const formats: FieldIssue[] = Object.entries(raw).map(([path, r]) => ({ path, message: r.message, severity: 'error' }));
    const typed = new Set(Object.keys(raw));
    return [...formats, ...validateOrder(draft, config, 'submit').issues.filter((issue) => !typed.has(issue.path))];
  }, [draft, config, ready, raw]);
  const draftErrors = useMemo(() => (ready ? validateOrder(draft, config, 'draft').issues.length : 0), [draft, config, ready]);
  const dirty = useMemo(() => (ready ? savePlan(draft, saved?.records ?? null, config).length > 0 : false), [draft, saved, config, ready]);
  const formatErrors = Object.keys(raw).length;
  const editor = Boolean(ready && (id ? isEditor(draft.order, me) : ready.access.canCreateOrder));

  const set = useCallback((path: string, value: string | boolean | number | null) => {
    // Nothing is taken while a save runs: what it writes would overwrite it (the fields are read-only meanwhile).
    if (inFlight.current) return;
    const kind = kindOf(path);
    if (kind && typeof value === 'string') {
      const result = checkFormat(kind, value);
      if (!result.ok) {
        setRaw((now) => ({ ...now, [path]: { text: value, message: result.message! } }));
        return;
      }
      setRaw((now) => {
        if (!(path in now)) return now;
        const { [path]: _gone, ...rest } = now;
        return rest;
      });
      setDraftState((now) => setIn(now, path, result.value === null && typeof getIn(now, path) === 'string' ? '' : result.value));
      return;
    }
    setDraftState((now) => setIn(now, path, value));
  }, []);

  // compute_pl runs on its trigger a few seconds after a save: read the order again until its P&L is newer than the request.
  const waitForOfficial = useCallback((orderId: string) => {
    polls.current.forEach(clearTimeout);
    setComputing(true);
    const done = (loaded: LoadedOrder | null) => {
      const order = loaded ? fieldsOf(loaded.records.order) : {};
      const requested = parseTime(String(order.pl_requested_at ?? ''));
      const computed = parseTime(String(loaded?.official.order_pl?.computed_at ?? ''));
      return !Number.isNaN(requested) && !Number.isNaN(computed) && computed >= requested;
    };
    const delays = [300, 1000, 2000, 4000, 8000, 15000, 30000];
    let step = 0;
    const tick = () => {
      refresh(orderId).then((loaded) => {
        if (done(loaded) || ++step >= delays.length) {
          setComputing(false);
          return;
        }
        polls.current.push(setTimeout(tick, delays[step]));
      });
    };
    polls.current.push(setTimeout(tick, delays[0]));
  }, [refresh]);

  const save = useCallback(async () => {
    if (inFlight.current) throw new OrdersError('BUSY', null);
    inFlight.current = true;
    setSaving(true);
    try {
      const loaded = await saveOrder(api, draft, saved?.records ?? null, config, reread.current);
      reread.current = false;
      setSaved(loaded);
      setDraftState(loaded.draft);
      setRaw({});
      if (loaded.draft.order.id) waitForOfficial(loaded.draft.order.id);
      return loaded;
    } catch (error) {
      // What a failed save did create keeps its id; the next save reads the order back before writing again.
      if (error instanceof OrdersError && Object.keys(error.created).length) {
        setDraftState(applyCreatedIds(draft, error.created));
        reread.current = true;
      }
      throw error;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [api, draft, saved, config, waitForOfficial]);

  const removeLine = useCallback((lineId: string) => {
    if (inFlight.current) return;
    const index = latest.current.draft.lines.findIndex((line) => line.id === lineId);
    if (index < 0) return;
    setDraftState((now) => ({ ...now, lines: now.lines.filter((line) => line.id !== lineId) }));
    // Format errors are kept by line position: drop the removed line's, move the later lines' up by one.
    setRaw((now) => Object.fromEntries(Object.entries(now).flatMap(([path, value]) => {
      const match = /^lines\[(\d+)\](.*)$/.exec(path);
      if (!match) return [[path, value]];
      const at = Number(match[1]);
      if (at === index) return [];
      return [[at > index ? `lines[${at - 1}]${match[2]}` : path, value]];
    })));
  }, []);

  return {
    state, loadError, draft, saved, config, access: ready?.access ?? null, staff: ready?.staff ?? [], me, editor, live, issues,
    issueAt: (path) => issues.find((issue) => issue.path === path)?.message ?? null,
    rawAt: (path) => raw[path]?.text,
    formatErrors,
    dirty: dirty || formatErrors > 0,
    canSave: editor && dirty && formatErrors === 0 && draftErrors === 0 && !saving,
    saving,
    computing,
    set,
    setDraft: (update) => { if (!inFlight.current) setDraftState(update); },
    removeLine,
    save,
    reload,
    refresh: () => { void refresh(); },
  };
}
