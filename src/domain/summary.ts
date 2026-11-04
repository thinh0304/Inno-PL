// Số liệu rút gọn cho người không được đọc P&L đầy đủ (spec §11.4): TM thấy phần dịch vụ, PROC thấy phần hàng hóa.
// Không có doanh thu tổng, CPBH, LN thuần hay giá bán của hàng hóa.
import type { PlConfig } from './config.js';
import { LINE_TYPE_OF_CODE } from './codes.js';
import { type Line, isGoods, isService, lineBuy, lineSell } from './lines.js';
import type { PlResult } from './pl.js';

const CODE_OF_TYPE = Object.fromEntries(Object.entries(LINE_TYPE_OF_CODE).map(([code, type]) => [type, code]));

export function summaryFor(part: 'dich_vu' | 'hang_hoa', lines: Line[], pl: PlResult, cfg: PlConfig): Record<string, number> {
  if (part === 'hang_hoa') {
    const goods = lines.filter((l) => isGoods(l.type));
    return { tong_gia_von: goods.reduce((t, l) => t + lineBuy(l, cfg), 0), so_dong: goods.length };
  }
  const out: Record<string, number> = {};
  for (const l of lines.filter((x) => isService(x.type))) {
    const code = CODE_OF_TYPE[l.type]!;
    out[`doanh_thu.${code}`] = (out[`doanh_thu.${code}`] ?? 0) + lineSell(l);
    out[`gia_von.${code}`] = (out[`gia_von.${code}`] ?? 0) + lineBuy(l, cfg);
  }
  return { ...out, ho_tro_kt: pl.techSupport, thuong_trien_khai: pl.deployBonus, thuong_tu_van: pl.consultBonus };
}
