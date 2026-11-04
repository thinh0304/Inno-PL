import { useEffect, useState } from 'react';
import { LINE_TYPE_OF_CODE } from '../../domain/codes.js';
import type { LineForm } from '../../domain/form.js';
import { isGoods } from '../../domain/lines.js';
import { checkProposals } from '../../domain/purchase.js';
import { parseNumber } from '../../domain/validate.js';
import type { ProposalRow, SupplierRec } from '../api.js';
import { formatMoney } from '../format.js';
import { TEXT, type Lang } from '../text.js';

/** Đơn mua hàng (spec §12.8): PROC đề xuất giá mua và NCC cho từng dòng TB/License; giá cao hơn giá của Sale bắt buộc lý do. SD, ACC chỉ xem. */
export function PurchasePanel({ lang, busy, lines, proposals, suppliers, editable, onSave }: {
  lang: Lang; busy: boolean; lines: LineForm[]; proposals: ProposalRow[]; suppliers: SupplierRec[]; editable: boolean; onSave(rows: ProposalRow[]): void;
}) {
  const t = TEXT[lang];
  const goods = lines.filter((l) => { const ty = LINE_TYPE_OF_CODE[l.loai]; return !!l.id && !!ty && isGoods(ty); });
  const [rows, setRows] = useState<Record<string, ProposalRow>>({});
  useEffect(() => {
    setRows(Object.fromEntries(goods.map((l) => [l.id!, proposals.find((p) => p.dong_hang === l.id) ?? { dong_hang: l.id!, gia_mua_de_xuat: null, ncc_id: '', ly_do: '' }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals, lines]);
  if (!goods.length) return null;
  const set = (id: string, patch: Partial<ProposalRow>) => setRows((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));
  const issues = checkProposals(lines, Object.values(rows));
  return (
    <section className="panel" aria-label={t.sPurchase}>
      <h2>{t.sPurchase}</h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>SKU</th><th className="num">{t.fSalePrice}</th><th className="num">{t.fProposed}</th><th>{t.fSupplier}</th><th>{t.fWhyHigher}</th></tr></thead>
          <tbody>
            {goods.map((l) => {
              const r = rows[l.id!];
              if (!r) return null;
              const bad = (f: string) => issues.some((x) => x.field === `dong_${lines.indexOf(l) + 1}.${f}`);
              return (
                <tr key={l.id}>
                  <td>{l.sku}</td>
                  <td className="num">{formatMoney(l.gia_mua)}</td>
                  <td><input className="num" aria-label={`${t.fProposed} ${l.sku}`} aria-invalid={bad('gia_mua_de_xuat') || undefined} readOnly={!editable}
                    value={r.gia_mua_de_xuat ?? ''} onChange={(e) => set(l.id!, { gia_mua_de_xuat: e.target.value.trim() === '' ? null : parseNumber(e.target.value) })} /></td>
                  <td>
                    <select aria-label={`${t.fSupplier} ${l.sku}`} aria-invalid={bad('ncc_id') || undefined} disabled={!editable} value={r.ncc_id} onChange={(e) => set(l.id!, { ncc_id: e.target.value })}>
                      <option value="">{t.pick}</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
                    </select>
                  </td>
                  <td><input aria-label={`${t.fWhyHigher} ${l.sku}`} aria-invalid={bad('ly_do') || undefined} readOnly={!editable} value={r.ly_do} onChange={(e) => set(l.id!, { ly_do: e.target.value })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable ? <div className="row"><button type="button" className="btn primary" disabled={busy} onClick={() => onSave(Object.values(rows))}>{t.saveProposals}</button></div> : null}
    </section>
  );
}
