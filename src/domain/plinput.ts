// Đầu vào của computePl dựng từ đơn trên form: module (tính khi gõ) và Code step (chốt số) dùng chung một đường.
import { CONTRACT_KIND_OF_CODE, LINE_TYPE_OF_CODE } from './codes.js';
import type { LineForm, OrderForm } from './form.js';
import type { PlInput } from './pl.js';

export function plInputFromForm(order: OrderForm, lines: LineForm[]): PlInput {
  return {
    lines: lines.map((l) => ({
      type: LINE_TYPE_OF_CODE[l.loai] ?? 'TB', qty: l.so_luong, sell: l.don_gia_ban, discountPct: l.chiet_khau, buy: l.gia_mua, months: l.so_thang,
    })),
    tier: order.hang_kh, creditDays: order.cong_no_ngay, salesCost: order.cpbh,
    chosenKind: order.loai_hd_chon ? CONTRACT_KIND_OF_CODE[order.loai_hd_chon] : undefined,
    deployStaff: !!order.nv_trien_khai, consultStaff: !!order.nv_tu_van, proposal: order.tv_proposal, poc: order.tv_poc,
  };
}
