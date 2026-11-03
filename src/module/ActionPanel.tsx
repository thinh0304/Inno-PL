import { useId, useRef, useState } from 'react';
import { actionsFor, needsReason } from '../flow/actions';
import { FINISHED, type TaskOutcome } from '../flow/tasks';
import { needsWhy, taskWarnings, warningsApply, type FlowWarning } from '../flow/warnings';
import { Dialog, useToasts, type ThemeMode } from './kit.js';
import { OrdersError, type IgnoredWarning, type OrderTask } from './orders-api.js';
import { errorText, TEXT, type Lang } from './text.js';
import type { FlowHook } from './useFlow.js';
import type { OrderDraftHook } from './useOrderDraft.js';

interface Props { hook: OrderDraftHook; flow: FlowHook; lang: Lang; locale: string; theme: ThemeMode; name(code: string): string }

const notLogged = (error: unknown) => error instanceof OrdersError && error.code === 'EVENT_NOT_LOGGED';

/**
 * "Việc của bạn" (mockup `wfact`): the open tasks this person may act on, each with its outcome buttons and its own note
 * for the reason, the warnings that will be logged if they go on (FR-6.10), and Close-lost for the order's Sales Admin.
 */
export function ActionPanel({ hook, flow, lang, locale, theme, name }: Props) {
  const T = TEXT[lang];
  const t = T.flow;
  const toasts = useToasts({ locale, theme });
  const base = useId();
  const pressed = useRef(false);
  // One note per task: a reason typed for one task is never sent for another.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ task: string; text: string } | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [closing, setClosing] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostError, setLostError] = useState<string | null>(null);

  const { order } = hook.draft;
  const mine = flow.tasks.filter((task) => task.status === 'open' && flow.actionable.has(task.id) && actionsFor(task, hook.me.id, [task.role]).length > 0);
  const passed = hook.saved?.official.order_pl?.passed;
  const ctx = { tasks: flow.tasks, now: new Date().toISOString(), passed: typeof passed === 'boolean' ? passed : null, customerPrepays: order.customer_prepays };
  const errors = hook.issues.filter((issue) => issue.severity === 'error').length;
  const submitLock = hook.dirty ? t.saveFirst : errors > 0 ? t.incomplete(errors) : null;
  const t41 = flow.tasks.find((task) => task.task_code === 't41');
  const canCloseLost = order.sa === hook.me.id && (order.status === 'draft' || order.status === 'in_progress') && !(t41 && FINISHED.has(t41.status));
  const lostId = `${base}-lost`;

  const wording = (w: FlowWarning) => (w.code === 'late' ? t.warnings.late(w.days ?? 0) : t.warnings[w.code]);
  const ignored = (w: FlowWarning): IgnoredWarning => ({ source: 'system', level: w.level, text: wording(w) });
  const say = (kind: 'ok' | 'error', text: string) => {
    setMessage({ kind, text });
    toasts.show(kind === 'ok' ? 'success' : 'error', text);
  };
  const clearNote = (task: string) => setNotes((now) => ({ ...now, [task]: '' }));

  const press = async (task: OrderTask, outcome: TaskOutcome) => {
    if (pressed.current || flow.busy) return;
    if (outcome === 'submitted' && submitLock) return;
    const reason = (notes[task.id] ?? '').trim();
    const warnings = warningsApply(outcome) ? taskWarnings(task, ctx) : [];
    if (needsReason(outcome) && !reason) return void setError({ task: task.id, text: t.reasonRequired });
    if (needsWhy(warnings) && !reason) return void setError({ task: task.id, text: t.criticalNeedsReason });
    pressed.current = true;
    setError(null);
    try {
      await flow.act(task, outcome, reason, warnings.map(ignored));
      clearNote(task.id);
      say('ok', t.done);
    } catch (e) {
      // The outcome stands when only its log line was refused, and so does the reason that went with it.
      if (notLogged(e)) clearNote(task.id);
      say('error', notLogged(e) ? t.eventNotLogged : errorText(e, T, t.failed));
    } finally {
      pressed.current = false;
    }
  };

  const closeLost = async () => {
    const reason = lostReason.trim();
    if (!reason) return void setLostError(t.closeLostRequired);
    if (pressed.current || flow.busy) return;
    pressed.current = true;
    setLostError(null);
    try {
      await flow.closeLost(reason);
      setClosing(false);
      setLostReason('');
    } catch (e) {
      if (notLogged(e)) {
        setClosing(false);
        setLostReason('');
        say('error', t.eventNotLogged);
      } else setLostError(errorText(e, T, t.failed));
    } finally {
      pressed.current = false;
    }
  };

  const waitingRoles = [...new Set(flow.tasks.filter((task) => task.status === 'open' && !mine.includes(task)).map((task) => t.roles[task.role]))];
  return (
    <section className="wfact" aria-label={t.yourWork}>
      <h2 className="card-title">{t.yourWork}</h2>
      {flow.stale && (
        <div className="banner" data-tone="warn" role="alert">
          <span>{t.stale}</span>
          <button type="button" className="af-button sm secondary" onClick={flow.reload}>{t.reload}</button>
        </div>
      )}
      {flow.busy && <p className="busy" role="status" aria-busy="true">{t.busy}</p>}
      {mine.length === 0 ? (
        <p>{t.nothingForYou}{waitingRoles.length > 0 && <> <span className="muted">{t.waitingNote(waitingRoles.join(', '))}</span></>}</p>
      ) : (
        <ul className="mytasks">
          {mine.map((task) => {
            const outcomes = actionsFor(task, hook.me.id, [task.role]);
            const warnings = outcomes.some(warningsApply) ? taskWarnings(task, ctx) : [];
            const noteId = `${base}-${task.id}-note`;
            const errorId = `${noteId}-error`;
            const failed = error?.task === task.id ? error.text : null;
            return (
              <li key={task.id} className="mytask">
                <p className="tcard-name"><b className="code">{task.task_code.toUpperCase()}</b> {name(task.task_code)}</p>
                {warnings.length > 0 && (
                  <div className="warnbox" role="group" aria-label={t.warnTitle(warnings.length)} data-tone={needsWhy(warnings) ? 'danger' : 'warn'}>
                    <b>{t.warnTitle(warnings.length)}</b>
                    <ul>
                      {warnings.map((w) => (
                        <li key={w.code}><span className="tag" data-tone={w.level === 'critical' ? 'danger' : 'warn'}>{t.warnSource.system} · {t.warnLevel[w.level]}</span> {wording(w)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {flow.busy !== task.id && <div className="actions">
                  {outcomes.map((outcome) => {
                    const locked = flow.busy !== null || (outcome === 'submitted' && submitLock !== null);
                    const why = outcome === 'submitted' ? submitLock : null;
                    const whyId = `${noteId}-${outcome}-why`;
                    return (
                      <span key={outcome} className="action">
                        <button type="button" className={`af-button ${outcome === 'returned' || outcome === 'revise' ? 'secondary' : 'primary'}`} data-outcome={outcome}
                          aria-disabled={locked} aria-describedby={why ? whyId : undefined} onClick={() => press(task, outcome)}>{t.outcomes[outcome]}</button>
                        {why && <span id={whyId} className="hint">{why}</span>}
                      </span>
                    );
                  })}
                </div>}
                <div className="field">
                  <label htmlFor={noteId}>{t.noteLabel}</label>
                  <textarea id={noteId} className="input note" rows={2} value={notes[task.id] ?? ''} placeholder={t.notePlaceholder} aria-invalid={failed ? true : undefined}
                    aria-describedby={failed ? errorId : undefined}
                    onChange={(e) => { setNotes((now) => ({ ...now, [task.id]: e.target.value })); setError(null); }} />
                  {failed && <p id={errorId} className="field-error" role="alert">{failed}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {message && <p className="result" data-tone={message.kind === 'ok' ? 'ok' : 'danger'} role="status">{message.text}</p>}
      {canCloseLost && (
        <div className="row">
          <button type="button" className="af-button danger" aria-disabled={flow.busy !== null} onClick={() => { if (flow.busy) return; setLostError(null); setClosing(true); }}>{t.closeLost}</button>
        </div>
      )}
      {closing && (
        <Dialog open heading={t.closeLostHeading} locale={locale} theme={theme} onClose={() => setClosing(false)}
          actions={<>
            <button type="button" className="af-button" onClick={() => setClosing(false)}>{t.cancel}</button>
            <button type="button" className="af-button danger" onClick={closeLost}>{t.closeLostConfirm}</button>
          </>}>
          <div className="field">
            <label htmlFor={lostId}>{t.closeLostReason}</label>
            <textarea id={lostId} className="input note" rows={3} value={lostReason} aria-invalid={lostError ? true : undefined}
              aria-describedby={lostError ? `${lostId}-error` : undefined}
              onChange={(e) => { setLostReason(e.target.value); setLostError(null); }} />
            {lostError && <p id={`${lostId}-error`} className="field-error" role="alert">{lostError}</p>}
          </div>
        </Dialog>
      )}
      {toasts.region}
    </section>
  );
}
