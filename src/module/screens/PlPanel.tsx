import type { PlResult } from '../../domain/pl.js';
import { formatDateTime, formatMoney, formatPercent } from '../format.js';
import { TEXT, type Lang } from '../text.js';

export interface PlPanelProps { result: PlResult; lockedAt: string | null; lang: Lang }

/** Thẻ tóm tắt và bảng P&L (spec §12.8). Số đang tính khi sửa, hoặc số đã chốt kèm thời điểm chốt. */
export function PlPanel({ result: r, lockedAt, lang }: PlPanelProps) {
  const t = TEXT[lang];
  const rows: [string, number, boolean][] = [
    [t.plRevenue, r.revenue, false], [t.plCost, r.cost, false], [t.plGross, r.grossProfit, true],
    [t.plSales, r.salesCost, false], [t.plFinance, r.financeCost, false], [t.plWarranty, r.warranty, false],
    [t.plLicense, r.licenseSupport, false], [t.plTech, r.techSupport, false], [t.plDeploy, r.deployBonus, false],
    [t.plProvision, r.provision, false], [t.plConsult, r.consultBonus, false], [t.plFund, r.fundTopUp, false],
    [t.plNet, r.netProfit, true],
  ];
  return (
    <section className="panel" aria-label={t.plTitle}>
      <h2>{t.plTitle}</h2>
      <p className="faint">{lockedAt ? <span>{`${t.lockedAt} ${formatDateTime(lockedAt)}`}</span> : <span>{t.liveCalc}</span>}</p>
      <div className="stats">
        <div className="stat"><span className="k">{t.result}</span><span className={`tag ${r.passed ? 'ok' : 'bad'}`}>{r.passed ? t.pass : t.fail}</span></div>
        <div className="stat"><span className="k">{t.margin}</span><span className="v">{formatPercent(r.margin, 2)}</span></div>
        <div className="stat"><span className="k">{t.threshold}</span><span className="v">{formatPercent(r.threshold, 2)}</span></div>
      </div>
      <table className="stmt">
        <tbody>
          {rows.map(([label, value, total]) => (
            <tr key={label} className={total ? 'total' : undefined}>
              <td>{label}</td>
              <td className="amt">{formatMoney(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
