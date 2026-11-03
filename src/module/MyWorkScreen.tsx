import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { dueState } from '../flow/calendar';
import { configFromRecords } from '../pl/config-records';
import { formatDay } from './format.js';
import { AlertIcon, ChevronIcon } from './icons.js';
import type { ThemeMode } from './kit.js';
import type { OrdersApi, WorkItem } from './orders-api.js';
import { errorText, TEXT, type Lang } from './text.js';

type Load = { state: 'loading' } | { state: 'ready'; items: WorkItem[]; names: Map<string, string> } | { state: 'failed'; error: unknown };

interface Props { api: OrdersApi; lang: Lang; locale: string; theme: ThemeMode; onOpen(orderId: string): void; onBack(): void }

/** "Việc của tôi" (FR-6.4): the tasks this person holds, then those offered to their role, across every order and stage. */
export function MyWorkScreen({ api, lang, onOpen, onBack }: Props) {
  const t = TEXT[lang];
  const w = t.work;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const reads = useRef(0);

  const read = useCallback(() => {
    const mine = ++reads.current;
    setLoad({ state: 'loading' });
    Promise.all([api.myWork(), api.config()]).then(
      ([items, config]) => mine === reads.current && setLoad({ state: 'ready', items,
        names: new Map(configFromRecords(config).taskSlas.map((s) => [s.taskCode, s.name])) }),
      (error: unknown) => mine === reads.current && setLoad({ state: 'failed', error }),
    );
  }, [api]);
  useEffect(read, [read]);

  const now = new Date().toISOString();
  const group = (label: string, items: WorkItem[], names: Map<string, string>) => items.length === 0 ? null : (
    <section key={label} className="card" aria-label={label}>
      <h2 className="card-title">{label}</h2>
      <ul className="worklist">
        {items.map(({ task, orderCode, customerName }) => {
          const code = task.task_code.toUpperCase();
          const live = dueState(task.due_at, now, null);
          const tone = live.state === 'overdue' ? 'danger' : live.state === 'due_soon' ? 'warn' : undefined;
          const state = live.state === 'overdue' ? t.flow.dueState.overdue(live.lateDays) : live.state === 'due_soon' ? t.flow.dueState.due_soon : null;
          return (
            <li key={task.id} className="workitem">
              <div className="workitem-main">
                <p className="tcard-name"><b className="code">{code}</b> {names.get(task.task_code) ?? code}</p>
                <p className="tcard-meta">
                  <span>{orderCode || t.draftCode} · {customerName}</span>
                  <span>{w.stage(task.stage)}</span>
                  {task.due_at && <span>{t.flow.due(formatDay(task.due_at))}</span>}
                  {state && <span className="due" data-tone={tone}>{state}</span>}
                </p>
              </div>
              <button type="button" className="af-button sm secondary" aria-label={w.openLabel(code, orderCode || customerName)} onClick={() => onOpen(task.order)}>{w.open}</button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <main className="screen screen-wide">
      <nav className="crumbs"><button type="button" className="link" onClick={onBack}><ChevronIcon open={false} />{t.backToList}</button></nav>
      <header className="head"><h1>{w.heading}</h1></header>
      {load.state === 'loading' && <div className="panel skeleton" aria-busy="true" aria-label={t.loading}>
        {[0, 1].map((i) => <div key={i} className="skeleton-row"><span className="af-skeleton" style={{ width: '50%' }} /></div>)}
      </div>}
      {load.state === 'failed' && (
        <div className="state" role="alert">
          <span className="state-icon danger"><AlertIcon /></span>
          <h2>{errorText(load.error, t, w.loadFailed)}</h2>
          <button type="button" className="af-button secondary" onClick={read}>{t.retry}</button>
        </div>
      )}
      {load.state === 'ready' && (load.items.length === 0 ? <p className="muted">{w.empty}</p> : (
        <>
          {group(w.mine, load.items.filter((i) => i.mine), load.names)}
          {group(w.offered, load.items.filter((i) => !i.mine), load.names)}
        </>
      ))}
    </main>
  );
}

/**
 * `/tasks/<id>`, where AgentFlow's My Work sends a person: that task's order on its flow tab, or My work when the task cannot
 * be read. Both are shown in place: the host cannot replace a history entry, so a redirect would trap the Back button.
 */
export function TaskRoute({ api, id, lang, found, missing }: { api: OrdersApi; id: string; lang: Lang; found(orderId: string): ReactNode; missing(): ReactNode }) {
  const t = TEXT[lang];
  const [order, setOrder] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setOrder(undefined);
    api.task(id).then((task) => alive && setOrder(task ? task.order : null), () => alive && setOrder(null));
    return () => { alive = false; };
  }, [api, id]);
  if (order) return <>{found(order)}</>;
  if (order === null) return <>{missing()}</>;
  return <main className="screen"><div className="panel skeleton" aria-busy="true" aria-label={t.loading}><div className="skeleton-row"><span className="af-skeleton" style={{ width: '50%' }} /></div></div></main>;
}
