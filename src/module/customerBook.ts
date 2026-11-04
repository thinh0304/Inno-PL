// Danh bạ khách hàng dùng lại giữa các đơn (spec §12.3): gợi ý khi gõ, chỉ điền ô trống, mã KH không trùng, điền nhanh giao nhận.
import type { OrderForm } from '../domain/form.js';
import { checkFormat } from '../domain/validate.js';

export interface CustomerRec {
  id: string; ma_kh: string; ten: string; mst: string; dia_chi: string; nguoi_dai_dien: string; chuc_vu: string; so_tk: string; ngan_hang: string;
  nguoi_lien_he: string; email: string; dien_thoai: string; hang_kh: string;
}
export interface Conflict { field: keyof OrderForm; current: string; fromBook: string }

/** Bỏ dấu, chữ thường: tìm không phân biệt dấu. */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

/** Gõ từ 2 ký tự: tìm theo tên, mã KH hoặc MST. Tối đa 8 gợi ý. */
export function suggest(book: CustomerRec[], query: string): CustomerRec[] {
  const q = fold(query);
  if (q.length < 2) return [];
  return book.filter((c) => [c.ten, c.ma_kh, c.mst].some((v) => fold(v).includes(q))).slice(0, 8);
}

// Cặp (trường của hồ sơ KH, trường của đơn).
const PAIRS = [
  ['ten', 'ten_kh'], ['ma_kh', 'ma_kh'], ['mst', 'mst'], ['dia_chi', 'dia_chi'], ['nguoi_dai_dien', 'nguoi_dai_dien'], ['chuc_vu', 'chuc_vu'],
  ['so_tk', 'so_tk'], ['ngan_hang', 'ngan_hang'], ['nguoi_lien_he', 'nguoi_lien_he'], ['email', 'email'], ['dien_thoai', 'dien_thoai'],
] as const;

/** Điền các ô trống từ hồ sơ; ô đã nhập mà khác hồ sơ thì không ghi đè, đưa vào `conflicts` để người dùng chọn. Hạng KH lấy theo hồ sơ. */
export function fillEmpty(order: OrderForm, c: CustomerRec): { order: OrderForm; conflicts: Conflict[] } {
  const next: OrderForm = { ...order, khach_hang_id: c.id };
  const conflicts: Conflict[] = [];
  for (const [from, to] of PAIRS) {
    const book = c[from]; const cur = order[to];
    if (!book) continue;
    if (!cur.trim()) next[to] = book;
    else if (cur.trim() !== book.trim()) conflicts.push({ field: to, current: cur, fromBook: book });
  }
  if (c.hang_kh === 'vip' || c.hang_kh === 'tiem_nang' || c.hang_kh === 'pho_thong') next.hang_kh = c.hang_kh;
  return { order: next, conflicts };
}

const COMPANY_PHRASES = /\b(cong ty|co phan|mot thanh vien|tap doan|doanh nghiep)\b/g;
const COMPANY_TYPE = /^(tnhh|cp|mtv|dn)$/;

/** Mã KH gợi ý từ tên: bỏ loại hình doanh nghiệp, nhiều từ thì lấy chữ cái đầu, một từ thì giữ cả từ; thêm số nếu trùng. */
export function suggestCode(name: string, taken: string[]): string {
  const words = fold(name).replace(COMPANY_PHRASES, ' ').split(' ').filter((w) => w && !COMPANY_TYPE.test(w));
  const base = (words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? 'KH')).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18) || 'KH';
  const used = new Set(taken.map((t) => t.toUpperCase()));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

/** Điền nhanh giao nhận: "= người liên hệ" hoặc "= địa chỉ KH". */
export function quickFill(order: OrderForm, how: 'contact' | 'address'): OrderForm {
  return how === 'contact'
    ? { ...order, nguoi_nhan: order.nguoi_lien_he, sdt_nhan: order.dien_thoai }
    : { ...order, dia_chi_nhan: order.dia_chi };
}

/** Lưu nháp chỉ tạo hồ sơ khách khi mã KH đúng dạng và đã có tên: không để lại hồ sơ rác. */
export function shouldCreateCustomer(o: OrderForm): boolean {
  return o.ten_kh.trim() !== '' && o.ma_kh.trim() !== '' && checkFormat('customerCode', o.ma_kh) === null;
}
