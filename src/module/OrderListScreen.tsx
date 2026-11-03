import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDay, formatMoney } from './format.js';
import { AlertIcon, ChevronIcon, InboxIcon, PlusIcon, TrashIcon } from './icons.js';
import { Dialog, useToasts, type ThemeMode } from './kit.js';
import type { Access, OrderSummary, OrdersApi, StaffMember } from './orders-api.js';
import { inRange, periodRange, type Period, type PeriodKind } from './period.js';
import { errorText, TEXT, type Lang, type Text } from './text.js';

type Load = { state: 'loading' } | { state: 'ready'; orders: OrderSummary[]; access: Access; staff: StaffMember[] } | { state: 'failed'; error: unknown };

interface Props {
  api: OrdersApi;
  lang: Lang;
  locale: string;
  theme: ThemeMode;
  onOpen(id: string): void;
  onNew(): void;
  /** Opens My work. */
  onMyWork?(): void;
  /** yyyy-mm-dd; the period filter counts from it. */
  today?: string;
}

const KINDS: PeriodKind[] = ['all', 'year', 'quarter', 'month', 'week'];
const STATUSES = ['draft', 'in_progress', 'done', 'close_lost'] as const;

function periodName(t: Text, today: string, period: Period): string {
  const range = periodRange(today, period);
  if (!range) return '';
  const [y, m] = range.from.split('-').map(Number);
  if (period.kind === 'year') return t.periodLabel.year(y);
  if (period.kind === 'quarter') return t.periodLabel.quarter(Math.floor((m - 1) / 3) + 1, y);
  if (period.kind === 'month') return t.periodLabel.month(m, y);
  const last = new Date(`${range.to}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  return t.periodLabel.week(formatDay(range.from).slice(0, 5), formatDay(last.toISOString()).slice(0, 5));
}

/** The orders the person may see, with the period / status / AM filters (FR-1.1, 1.2), the new-order button (FR-1.5). */
export function OrderListScreen({ api, lang, locale, theme, onOpen, onNew, onMyWork, today = new Date().toISOString().slice(0, 10) }: Props) {
  const t = TEXT[lang];
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [period, setPeriod] = useState<Period>({ kind: 'all', offset: 0 });
  const [status, setStatus] = useState('');
  const [am, setAm] = useState('');
  const [deleting, setDeleting] = useState<OrderSummary | null>(null);
  // How many tasks wait for this person (the badge on My work); not being able to count them hides the number, not the list.
  const [waiting, setWaiting] = useState(0);
  const busy = useRef(false);
  const toasts = useToasts({ locale, theme });
  // Only the newest read may land: a retry pressed during a slow read must not be overwritten by it.
  const reads = useRef(0);

  const read = useCallback(() => {
    const mine = ++reads.current;
    setLoad({ state: 'loading' });
    Promise.all([api.list(), api.access(), api.staff()]).then(
      ([orders, access, staff]) => mine === reads.current && setLoad({ state: 'ready', orders, access, staff }),
      (error: unknown) => mine === reads.current && setLoad({ state: 'failed', error }),
    );
  }, [api]);
  useEffect(read, [read]);
  useEffect(() => {
    let alive = true;
    api.myWork().then((items) => alive && setWaiting(items.length), () => alive && setWaiting(0));
    return () => { alive = false; };
  }, [api]);

  const ready = load.state === 'ready' ? load : null;
  const nameOf = useMemo(() => {
    const byUser = new Map((ready?.staff ?? []).filter((s) => s.user).map((s) => [s.user!, s.name]));
    return (user: string | null) => (user ? byUser.get(user) ?? '—' : '—');
  }, [ready?.staff]);
  const range = periodRange(today, period);
  const shown = (ready?.orders ?? []).filter((o) => inRange(o.createdAt, range) && (!status || o.status === status) && (!am || o.am === am));

  const confirmDelete = async () => {
    if (!deleting || busy.current) return;
    busy.current = true;
    try {
      await api.deleteOrder(deleting.id);
      toasts.show('success', t.deleted);
      setDeleting(null);
      read();
    } catch (error) {
      toasts.show('error', errorText(error, t, t.deleteFailed));
    } finally {
      busy.current = false;
    }
  };

  const access = ready?.access;
  const showAmFilter = Boolean(access && ((access.seesPl && access.seesProposals) || access.isAdmin));
  const moneyColumn = access?.seesPl ? 'revenue' : 'lines';
  const resultColumn = Boolean(access?.seesPl && access.seesProposals);

  return (
    <main className="screen screen-wide">
      <header className="head">
        <h1>{t.listHeading}</h1>
        {ready && <span className="count">{t.count(shown.length)}</span>}
        <span className="grow" />
        {onMyWork && <button type="button" className="af-button secondary" onClick={onMyWork}>{t.work.button(waiting)}</button>}
        {access?.canCreateOrder && (
          <button type="button" className="af-button primary" onClick={onNew}><PlusIcon />{t.newOrder}</button>
        )}
      </header>

      <div className="filters">
        <div className="segmented" role="radiogroup" aria-label={t.periodGroup}>
          {KINDS.map((kind) => (
            <label key={kind} className="segment" data-on={period.kind === kind || undefined}>
              <input type="radio" name="period" checked={period.kind === kind} onChange={() => setPeriod({ kind, offset: 0 })} />
              {t.periods[kind]}
            </label>
          ))}
        </div>
        {period.kind !== 'all' && (
          <div className="stepper">
            <button type="button" className="af-button ghost icon sm flip" aria-label={t.previousPeriod}
              onClick={() => setPeriod({ ...period, offset: period.offset - 1 })}><ChevronIcon open={false} /></button>
            <span className="period-name">{periodName(t, today, period)}</span>
            <button type="button" className="af-button ghost icon sm" aria-label={t.nextPeriod}
              onClick={() => setPeriod({ ...period, offset: period.offset + 1 })}><ChevronIcon open={false} /></button>
          </div>
        )}
        <label className="select-field">
          <span className="sr-only">{t.statusFilter}</span>
          <select className="input select" aria-label={t.statusFilter} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t.anyStatus}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </select>
        </label>
        {showAmFilter && (
          <label className="select-field">
            <span className="sr-only">{t.amFilter}</span>
            <select className="input select" aria-label={t.amFilter} value={am} onChange={(e) => setAm(e.target.value)}>
              <option value="">{t.anyAm}</option>
              {ready!.staff.filter((s) => s.team === 'sales' && s.user).map((s) => <option key={s.id} value={s.user!}>{s.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {load.state === 'loading' && <div className="panel skeleton" aria-busy="true" aria-label={t.loading}>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton-row"><span className="af-skeleton" style={{ width: '40%' }} /><span className="af-skeleton pill-shape" /></div>)}
      </div>}

      {load.state === 'failed' && (
        <div className="state" role="alert">
          <span className="state-icon danger"><AlertIcon /></span>
          <h2>{errorText(load.error, t, t.loadFailed)}</h2>
          <p>{t.retryHint}</p>
          <button type="button" className="af-button secondary" onClick={read}>{t.retry}</button>
        </div>
      )}

      {ready && ready.orders.length === 0 && (
        <div className="state">
          <span className="state-icon"><InboxIcon /></span>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
        </div>
      )}

      {ready && ready.orders.length > 0 && shown.length === 0 && (
        <div className="state"><span className="state-icon"><InboxIcon /></span><h2>{t.noMatch}</h2></div>
      )}

      {ready && shown.length > 0 && (
        <div className="panel">
          <table className="table orders">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.colCode}</th>
                <th scope="col">{t.colCustomer}</th>
                <th scope="col" className="col-owner">{t.colOwner}</th>
                <th scope="col" className="col-status">{t.colStatus}</th>
                <th scope="col" className="num">{moneyColumn === 'revenue' ? t.colRevenue : t.colMyLines}</th>
                {resultColumn && <th scope="col" className="col-result">{t.colResult}</th>}
                {access?.isAdmin && <th scope="col" className="col-actions"><span className="sr-only">{t.deleteConfirm}</span></th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => onOpen(o.id)}>
                  <td className="col-code">
                    {o.code ? <span className="code">{o.code}</span> : <span className="tag" data-tone="muted">{t.draftCode}</span>}
                  </td>
                  <td>
                    <button type="button" className="link customer-name" onClick={(e) => { e.stopPropagation(); onOpen(o.id); }}>{o.customerName || '—'}</button>
                    <div className="sub">{[o.customerCode, formatDay(o.createdAt)].filter((v) => v && v !== '—').join(' · ')}</div>
                  </td>
                  <td className="col-owner">
                    <div>{nameOf(o.am)}</div>
                    {o.sa && <div className="sub">{t.saPrefix} {nameOf(o.sa)}</div>}
                  </td>
                  <td className="col-status">
                    <span className="pill" data-status={o.status}>{t.status[o.status]}</span>
                    {o.status === 'in_progress' && <div className="sub">{t.stageOf(o.stage)}</div>}
                  </td>
                  <td className="num">{moneyColumn === 'revenue' ? formatMoney(o.revenue) : (o.myLines ?? '—')}</td>
                  {resultColumn && (
                    <td className="col-result">
                      {o.passed === null ? '—' : <span className="tag" data-tone={o.passed ? 'ok' : 'danger'}>{o.passed ? t.passed : t.failed}</span>}
                    </td>
                  )}
                  {access?.isAdmin && (
                    <td className="col-actions">
                      <button type="button" className="af-button ghost icon sm" aria-label={t.deleteOrder(o.customerName || o.code)}
                        onClick={(e) => { e.stopPropagation(); setDeleting(o); }}><TrashIcon /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={deleting !== null} heading={t.deleteHeading} locale={locale} theme={theme} onClose={() => setDeleting(null)}
        actions={<>
          <button type="button" className="af-button" onClick={() => setDeleting(null)}>{t.cancel}</button>
          <button type="button" className="af-button danger" onClick={confirmDelete}>{t.deleteConfirm}</button>
        </>}>
        <p>{t.deleteBody}</p>
      </Dialog>
      {toasts.region}
    </main>
  );
}
