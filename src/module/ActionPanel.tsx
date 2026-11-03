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

/**
 * "Việc của bạn" (mockup `wfact`): the open tasks this person may act on, each with its outcome buttons, one note for
 * the reason, the warnings that will be logged if they go on (FR-6.10), and Close-lost for the order's Sales Admin.
 */
export function ActionPanel({ hook, flow, lang, locale, theme, name }: Props) {
  const T = TEXT[lang];
  const t = T.flow;
  const toasts = useToasts({ locale, theme });
  const noteId = useId();
  const errorId = useId();
  const pressed = useRef(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  const wording = (w: FlowWarning) => (w.code === 'late' ? t.warnings.late(w.days ?? 0) : t.warnings[w.code]);
  const ignored = (w: FlowWarning): IgnoredWarning => ({ source: 'system', level: w.level, text: wording(w) });
  const say = (kind: 'ok' | 'error', text: string) => {
    setMessage({ kind, text });
    toasts.show(kind === 'ok' ? 'success' : 'error', text);
  };

  const press = async (task: OrderTask, outcome: TaskOutcome) => {
    if (pressed.current || flow.busy) return;
    if (outcome === 'submitted' && submitLock) return;
    const reason = note.trim();
    const warnings = warningsApply(outcome) ? taskWarnings(task, ctx) : [];
    if (needsReason(outcome) && !reason) return void setError(t.reasonRequired);
    if (needsWhy(warnings) && !reason) return void setError(t.criticalNeedsReason);
    pressed.current = true;
    setError(null);
    try {
      await flow.act(task, outcome, reason, warnings.map(ignored));
      setNote('');
      say('ok', t.done);
    } catch (e) {
      say('error', e instanceof OrdersError && e.code === 'EVENT_NOT_LOGGED' ? t.eventNotLogged : errorText(e, T, t.failed));
    } finally {
      pressed.current = false;
    }
  };

  const closeLost = async () => {
    const reason = lostReason.trim();
    if (!reason) return void setLostError(t.closeLostRequired);
    if (pressed.current) return;
    pressed.current = true;
    setLostError(null);
    try {
      await flow.closeLost(reason);
      setClosing(false);
      setLostReason('');
    } catch (e) {
      setLostError(errorText(e, T, t.failed));
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
      {mine.length === 0 ? (
        <p>{t.nothingForYou}{waitingRoles.length > 0 && <> <span className="muted">{t.waitingNote(waitingRoles.join(', '))}</span></>}</p>
      ) : (
        <ul className="mytasks">
          {mine.map((task) => {
            const warnings = actionsFor(task, hook.me.id, [task.role]).some(warningsApply) ? taskWarnings(task, ctx) : [];
            const busy = flow.busy === task.id;
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
                {busy ? <p className="busy" role="status" aria-busy="true">{t.busy}</p> : (
                  <div className="actions">
                    {actionsFor(task, hook.me.id, [task.role]).map((outcome) => {
                      const locked = flow.busy !== null || (outcome === 'submitted' && submitLock !== null);
                      const why = outcome === 'submitted' ? submitLock : null;
                      const whyId = `${noteId}-${task.id}-why`;
                      return (
                        <span key={outcome} className="action">
                          <button type="button" className={`af-button ${outcome === 'returned' || outcome === 'revise' ? 'secondary' : 'primary'}`} data-outcome={outcome}
                            aria-disabled={locked} aria-describedby={why ? whyId : undefined} onClick={() => press(task, outcome)}>{t.outcomes[outcome]}</button>
                          {why && <span id={whyId} className="hint">{why}</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {mine.length > 0 && (
        <div className="field">
          <label htmlFor={noteId}>{t.noteLabel}</label>
          <textarea id={noteId} className="input note" rows={2} value={note} placeholder={t.notePlaceholder} aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined} onChange={(e) => { setNote(e.target.value); setError(null); }} />
          {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        </div>
      )}
      {message && <p className="result" data-tone={message.kind === 'ok' ? 'ok' : 'danger'} role="status">{message.text}</p>}
      {canCloseLost && (
        <div className="row">
          <button type="button" className="af-button danger" onClick={() => { setLostError(null); setClosing(true); }}>{t.closeLost}</button>
        </div>
      )}
      {closing && (
        <Dialog open heading={t.closeLostHeading} locale={locale} theme={theme} onClose={() => setClosing(false)}
          actions={<>
            <button type="button" className="af-button" onClick={() => setClosing(false)}>{t.cancel}</button>
            <button type="button" className="af-button danger" onClick={closeLost}>{t.closeLostConfirm}</button>
          </>}>
          <label className="field">
            <span>{t.closeLostReason}</span>
            <textarea className="input note" rows={3} value={lostReason} aria-label={t.closeLostReason} aria-invalid={lostError ? true : undefined}
              onChange={(e) => { setLostReason(e.target.value); setLostError(null); }} />
          </label>
          {lostError && <p className="field-error" role="alert">{lostError}</p>}
        </Dialog>
      )}
      {toasts.region}
    </section>
  );
}
