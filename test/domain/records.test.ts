import { describe, expect, it } from 'vitest';
import { STAGE_CODES } from '../../src/domain/form';
import { financePayload, flat, formFromRecords, linePayload, orderPayload } from '../../src/domain/records';
import { validLine, validOrder } from './fixtures/order-form';

describe('flat', () => {
  it('đọc cả bản ghi có body lẫn bản ghi phẳng', () => {
    expect(flat({ id: 'a', body: { x: 1 } })).toEqual({ id: 'a', x: 1 });
    expect(flat({ id: 'b', x: 2 })).toEqual({ id: 'b', x: 2 });
  });
});

describe('formFromRecords', () => {
  const order = { ...validOrder(), ngay_ky: '05/11/2026', hieu_luc_den: '', cpbh_truoc: null, so_hd_truoc: '' };
  const line = validLine({ ngay_bat_dau: '01/01/2026', ngay_ket_thuc: '31/12/2026', loai: 'cloud_server', so_thang: 12, co_cq: '' });
  const records = () => ({
    don: { id: 'd1', body: orderPayload(order) },
    finance: { id: 'f1', body: financePayload(order) },
    dong: [{ id: 'l1', body: linePayload('d1', line, 1) }],
    gia_ban: [{ id: 'p1', body: { dong_hang: 'l1', don_gia_ban: line.don_gia_ban, chiet_khau: line.chiet_khau } }],
  });

  it('khứ hồi: form → payload → bản ghi → form giữ nguyên mọi trường', () => {
    const back = formFromRecords(records());
    expect(back.order).toEqual({ ...order, id: 'd1', financeId: 'f1' });
    expect(back.lines).toEqual([{ ...line, id: 'l1', priceId: 'p1' }]);
  });

  it('ngày lưu ISO, form dd/mm/yyyy; ngày rỗng lưu null', () => {
    expect(orderPayload(order).ngay_ky).toBe('2026-11-05');
    expect(orderPayload(order).hieu_luc_den).toBeNull();
    expect(linePayload('d1', line, 1).ngay_bat_dau).toBe('2026-01-01');
  });

  it('số liệu năm trước chưa nhập là null, không phải 0', () => {
    expect(financePayload(order).cpbh_truoc).toBeNull();
    expect(formFromRecords(records()).order.cpbh_truoc).toBeNull();
  });

  it('giai_doan luôn đủ 6 phần tử theo thứ tự mã, kể cả khi bản ghi thiếu', () => {
    const r = records();
    r.don.body = { ...r.don.body, giai_doan_deal: [{ ma: 'chot', nv: 'u-x', pct: 0.2 }] };
    const stages = formFromRecords(r).order.giai_doan;
    expect(stages.map((s) => s.ma)).toEqual([...STAGE_CODES]);
    expect(stages[4]).toEqual({ ma: 'chot', nv: 'u-x', pct: 0.2 });
    expect(stages[0]).toEqual({ ma: 'co_hoi', nv: '', pct: 0 });
  });

  it('người dùng và tham chiếu rỗng ghi là null', () => {
    expect(orderPayload({ ...order, nv_trien_khai: '', khach_hang_id: '' })).toMatchObject({ nv_trien_khai: null, khach_hang: null });
  });

  it('dòng không có giá bán (người xem không đọc được) vẫn dựng được với giá 0', () => {
    const r = records();
    expect(formFromRecords({ ...r, gia_ban: [] }).lines[0]).toMatchObject({ don_gia_ban: 0, chiet_khau: 0, priceId: undefined });
  });
});
