import { useState } from 'react';
import { AlertIcon } from '../icons.js';
import { formatDateTime } from '../format.js';
import type { TabProps } from '../OrderPage.js';
import { TEXT } from '../text.js';

/**
 * The order's log, newest first (FR-6.9, mockup `logBlock`): when, who and in which role, what, on which task, why, and the
 * warnings that were ignored with their source and level (FR-6.10), with a filter for just those.
 */
export function HistoryTab({ hook, lang, flow }: TabProps) {
  const T = TEXT[lang];
  const t = T.history;
  const [onlyIgnored, setOnlyIgnored] = useState(false);

  if (flow.state === 'loading') return <div className="panel skeleton" aria-busy="true" aria-label={T.loading}><div className="skeleton-row"><span className="af-skeleton" style={{ width: '50%' }} /></div></div>;
  if (flow.state === 'forbidden' || flow.state === 'failed') {
    return (
      <div className="state" role={flow.state === 'failed' ? 'alert' : 'status'}>
        <span className="state-icon danger"><AlertIcon /></span>
        <h2>{flow.state === 'forbidden' ? T.flow.forbidden : T.flow.loadFailed}</h2>
        {flow.state === 'failed' && <button type="button" className="af-button secondary" onClick={flow.reload}>{T.retry}</button>}
      </div>
    );
  }
  if (flow.events.length === 0) return <p className="muted">{t.empty}</p>;

  const person = (user: string | null) => (user ? hook.staff.find((s) => s.user === user)?.name ?? T.flow.unknownPerson : T.flow.system);
  const ignored = flow.events.filter((e) => e.action === 'ignored_warnings');
  const shown = [...(onlyIgnored ? ignored : flow.events)].reverse();
  const known = t.actions as Record<string, string>;
  const roles = T.flow.roles as Record<string, string>;
  return (
    <section className="history">
      <div className="toolbar">
        <span className="count">{t.count(flow.events.length)}</span>
        {ignored.length > 0 && <span className="tag" data-tone="warn">{t.ignoredBadge(ignored.length)}</span>}
        <span className="grow" />
        <button type="button" className="af-button sm secondary" aria-pressed={onlyIgnored} onClick={() => setOnlyIgnored(!onlyIgnored)}>
          {t.onlyIgnored} ({ignored.length})
        </button>
      </div>
      {shown.length === 0 ? <p className="muted">{t.noMatch}</p> : (
        <ul className="eventlog" aria-label={t.listLabel}>
          {shown.map((e) => {
            const critical = e.warnings.some((w) => w.level === 'critical');
            return (
              <li key={e.id} className="event" data-action={e.action} data-tone={critical ? 'danger' : e.action === 'ignored_warnings' ? 'warn' : undefined}>
                <p className="event-head">
                  <b>{person(e.actor)}</b>
                  {e.role && <span className="muted">{roles[e.role] ?? e.role}</span>}
                  <span className="tag">{known[e.action] ?? e.action}</span>
                  {e.task_code && <span>{e.task_code.toUpperCase()}</span>}
                  <span className="muted">{formatDateTime(e.at)}</span>
                </p>
                {e.warnings.length > 0 && (
                  <ul className="event-warns">
                    {e.warnings.map((w, i) => (
                      <li key={i}>
                        <span className="tag" data-tone={w.level === 'critical' ? 'danger' : 'warn'}>
                          {(T.flow.warnSource as Record<string, string>)[w.source] ?? w.source} · {(T.flow.warnLevel as Record<string, string>)[w.level] ?? w.level}
                        </span>
                        {' '}<span>{w.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {e.reason && <p className="event-why"><b>{t.reason}:</b> {e.reason}</p>}
                {e.note && <p className="event-note">{e.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
