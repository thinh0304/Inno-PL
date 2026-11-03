import { useEffect, useState } from 'react';
import type { Rec } from '../../order/types';
import type { TabProps } from '../OrderPage.js';
import { TEXT } from '../text.js';

/** Nhà cung cấp (FR-4.1; mockup renderSuppliers): the suppliers this order's lines use, read-only. */
export function SuppliersTab({ hook, api, lang }: TabProps) {
  const t = TEXT[lang];
  const [all, setAll] = useState<Rec[] | null>(null);
  useEffect(() => {
    let alive = true;
    api.suppliers().then((found) => alive && setAll(found), () => alive && setAll([]));
    return () => { alive = false; };
  }, [api]);

  const used = new Set(hook.draft.lines.map((line) => line.price.supplier).filter(Boolean));
  const shown = (all ?? []).filter((s) => used.has(String(s.id)));
  const terms = (s: Rec) => [
    ...((s.payment_terms as Rec[] | undefined) ?? []).map((p) => t.term(String(p.label ?? ''), Number(p.percent ?? 0), typeof p.days === 'number' ? p.days : null)),
    ...(typeof s.debt_days === 'number' ? [t.debtDays(s.debt_days)] : []),
  ].join('; ') || '—';

  return (
    <section className="card">
      <h2 className="card-title">{t.suppliersTitle}</h2>
      {all !== null && shown.length === 0 ? <p className="hint">{t.noSuppliers}</p> : (
        <table className="table">
          <thead><tr>{(['name', 'contact', 'phone', 'email', 'terms'] as const).map((k) => <th key={k} scope="col">{t.supplierCols[k]}</th>)}</tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={String(s.id)}>
                <th scope="row">{String(s.name ?? '')}</th><td>{String(s.contact_name ?? '—')}</td><td>{String(s.phone ?? '—')}</td>
                <td>{String(s.email ?? '—')}</td><td>{terms(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
