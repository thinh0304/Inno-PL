import { useEffect, useRef, useState } from 'react';
import { checkFormat } from '../../order/formats';
import { lineGroup, refId } from '../../order/records';
import type { Rec } from '../../order/types';
import { formatMoney, formatPercent } from '../format.js';
import { useToasts } from '../kit.js';
import type { TabProps } from '../OrderPage.js';
import { errorText, TEXT } from '../text.js';

type Edit = { cost: string; supplier: string; note: string; error: string | null };
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Đơn mua hàng (FR-4.2–4.6, Thiết kế 13.4; mockup renderMHProcure, renderTechSpecView): goods with Purchasing's proposals
 * and its KPI, services with their cost, and the equipment's specs without prices, each as this person may see it.
 */
export function PurchaseTab({ hook, api, lang, locale, theme }: TabProps) {
  const t = TEXT[lang];
  const m = t.mhCols;
  const { draft, config, live, access, saved } = hook;
  const [suppliers, setSuppliers] = useState<Rec[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [recomputing, setRecomputing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toasts = useToasts({ locale, theme });

  useEffect(() => {
    let alive = true;
    api.suppliers().then((found) => alive && setSuppliers(found), () => {});
    return () => { alive = false; timers.current.forEach(clearTimeout); };
  }, [api]);

  const isProcurement = Boolean(access?.seesProposals && !access.seesPl);
  const seesGoods = Boolean(access?.seesGoodsPrices);
  const seesServices = Boolean(access?.seesServicePrices);
  const isTechnical = seesServices && !seesGoods && !access?.seesPl;
  const groups = draft.lines.map((line) => lineGroup(line.item_type_code, config));
  const goods = draft.lines.map((line, i) => ({ line, n: i + 1 })).filter((_, i) => groups[i] === 'goods');
  const services = draft.lines.map((line, i) => ({ line, n: i + 1 })).filter((_, i) => groups[i] === 'service');
  const cost = new Map(live.lines.map((line) => [line.id, line.cost]));
  const supplierName = (id: string | null) => String(suppliers.find((s) => String(s.id) === id)?.name ?? '—');
  const proposalOf = (lineId: string) => (saved?.proposals ?? []).find((p) => refId(p.order_line) === lineId);
  const edit = (lineId: string): Edit => {
    if (edits[lineId]) return edits[lineId];
    const p = proposalOf(lineId);
    return { cost: num(p?.proposed_cost) !== null ? formatMoney(num(p?.proposed_cost)) : '', supplier: refId(p?.proposed_supplier) ?? '',
      note: String(p?.note ?? ''), error: null };
  };

  const saveProposal = async (lineId: string) => {
    const e = edit(lineId);
    const parsed = checkFormat('money', e.cost);
    if (!parsed.ok) {
      setEdits((now) => ({ ...now, [lineId]: { ...e, error: parsed.message! } }));
      return;
    }
    try {
      await api.saveProposal(lineId, draft.order.id!, { proposed_cost: parsed.value as number | null, proposed_supplier: e.supplier || null, note: e.note });
      setEdits((now) => {
        const { [lineId]: _done, ...rest } = now;
        return rest;
      });
      toasts.show('success', t.proposalSaved);
      // compute_pl runs on the proposal's trigger, a few seconds later in AgentFlow: read the order again until then.
      setRecomputing(true);
      hook.refresh();
      timers.current.push(...[5000, 15000, 30000].map((ms) => setTimeout(hook.refresh, ms)),
        setTimeout(() => setRecomputing(false), 30000));
    } catch (error) {
      setEdits((now) => ({ ...now, [lineId]: { ...e, error: errorText(error, t, t.proposalFailed) } }));
    }
  };

  const plGoods = saved?.official.order_pl_goods ?? null;
  const plService = saved?.official.order_pl_service ?? null;
  const saving = num(plGoods?.proc_saving) ?? 0;
  const saleTotal = num(plGoods?.sale_cost_total) ?? 0;

  return (
    <div className="tab-body">
      {seesGoods && (
        <>
          <section className="card">
            <h2 className="card-title">{t.kpiMh}</h2>
            {recomputing && <p className="hint" role="status">{t.recomputing}</p>}
            <div className="stats compact">
              <div className="stat" data-tone={saving >= 0 ? 'ok' : 'danger'}>
                <span className="label">{saving >= 0 ? t.savingLabel : t.overLabel}</span>
                <strong className="stat-value">{formatMoney(Math.abs(saving))}{saleTotal > 0 && ` · ${formatPercent(saving / saleTotal)}`}</strong>
              </div>
              <div className="stat"><span className="label">{t.saleCostTotal}</span><strong className="stat-value">{formatMoney(saleTotal)}</strong></div>
              <div className="stat"><span className="label">{t.procCostTotal}</span><strong className="stat-value">{formatMoney(num(plGoods?.proposed_cost_total))}</strong></div>
            </div>
          </section>
          <section className="card">
            <h2 className="card-title">{t.goodsTitle}</h2>
            {access?.seesProposals && <p className="hint">{t.proposalNote}</p>}
            {goods.length === 0 ? <p className="hint">{t.noGoods}</p> : (
              <div className="scroll-x">
                <table className="table mh">
                  <thead>
                    <tr>
                      {[m.no, m.type, m.coCq, m.name, m.unit, m.qty, m.months, m.saleUnitCost, m.saleAmount, m.saleSupplier].map((h) => <th key={h} scope="col">{h}</th>)}
                      {access?.seesProposals && [m.procUnitCost, m.procSupplier, m.procAmount, m.diff, m.note].map((h) => <th key={h} scope="col">{h}</th>)}
                      {isProcurement && <th scope="col"><span className="sr-only">{t.saveProposalShort}</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {goods.map(({ line, n }) => {
                      const e = edit(line.id);
                      const proposed = num(proposalOf(line.id)?.proposed_cost);
                      const qty = line.quantity ?? 0;
                      return (
                        <tr key={line.id}>
                          <td>{n}</td><td>{line.item_type_code}</td><td>{line.item_type_code === 'TB' ? (line.co_cq ? t.yes : t.no) : ''}</td>
                          <td>{line.name}</td><td>{line.unit}</td><td className="num">{qty}</td><td className="num">{line.months ?? '—'}</td>
                          <td className="num">{formatMoney(line.price.unit_cost)}</td><td className="num">{formatMoney((line.price.unit_cost ?? 0) * qty)}</td>
                          <td>{supplierName(line.price.supplier)}</td>
                          {access?.seesProposals && (isProcurement ? (
                            <>
                              <td>
                                <input className="input cell num" aria-label={t.colOfLine(m.procUnitCost, n)} value={e.cost}
                                  aria-invalid={e.error ? true : undefined} title={e.error ?? undefined}
                                  onChange={(ev) => setEdits((now) => ({ ...now, [line.id]: { ...e, cost: ev.target.value, error: null } }))} />
                              </td>
                              <td>
                                <select className="input cell" aria-label={t.colOfLine(m.procSupplier, n)} value={e.supplier}
                                  onChange={(ev) => setEdits((now) => ({ ...now, [line.id]: { ...e, supplier: ev.target.value } }))}>
                                  <option value="">{t.noSupplier}</option>
                                  {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                                </select>
                              </td>
                            </>
                          ) : (
                            <><td className="num">{formatMoney(proposed)}</td><td>{supplierName(refId(proposalOf(line.id)?.proposed_supplier))}</td></>
                          ))}
                          {access?.seesProposals && (
                            <>
                              <td className="num">{proposed === null ? '—' : formatMoney(proposed * qty)}</td>
                              <td className="num">{proposed === null ? '—' : formatMoney(((line.price.unit_cost ?? 0) - proposed) * qty)}</td>
                              <td>{isProcurement ? (
                                <input className="input cell" aria-label={t.colOfLine(m.note, n)} value={e.note}
                                  onChange={(ev) => setEdits((now) => ({ ...now, [line.id]: { ...e, note: ev.target.value } }))} />
                              ) : String(proposalOf(line.id)?.note ?? '')}</td>
                            </>
                          )}
                          {isProcurement && (
                            <td>
                              <button type="button" className="af-button secondary sm" aria-label={t.saveProposal(n)} onClick={() => saveProposal(line.id)}>
                                {t.saveProposalShort}</button>
                              {e.error && <span className="field-error">{e.error}</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {seesServices && (
        <>
          {plService && (
            <section className="card">
              <h2 className="card-title">{t.serviceCard}</h2>
              <div className="stats compact">
                {(['revenue', 'cost', 'gross', 'oneTime', 'recurring', 'internal', 'outsource'] as const).map((k) => {
                  const field = { revenue: 'revenue', cost: 'cost', gross: 'gross_profit', oneTime: 'one_time_cost', recurring: 'recurring_cost',
                    internal: 'internal_cost', outsource: 'outsource_cost' }[k];
                  return <div key={k} className="stat"><span className="label">{t.serviceStats[k]}</span>
                    <strong className="stat-value">{formatMoney(num(plService[field]))}</strong></div>;
                })}
              </div>
            </section>
          )}
          <section className="card">
            <h2 className="card-title">{t.servicesTitle}</h2>
            {services.length === 0 ? <p className="hint">{t.noServices}</p> : (
              <table className="table">
                <thead><tr>{(['no', 'name', 'type', 'unit', 'qty', 'unitCost', 'months', 'supplier', 'cost'] as const).map((k) =>
                  <th key={k} scope="col">{t.svcCols[k]}</th>)}</tr></thead>
                <tbody>
                  {services.map(({ line, n }) => (
                    <tr key={line.id}>
                      <td>{n}</td><td>{line.name}</td><td>{line.item_type_code}</td><td>{line.unit}</td><td className="num">{line.quantity ?? '—'}</td>
                      <td className="num">{formatMoney(line.price.unit_cost)}</td><td className="num">{line.months ?? '—'}</td>
                      <td>{supplierName(line.price.supplier)}</td><td className="num">{formatMoney(cost.get(line.id) ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {isTechnical && (
        <section className="card">
          <h2 className="card-title">{t.specsTitle}</h2>
          {goods.length === 0 ? <p className="hint">{t.noGoods}</p> : (
            <table className="table">
              <thead><tr>{(['no', 'type', 'name', 'qty', 'sku', 'specs'] as const).map((k) => <th key={k} scope="col">{t.specCols[k]}</th>)}</tr></thead>
              <tbody>
                {goods.map(({ line, n }) => (
                  <tr key={line.id}><td>{n}</td><td>{line.item_type_code}</td><td>{line.name}</td><td className="num">{line.quantity ?? '—'}</td>
                    <td>{line.sku || '—'}</td><td>{line.specs || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {toasts.region}
    </div>
  );
}
