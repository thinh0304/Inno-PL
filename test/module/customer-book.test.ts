import { describe, expect, it } from 'vitest';
import { emptyOrder } from '../../src/domain/form';
import { fillEmpty, quickFill, suggest, suggestCode, type CustomerRec } from '../../src/module/customerBook';

const rec = (patch: Partial<CustomerRec>): CustomerRec => ({
  id: 'k1', ma_kh: 'SOGTVTLD', ten: 'Sở Giao thông Vận tải Lâm Đồng', mst: '0312345678', dia_chi: 'Số 4 Trần Hưng Đạo, Đà Lạt', nguoi_dai_dien: 'Ông Bình',
  chuc_vu: 'Giám đốc', so_tk: '0071000123456', ngan_hang: 'Vietcombank', nguoi_lien_he: 'Anh Bình', email: 'binh@sogtvtld.gov.vn', dien_thoai: '0909 111 222',
  hang_kh: 'vip', ...patch,
});
const book = [rec({}), rec({ id: 'k2', ma_kh: 'ABC', ten: 'Công ty ABC', mst: '0109999999' })];

describe('suggest', () => {
  it('từ 2 ký tự, theo tên, mã KH hoặc MST, không phân biệt dấu', () => {
    expect(suggest(book, 'giao thong').map((c) => c.id)).toEqual(['k1']);
    expect(suggest(book, 'ABC').map((c) => c.id)).toEqual(['k2']);
    expect(suggest(book, '03123').map((c) => c.id)).toEqual(['k1']);
    expect(suggest(book, 'so g').map((c) => c.id)).toEqual(['k1']);
  });
  it('một ký tự hoặc không khớp thì không gợi ý', () => {
    expect(suggest(book, 'a')).toEqual([]);
    expect(suggest(book, 'zzz')).toEqual([]);
  });
});

describe('fillEmpty', () => {
  it('chỉ điền ô trống, ghi nhớ hồ sơ khách hàng', () => {
    const { order, conflicts } = fillEmpty({ ...emptyOrder('u-am'), nguoi_lien_he: 'Chị Hạnh' }, rec({}));
    expect(order).toMatchObject({ ten_kh: 'Sở Giao thông Vận tải Lâm Đồng', ma_kh: 'SOGTVTLD', mst: '0312345678', dia_chi: 'Số 4 Trần Hưng Đạo, Đà Lạt', khach_hang_id: 'k1', hang_kh: 'vip' });
    expect(order.nguoi_lien_he).toBe('Chị Hạnh');
    expect(conflicts).toEqual([{ field: 'nguoi_lien_he', current: 'Chị Hạnh', fromBook: 'Anh Bình' }]);
  });
  it('ô đã nhập giống hồ sơ không bị coi là khác biệt', () => {
    expect(fillEmpty({ ...emptyOrder('u-am'), mst: '0312345678' }, rec({})).conflicts).toEqual([]);
  });
});

describe('suggestCode', () => {
  it('Review Focus: không trùng mã đã có; bỏ loại hình doanh nghiệp; nhiều từ lấy chữ đầu', () => {
    expect(suggestCode('CÔNG TY TNHH ABC', [])).toBe('ABC');
    expect(suggestCode('CÔNG TY TNHH ABC', ['ABC'])).toBe('ABC2');
    expect(suggestCode('Sở Giao thông Vận tải Lâm Đồng', [])).toBe('SGTVTLD');
  });
});

describe('quickFill', () => {
  it('điền nhanh giao nhận: = người liên hệ, = địa chỉ KH', () => {
    const o = { ...emptyOrder('a'), nguoi_lien_he: 'Anh Bình', dien_thoai: '0909 111 222', dia_chi: 'Đà Lạt' };
    expect(quickFill(o, 'contact')).toMatchObject({ nguoi_nhan: 'Anh Bình', sdt_nhan: '0909 111 222' });
    expect(quickFill(o, 'address').dia_chi_nhan).toBe('Đà Lạt');
  });
});
