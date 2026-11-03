import { useState } from 'react';
import type { Rec } from '../../order/types';
import type { PlResult } from '../../pl/compute';
import { formatDateTime, formatMoney, formatPercent } from '../format.js';
import { CheckIcon, ChevronIcon, XIcon } from '../icons.js';
import type { TabProps } from '../OrderPage.js';
import { TEXT } from '../text.js';

/** The figures the tab shows, from the live computation or from the official order_pl record. */
interface PlView { revenue: number; cost: number; grossProfit: number; salesCost: number; finCost: number; finCostRate: number;
  profitAfterSales: number; warranty: number; licenseSupport: number; techSupport: number; deployBonus: number; provision: number;
  consultBonus: number; consultBonusRate: number; provisionFundDraw: number; netProfit: number; netMargin: number | null;
  threshold: number; passed: boolean; appliedContractType: string | null; byType: PlResult['byType'];
  kpiSplit: PlResult['kpiSplit']; }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const parse = <T,>(v: unknown, fallback: T): T => {
  if (typeof v !== 'string') return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};

function fromOfficial(pl: Rec): PlView {
  const detail = parse<Rec>(pl.detail, {});
  return { revenue: num(pl.revenue), cost: num(pl.cost), grossProfit: num(pl.gross_profit), salesCost: num(pl.sales_cost),
    finCost: num(pl.fin_cost), finCostRate: num(detail.finCostRate), profitAfterSales: num(detail.profitAfterSales),
    warranty: num(pl.warranty), licenseSupport: num(pl.license_support), techSupport: num(pl.tech_support),
    deployBonus: num(pl.deploy_bonus), provision: num(pl.provision), consultBonus: num(pl.consult_bonus),
    consultBonusRate: num(detail.consultBonusRate), provisionFundDraw: num(pl.provision_fund_draw), netProfit: num(pl.net_profit),
    netMargin: typeof pl.net_margin === 'number' ? pl.net_margin : null, threshold: num(pl.threshold), passed: pl.passed === true,
    appliedContractType: typeof pl.applied_contract_type === 'string' ? pl.applied_contract_type : null,
    byType: parse(JSON.stringify(detail.byType ?? {}), {}), kpiSplit: parse(pl.kpi_split, []) };
}

/** Kết quả P&L (FR-5.1–5.6; mockup renderPLview). The order's editor sees it live; everyone else the official figures. */
export function PlTab({ hook, lang }: TabProps) {
  const t = TEXT[lang];
  const r = t.plRows;
  const f = t.formulas;
  const [otherOpen, setOtherOpen] = useState(false);
  const [formulas, setFormulas] = useState(false);
  const { live, config, draft, staff, access } = hook;
  const official = hook.saved?.official.order_pl ?? null;
  const view: PlView = hook.editor || !official ? live : fromOfficial(official);
  const settings = config.settings;
  const rate = config.contractTypeRates.find((x) => x.code === (view.appliedContractType ?? 'tm_once'));
  const pct = (v: number | undefined) => formatPercent(v ?? 0, 2);
  const baseThreshold = rate?.threshold ?? view.threshold;

  const stale = hook.editor && (!official || Math.abs(num(official.net_profit) - live.netProfit) > 1);
  const status = official?.locked === true ? t.lockedOfficial
    : stale ? (official ? t.staleOfficial : t.noOfficial)
    : official ? t.officialAt(formatDateTime(String(official.computed_at ?? ''))) : t.noOfficial;

  const other = view.warranty + view.licenseSupport + view.techSupport + view.deployBonus + view.consultBonus + view.provision;
  type Row = { key: string; label: string; amount: number; formula: string; strong?: boolean; sub?: boolean };
  const rows: Row[] = [
    { key: 'revenue', label: r.revenue, amount: view.revenue, formula: f.revenue, strong: true },
    { key: 'cost', label: r.cost, amount: view.cost, formula: f.cost(pct(settings.foreignContractorTax)) },
    { key: 'gross', label: `${r.gross} (${view.cost > 0 ? formatPercent(view.grossProfit / view.cost) : '—'})`, amount: view.grossProfit, formula: f.gross, strong: true },
    { key: 'salesCost', label: r.salesCost, amount: view.salesCost, formula: f.salesCost },
    { key: 'finCost', label: r.finCost, amount: view.finCost, formula: f.finCost(pct(view.finCostRate)) },
    { key: 'afterSales', label: r.afterSales, amount: view.profitAfterSales, formula: f.afterSales, strong: true },
  ];
  const otherRows: Row[] = [
    { key: 'warranty', label: r.warranty, amount: view.warranty, formula: f.warranty(pct(settings.warrantyRate)), sub: true },
    { key: 'license', label: r.license, amount: view.licenseSupport, formula: f.license(pct(settings.licenseSupportRate)), sub: true },
    { key: 'tech', label: r.tech, amount: view.techSupport, formula: f.tech(pct(settings.techSupportInternalRate), pct(settings.techSupportOutsourceRate)), sub: true },
    { key: 'deploy', label: r.deploy, amount: view.deployBonus, formula: f.deploy(pct(rate?.deployBonus)), sub: true },
    { key: 'consult', label: r.consult, amount: view.consultBonus, formula: f.consult(pct(view.consultBonusRate)), sub: true },
    { key: 'provision', label: r.provision, amount: view.provision, formula: f.provision(pct(rate?.provision)), sub: true },
  ];
  const tail: Row[] = [
    ...(view.provisionFundDraw > 0 ? [{ key: 'fund', label: r.fund, amount: view.provisionFundDraw, formula: f.fund }] : []),
    { key: 'net', label: r.net, amount: view.netProfit, formula: f.net, strong: true },
  ];
  const line = (row: Row) => (
    <tr key={row.key} data-strong={row.strong || undefined} data-sub={row.sub || undefined}>
      <th scope="row">{row.label}</th>
      <td className="num">{formatMoney(row.amount)}</td>
      {formulas && <td className="formula">{row.formula}</td>}
    </tr>
  );

  const nameOf = (code: string) => staff.find((s) => s.code === code)?.name ?? code;
  const stagesOf = (code: string) => [
    ...(draft.order.is_new_logo && draft.order.lead_source === code ? [t.stageNames.lead] : []),
    ...draft.order.deal_stages.filter((s) => s.person === code).map((s) => t.stageNames[s.stage]),
  ].join(', ');
  const showByType = access?.seesPl && access.seesProposals;

  return (
    <div className="tab-body">
      <p className="status-line" role="status" data-tone={stale ? 'warn' : undefined}>{status}</p>

      <div className="stats">
        <div className="stat" data-tone={view.passed ? 'ok' : 'danger'}>
          <span className="label">{t.plStats.result}</span>
          <strong className="stat-value">{view.passed ? <CheckIcon /> : <XIcon />}{view.passed ? t.passedLong : t.failedLong}</strong>
        </div>
        <div className="stat"><span className="label">{t.plStats.margin}</span><strong className="stat-value">{formatPercent(view.netMargin)}</strong></div>
        <div className="stat" title={t.thresholdHint(formatPercent(baseThreshold), formatPercent(view.threshold - baseThreshold))}>
          <span className="label">{t.plStats.threshold}</span><strong className="stat-value">{formatPercent(view.threshold)}</strong>
        </div>
        <div className="stat"><span className="label">{t.plStats.revenue}</span><strong className="stat-value">{formatMoney(view.revenue)}</strong></div>
        <div className="stat"><span className="label">{t.plStats.net}</span><strong className="stat-value">{formatMoney(view.netProfit)}</strong></div>
      </div>

      <section className="card">
        <header className="card-head">
          <h2>{t.plReport}</h2>
          <span className="grow" />
          <button type="button" className="af-button ghost sm" aria-pressed={formulas} onClick={() => setFormulas(!formulas)}>
            {formulas ? t.hideFormula : t.showFormula}</button>
        </header>
        <table className="table pl">
          <thead><tr><th scope="col">{t.itemCol}</th><th scope="col" className="num">{t.amountCol}</th>
            {formulas && <th scope="col">{t.formulaCol}</th>}</tr></thead>
          <tbody>
            {rows.map(line)}
            <tr>
              <th scope="row">
                <button type="button" className="link toggle" aria-expanded={otherOpen} onClick={() => setOtherOpen(!otherOpen)}>
                  <ChevronIcon open={otherOpen} />{r.other}</button>
              </th>
              <td className="num">{formatMoney(other)}</td>
              {formulas && <td />}
            </tr>
            {otherOpen && otherRows.map(line)}
            {tail.map(line)}
          </tbody>
        </table>
      </section>

      {showByType && (
        <section className="card">
          <h2 className="card-title">{t.byTypeTitle}</h2>
          <table className="table">
            <thead><tr>{(['type', 'cost', 'vatIn', 'revenue', 'vatOut'] as const).map((k) =>
              <th key={k} scope="col" className={k === 'type' ? undefined : 'num'}>{t.byTypeCols[k]}</th>)}</tr></thead>
            <tbody>
              {Object.entries(view.byType).map(([code, v]) => (
                <tr key={code}><th scope="row">{code}</th><td className="num">{formatMoney(v.cost)}</td><td className="num">{formatMoney(v.vatIn)}</td>
                  <td className="num">{formatMoney(v.revenue)}</td><td className="num">{formatMoney(v.vatOut)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">{t.kpiTitle}</h2>
        {view.kpiSplit.length === 0 ? <p className="hint">{t.noKpi}</p> : (
          <table className="table">
            <thead><tr><th scope="col">{t.kpiCols.person}</th><th scope="col">{t.kpiCols.stages}</th><th scope="col" className="num">{t.kpiCols.amount}</th></tr></thead>
            <tbody>
              {view.kpiSplit.map((k) => (
                <tr key={k.person}><th scope="row">{nameOf(k.person)}</th><td>{stagesOf(k.person)} · {formatPercent(k.weight)}</td>
                  <td className="num">{formatMoney(k.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!draft.order.is_new_order && (
        <section className="card">
          <h2 className="card-title">{t.compareTitle}</h2>
          <table className="table">
            <thead><tr><th scope="col">{t.compareCols.item}</th><th scope="col" className="num">{t.compareCols.last}</th>
              <th scope="col" className="num">{t.compareCols.now}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{t.compareRows.po}</th><td className="num">{draft.order.prev_contract_no || '—'}</td>
                <td className="num">{draft.order.customer_po_no || draft.order.internal_contract_no || '—'}</td></tr>
              <tr><th scope="row">{t.compareRows.salesCost}</th><td className="num">{formatMoney(draft.finance.prev_sales_cost)}</td>
                <td className="num">{formatMoney(view.salesCost)}</td></tr>
              <tr><th scope="row">{t.compareRows.revenue}</th><td className="num">{formatMoney(draft.finance.prev_revenue)}</td>
                <td className="num">{formatMoney(view.revenue)}</td></tr>
              <tr><th scope="row">{t.compareRows.net}</th><td className="num">{formatMoney(draft.finance.prev_net_profit)}</td>
                <td className="num">{formatMoney(view.netProfit)}</td></tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
