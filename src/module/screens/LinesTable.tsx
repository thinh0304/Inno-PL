import { LINE_CODES, LINE_TYPE_OF_CODE } from '../../domain/codes.js';
import { emptyLine, type LineForm, type VatCode } from '../../domain/form.js';
import { isMonthly } from '../../domain/lines.js';
import { normalize, parseNumber, type FormatKind } from '../../domain/validate.js';
import type { SupplierRec } from '../api.js';
import { TEXT, type Lang, type TextKey } from '../text.js';

export interface LinesTableProps {
  lines: LineForm[];
  editable: boolean;
  lang: Lang;
  onChange(lines: LineForm[]): void;
  /** false với người không đọc được giá bán (TM, PROC): bỏ cột giá bán và chiết khấu. */
  showPrices?: boolean;
  suppliers?: SupplierRec[];
  /** Lỗi theo khóa `dong_<n>.<trường>` (đã đổi sang chữ để hiện dưới ô). */
  errors?: Record<string, string>;
}

const VATS: VatCode[] = ['kct', '0', '5', '8', '10'];

/** Ô "số tháng" mang hai nghĩa (spec §4.1): tháng dịch vụ với loại nhân tháng, tháng bảo hành với TB, còn lại là "Số tháng". */
function monthsLabel(code: string, lang: Lang): string {
  const t = TEXT[lang];
  const type = LINE_TYPE_OF_CODE[code];
  if (type && isMonthly(type)) return t.monthsService;
  if (type === 'TB') return t.monthsWarranty;
  return t.months;
}

export function LinesTable({ lines, editable, lang, onChange, showPrices = true, suppliers = [], errors = {} }: LinesTableProps) {
  const t = TEXT[lang];
  const set = (i: number, patch: Partial<LineForm>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const num = (v: string) => parseNumber(v);
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>{t.colType}</th><th>{t.colSku}</th><th>{t.colDesc}</th><th>{t.colUnit}</th><th className="num">{t.colQty}</th>
            <th className="num">{t.months}</th><th>{t.colStart}</th><th>{t.colEnd}</th>
            {showPrices ? <><th className="num">{t.colSell}</th><th className="num">{t.colDiscount}</th></> : null}
            <th className="num">{t.colBuy}</th><th>{t.colVat}</th><th>{t.colCoCq}</th><th>{t.colSupplier}</th>{editable ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const n = `${t.line} ${i + 1}`;
            const months = monthsLabel(l.loai, lang);
            const err = (k: string) => errors[`dong_${i + 1}.${k}`];
            const text = (k: 'sku' | 'mo_ta' | 'dvt' | 'ngay_bat_dau' | 'ngay_ket_thuc', label: string, kind?: FormatKind) => (
              <input aria-label={`${label} (${n})`} aria-invalid={err(k) ? true : undefined} title={err(k)} value={l[k]} readOnly={!editable}
                onChange={(e) => set(i, { [k]: e.target.value })} onBlur={kind ? (e) => set(i, { [k]: normalize(kind, e.target.value) }) : undefined} />
            );
            const number = (k: 'so_luong' | 'so_thang' | 'don_gia_ban' | 'chiet_khau' | 'gia_mua', label: string) => (
              <input className="num" inputMode="decimal" aria-label={`${label} (${n})`} aria-invalid={err(k) ? true : undefined} title={err(k)} value={l[k]}
                readOnly={!editable} onChange={(e) => set(i, { [k]: num(e.target.value) })} />
            );
            return (
              <tr key={l.id ?? `new-${i}`}>
                <td>{i + 1}</td>
                <td>
                  <select aria-label={`${t.colType} (${n})`} value={l.loai} disabled={!editable} onChange={(e) => set(i, { loai: e.target.value })}>
                    {LINE_CODES.map((c) => <option key={c} value={c}>{t[`type.${c}` as TextKey]}</option>)}
                  </select>
                </td>
                <td>{text('sku', t.colSku, 'sku')}</td>
                <td>{text('mo_ta', t.colDesc)}</td>
                <td>{text('dvt', t.colUnit)}</td>
                <td>{number('so_luong', t.colQty)}</td>
                <td><input className="num" inputMode="decimal" aria-label={`${months} (${n})`} aria-invalid={err('so_thang') ? true : undefined} title={err('so_thang')}
                  value={l.so_thang} readOnly={!editable} onChange={(e) => set(i, { so_thang: num(e.target.value) })} /></td>
                <td>{text('ngay_bat_dau', t.colStart, 'date')}</td>
                <td>{text('ngay_ket_thuc', t.colEnd, 'date')}</td>
                {showPrices ? <><td>{number('don_gia_ban', t.colSell)}</td><td>{number('chiet_khau', t.colDiscount)}</td></> : null}
                <td>{number('gia_mua', t.colBuy)}</td>
                <td>
                  <select aria-label={`${t.colVat} (${n})`} value={l.vat} disabled={!editable} onChange={(e) => set(i, { vat: e.target.value as VatCode })}>
                    {VATS.map((v) => <option key={v} value={v}>{v === 'kct' ? 'KCT' : `${v}%`}</option>)}
                  </select>
                </td>
                <td>
                  <select aria-label={`${t.colCoCq} (${n})`} aria-invalid={err('co_cq') ? true : undefined} value={l.co_cq} disabled={!editable}
                    onChange={(e) => set(i, { co_cq: e.target.value as LineForm['co_cq'] })}>
                    <option value="">{t.pick}</option><option value="co">{t.yes}</option><option value="khong">{t.no}</option>
                  </select>
                </td>
                <td>
                  <select aria-label={`${t.colSupplier} (${n})`} aria-invalid={err('ncc_id') ? true : undefined} value={l.ncc_id} disabled={!editable}
                    onChange={(e) => set(i, { ncc_id: e.target.value })}>
                    <option value="">{t.pick}</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
                  </select>
                </td>
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
