// Đơn và dòng hợp lệ dùng chung cho các test của domain và Code step.
import { emptyLine, emptyOrder, type LineForm, type OrderForm } from '../../../src/domain/form';

const STAGES = ['co_hoi', 'lam_ro', 'bao_gia', 'dam_phan', 'chot', 'hd_tt_cskh'] as const;
// Bộ new_tm: 0,2 + 0,3 + 0,1 + 0,1 + 0,2 + 0,1 = 1 (Lead 0,3 cộng riêng, spec §5.1).
const PCT = [0.2, 0.3, 0.1, 0.1, 0.2, 0.1];

export function validOrder(): OrderForm {
  return {
    ...emptyOrder('u-am'),
    ten_kh: 'Sở Giao thông Vận tải Lâm Đồng', ma_kh: 'SOGTVTLD', mst: '0312345678', nguoi_lien_he: 'Anh Bình', dien_thoai: '0909 111 222',
    email: 'binh@sogtvtld.gov.vn', dia_chi: 'Số 4 Trần Hưng Đạo, Đà Lạt', noi_dung: 'Nâng cấp hạ tầng', so_hd_noi_bo: 'NB-1041', is: 'u-is',
    hang_kh: 'pho_thong', cong_no_ngay: 45, cpbh: 5_000_000, don_moi: true, kh_moi: false, nguon_kh: 'khong',
    giai_doan: STAGES.map((ma, i) => ({ ma, nv: i === 5 ? 'u-is' : 'u-am', pct: PCT[i]! })),
  };
}
export const validLine = (patch: Partial<LineForm> = {}): LineForm => ({
  ...emptyLine(), sku: 'SRV-R750', mo_ta: 'Máy chủ Dell', dvt: 'Cái', so_luong: 2, loai: 'tb', so_thang: 36, gia_mua: 118_000_000,
  don_gia_ban: 120_000_000, ncc_id: 'ncc-1', co_cq: 'khong', ...patch,
});
