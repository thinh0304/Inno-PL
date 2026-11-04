// Ngày hết hạn và cờ "theo dõi tái ký" khi đơn hoàn tất (spec §7.4): để CRM sau này đọc.
import { LINE_TYPE_OF_CODE } from './codes.js';
import type { LineForm } from './form.js';
import { isGoods, isMonthly, isPeriodic } from './lines.js';
import { toIso } from './records.js';

export interface Renewal { ngay_het_han: string; theo_doi_tai_ky: boolean }

const addMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31/01 + 1 tháng = 28 hoặc 29/02
  return d.toISOString().slice(0, 10);
};

/**
 * Dịch vụ / TMDK: ngày kết thúc dài nhất của dòng; thiết bị: ngày giao (`deliveredIso`, YYYY-MM-DD) + số tháng bảo hành dài nhất.
 * Lấy ngày muộn nhất trong hai loại. Không có dòng nào có hạn thì để trống. Cờ theo dõi bật khi có dòng định kỳ.
 */
export function renewalOf(lines: LineForm[], deliveredIso: string | null): Renewal {
  let latest = '';
  let periodic = false;
  for (const l of lines) {
    const type = LINE_TYPE_OF_CODE[l.loai];
    if (!type) continue;
    const recurring = isPeriodic(type) || isMonthly(type);
    if (recurring) periodic = true;
    if (recurring || !isGoods(type)) {
      const end = toIso(l.ngay_ket_thuc);
      if (end && end > latest) latest = end;
    } else if (isGoods(type) && deliveredIso && l.so_thang > 0) {
      const end = addMonths(deliveredIso, l.so_thang);
      if (end > latest) latest = end;
    }
  }
  return { ngay_het_han: latest, theo_doi_tai_ky: periodic };
}
