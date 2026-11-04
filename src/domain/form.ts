// Dữ liệu một đơn như người lập thấy và sửa (spec §6). Module giữ dạng này khi đang sửa; Code step dựng lại từ bản ghi
// bằng `formFromRecords` (records.ts) để kiểm tra lại ở máy chủ. Ngày giữ dạng dd/mm/yyyy; số liệu chưa nhập là `null`.

export type VatCode = 'kct' | '0' | '5' | '8' | '10';
export const STAGE_CODES = ['co_hoi', 'lam_ro', 'bao_gia', 'dam_phan', 'chot', 'hd_tt_cskh'] as const;
export type StageCode = (typeof STAGE_CODES)[number];

export interface StageForm { ma: StageCode; nv: string; pct: number }

export interface LineForm {
  id?: string;
  priceId?: string;
  sku: string;
  mo_ta: string;
  dvt: string;
  so_luong: number;
  loai: string;
  so_thang: number;
  gia_mua: number;
  gia_mua_usd: number;
  don_gia_ban: number;
  chiet_khau: number;
  vat: VatCode;
  ncc_id: string;
  co_cq: '' | 'co' | 'khong';
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
}

export type SourceKind = 'khong' | 'nguoi' | 'marketing' | 'other';

export interface OrderForm {
  id?: string;
  financeId?: string;
  khach_hang_id: string;
  ten_kh: string; ma_kh: string; mst: string; nguoi_lien_he: string; dien_thoai: string; email: string; dia_chi: string;
  nguoi_dai_dien: string; chuc_vu: string; so_tk: string; ngan_hang: string;
  noi_dung: string; so_hd_noi_bo: string; so_hd_po: string; ngay_ky: string; ngay_bao_gia: string; hieu_luc_den: string; ty_gia: number;
  nguoi_nhan: string; sdt_nhan: string; dia_chi_nhan: string; email_nhan_license: string; ghi_chu_giao: string;
  am: string; is: string;
  hang_kh: 'vip' | 'tiem_nang' | 'pho_thong';
  cong_no_ngay: number;
  cpbh: number;
  so_lan_tt: number;
  nv_trien_khai: string; nv_tu_van: string; tv_proposal: boolean; tv_poc: boolean;
  loai_hd_chon: string;
  tu_truoc: boolean;
  don_moi: boolean; kh_moi: boolean;
  nguon_kh: SourceKind; nguon_kh_nguoi: string;
  hinh_thuc: '' | 'hop_dong' | 'don_hang' | 'thau';
  so_hd_truoc: string; cpbh_truoc: number | null; doanh_thu_truoc: number | null; ln_truoc: number | null;
  giai_doan: StageForm[];
}

export const emptyStages = (): StageForm[] => STAGE_CODES.map((ma) => ({ ma, nv: '', pct: 0 }));

export const emptyLine = (): LineForm => ({
  sku: '', mo_ta: '', dvt: '', so_luong: 1, loai: 'tb', so_thang: 0, gia_mua: 0, gia_mua_usd: 0, don_gia_ban: 0, chiet_khau: 0, vat: '8',
  ncc_id: '', co_cq: '', ngay_bat_dau: '', ngay_ket_thuc: '',
});

export const emptyOrder = (am: string): OrderForm => ({
  khach_hang_id: '',
  ten_kh: '', ma_kh: '', mst: '', nguoi_lien_he: '', dien_thoai: '', email: '', dia_chi: '', nguoi_dai_dien: '', chuc_vu: '', so_tk: '', ngan_hang: '',
  noi_dung: '', so_hd_noi_bo: '', so_hd_po: '', ngay_ky: '', ngay_bao_gia: '', hieu_luc_den: '', ty_gia: 26000,
  nguoi_nhan: '', sdt_nhan: '', dia_chi_nhan: '', email_nhan_license: '', ghi_chu_giao: '',
  am, is: '', hang_kh: 'pho_thong', cong_no_ngay: 30, cpbh: 0, so_lan_tt: 1,
  nv_trien_khai: '', nv_tu_van: '', tv_proposal: false, tv_poc: false, loai_hd_chon: '', tu_truoc: false,
  don_moi: true, kh_moi: false, nguon_kh: 'khong', nguon_kh_nguoi: '', hinh_thuc: '',
  so_hd_truoc: '', cpbh_truoc: null, doanh_thu_truoc: null, ln_truoc: null,
  giai_doan: emptyStages(),
});
