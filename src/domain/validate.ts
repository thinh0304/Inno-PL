// Quy tắc định dạng và trường bắt buộc (spec §12.1, §12.2). Hàm thuần: module kiểm khi nhập, Code step kiểm lại khi gửi duyệt.
import type { LineForm, OrderForm } from './form.js';
import { LINE_TYPE_OF_CODE } from './codes.js';
import { isGoods, isMonthly, isPeriodic } from './lines.js';

export type FormatKind =
  | 'phone' | 'email' | 'date' | 'taxId' | 'account' | 'customerCode' | 'contractNo' | 'sku' | 'personName' | 'text' | 'unit' | 'money'
  | 'quantity' | 'months' | 'percent' | 'creditDays' | 'days' | 'payments' | 'count';

export interface Issue { field: string; code: string }

const pad = (n: number) => String(n).padStart(2, '0');
const hasLetter = (s: string) => /\p{L}/u.test(s);
const collapse = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Ngày có thật, năm 2000–2100. */
function validDate(d: number, m: number, y: number): boolean {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

/** Tự chuẩn hóa trước khi lưu (spec §12.1, cột cuối). Giá trị không nhận ra được trả lại như đã gõ (đã cắt khoảng trắng đầu cuối). */
export function normalize(kind: FormatKind, raw: string): string {
  const s = raw.trim();
  switch (kind) {
    case 'phone': {
      let d = s.replace(/[\s.\-()]/g, '');
      if (d.startsWith('+84')) d = `0${d.slice(3)}`;
      if (!/^\d+$/.test(d)) return s;
      if (/^0[35789]\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
      if (/^02\d{9}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
      return d;
    }
    case 'date': {
      const m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(s) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(s);
      if (!m) return s;
      const iso = m[1]!.length === 4;
      const [d, mo, y] = iso ? [+m[3]!, +m[2]!, +m[1]!] : [+m[1]!, +m[2]!, +m[3]!];
      return `${pad(d)}/${pad(mo)}/${y}`;
    }
    case 'taxId': return s.replace(/\s+/g, '');
    case 'account': return s.replace(/[\s.\-]/g, '');
    case 'customerCode': return s.replace(/\s+/g, '').toUpperCase();
    case 'email': return s.replace(/\s+/g, '').toLowerCase();
    case 'personName': case 'text': case 'unit': return collapse(s);
    case 'creditDays': return /^\d+$/.test(s) ? s : s.replace(/\s*ngày\s*$/i, '');
    default: return s;
  }
}

const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const int = (s: string) => /^\d+$/.test(s);

/** null khi hợp lệ, ngược lại mã lỗi `format.<loại>`. Kiểm sau khi tự chuẩn hóa. */
export function checkFormat(kind: FormatKind, value: string): string | null {
  const v = normalize(kind, value);
  const bad = `format.${kind}`;
  const ok = (() => {
    switch (kind) {
      case 'phone': return /^0[35789]\d{2} \d{3} \d{3}$/.test(v) || /^02\d{1} \d{4} \d{4}$/.test(v);
      case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      case 'date': {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
        return !!m && validDate(+m[1]!, +m[2]!, +m[3]!);
      }
      case 'taxId': return /^\d{10}(-\d{3})?$/.test(v);
      case 'account': return /^\d{6,19}$/.test(v);
      case 'customerCode': return /^[A-Z0-9\-_]{2,20}$/.test(v);
      case 'contractNo': return /^[\p{L}\d/\-._]{2,40}$/u.test(v);
      case 'sku': return /^[A-Za-z0-9\-_./+]{1,40}$/.test(v);
      case 'personName': return v.length >= 2 && v.length <= 80 && hasLetter(v) && !/[\d@]/.test(v);
      case 'text': return v.length >= 2 && v.length <= 300 && hasLetter(v);
      case 'unit': return v.length >= 1 && v.length <= 20 && hasLetter(v);
      case 'money': return /^\d+(\.\d{3})*(,\d+)?$/.test(v) || /^\d+(,\d+)?$/.test(v);
      case 'quantity': return int(v) && +v > 0;
      case 'months': return int(v) && +v <= 120;
      case 'percent': return /^\d+(,\d+)?$/.test(v) && num(v) <= 100;
      case 'creditDays': case 'days': return int(v) && +v <= 365;
      case 'payments': return int(v) && +v >= 1 && +v <= 12;
      case 'count': return int(v);
    }
  })();
  return ok ? null : bad;
}

const parseDate = (s: string): Date | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalize('date', s));
  return m && validDate(+m[1]!, +m[2]!, +m[3]!) ? new Date(+m[3]!, +m[2]! - 1, +m[1]!) : null;
};
const monthsBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / 86_400_000 / 30.4375);

const SUM_TOLERANCE = 1e-6;

/** Mọi lỗi của một đơn theo spec §12.1–12.2: trường bắt buộc còn thiếu, sai định dạng, ràng buộc chéo. Đơn hợp lệ trả `[]`. */
export function validateOrder(order: OrderForm, lines: LineForm[]): Issue[] {
  const out: Issue[] = [];
  const add = (field: string, code: string) => out.push({ field, code });
  const need = (field: string, value: string, kind?: FormatKind) => {
    if (!value.trim()) return add(field, 'required');
    const err = kind ? checkFormat(kind, value) : null;
    if (err) add(field, err);
  };
  const maybe = (field: string, value: string, kind: FormatKind) => {
    if (!value.trim()) return;
    const err = checkFormat(kind, value);
    if (err) add(field, err);
  };

  need('ten_kh', order.ten_kh, 'text');
  need('ma_kh', order.ma_kh, 'customerCode');
  need('mst', order.mst, 'taxId');
  need('nguoi_lien_he', order.nguoi_lien_he, 'personName');
  need('noi_dung', order.noi_dung, 'text');
  need('so_hd_noi_bo', order.so_hd_noi_bo, 'contractNo');
  need('am', order.am);
  need('is', order.is);
  maybe('dien_thoai', order.dien_thoai, 'phone');
  maybe('email', order.email, 'email');
  maybe('sdt_nhan', order.sdt_nhan, 'phone');
  maybe('email_nhan_license', order.email_nhan_license, 'email');
  maybe('so_tk', order.so_tk, 'account');
  maybe('so_hd_po', order.so_hd_po, 'contractNo');
  maybe('nguoi_dai_dien', order.nguoi_dai_dien, 'personName');
  maybe('nguoi_nhan', order.nguoi_nhan, 'personName');
  for (const k of ['ngay_ky', 'ngay_bao_gia', 'hieu_luc_den'] as const) maybe(k, order[k], 'date');
  const quoted = parseDate(order.ngay_bao_gia);
  const valid = parseDate(order.hieu_luc_den);
  if (quoted && valid && valid <= quoted) add('hieu_luc_den', 'range.after');
  if (checkFormat('creditDays', String(order.cong_no_ngay))) add('cong_no_ngay', 'format.creditDays');
  if (order.so_lan_tt && checkFormat('payments', String(order.so_lan_tt))) add('so_lan_tt', 'format.payments');

  if (order.nguon_kh === 'nguoi' && !order.nguon_kh_nguoi.trim()) add('nguon_kh_nguoi', 'required');
  if (!order.don_moi) {
    if (order.nguon_kh !== 'khong') add('nguon_kh', 'renew.source');
    need('so_hd_truoc', order.so_hd_truoc, 'contractNo');
    if (order.cpbh_truoc === null) add('cpbh_truoc', 'required');
    if (order.doanh_thu_truoc === null || order.doanh_thu_truoc <= 0) add('doanh_thu_truoc', 'required');
    if (order.ln_truoc === null) add('ln_truoc', 'required');
    else if (order.doanh_thu_truoc !== null && order.ln_truoc > order.doanh_thu_truoc) add('ln_truoc', 'range.max');
  }

  order.giai_doan.forEach((s, i) => { if (!s.nv.trim()) add(`giai_doan.${i}.nv`, 'required'); });
  const total = order.giai_doan.reduce((t, s) => t + s.pct, 0);
  if (Math.abs(total - 1) > SUM_TOLERANCE) add('giai_doan.tong', 'stages.total');

  if (!lines.length) add('dong_hang', 'required');
  lines.forEach((l, i) => {
    const f = (k: string) => `dong_${i + 1}.${k}`;
    const type = LINE_TYPE_OF_CODE[l.loai];
    const goods = !!type && isGoods(type);
    need(f('mo_ta'), l.mo_ta, 'text');
    need(f('dvt'), l.dvt, 'unit');
    if (!(l.so_luong > 0) || !Number.isInteger(l.so_luong)) add(f('so_luong'), 'format.quantity');
    if (!(l.don_gia_ban > 0)) add(f('don_gia_ban'), 'required');
    if (goods) need(f('sku'), l.sku, 'sku');
    else maybe(f('sku'), l.sku, 'sku');
    if (l.loai === 'tb' && !l.co_cq) add(f('co_cq'), 'required');
    const dated = !!type && (isPeriodic(type) || isMonthly(type));
    const start = parseDate(l.ngay_bat_dau); const end = parseDate(l.ngay_ket_thuc);
    if (dated) {
      if (!l.ngay_bat_dau.trim()) add(f('ngay_bat_dau'), 'required'); else if (!start) add(f('ngay_bat_dau'), 'format.date');
      if (!l.ngay_ket_thuc.trim()) add(f('ngay_ket_thuc'), 'required'); else if (!end) add(f('ngay_ket_thuc'), 'format.date');
      if (start && end && end <= start) add(f('ngay_ket_thuc'), 'range.after');
    }
    if (type && isMonthly(type)) {
      if (!(l.so_thang > 0)) add(f('so_thang'), 'required');
      else if (start && end && end > start && Math.abs(monthsBetween(start, end) - l.so_thang) > 1) add(f('so_thang'), 'months.mismatch');
    } else if (l.so_thang < 0 || l.so_thang > 120) add(f('so_thang'), 'format.months');
    need(f('ncc_id'), l.ncc_id);
  });
  return out;
}
