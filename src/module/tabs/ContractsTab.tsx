import { useId, useRef, useState } from 'react';
import { needsFile, SIGNING_FIELDS, type SigningField } from '../../contract/rules';
import type { ContractRec, ContractTask, Slot, Step } from '../../contract/types';
import type { OrderFields } from '../../order/types';
import { AlertIcon } from '../icons.js';
import { formatDateTime, formatMoney } from '../format.js';
import type { TabProps } from '../OrderPage.js';
import { OrdersError } from '../orders-api.js';
import { errorText, TEXT, type Lang } from '../text.js';

/** The task a slot's step is uploaded in (FR-7.1): drafts at t40 / t44, signed copies at t41 / t45. */
export const taskFor = (slot: Pick<Slot, 'party'>, step: Step): ContractTask =>
  (slot.party === 'customer' ? (step === 'draft' ? 't40' : 't41') : step === 'draft' ? 't44' : 't45');

/** The contracts tab (FR-7.1, FR-7.8, FR-7.9): the customer's contract and each supplier's, draft and signed copy, every version. */
export function ContractsTab({ hook, flow, contracts, lang }: TabProps) {
  const T = TEXT[lang];
  const t = T.contracts;
  const { order } = hook.draft;
  if (contracts.state === 'loading') {
    return <div className="panel skeleton" aria-busy="true" aria-label={T.loading}>
      {[0, 1].map((i) => <div key={i} className="skeleton-row"><span className="af-skeleton" style={{ width: '50%' }} /></div>)}
    </div>;
  }
  if (contracts.state === 'failed') {
    return (
      <div className="state" role="alert">
        <span className="state-icon danger"><AlertIcon /></span>
        <h2>{t.loadFailed}</h2>
        <button type="button" className="af-button secondary" onClick={contracts.reload}>{T.retry}</button>
      </div>
    );
  }

  const closed = order.status === 'close_lost' || order.status === 'done';
  const taskOf = (code: ContractTask) => flow.tasks.find((task) => task.task_code === code);
  // Only the person who may act on the slot's task while it is open uploads to it (the server's rule checks the party too).
  const canUpload = (slot: Slot, step: Step) => {
    const task = taskOf(taskFor(slot, step));
    return !closed && !slot.orphan && !!task && task.status === 'open' && flow.actionable.has(task.id);
  };
  const t41 = taskOf('t41');
  // Open only while t41 is: once it is done the contract is signed and the fields lock (signing_fields_locked_after_signing).
  const signing = !closed && !!t41 && t41.status === 'open' && flow.actionable.has(t41.id);
  const person = (user: string | null) => (user ? hook.staff.find((s) => s.user === user)?.name ?? (user === hook.me.id ? hook.me.name : t.unknownPerson) : t.unknownPerson);

  return (
    <div className="contracts">
      {signing && <SigningCard order={order} lang={lang} save={contracts.saveSigning} />}
      {contracts.slots.map((slot) => (
        <SlotCard key={slot.key} slot={slot} lang={lang} limit={hook.config.settings.contractFileLimit}
          title={slot.party === 'customer' ? t.customerTitle : t.supplierTitle(contracts.supplierName(slot.supplier))}
          canUpload={(step) => canUpload(slot, step)} uploading={contracts.uploading} person={person} fileUrl={contracts.fileUrl}
          upload={contracts.upload} />
      ))}
    </div>
  );
}

interface SlotProps { slot: Slot; title: string; lang: Lang; limit: number; canUpload(step: Step): boolean; uploading: string | null;
  person(user: string | null): string; fileUrl(c: ContractRec): string | null; upload: TabProps['contracts']['upload'] }

function SlotCard({ slot, title, lang, limit, canUpload, uploading, person, fileUrl, upload }: SlotProps) {
  const t = TEXT[lang].contracts;
  const head = useId();
  const shown = new Set([slot.draft?.id, slot.final?.id]);
  const older = slot.history.filter((c) => !shown.has(c.id));
  const value = slot.history.find((c) => c.value !== null)?.value ?? slot.expectedValue;
  return (
    <section className="card contract" aria-labelledby={head}>
      <h2 id={head} className="card-title">{title}</h2>
      <p className="contract-meta">
        {slot.orphan ? <span className="tag" data-tone="warn">{t.orphan}</span> : (
          <>
            <span className="tag" data-tone={needsFile(value, limit) ? 'warn' : undefined}>
              {needsFile(value, limit) ? t.needsFile(formatMoney(limit)) : t.noFileNeeded(formatMoney(limit))}
            </span>
            <span className="muted">{t.expected(formatMoney(slot.expectedValue))}</span>
          </>
        )}
      </p>
      <div className="contract-steps">
        {(['draft', 'final'] as const).map((step) => (
          <StepBlock key={step} slot={slot} step={step} lang={lang} current={step === 'draft' ? slot.draft : slot.final}
            open={canUpload(step)} busy={uploading === `${slot.key}:${step}`} person={person} fileUrl={fileUrl} upload={upload} />
        ))}
      </div>
      {older.length > 0 && (
        <details className="contract-history" role="group" aria-label={t.history}>
          <summary>{t.historyCount(older.length)}</summary>
          <ul>
            {older.map((c) => <li key={c.id}><FileLink contract={c} fileUrl={fileUrl} lang={lang} /> · {t.steps[c.step]} · {t.meta(c.version, person(c.uploaded_by), formatDateTime(c.uploaded_at))}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

function FileLink({ contract, fileUrl, lang }: { contract: ContractRec; fileUrl(c: ContractRec): string | null; lang: Lang }) {
  const t = TEXT[lang].contracts;
  const url = fileUrl(contract);
  const name = contract.file_name ?? (contract.file ? contract.file : t.noFile);
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="link">{name}</a> : <span>{name}</span>;
}

interface StepProps { slot: Slot; step: Step; lang: Lang; current: ContractRec | null; open: boolean; busy: boolean;
  person(user: string | null): string; fileUrl(c: ContractRec): string | null; upload: TabProps['contracts']['upload'] }

function StepBlock({ slot, step, lang, current, open, busy, person, fileUrl, upload }: StepProps) {
  const T = TEXT[lang];
  const t = T.contracts;
  const base = useId();
  const pressed = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState('');
  const [advance, setAdvance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputKey = useRef(0);

  const send = async () => {
    if (pressed.current || busy) return;
    if (!file) return void setError(t.fileRequired);
    pressed.current = true;
    setError(null);
    const digits = value.replace(/\D/g, '');
    const percent = advance.trim() === '' ? null : Number(advance.replace(',', '.')) / 100;
    try {
      await upload({ party: slot.party, supplier: slot.supplier, step, file, value: digits ? Number(digits) : null,
        advance_percent: percent !== null && Number.isFinite(percent) ? percent : null });
      setFile(null);
      setValue('');
      setAdvance('');
      inputKey.current += 1;
    } catch (e) {
      setError(e instanceof OrdersError && e.code === 'UPLOAD_NOT_ALLOWED' ? t.notAllowed : errorText(e, T, t.uploadFailed));
    } finally {
      pressed.current = false;
    }
  };

  const errorId = `${base}-error`;
  return (
    <div className="contract-step">
      <h3 className="step-title">{t.steps[step]}</h3>
      {current ? (
        <p><FileLink contract={current} fileUrl={fileUrl} lang={lang} /><br />
          <span className="muted">{t.meta(current.version, person(current.uploaded_by), formatDateTime(current.uploaded_at))}</span></p>
      ) : <p className="muted">{t.noFile}</p>}
      {open && (
        <div className="upload">
          <div className="field">
            <label htmlFor={`${base}-file`}>{t.chooseFile(t.stepLower[step])}</label>
            <input key={inputKey.current} id={`${base}-file`} type="file" className="input" accept=".pdf,.doc,.docx,.html,.htm,image/*"
              aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} />
          </div>
          <div className="field">
            <label htmlFor={`${base}-value`}>{t.value}</label>
            <input id={`${base}-value`} className="input num" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          {slot.party === 'supplier' && (
            <div className="field">
              <label htmlFor={`${base}-advance`}>{t.advance}</label>
              <input id={`${base}-advance`} className="input num" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </div>
          )}
          <button type="button" className="af-button primary" aria-disabled={busy} aria-busy={busy || undefined} onClick={send}>
            {busy ? t.uploading : t.upload(t.stepLower[step])}
          </button>
          {busy && <span className="sr-only" role="status">{t.uploading}</span>}
          {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** BR-45: the order's signing fields, which SA fills at t41 after the order was sent (they lock once it is signed). */
function SigningCard({ order, lang, save }: { order: OrderFields; lang: Lang; save: TabProps['contracts']['saveSigning'] }) {
  const T = TEXT[lang];
  const t = T.contracts;
  const head = useId();
  const pressed = useRef(false);
  const initial = () => Object.fromEntries(SIGNING_FIELDS.map((k) => [k, order[k] == null ? '' : String(order[k])])) as Record<SigningField, string>;
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    if (pressed.current) return;
    const changes: Partial<Pick<OrderFields, SigningField>> = {};
    for (const key of SIGNING_FIELDS) {
      const raw = values[key].trim();
      const was = order[key] == null ? '' : String(order[key]);
      if (raw === was) continue;
      (changes as Record<string, unknown>)[key] = key === 'payment_count' ? (raw === '' ? null : Number(raw)) : key === 'signed_on' ? raw || null : raw;
    }
    if (Object.keys(changes).length === 0) return;
    pressed.current = true;
    try {
      await save(changes);
      setMessage({ ok: true, text: t.signingSaved });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e, T, T.contracts.uploadFailed) });
    } finally {
      pressed.current = false;
    }
  };

  return (
    <section className="card signing" aria-labelledby={head}>
      <h2 id={head} className="card-title">{t.signingTitle}</h2>
      <p className="hint">{t.signingHint}</p>
      <div className="grid">
        {SIGNING_FIELDS.map((key) => (
          <div key={key} className="field">
            <label htmlFor={`${head}-${key}`}>{t.signingLabels[key]}</label>
            <input id={`${head}-${key}`} className="input" type={key === 'signed_on' ? 'date' : key === 'payment_count' ? 'number' : 'text'}
              value={values[key]} onChange={(e) => { setValues((now) => ({ ...now, [key]: e.target.value })); setMessage(null); }} />
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="af-button primary" onClick={submit}>{t.saveSigning}</button>
      </div>
      {message && <p className="result" data-tone={message.ok ? 'ok' : 'danger'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </section>
  );
}
