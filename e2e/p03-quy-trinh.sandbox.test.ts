// Phase 3 trên sandbox: quy trình đủ 15 task, Close-lost, Yêu cầu sửa dự thảo, Xin duyệt lại, KH tạm ứng trước, cổng t23. Cần `pnpm af deploy --sandbox` trước.
import { describe, expect, it } from 'vitest';
import { POLL, as, create, denied, finish, get, live, newOrder, patch, proposeAll, query, submitT11, tasksOf, uid, type Client } from './helpers';

const LONG = 1_200_000;
const am = () => as('am1');
const WHO: Record<string, string> = { t22: 'tm1', t23: 'proc1', t31: 'sd1', t40: 'is1', t44: 'proc1', t42: 'sd1', t41: 'is1', t45: 'proc1', t51: 'acc1', t53: 'acc1', t61: 'proc1', t62: 'tm1', t71: 'acc1', t72: 'acc1' };

/** Chờ task `ma` mở (đang làm) rồi người của vai trò đó đổi trạng thái. */
async function step(don: string, ma: string, status = 'xong', reason?: string) {
  const c: Client = as(WHO[ma]!);
  await expect.poll(async () => live(await tasksOf(am(), don), ma).filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
  await finish(c, live(await tasksOf(c, don), ma).filter((t) => t.body.trang_thai === 'dang_lam')[0]!, status, reason);
}
const orderStatus = async (don: string) => (await get(am(), 'don_hang', don)).body;
const request = (c: Client, don: string, kind: 'yc_close_lost' | 'yc_xin_duyet_lai', ly_do = 'Lý do thử') =>
  create(c, 'task', { don_hang: don, ma: kind, vai_tro: 'is', trang_thai: 'dang_lam', ly_do });
/** Đơn dịch vụ tự duyệt: chờ t40 mở xong rồi mới gửi yêu cầu (hai lượt điều phối chạy chồng nhau là F-32). */
const settled = (don: string) => expect.poll(async () => live(await tasksOf(am(), don), 't40').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
const hasLive = async (don: string, ma: string) => live(await tasksOf(am(), don), ma).length > 0;

describe('Phase 3: quy trình đủ 15 task', () => {
  it('đơn hỗn hợp đi hết t11 → t72 đến Hoàn tất, có ngày hết hạn; t51, t53 "Không áp dụng" cũng được', async () => {
    const o = await newOrder('mixed');
    const don = o.don.id;
    await proposeAll(o);
    await submitT11(don);
    await step(don, 't22'); await step(don, 't23');
    await step(don, 't31');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('da_phe_duyet');
    await step(don, 't40'); await step(don, 't44'); await step(don, 't42');
    await step(don, 't41'); await step(don, 't45');
    await step(don, 't51', 'khong_ap_dung'); await step(don, 't53');
    await step(don, 't61'); await step(don, 't62');
    await step(don, 't71'); await step(don, 't72');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('hoan_tat');
    expect(String((await orderStatus(don)).ngay_het_han)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Lịch sử ghi sau trạng thái đơn trong cùng lượt chạy.
    await expect.poll(async () => (await query(as('admin'), 'lich_su', [{ field: 'don_hang', op: 'eq', value: don }])).map((h) => h.body.hanh_dong), POLL).toEqual(expect.arrayContaining(['hoan_tat', 'hoan_tat_gd']));
  }, LONG);

  it('KH tạm ứng trước = Có: t61 và t62 chờ t51', async () => {
    const o = await newOrder('mixed', (f) => { f.tu_truoc = true; });
    const don = o.don.id;
    await proposeAll(o);
    await submitT11(don);
    await step(don, 't22'); await step(don, 't23'); await step(don, 't31');
    await step(don, 't40'); await step(don, 't44'); await step(don, 't42'); await step(don, 't41'); await step(don, 't45');
    await step(don, 't53');
    await new Promise((r) => setTimeout(r, 20_000));
    expect(await hasLive(don, 't61')).toBe(false);
    expect(await hasLive(don, 't62')).toBe(false);
    await step(don, 't51');
    await expect.poll(async () => [await hasLive(don, 't61'), await hasLive(don, 't62')], POLL).toEqual([true, true]);
  }, LONG);

  it('cổng t23: xong mà thiếu đề xuất giá mua thì t23 mở lại, chưa có t31; đủ đề xuất thì mở t31', async () => {
    const o = await newOrder('mixed');
    const don = o.don.id;
    await submitT11(don);
    await step(don, 't22'); await step(don, 't23');
    await expect.poll(async () => (await tasksOf(am(), don)).filter((t) => t.body.ma === 't23' && t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
    expect(await hasLive(don, 't31')).toBe(false);
    await proposeAll(o);
    await step(don, 't23');
    await expect.poll(async () => hasLive(don, 't31'), POLL).toBe(true);
  }, LONG);

  it('Yêu cầu sửa dự thảo (t42) mở lại t40; Close-lost của IS dừng đơn', async () => {
    const o = await newOrder('service');
    const don = o.don.id;
    await submitT11(don);
    await step(don, 't22');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('da_phe_duyet');
    await step(don, 't40');
    await step(don, 't42', 'yeu_cau_sua', 'Sai điều khoản thanh toán');
    await expect.poll(async () => live(await tasksOf(am(), don), 't40').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
    expect(await hasLive(don, 't42')).toBe(false);

    await request(as('is1'), don, 'yc_close_lost', 'KH chọn nhà thầu khác');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('close_lost');
    expect((await tasksOf(am(), don)).filter((t) => !['huy', 'xong', 'bo_qua', 'khong_ap_dung'].includes(String(t.body.trang_thai)))).toEqual([]);
  }, LONG);

  it('Xin duyệt lại: AM sửa được dòng hàng, SD duyệt lại, rồi khóa lại', async () => {
    const o = await newOrder('service');
    const don = o.don.id;
    await submitT11(don);
    await step(don, 't22');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('da_phe_duyet');
    await settled(don);
    await denied(patch(am(), 'dong_hang', o.dong[0]!.id, { so_luong: 2 }));

    await request(as('is1'), don, 'yc_xin_duyet_lai', 'Giá HĐ đàm phán lệch số đã duyệt');
    await expect.poll(async () => (await orderStatus(don)).cho_duyet_lai, POLL).toBe(true);
    await expect.poll(async () => live(await tasksOf(am(), don), 't31').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
    expect(await hasLive(don, 't40')).toBe(false);
    await patch(am(), 'dong_hang', o.dong[0]!.id, { so_luong: 2 });

    await step(don, 't31');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('da_phe_duyet');
    expect((await orderStatus(don)).cho_duyet_lai).toBe(false);
    await expect.poll(async () => live(await tasksOf(am(), don), 't40').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
    await denied(patch(am(), 'dong_hang', o.dong[0]!.id, { so_luong: 3 }));
  }, LONG);

  it('quyền: người không thuộc đơn bị từ chối yêu cầu; Kỹ thuật không tạo được yêu cầu; không ai tự tạo task quy trình', async () => {
    const o = await newOrder('service');
    const don = o.don.id;
    await submitT11(don);
    await step(don, 't22');
    await expect.poll(async () => (await orderStatus(don)).trang_thai, POLL).toBe('da_phe_duyet');

    const stray = await request(as('am3'), don, 'yc_close_lost', 'Không phải đơn của tôi');
    await expect.poll(async () => (await get(as('admin'), 'task', stray.id)).body.trang_thai, POLL).toBe('huy');
    expect((await orderStatus(don)).trang_thai).toBe('da_phe_duyet');

    await denied(request(as('tm1'), don, 'yc_close_lost'));
    await denied(create(am(), 'task', { don_hang: don, ma: 't41', vai_tro: 'is', trang_thai: 'dang_lam', am: uid('am1'), is: uid('is1') }));
  }, LONG);
});
