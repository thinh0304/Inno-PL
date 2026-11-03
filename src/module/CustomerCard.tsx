import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Rec } from '../order/types';
import { Field } from './Field.js';
import { ChevronIcon } from './icons.js';
import type { CustomerHit, OrdersApi } from './orders-api.js';
import { getIn } from './paths.js';
import { TEXT, type Lang } from './text.js';
import type { OrderDraftHook } from './useOrderDraft.js';

const FIELDS: { path: string; key: string; required?: boolean; wide?: boolean }[] = [
  { path: 'order.customer_name', key: 'customer_name', required: true, wide: true },
  { path: 'order.customer_code', key: 'customer_code', required: true },
  { path: 'order.tax_code', key: 'tax_code', required: true },
  { path: 'order.address', key: 'address', wide: true },
  { path: 'order.contact_name', key: 'contact_name', required: true },
  { path: 'order.contact_phone', key: 'contact_phone' },
  { path: 'order.contact_email', key: 'contact_email' },
  { path: 'order.representative', key: 'representative' },
  { path: 'order.representative_title', key: 'representative_title' },
  { path: 'order.bank_account', key: 'bank_account' },
  { path: 'order.bank_name', key: 'bank_name' },
  { path: 'order.quote_date', key: 'quote_date' },
  { path: 'order.quote_valid_until', key: 'quote_valid_until' },
  { path: 'order.exchange_rate', key: 'exchange_rate' },
];
// The fields typing in which looks a customer up (FR-1.6c).
const LOOKUP = new Set(['order.customer_name', 'order.customer_code', 'order.tax_code']);

// A customer record's fields → the order's (the order keeps its own copy, Thiết kế 6.1).
const FROM_PROFILE: [string, (c: Rec) => unknown][] = [
  ['customer_name', (c) => c.name], ['customer_code', (c) => c.code], ['tax_code', (c) => c.tax_code], ['address', (c) => c.address],
  ['representative', (c) => c.representative], ['representative_title', (c) => c.representative_title],
  ['bank_account', (c) => c.bank_account], ['bank_name', (c) => c.bank_name],
  ['contact_name', (c) => (c.contacts as Rec[] | undefined)?.[0]?.name], ['contact_phone', (c) => (c.contacts as Rec[] | undefined)?.[0]?.phone],
  ['contact_email', (c) => (c.contacts as Rec[] | undefined)?.[0]?.email],
  ['receiver_name', (c) => c.receiver_name], ['receiver_phone', (c) => c.receiver_phone],
  ['delivery_address', (c) => c.delivery_address], ['delivery_note', (c) => c.delivery_note],
];

interface Props { hook: OrderDraftHook; api: OrdersApi; lang: Lang }

/** The customer block (mockup renderInfo, kSug): collapsible, with known customers suggested while typing. */
export function CustomerCard({ hook, api, lang }: Props) {
  const t = TEXT[lang];
  const [open, setOpen] = useState(true);
  const [hits, setHits] = useState<CustomerHit[] | null>(null);
  const [active, setActive] = useState(-1);
  const [lookupPath, setLookupPath] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ key: string; profile: string }[]>([]);
  const listId = useId();
  const searches = useRef(0);

  // Look the customer up 250 ms after the last key, from 2 characters on.
  const text = lookupPath ? String(hook.rawAt(lookupPath) ?? getIn(hook.draft, lookupPath) ?? '') : '';
  useEffect(() => {
    if (!lookupPath || text.trim().length < 2) {
      setHits(null);
      return;
    }
    const mine = ++searches.current;
    const timer = setTimeout(() => {
      api.findCustomers(text).then((found) => mine === searches.current && (setHits(found), setActive(-1)), () => setHits(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [api, lookupPath, text]);

  const close = () => {
    searches.current += 1;
    setHits(null);
    setLookupPath(null);
  };

  const pick = (hit: CustomerHit) => {
    const differing: { key: string; profile: string }[] = [];
    hook.setDraft((draft) => {
      const order = { ...draft.order } as unknown as Rec;
      for (const [key, read] of FROM_PROFILE) {
        const profile = read(hit.record);
        if (profile === undefined || profile === null || profile === '') continue;
        const now = order[key];
        if (now === '' || now === null || now === undefined) order[key] = profile;
        else if (String(now) !== String(profile)) differing.push({ key, profile: String(profile) });
      }
      order.customer = hit.id;
      if (hit.tier) order.customer_tier = hit.tier;
      return { ...draft, order: order as unknown as typeof draft.order };
    });
    setConflicts(differing);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!hits) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(hits.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Enter' && hits[active]) { event.preventDefault(); pick(hits[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
  };

  const missing = hook.issues.filter((issue) => FIELDS.some((f) => f.path === issue.path) && issue.message === 'Bắt buộc').length;

  return (
    <section className="card" aria-labelledby={`${listId}-title`}>
      <header className="card-head">
        <h2 id={`${listId}-title`}>{t.customerCard}</h2>
        {hook.editor && <span className="hint">{t.requiredHint}</span>}
        <span className="grow" />
        <button type="button" className="af-button ghost sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronIcon open={open} />{open ? t.collapse : t.expand}
        </button>
      </header>
      {hook.editor && missing > 0 && <div className="af-banner warning inset" role="status">{t.customerMissing(missing)}</div>}
      {open && (
        <div className="grid">
          {FIELDS.map((f) => {
            const lookup = LOOKUP.has(f.path) && hook.editor;
            const showList = lookup && lookupPath === f.path && hits !== null;
            return (
              <Field key={f.path} hook={hook} path={f.path} label={t.labels[f.key]} required={f.required} wide={f.wide}
                onEdit={lookup ? () => setLookupPath(f.path) : undefined}
                onKeyDown={lookup ? onKeyDown : undefined}
                inputProps={lookup ? { role: 'combobox', 'aria-expanded': showList, 'aria-controls': listId, 'aria-autocomplete': 'list',
                  'aria-activedescendant': showList && active >= 0 ? `${listId}-${active}` : undefined } : undefined}
                listbox={showList ? (
                  <div className="suggest">
                    {hits!.length === 0 ? <p className="suggest-empty">{t.noCustomer}</p> : (
                      <ul id={listId} role="listbox" aria-label={t.suggestions}>
                        {hits!.map((hit, i) => (
                          <li key={hit.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                            onMouseDown={(e) => { e.preventDefault(); pick(hit); }} onClick={() => pick(hit)}>
                            <div><strong>{hit.name}</strong> · {hit.code}{hit.tier && <span className="tag"> {t.tiers[hit.tier]}</span>}</div>
                            <div className="sub">{t.mst} {hit.taxCode}{hit.address && ` · ${hit.address}`}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="suggest-foot">{t.suggestFooter}</p>
                  </div>
                ) : undefined} />
            );
          })}
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="conflicts">
          <h3>{t.differs}</h3>
          <ul>
            {conflicts.map((c) => (
              <li key={c.key}>
                <span className="label">{t.labels[c.key]}</span>
                <span>{String(getIn(hook.draft, `order.${c.key}`) ?? '')}</span>
                <span className="sub">→ {c.profile}</span>
                <button type="button" className="af-button sm" aria-label={t.keepField(t.labels[c.key])}
                  onClick={() => { hook.noteIgnoredSuggestion(t.history.ignoredSuggestionNote(t.labels[c.key])); setConflicts((now) => now.filter((x) => x.key !== c.key)); }}>{t.keep}</button>
                <button type="button" className="af-button sm secondary" aria-label={t.updateField(t.labels[c.key])}
                  onClick={() => { hook.set(`order.${c.key}`, c.profile); setConflicts((now) => now.filter((x) => x.key !== c.key)); }}>{t.update}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
