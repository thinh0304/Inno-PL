import { useCallback, useEffect, useRef, useState } from 'react';
import type { Case, CasesApi } from './cases-api.js';
import { AlertIcon, FlagIcon, InboxIcon, PlusIcon, StatusIcon } from './icons.js';
import { LazyTooltip, useToasts, type ThemeMode } from './kit.js';
import { NewCaseDialog, todayIso } from './NewCaseDialog.js';
import { errorText, TEXT, type Lang } from './text.js';

type Load = { state: 'loading' } | { state: 'ready'; cases: Case[] } | { state: 'failed'; error: unknown };

type Text = (typeof TEXT)[Lang];

const dayFormat = (lang: Lang, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { ...options, timeZone: 'UTC' });

/** A day as AgentFlow's date picker shows it, the year only when it is not this one. A day has no time zone. */
function formatDay(day: string, t: Text, today: string, lang: Lang): string {
  if (day === today) return t.today;
  const options: Intl.DateTimeFormatOptions = lang === 'vi'
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  const parts = dayFormat(lang, options).formatToParts(new Date(`${day}T00:00:00Z`));
  if (day.slice(0, 4) !== today.slice(0, 4)) return parts.map((p) => p.value).join('');
  // Without its year, Vietnamese day and month alone format as 02-10; dropping the year keeps the picker's 02/10.
  const year = parts.findIndex((p) => p.type === 'year');
  return parts.filter((_, i) => i !== year && i !== year - 1).map((p) => p.value).join('').trim();
}

const fullDay = (day: string, lang: Lang) => dayFormat(lang, { dateStyle: 'full' }).format(new Date(`${day}T00:00:00Z`));

interface Props {
  api: CasesApi;
  lang: Lang;
  locale: string;
  theme: ThemeMode;
}

/** The list of cases, with a "New case" dialog. */
export function CasesScreen({ api, lang, locale, theme }: Props) {
  const t = TEXT[lang];
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [creating, setCreating] = useState(false);
  const toasts = useToasts({ locale, theme });
  // Only the newest read may land: a retry pressed during a slow read must not be overwritten by it.
  const reads = useRef(0);

  const read = useCallback(() => {
    const mine = ++reads.current;
    setLoad({ state: 'loading' });
    api.list().then(
      (cases) => mine === reads.current && setLoad({ state: 'ready', cases }),
      (error: unknown) => mine === reads.current && setLoad({ state: 'failed', error }),
    );
  }, [api]);
  useEffect(read, [read]);

  // What the screen last showed, for a create that lands renders after it started.
  const shown = useRef(load);
  useEffect(() => {
    shown.current = load;
  }, [load]);
  const created = (made: Case) => {
    // A list still loading, or one that failed, may not hold the new case: read it again rather than show it without.
    // Two creates can land before the next render, so each adds to the list as it is then, not as it was shown.
    if (shown.current.state === 'ready') {
      setLoad((now) => (now.state === 'ready' ? { state: 'ready', cases: [made, ...now.cases] } : now));
    } else {
      read();
    }
    toasts.show('success', t.created);
  };

  const today = todayIso();

  return (
    <div className="screen">
      <header className="head">
        <h1>{t.heading}</h1>
        {load.state === 'ready' && load.cases.length > 0 && <span className="count">{t.count(load.cases.length, locale)}</span>}
        <span className="grow" />
        <button type="button" className="af-button primary" onClick={() => setCreating(true)}>
          <PlusIcon />{t.newCase}
        </button>
      </header>

      {load.state === 'loading' && (
        <div className="panel" aria-busy="true">
          <span className="sr-only" role="status">{t.loading}</span>
          <div className="skeleton" aria-hidden="true">
            {[60, 45, 70, 50].map((w) => (
              <div className="skeleton-row" key={w}>
                <span className="af-skeleton" style={{ width: `${w}%` }} />
                <span className="af-skeleton pill-shape" />
              </div>
            ))}
          </div>
        </div>
      )}

      {load.state === 'failed' && (
        <div className="state" role="alert">
          <span className="state-icon danger"><AlertIcon /></span>
          <h2>{t.loadFailed}</h2>
          <p>{errorText(load.error, t, t.retryHint)}</p>
          <button type="button" className="af-button secondary" onClick={read}>{t.retry}</button>
        </div>
      )}

      {load.state === 'ready' && load.cases.length === 0 && (
        <div className="state">
          <span className="state-icon"><InboxIcon /></span>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
        </div>
      )}

      {load.state === 'ready' && load.cases.length > 0 && (
        <div className="panel">
          <table className="table">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.colTitle}</th>
                <th scope="col" className="col-status">{t.colStatus}</th>
                <th scope="col" className="col-opened">{t.colOpened}</th>
              </tr>
            </thead>
            <tbody>
              {load.cases.map((c) => {
                const opened = c.openedOn && (
                  <>
                    <LazyTooltip text={fullDay(c.openedOn, lang)} locale={locale} theme={theme}>
                      <time dateTime={c.openedOn} aria-hidden="true">{formatDay(c.openedOn, t, today, lang)}</time>
                    </LazyTooltip>
                    <span className="sr-only">{fullDay(c.openedOn, lang)}</span>
                  </>
                );
                return (
                  <tr key={c.id} data-urgent={c.urgent || undefined}>
                    <td>
                      <span className="title">
                        <span className="title-text">{c.title}</span>
                        {c.urgent && <span className="tag" data-tone="danger"><FlagIcon />{t.urgent}</span>}
                      </span>
                      {opened && <span className="meta">{opened}</span>}
                    </td>
                    <td className="col-status">
                      <span className="pill" data-status={c.status}><StatusIcon status={c.status} />{t.status[c.status]}</span>
                    </td>
                    <td className="col-opened">{opened}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewCaseDialog open={creating} api={api} lang={lang} locale={locale} theme={theme}
        onCreated={created} onClose={() => setCreating(false)} />
      {toasts.region}
    </div>
  );
}
