// One order being edited: the draft, what is typed but not yet valid, the live P&L, the issues, and saving.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkFormat } from '../order/formats';
import { toPlOrderInput } from '../order/records';
import type { OrderDraft } from '../order/types';
import { validateOrder, type FieldIssue } from '../order/validate';
import { computePl, type PlResult } from '../pl/compute';
import { configFromRecords } from '../pl/config-records';
import { DEFAULT_CONFIG } from '../pl/defaults';
import type { PlConfig } from '../pl/types';
import { isEditor } from './access.js';
import { OrdersError, type Access, type LoadedOrder, type OrdersApi, type Person, type StaffMember } from './orders-api.js';
import { getIn, kindOf, setIn } from './paths.js';
import { applyCreatedIds, blankDraft, savePlan } from './save-plan.js';

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
  set(path: string, raw: string | boolean | number | null): void;
  setDraft(update: (draft: OrderDraft) => OrderDraft): void;
  save(): Promise<LoadedOrder>;
  reload(): void;
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
  const inFlight = useRef(false);
  const reads = useRef(0);

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

  const save = useCallback(async () => {
    if (inFlight.current) throw new OrdersError('BUSY', null);
    inFlight.current = true;
    setSaving(true);
    try {
      const loaded = await api.save(draft, saved?.records ?? null, config);
      setSaved(loaded);
      setDraftState(loaded.draft);
      setRaw({});
      return loaded;
    } catch (error) {
      // What a failed save did create keeps its id, so Save again continues instead of creating it twice.
      if (error instanceof OrdersError && Object.keys(error.created).length) {
        const next = applyCreatedIds(draft, error.created);
        setDraftState(next);
        if (next.order.id) api.load(next.order.id).then((loaded) => setSaved(loaded), () => {});
      }
      throw error;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [api, draft, saved, config]);

  return {
    state, loadError, draft, saved, config, access: ready?.access ?? null, staff: ready?.staff ?? [], me, editor, live, issues,
    issueAt: (path) => issues.find((issue) => issue.path === path)?.message ?? null,
    rawAt: (path) => raw[path]?.text,
    formatErrors,
    dirty: dirty || formatErrors > 0,
    canSave: editor && dirty && formatErrors === 0 && draftErrors === 0 && !saving,
    saving,
    set,
    setDraft: (update) => setDraftState(update),
    save,
    reload,
  };
}
