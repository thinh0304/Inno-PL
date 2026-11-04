// Bản ghi API ↔ đơn trên màn hình (spec §6). Dùng ở module (đọc/ghi) và ở Code step (dựng lại đơn để kiểm tra lại).
import { STAGE_CODES, type LineForm, type OrderForm, type StageCode, type StageForm, type VatCode } from './form.js';
import { normalize } from './validate.js';

export type Rec = Record<string, unknown> & { id: string };

/** Bản ghi API có thể để trường dưới `body` hoặc phẳng; trả về dạng phẳng có `id`. */
export function flat(r: unknown): Rec {
  const o = (r ?? {}) as Record<string, unknown>;
  return (o.body && typeof o.body === 'object' ? { ...(o.body as object), id: o.id } : o) as Rec;
}
export const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.map(flat) : []);
export const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as Rec).id) : v ? String(v) : null);
/** Số có thể chưa nhập: null giữ nguyên, không đổi thành 0 (spec §12.2). */
const nullable = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : n(v));
const orNull = (s: string): string | null => (s.trim() ? s : null);

/** dd/mm/yyyy ↔ yyyy-mm-dd; ngày rỗng hoặc không đọc được là null / ''. */
export function toIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalize('date', display));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function fromIso(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function orderPayload(o: OrderForm): Record<string, unknown> {
  return {
    khach_hang: orNull(o.khach_hang_id),
    ten_kh: o.ten_kh, ma_kh: o.ma_kh, mst: o.mst, nguoi_lien_he: o.nguoi_lien_he, dien_thoai: o.dien_thoai, email: o.email, dia_chi: o.dia_chi,
    nguoi_dai_dien: o.nguoi_dai_dien, chuc_vu: o.chuc_vu, so_tk: o.so_tk, ngan_hang: o.ngan_hang,
    noi_dung: o.noi_dung, so_hd_noi_bo: o.so_hd_noi_bo, so_hd_po: o.so_hd_po, ngay_ky: toIso(o.ngay_ky), ngay_bao_gia: toIso(o.ngay_bao_gia),
    hieu_luc_den: toIso(o.hieu_luc_den), ty_gia: o.ty_gia,
    nguoi_nhan: o.nguoi_nhan, sdt_nhan: o.sdt_nhan, dia_chi_nhan: o.dia_chi_nhan, email_nhan_license: o.email_nhan_license, ghi_chu_giao: o.ghi_chu_giao,
    am: orNull(o.am), is: orNull(o.is), hang_kh: o.hang_kh, cong_no_ngay: o.cong_no_ngay, so_lan_tt: o.so_lan_tt,
    nv_trien_khai: orNull(o.nv_trien_khai), nv_tu_van: orNull(o.nv_tu_van), tv_proposal: o.tv_proposal, tv_poc: o.tv_poc,
    loai_hd_chon: orNull(o.loai_hd_chon), tu_truoc: o.tu_truoc, don_moi: o.don_moi, kh_moi: o.kh_moi,
    nguon_kh: o.nguon_kh, nguon_kh_nguoi: orNull(o.nguon_kh_nguoi), hinh_thuc: orNull(o.hinh_thuc),
    giai_doan_deal: o.giai_doan.map((s) => ({ ma: s.ma, nv: s.nv, pct: s.pct })),
  };
}

export function financePayload(o: OrderForm): Record<string, unknown> {
  return { cpbh: o.cpbh, so_hd_truoc: o.so_hd_truoc, cpbh_truoc: o.cpbh_truoc, doanh_thu_truoc: o.doanh_thu_truoc, ln_truoc: o.ln_truoc };
}

export function linePayload(donId: string, l: LineForm, stt: number): Record<string, unknown> {
  return {
    don_hang: donId, stt, sku: l.sku, mo_ta: l.mo_ta, dvt: l.dvt, so_luong: l.so_luong, loai: l.loai, so_thang: l.so_thang,
    gia_mua: l.gia_mua, gia_mua_usd: l.gia_mua_usd, vat: l.vat, ncc_id: orNull(l.ncc_id), co_cq: orNull(l.co_cq),
    ngay_bat_dau: toIso(l.ngay_bat_dau), ngay_ket_thuc: toIso(l.ngay_ket_thuc),
  };
}

function stagesOf(v: unknown): StageForm[] {
  const have = new Map<StageCode, StageForm>();
  for (const s of Array.isArray(v) ? v : []) {
    const o = flat(s) as unknown as Record<string, unknown>;
    const ma = str(o.ma) as StageCode;
    if (STAGE_CODES.includes(ma)) have.set(ma, { ma, nv: idOf(o.nv) ?? '', pct: n(o.pct) });
  }
  return STAGE_CODES.map((ma) => have.get(ma) ?? { ma, nv: '', pct: 0 });
}

export function formFromRecords(src: { don: unknown; finance?: unknown; dong: unknown; gia_ban: unknown }): { order: OrderForm; lines: LineForm[] } {
  const d = flat(src.don);
  const f = src.finance ? flat(src.finance) : undefined;
  const order: OrderForm = {
    id: d.id, financeId: f?.id, khach_hang_id: idOf(d.khach_hang) ?? '',
    ten_kh: str(d.ten_kh), ma_kh: str(d.ma_kh), mst: str(d.mst), nguoi_lien_he: str(d.nguoi_lien_he), dien_thoai: str(d.dien_thoai),
    email: str(d.email), dia_chi: str(d.dia_chi), nguoi_dai_dien: str(d.nguoi_dai_dien), chuc_vu: str(d.chuc_vu), so_tk: str(d.so_tk), ngan_hang: str(d.ngan_hang),
    noi_dung: str(d.noi_dung), so_hd_noi_bo: str(d.so_hd_noi_bo), so_hd_po: str(d.so_hd_po), ngay_ky: fromIso(d.ngay_ky),
    ngay_bao_gia: fromIso(d.ngay_bao_gia), hieu_luc_den: fromIso(d.hieu_luc_den), ty_gia: n(d.ty_gia) || 26000,
    nguoi_nhan: str(d.nguoi_nhan), sdt_nhan: str(d.sdt_nhan), dia_chi_nhan: str(d.dia_chi_nhan), email_nhan_license: str(d.email_nhan_license),
    ghi_chu_giao: str(d.ghi_chu_giao),
    am: idOf(d.am) ?? '', is: idOf(d.is) ?? '', hang_kh: (str(d.hang_kh) || 'pho_thong') as OrderForm['hang_kh'], cong_no_ngay: n(d.cong_no_ngay),
    cpbh: n(f?.cpbh), so_lan_tt: n(d.so_lan_tt),
    nv_trien_khai: idOf(d.nv_trien_khai) ?? '', nv_tu_van: idOf(d.nv_tu_van) ?? '', tv_proposal: d.tv_proposal === true, tv_poc: d.tv_poc === true,
    loai_hd_chon: str(d.loai_hd_chon), tu_truoc: d.tu_truoc === true, don_moi: d.don_moi !== false, kh_moi: d.kh_moi === true,
    nguon_kh: (str(d.nguon_kh) || 'khong') as OrderForm['nguon_kh'], nguon_kh_nguoi: idOf(d.nguon_kh_nguoi) ?? '',
    hinh_thuc: str(d.hinh_thuc) as OrderForm['hinh_thuc'],
    so_hd_truoc: str(f?.so_hd_truoc), cpbh_truoc: nullable(f?.cpbh_truoc), doanh_thu_truoc: nullable(f?.doanh_thu_truoc), ln_truoc: nullable(f?.ln_truoc),
    giai_doan: stagesOf(d.giai_doan_deal),
  };
  const prices = new Map(list(src.gia_ban).map((p) => [idOf(p.dong_hang), p]));
  const lines: LineForm[] = list(src.dong)
    .sort((a, b) => n(a.stt) - n(b.stt))
    .map((l) => {
      const p = prices.get(l.id);
      return {
        id: l.id, priceId: p?.id, sku: str(l.sku), mo_ta: str(l.mo_ta), dvt: str(l.dvt), so_luong: n(l.so_luong), loai: str(l.loai) || 'tb',
        so_thang: n(l.so_thang), gia_mua: n(l.gia_mua), gia_mua_usd: n(l.gia_mua_usd), don_gia_ban: n(p?.don_gia_ban), chiet_khau: n(p?.chiet_khau),
        vat: (str(l.vat) || '8') as VatCode, ncc_id: idOf(l.ncc_id) ?? '', co_cq: str(l.co_cq) as LineForm['co_cq'],
        ngay_bat_dau: fromIso(l.ngay_bat_dau), ngay_ket_thuc: fromIso(l.ngay_ket_thuc),
      };
    });
  return { order, lines };
}

/** Form tạo bản ghi từ chối `null` (số, ngày, enum, người dùng): khi tạo phải bỏ hẳn các trường rỗng. Khi sửa, `null` xóa trường nên giữ nguyên. */
export function forCreate(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== undefined));
}
