import { describe, expect, it } from 'vitest';
import { emptyLine, emptyOrder, type LineForm, type OrderForm } from '../../src/domain/form';
import { checkFormat, normalize, validateOrder } from '../../src/domain/validate';

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
const fields = (o: OrderForm, l: LineForm[]) => validateOrder(o, l).map((i) => i.field);

describe('normalize và checkFormat', () => {
  it('số điện thoại: tự chuẩn hóa +84 và nhóm, kiểm di động 10 số / cố định 11 số', () => {
    expect(normalize('phone', '+84 909 123 456')).toBe('0909 123 456');
    expect(normalize('phone', '028-3800-0000')).toBe('028 3800 0000');
    expect(checkFormat('phone', '0909123456')).toBeNull();
    expect(checkFormat('phone', '0109123456')).not.toBeNull();
    expect(checkFormat('phone', '12345')).not.toBeNull();
  });

  it('ngày: nhiều cách gõ về dd/mm/yyyy; ngày không có thật hoặc ngoài 2000–2100 là lỗi', () => {
    for (const raw of ['5-11-2026', '5.11.2026', '2026-11-05', '05112026']) expect(normalize('date', raw)).toBe('05/11/2026');
    expect(checkFormat('date', '05/11/2026')).toBeNull();
    expect(checkFormat('date', '31/02/2026')).not.toBeNull();
    expect(checkFormat('date', '05/11/1999')).not.toBeNull();
  });

  it('MST: bỏ khoảng trắng; 10 số hoặc 10 số-3 số', () => {
    expect(normalize('taxId', ' 0312345678 ')).toBe('0312345678');
    expect(checkFormat('taxId', '0312345678')).toBeNull();
    expect(checkFormat('taxId', '0312345678-001')).toBeNull();
    expect(checkFormat('taxId', '031234567')).not.toBeNull();
    expect(checkFormat('taxId', '0312345678-01')).not.toBeNull();
  });

  it('mã KH in hoa 2–20 ký tự; email chữ thường; số tài khoản 6–19 số', () => {
    expect(normalize('customerCode', ' sogtvtld ')).toBe('SOGTVTLD');
    expect(checkFormat('customerCode', 'A')).not.toBeNull();
    expect(normalize('email', ' Cntt@Barria.gov.vn ')).toBe('cntt@barria.gov.vn');
    expect(checkFormat('email', 'a@b')).not.toBeNull();
    expect(checkFormat('email', 'cntt@barria.gov.vn')).toBeNull();
    expect(checkFormat('account', '0071000123456')).toBeNull();
    expect(checkFormat('account', '12345')).not.toBeNull();
  });

  it('các ô số: SL nguyên > 0, tháng 0–120, % 0–100, công nợ 0–365, số lần thanh toán 1–12', () => {
    expect(checkFormat('quantity', '17')).toBeNull();
    expect(checkFormat('quantity', '0')).not.toBeNull();
    expect(checkFormat('quantity', '1.5')).not.toBeNull();
    expect(checkFormat('months', '120')).toBeNull();
    expect(checkFormat('months', '121')).not.toBeNull();
    expect(checkFormat('percent', '0,5')).toBeNull();
    expect(checkFormat('percent', '100,5')).not.toBeNull();
    expect(checkFormat('creditDays', '365')).toBeNull();
    expect(checkFormat('creditDays', '366')).not.toBeNull();
    expect(checkFormat('payments', '12')).toBeNull();
    expect(checkFormat('payments', '13')).not.toBeNull();
  });
});

describe('validateOrder', () => {
  it('đơn đầy đủ và hợp lệ không có lỗi', () => {
    expect(validateOrder(validOrder(), [validLine()])).toEqual([]);
  });

  it('đơn rỗng thiếu các trường bắt buộc và danh mục', () => {
    const f = fields(emptyOrder(''), []);
    for (const k of ['ten_kh', 'ma_kh', 'mst', 'nguoi_lien_he', 'noi_dung', 'so_hd_noi_bo', 'am', 'is', 'dong_hang']) expect(f).toContain(k);
  });

  it('6 giai đoạn: thiếu người phụ trách và tổng lệch bị báo', () => {
    const o = validOrder();
    o.giai_doan = o.giai_doan.map((s, i) => (i === 0 ? { ...s, nv: '' } : i === 1 ? { ...s, pct: 0.4 } : s));
    const f = fields(o, [validLine()]);
    expect(f).toContain('giai_doan.0.nv');
    expect(f).toContain('giai_doan.tong');
  });

  it('đơn tái ký: thiếu số liệu năm trước, LN lớn hơn doanh thu, nguồn KH khác "Không"', () => {
    const o = { ...validOrder(), don_moi: false, nguon_kh: 'nguoi' as const, nguon_kh_nguoi: 'u-x' };
    const f = fields(o, [validLine()]);
    for (const k of ['so_hd_truoc', 'cpbh_truoc', 'doanh_thu_truoc', 'ln_truoc', 'nguon_kh']) expect(f).toContain(k);
    const g = fields({ ...o, nguon_kh: 'khong', so_hd_truoc: 'HD-1', cpbh_truoc: 0, doanh_thu_truoc: 100, ln_truoc: 200 }, [validLine()]);
    expect(g).toEqual(['ln_truoc']);
  });

  it('nguồn KH: Team Marketing hợp lệ không cần người; "một người" mà thiếu người là lỗi', () => {
    expect(fields({ ...validOrder(), nguon_kh: 'marketing' }, [validLine()])).toEqual([]);
    expect(fields({ ...validOrder(), nguon_kh: 'nguoi', nguon_kh_nguoi: '' }, [validLine()])).toEqual(['nguon_kh_nguoi']);
  });

  it('dòng hàng: P/N, CO/CQ, kỳ hạn, số tháng, NCC, ngày kết thúc phải sau ngày bắt đầu', () => {
    const o = validOrder();
    expect(fields(o, [validLine({ sku: '' })])).toEqual(['dong_1.sku']);
    expect(fields(o, [validLine({ co_cq: '' })])).toEqual(['dong_1.co_cq']);
    expect(fields(o, [validLine({ loai: 'lic_dk', co_cq: '' })])).toEqual(['dong_1.ngay_bat_dau', 'dong_1.ngay_ket_thuc']);
    expect(fields(o, [validLine({ loai: 'cloud_server', sku: '', co_cq: '', so_thang: 0, ngay_bat_dau: '01/01/2026', ngay_ket_thuc: '31/12/2026' })])).toEqual(['dong_1.so_thang']);
    expect(fields(o, [validLine({ ncc_id: '' })])).toEqual(['dong_1.ncc_id']);
    expect(fields(o, [validLine({ loai: 'lic_dk', co_cq: '', ngay_bat_dau: '10/11/2026', ngay_ket_thuc: '01/11/2026' })])).toEqual(['dong_1.ngay_ket_thuc']);
  });

  it('lỗi định dạng của trường đã nhập: MST sai, SĐT sai', () => {
    const f = fields({ ...validOrder(), mst: '123', dien_thoai: '12345' }, [validLine()]);
    expect(f).toEqual(expect.arrayContaining(['mst', 'dien_thoai']));
  });
});
