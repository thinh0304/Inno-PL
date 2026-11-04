// Dữ liệu một đơn như module giữ khi đang sửa, và cách đổi sang đầu vào của computePl.
import { CONTRACT_KIND_OF_CODE, LINE_TYPE_OF_CODE } from '../domain/codes.js';
import type { PlInput } from '../domain/pl.js';

export interface LineDraft {
  id?: string;
  priceId?: string;
  sku: string;
  mo_ta: string;
  dvt: string;
  so_luong: number;
  loai: string;
  so_thang: number;
  gia_mua: number;
  don_gia_ban: number;
  chiet_khau: number;
  ncc: string;
}

export interface OrderDraft {
  id?: string;
  financeId?: string;
  ten_kh: string; ma_kh: string; mst: string; nguoi_lien_he: string; noi_dung: string; so_hd_noi_bo: string;
  am: string; is: string;
  hang_kh: 'vip' | 'tiem_nang' | 'pho_thong';
  cong_no_ngay: number;
  cpbh: number;
  nv_trien_khai: string; nv_tu_van: string; tv_proposal: boolean; tv_poc: boolean;
  loai_hd_chon: string;
  tu_truoc: boolean;
}

export const emptyLine = (): LineDraft => ({ sku: '', mo_ta: '', dvt: '', so_luong: 1, loai: 'tb', so_thang: 0, gia_mua: 0, don_gia_ban: 0, chiet_khau: 0, ncc: '' });

export const emptyOrder = (person: string): OrderDraft => ({
  ten_kh: '', ma_kh: '', mst: '', nguoi_lien_he: '', noi_dung: '', so_hd_noi_bo: '', am: person, is: '', hang_kh: 'pho_thong',
  cong_no_ngay: 30, cpbh: 0, nv_trien_khai: '', nv_tu_van: '', tv_proposal: false, tv_poc: false, loai_hd_chon: '', tu_truoc: false,
});

export function toPlInput(order: OrderDraft, lines: LineDraft[]): PlInput {
  return {
    lines: lines.map((l) => ({
      type: LINE_TYPE_OF_CODE[l.loai] ?? 'TB', qty: l.so_luong, sell: l.don_gia_ban, discountPct: l.chiet_khau, buy: l.gia_mua, months: l.so_thang,
    })),
    tier: order.hang_kh, creditDays: order.cong_no_ngay, salesCost: order.cpbh,
    chosenKind: order.loai_hd_chon ? CONTRACT_KIND_OF_CODE[order.loai_hd_chon] : undefined,
    deployStaff: !!order.nv_trien_khai, consultStaff: !!order.nv_tu_van, proposal: order.tv_proposal, poc: order.tv_poc,
  };
}

/** Giữ lại các task nằm trong My Work của người xem (nút thao tác chỉ hiện cho task của họ). */
export const onlyMine = <T extends { id: string }>(tasks: T[], workIds: ReadonlySet<string>): T[] => tasks.filter((t) => workIds.has(t.id));

/** Trường bắt buộc còn thiếu (spec §12.2, phần của Phase 1); chặn nút Gửi duyệt. */
export function missingFields(order: OrderDraft, lines: LineDraft[]): string[] {
  const out: string[] = [];
  for (const k of ['ten_kh', 'ma_kh', 'mst', 'nguoi_lien_he', 'noi_dung', 'so_hd_noi_bo', 'am', 'is'] as const) if (!order[k].trim()) out.push(k);
  if (!lines.length) out.push('dong_hang');
  lines.forEach((l, i) => { if (!l.mo_ta.trim() || !l.dvt.trim() || l.so_luong <= 0 || l.don_gia_ban <= 0) out.push(`dong_${i + 1}`); });
  return out;
}
