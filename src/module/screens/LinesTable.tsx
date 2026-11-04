import { LINE_CODES, LINE_TYPE_OF_CODE } from '../../domain/codes.js';
import { isMonthly } from '../../domain/lines.js';
import { emptyLine, type LineDraft } from '../model.js';
import { TEXT, type Lang, type TextKey } from '../text.js';

export interface LinesTableProps { lines: LineDraft[]; editable: boolean; lang: Lang; onChange(lines: LineDraft[]): void }

/** Ô "số tháng" mang hai nghĩa (spec §4.1): tháng dịch vụ với loại nhân tháng, tháng bảo hành với TB, còn lại là "Số tháng". */
function monthsLabel(code: string, lang: Lang): string {
  const t = TEXT[lang];
  const type = LINE_TYPE_OF_CODE[code];
  if (type && isMonthly(type)) return t.monthsService;
  if (type === 'TB') return t.monthsWarranty;
  return t.months;
}

export function LinesTable({ lines, editable, lang, onChange }: LinesTableProps) {
  const t = TEXT[lang];
  const set = (i: number, patch: Partial<LineDraft>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const num = (v: string) => (v === '' ? 0 : Number(v.replace(/[^\d.-]/g, '')) || 0);
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>{t.colType}</th><th>{t.colDesc}</th><th>{t.colUnit}</th><th className="num">{t.colQty}</th>
            <th className="num">{t.months}</th><th className="num">{t.colSell}</th><th className="num">{t.colDiscount}</th>
            <th className="num">{t.colBuy}</th>{editable ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const n = `${t.line} ${i + 1}`;
            const months = monthsLabel(l.loai, lang);
            return (
              <tr key={l.id ?? `new-${i}`}>
                <td>{i + 1}</td>
                <td>
                  <select aria-label={`${t.colType} (${n})`} value={l.loai} disabled={!editable} onChange={(e) => set(i, { loai: e.target.value })}>
                    {LINE_CODES.map((c) => <option key={c} value={c}>{t[`type.${c}` as TextKey]}</option>)}
                  </select>
                </td>
                <td><input aria-label={`${t.colDesc} (${n})`} value={l.mo_ta} readOnly={!editable} onChange={(e) => set(i, { mo_ta: e.target.value })} /></td>
                <td><input aria-label={`${t.colUnit} (${n})`} value={l.dvt} readOnly={!editable} onChange={(e) => set(i, { dvt: e.target.value })} /></td>
                <td><input className="num" inputMode="decimal" aria-label={`${t.colQty} (${n})`} value={l.so_luong} readOnly={!editable} onChange={(e) => set(i, { so_luong: num(e.target.value) })} /></td>
                <td><input className="num" inputMode="decimal" aria-label={`${months} (${n})`} value={l.so_thang} readOnly={!editable} onChange={(e) => set(i, { so_thang: num(e.target.value) })} /></td>
                <td><input className="num" inputMode="decimal" aria-label={`${t.colSell} (${n})`} value={l.don_gia_ban} readOnly={!editable} onChange={(e) => set(i, { don_gia_ban: num(e.target.value) })} /></td>
                <td><input className="num" inputMode="decimal" aria-label={`${t.colDiscount} (${n})`} value={l.chiet_khau} readOnly={!editable} onChange={(e) => set(i, { chiet_khau: num(e.target.value) })} /></td>
                <td><input className="num" inputMode="decimal" aria-label={`${t.colBuy} (${n})`} value={l.gia_mua} readOnly={!editable} onChange={(e) => set(i, { gia_mua: num(e.target.value) })} /></td>
                {editable ? <td><button type="button" className="btn" aria-label={`${t.removeLine} (${n})`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>×</button></td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable ? <button type="button" className="btn" onClick={() => onChange([...lines, emptyLine()])}>{t.addLine}</button> : null}
    </div>
  );
}
