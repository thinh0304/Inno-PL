import { describe, expect, it } from 'vitest';
import { emptyLine, emptyOrder, missingFields } from '../../src/module/model';

describe('missingFields (chặn nút Gửi duyệt ở t11)', () => {
  it('đơn trống thiếu mọi trường bắt buộc và danh mục', () => {
    expect(missingFields(emptyOrder(''), [])).toEqual(expect.arrayContaining(['ten_kh', 'mst', 'am', 'is', 'dong_hang']));
  });

  it('đủ thông tin và một dòng hợp lệ thì không thiếu gì', () => {
    const order = { ...emptyOrder('u-am'), ten_kh: 'KH', ma_kh: 'KH1', mst: '0312345678', nguoi_lien_he: 'A', noi_dung: 'ND', so_hd_noi_bo: 'NB-1', is: 'u-is' };
    const line = { ...emptyLine(), mo_ta: 'Máy chủ', dvt: 'Cái', so_luong: 1, don_gia_ban: 10 };
    expect(missingFields(order, [line])).toEqual([]);
  });

  it('dòng thiếu giá bán bị báo theo số dòng', () => {
    const order = { ...emptyOrder('u-am'), ten_kh: 'KH', ma_kh: 'KH1', mst: '0312345678', nguoi_lien_he: 'A', noi_dung: 'ND', so_hd_noi_bo: 'NB-1', is: 'u-is' };
    expect(missingFields(order, [{ ...emptyLine(), mo_ta: 'X', dvt: 'Cái' }])).toEqual(['dong_1']);
  });
});
