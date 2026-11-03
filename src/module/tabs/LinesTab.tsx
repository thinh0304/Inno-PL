import { Fragment, useEffect, useId, useState } from 'react';
import { lineGroup } from '../../order/records';
import type { LineDraft, Rec } from '../../order/types';
import { shownValue, useEditing } from '../Field.js';
import { formatMoney, formatPercent } from '../format.js';
import { ChevronIcon, PlusIcon, TrashIcon } from '../icons.js';
import type { TabProps } from '../OrderPage.js';
import { getIn } from '../paths.js';
import { newLine } from '../save-plan.js';
import { errorText, TEXT } from '../text.js';
import type { OrderDraftHook } from '../useOrderDraft.js';

/** One editable cell of the grid, named for a screen reader by its column and line. */
function Cell({ hook, path, label, numeric }: { hook: OrderDraftHook; path: string; label: string; numeric?: boolean }) {
  const editing = useEditing(hook, path);
  const issue = hook.issueAt(path);
  if (!hook.editor) return <span className={numeric ? 'num' : undefined}>{shownValue(path, getIn(hook.draft, path)) || '—'}</span>;
  return (
    <input className={`input cell${numeric ? ' num' : ''}`} aria-label={label} value={editing.value} title={issue ?? undefined}
      aria-invalid={issue ? true : undefined} onChange={(e) => editing.onChange(e.target.value)} onFocus={editing.onFocus}
      onBlur={editing.onBlur} autoComplete="off" />
  );
}

function Choice({ hook, path, label, value, options, onPick }: { hook: OrderDraftHook; path: string; label: string; value: string;
  options: { value: string; label: string }[]; onPick?(value: string): void }) {
  if (!hook.editor) return <span>{options.find((o) => o.value === value)?.label ?? '—'}</span>;
  return (
    <select className="input cell" aria-label={label} value={value} aria-invalid={hook.issueAt(path) ? true : undefined}
      onChange={(e) => (onPick ? onPick(e.target.value) : hook.set(path, e.target.value))}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Danh mục Thiết bị / Dịch vụ (FR-3.1–3.5, FR-4.1; mockup renderBanMua, specRow): the lines, computed as they are typed. */
export function LinesTab({ hook, api, lang }: TabProps) {
  const t = TEXT[lang];
  const c = t.cols;
  const { draft, live, config } = hook;
  const [suppliers, setSuppliers] = useState<Rec[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [grouped, setGrouped] = useState(false);
  const [adding, setAdding] = useState<{ line: number; name: string; contact: string; phone: string; error: string | null } | null>(null);
  const captionId = useId();

  useEffect(() => {
    let alive = true;
    api.suppliers().then((found) => alive && setSuppliers(found), () => {});
    return () => { alive = false; };
  }, [api]);

  const result = new Map(live.lines.map((line) => [line.id, line]));
  const supplierName = (id: string | null) => String(suppliers.find((s) => s.id === id)?.name ?? '');
  const types = config.itemTypes.map((type) => ({ value: type.code, label: type.code }));
  const at = (i: number) => `lines[${i}]`;

  const addLine = () => hook.setDraft((d) => ({ ...d, lines: [...d.lines,
    newLine(`new:${Date.now().toString(36)}${d.lines.length}`, Math.max(0, ...d.lines.map((l) => l.line_no)) + 1, config)] }));
  const removeLine = (id: string) => hook.setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));
  const toggle = (id: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const saveSupplier = async () => {
    if (!adding || !adding.name.trim()) return;
    try {
      const made = await api.createSupplier({ name: adding.name.trim(), contact_name: adding.contact || undefined, phone: adding.phone || undefined });
      setSuppliers((now) => [...now, made]);
      hook.set(`${at(adding.line)}.price.supplier`, String(made.id));
      setAdding(null);
    } catch (error) {
      setAdding({ ...adding, error: errorText(error, t, t.supplierFailed) });
    }
  };

  // The lines in display order: as entered, or grouped by supplier (FR-3.4).
  const order = draft.lines.map((line, index) => ({ line, index }));
  if (grouped) order.sort((a, b) => supplierName(a.line.price.supplier).localeCompare(supplierName(b.line.price.supplier)));

  const missingLines = new Set(hook.issues.filter((i) => i.message === 'Bắt buộc' && i.path.startsWith('lines['))
    .map((i) => i.path.slice(0, i.path.indexOf(']') + 1))).size;
  const total = { revenue: live.revenue, cost: live.cost, gross: live.grossProfit };
  const vatOptions = config.vatRates.map((rate) => ({ value: rate.code, label: rate.label }));
  const vatCode = (line: LineDraft) => config.vatRates.find((rate) => rate.rate === (line.price.vat_rate ?? 0.08))?.code ?? '';

  const row = (line: LineDraft, i: number) => {
    const n = i + 1;
    const type = config.itemTypes.find((x) => x.code === line.item_type_code);
    const r = result.get(line.id);
    const misplaced = line.price.source && lineGroup(line.item_type_code, config) && line.price.source !== lineGroup(line.item_type_code, config);
    const expanded = open.has(line.id);
    return (
      <Fragment key={line.id}>
        <tr className="line">
          <td className="col-no">
            <button type="button" className="af-button ghost icon sm" aria-expanded={expanded} aria-label={t.detailOf(n)} onClick={() => toggle(line.id)}>
              <ChevronIcon open={expanded} />
            </button>
            <span>{n}</span>
          </td>
          <td className="col-type">
            <Choice hook={hook} path={`${at(i)}.item_type_code`} label={t.colOfLine(c.type, n)} value={line.item_type_code}
              options={type ? types : [{ value: line.item_type_code, label: line.item_type_code }, ...types]} />
            {!type && <div className="tag" data-tone="warn">{t.unknownType}</div>}
            {misplaced && hook.editor && <div className="tag" data-tone="info">{t.misplaced}</div>}
          </td>
          <td className="col-cocq">
            {line.item_type_code === 'TB' ? (
              <Choice hook={hook} path={`${at(i)}.co_cq`} label={t.colOfLine(c.coCq, n)} value={line.co_cq ? 'yes' : 'no'}
                options={[{ value: 'no', label: t.no }, { value: 'yes', label: t.yes }]} onPick={(v) => hook.set(`${at(i)}.co_cq`, v === 'yes')} />
            ) : null}
          </td>
          <td className="col-name"><Cell hook={hook} path={`${at(i)}.name`} label={t.colOfLine(c.name, n)} /></td>
          <td className="col-unit"><Cell hook={hook} path={`${at(i)}.unit`} label={t.colOfLine(c.unit, n)} /></td>
          <td className="col-qty"><Cell hook={hook} path={`${at(i)}.quantity`} label={t.colOfLine(c.quantity, n)} numeric /></td>
          <td className="col-qty"><Cell hook={hook} path={`${at(i)}.months`} label={t.colOfLine(c.months, n)} numeric /></td>
          <td className="col-money"><Cell hook={hook} path={`${at(i)}.price.unit_price`} label={t.colOfLine(c.unitPrice, n)} numeric /></td>
          <td className="num">{formatMoney(r?.revenue ?? 0)}</td>
          <td className="col-money"><Cell hook={hook} path={`${at(i)}.price.unit_cost`} label={t.colOfLine(c.unitCost, n)} numeric /></td>
          <td className="num">{formatMoney(r?.cost ?? 0)}</td>
          <td className="num">{formatMoney(r?.profit ?? 0)}</td>
          <td className="num">{r && r.cost > 0 ? formatPercent(r.profit / r.cost) : '—'}</td>
          <td className="col-supplier">
            <Choice hook={hook} path={`${at(i)}.price.supplier`} label={t.colOfLine(c.supplier, n)} value={line.price.supplier ?? ''}
              options={[{ value: '', label: t.noSupplier }, ...suppliers.map((s) => ({ value: String(s.id), label: String(s.name) })),
                ...(hook.editor ? [{ value: '__new', label: t.newSupplier }] : [])]}
              onPick={(v) => (v === '__new' ? setAdding({ line: i, name: '', contact: '', phone: '', error: null })
                : hook.set(`${at(i)}.price.supplier`, v || null))} />
          </td>
          <td className="col-note"><Cell hook={hook} path={`${at(i)}.note`} label={t.colOfLine(c.note, n)} /></td>
          {hook.editor && (
            <td className="col-actions">
              <button type="button" className="af-button ghost icon sm" aria-label={t.deleteLine(n)} onClick={() => removeLine(line.id)}><TrashIcon /></button>
            </td>
          )}
        </tr>
        {expanded && (
          <tr className="line-detail">
            <td colSpan={hook.editor ? 16 : 15}>
              <div className="detail-grid">
                <label className="field"><span className="label">{t.detail.discount}</span>
                  <Cell hook={hook} path={`${at(i)}.price.discount_pct`} label={t.colOfLine(t.detail.discount, n)} numeric /></label>
                <label className="field"><span className="label">{t.detail.vat}</span>
                  <Choice hook={hook} path={`${at(i)}.price.vat_rate`} label={t.colOfLine(t.detail.vat, n)} value={vatCode(line)} options={vatOptions}
                    onPick={(code) => hook.set(`${at(i)}.price.vat_rate`, config.vatRates.find((r2) => r2.code === code)?.rate ?? null)} /></label>
                <label className="field"><span className="label">{t.detail.sku}</span>
                  <Cell hook={hook} path={`${at(i)}.sku`} label={t.colOfLine(t.detail.sku, n)} /></label>
                {type?.termed && (
                  <>
                    <label className="field"><span className="label">{t.detail.start}</span>
                      <Cell hook={hook} path={`${at(i)}.start_date`} label={t.colOfLine(t.detail.start, n)} /></label>
                    <label className="field"><span className="label">{t.detail.end}</span>
                      <Cell hook={hook} path={`${at(i)}.end_date`} label={t.colOfLine(t.detail.end, n)} /></label>
                  </>
                )}
                <label className="field"><span className="label">{t.detail.deliveryTime}</span>
                  <Cell hook={hook} path={`${at(i)}.delivery_time`} label={t.colOfLine(t.detail.deliveryTime, n)} /></label>
                <label className="field"><span className="label">{t.detail.priority}</span>
                  <Choice hook={hook} path={`${at(i)}.supplier_priority`} label={t.colOfLine(t.detail.priority, n)} value={line.supplier_priority}
                    options={Object.entries(t.priorities).map(([value, label]) => ({ value, label }))} /></label>
                <label className="field"><span className="label">{t.detail.endUser}</span>
                  <Cell hook={hook} path={`${at(i)}.end_user`} label={t.colOfLine(t.detail.endUser, n)} /></label>
                <label className="field wide"><span className="label">{t.detail.specs}</span>
                  <Cell hook={hook} path={`${at(i)}.specs`} label={t.colOfLine(t.detail.specs, n)} /></label>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  let lastSupplier: string | null | undefined;
  return (
    <div className="tab-body">
      <section className="card">
        <h2 className="card-title">{t.summary}</h2>
        <table className="table summary">
          <thead><tr><td />
            {(['before', 'vat', 'after', 'ratio'] as const).map((k) => <th key={k} scope="col" className="num">{t.summaryCols[k]}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">{t.summaryRows.revenue}</th><td className="num">{formatMoney(total.revenue)}</td>
              <td className="num">{formatMoney(live.vatOut)}</td><td className="num">{formatMoney(total.revenue + live.vatOut)}</td><td className="num">—</td></tr>
            <tr><th scope="row">{t.summaryRows.cost}</th><td className="num">{formatMoney(total.cost)}</td>
              <td className="num">{formatMoney(live.vatIn)}</td><td className="num">{formatMoney(total.cost + live.vatIn)}</td><td className="num">—</td></tr>
            <tr><th scope="row">{t.summaryRows.gross}</th><td className="num">{formatMoney(total.gross)}</td>
              <td className="num">{formatMoney(live.vatOut - live.vatIn)}</td><td className="num">{formatMoney(total.gross + live.vatOut - live.vatIn)}</td>
              <td className="num">{total.cost > 0 ? formatPercent(total.gross / total.cost) : '—'}</td></tr>
          </tbody>
        </table>
      </section>

      {hook.editor && missingLines > 0 && <div className="af-banner warning inset" role="status">{t.linesMissing(missingLines)}</div>}

      <div className="toolbar">
        {hook.editor && <button type="button" className="af-button secondary sm" onClick={addLine}><PlusIcon />{t.addLine}</button>}
        <label className="check"><input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />{t.groupBySupplier}</label>
      </div>

      {adding && (
        <div className="card inline-form">
          <label className="field"><span className="label">{t.supplierName}</span>
            <input className="input" aria-label={t.supplierName} value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></label>
          <label className="field"><span className="label">{t.supplierContact}</span>
            <input className="input" value={adding.contact} onChange={(e) => setAdding({ ...adding, contact: e.target.value })} /></label>
          <label className="field"><span className="label">{t.supplierPhone}</span>
            <input className="input" value={adding.phone} onChange={(e) => setAdding({ ...adding, phone: e.target.value })} /></label>
          <div className="choices">
            <button type="button" className="af-button primary sm" onClick={saveSupplier}>{t.saveSupplier}</button>
            <button type="button" className="af-button ghost sm" onClick={() => setAdding(null)}>{t.cancel}</button>
          </div>
          {adding.error && <p className="field-error">{adding.error}</p>}
        </div>
      )}

      {draft.lines.length === 0 ? <div className="state"><p>{t.noLines}</p></div> : (
        <div className="panel scroll-x">
          <table className="table lines" aria-describedby={captionId}>
            <caption id={captionId} className="sr-only">{t.linesCaption}</caption>
            <thead>
              <tr>
                {[c.no, c.type, c.coCq, c.name, c.unit, c.quantity, c.months, c.unitPrice, c.revenue, c.unitCost, c.cost, c.gross, c.margin,
                  c.supplier, c.note].map((h) => <th key={h} scope="col">{h}</th>)}
                {hook.editor && <th scope="col"><span className="sr-only">{t.deleteLine(0).replace(/ 0$/, '')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {order.map(({ line, index }) => {
                const head = grouped && line.price.supplier !== lastSupplier;
                lastSupplier = line.price.supplier;
                const members = draft.lines.filter((l) => l.price.supplier === line.price.supplier);
                const cost = members.reduce((sum, l) => sum + (result.get(l.id)?.cost ?? 0), 0);
                return (
                  <Fragment key={line.id}>
                    {head && <tr className="group-head"><th scope="rowgroup" colSpan={hook.editor ? 16 : 15}>
                      {t.groupHead(supplierName(line.price.supplier) || t.noSupplier, members.length, formatMoney(cost))}</th></tr>}
                    {row(line, index)}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={8}>{t.total}</th>
                <td className="num">{formatMoney(live.revenue)}</td><td />
                <td className="num">{formatMoney(live.cost)}</td>
                <td className="num">{formatMoney(live.grossProfit)}</td>
                <td className="num">{live.cost > 0 ? formatPercent(live.grossProfit / live.cost) : '—'}</td>
                <td colSpan={hook.editor ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
