import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Case, CasesApi } from './cases-api.js';
import { DateInput, Dialog, type ThemeMode } from './kit.js';
import { errorText, TEXT, type Lang } from './text.js';

/** Today in the viewer's own calendar, `yyyy-mm-dd`. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface Props {
  open: boolean;
  api: CasesApi;
  lang: Lang;
  locale: string;
  theme: ThemeMode;
  onCreated(made: Case): void;
  onClose(): void;
}

/** The "New case" dialog: the create form's three fields. A failed create keeps what was typed and says why. */
export function NewCaseDialog({ open, api, lang, locale, theme, onCreated, onClose }: Props) {
  const t = TEXT[lang];
  const ids = useId();
  const [title, setTitle] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [openedOn, setOpenedOn] = useState<string | null>(todayIso);
  const [titleMissing, setTitleMissing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Read and set in the same tick as the press, so a double press sends one create.
  const sending = useRef(false);
  // Counts closings: a create that answers after its dialog closed must not write into the next one.
  const session = useRef(0);
  const titleInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setUrgent(false);
    setOpenedOn(todayIso());
    setTitleMissing(false);
    setFailure(null);
    setBusy(false);
    sending.current = false;
  };

  useEffect(() => {
    if (!open) return;
    reset();
    // The dialog puts focus on its close button as it opens; the title is where the person starts.
    const timer = setTimeout(() => titleInput.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const close = () => {
    session.current += 1;
    reset();
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    if (!title.trim()) {
      setTitleMissing(true);
      titleInput.current?.focus();
      return;
    }
    const mine = session.current;
    sending.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const made = await api.create({ title: title.trim(), urgent, openedOn });
      if (mine === session.current) close();
      // The case exists even when the dialog was closed meanwhile, so the list still shows it.
      onCreated(made);
    } catch (error) {
      if (mine === session.current) setFailure(errorText(error, t, t.createFailed));
    } finally {
      if (mine === session.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  };

  const formId = `${ids}form`;
  const titleId = `${ids}title`;
  const titleHelp = `${ids}title-help`;
  return (
    <Dialog open={open} heading={t.newCase} locale={locale} theme={theme} onClose={close}
      actions={<>
        <button type="button" className="af-button secondary" onClick={close}>{t.cancel}</button>
        <button type="submit" form={formId} className="af-button primary" aria-disabled={busy || undefined}>
          {busy ? t.creating : t.create}
        </button>
      </>}>
      <form id={formId} className="form" noValidate onSubmit={submit}>
        {failure && <div className="af-banner danger" role="alert">{failure}</div>}
        <div className="field">
          <label htmlFor={titleId}>{t.title}</label>
          <input id={titleId} ref={titleInput} className="input" value={title} placeholder={t.titlePlaceholder} autoComplete="off"
            aria-invalid={titleMissing || undefined} aria-describedby={titleMissing ? titleHelp : undefined}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) setTitleMissing(false);
            }} />
          {titleMissing && <p id={titleHelp} className="field-error">{t.titleMissing}</p>}
        </div>
        <label className="check">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          <span>
            <span className="check-label">{t.urgentLabel}</span>
            <span className="hint">{t.urgentHelp}</span>
          </span>
        </label>
        <div className="field">
          <span className="label" aria-hidden="true">{t.openedOn}</span>
          <DateInput value={openedOn} label={t.openedOn} locale={locale} theme={theme} onChange={setOpenedOn} />
        </div>
      </form>
    </Dialog>
  );
}
