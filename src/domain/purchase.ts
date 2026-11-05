// Đơn mua hàng (spec §7.2 t23, §12.8): PROC đề xuất giá Mua hàng và NCC cho từng dòng TB/License.
import { LINE_TYPE_OF_CODE } from './codes.js';
import type { LineForm } from './form.js';
import { isGoods } from './lines.js';
import type { Issue } from './validate.js';

export interface Proposal { dong_hang: string; gia_mua_de_xuat: number | null; ncc_id: string; ly_do: string }

/**
 * t23 xong khi mọi dòng TB/License có đề xuất đủ giá và NCC; dòng có giá đề xuất cao hơn giá mua của Sale bắt buộc lý do.
 * `lines` là dòng đã lưu (có `id`).
 */
export function checkProposals(lines: LineForm[], proposals: Proposal[]): Issue[] {
  const out: Issue[] = [];
  lines.forEach((l, i) => {
    const type = LINE_TYPE_OF_CODE[l.loai];
    if (!type || !isGoods(type)) return;
    const f = (k: string) => `dong_${i + 1}.${k}`;
    const p = proposals.find((x) => x.dong_hang === l.id);
    if (!p || p.gia_mua_de_xuat === null || !(p.gia_mua_de_xuat > 0)) { out.push({ field: f('gia_mua_de_xuat'), code: 'required' }); return; }
    if (!p.ncc_id) out.push({ field: f('ncc_id'), code: 'required' });
    if (p.gia_mua_de_xuat > l.gia_mua && !p.ly_do.trim()) out.push({ field: f('ly_do'), code: 'required' });
  });
  return out;
}
