// Phase 2 trên sandbox: dữ liệu đơn đầy đủ, cổng kiểm t11, đọc chéo giữa các vai trò, đơn không sửa được sau khi gửi duyệt.
import { describe, expect, it } from 'vitest';
import { POLL, as, create, denied, get, live, newOrder, patch, query, remove, submitT11, tag, tasksOf, uid } from './helpers';

const byOrder = (id: string) => [{ field: 'don_hang', op: 'eq', value: id }];

describe('Phase 2: dữ liệu và quyền', () => {
  it('cổng kiểm: đơn thiếu MST gửi duyệt bị máy chủ trả lại, nêu rõ trường thiếu, không mở task cho người khác', async () => {
    const am = as('am1');
    const { don } = await newOrder('mixed', (o) => { o.mst = ''; });
    await submitT11(don.id);
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.trang_thai, POLL).toBe('tra_lai');
    expect(String((await get(am, 'don_hang', don.id)).body.ly_do_gui)).toContain('mst');
    await expect.poll(async () => live(await tasksOf(am, don.id), 't11').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
    expect(live(await tasksOf(am, don.id), 't22')).toEqual([]);
  });

  it('đơn hợp lệ: tóm tắt đúng phần cho TM / PROC, lịch sử, người được chia đọc được đơn; TM/PROC không đọc được số nhạy cảm', async () => {
    const am = as('am1'); const tm = as('tm1'); const proc = as('proc1'); const sd = as('sd1');
    const { don, tai_chinh, gia, dong } = await newOrder('mixed', (o) => { o.giai_doan[0]!.nv = uid('am2'); });
    // Mã đơn có tiền tố TM- khi có thiết bị / license (spec §12.3).
    expect(String((await get(am, 'don_hang', don.id)).body.ma_don)).toMatch(/^TM-/);
    // am3 không liên quan: không đọc được đơn.
    await denied(get(as('am3'), 'don_hang', don.id));
    await submitT11(don.id);
    await expect.poll(async () => (await tasksOf(am, don.id)).length, POLL).toBeGreaterThan(1);

    // Tóm tắt: TM thấy đúng phần dịch vụ, PROC đúng phần hàng hóa, SD thấy cả hai, AM không thấy.
    await expect.poll(async () => (await query(sd, 'tom_tat_don', byOrder(don.id))).length, POLL).toBe(2);
    expect((await query(tm, 'tom_tat_don', byOrder(don.id))).map((t) => t.body.phan)).toEqual(['dich_vu']);
    expect((await query(proc, 'tom_tat_don', byOrder(don.id))).map((t) => t.body.phan)).toEqual(['hang_hoa']);
    expect(await query(am, 'tom_tat_don', byOrder(don.id)).catch(() => [])).toEqual([]);
    const dv = JSON.parse(String((await query(tm, 'tom_tat_don', byOrder(don.id)))[0]!.body.du_lieu)) as Record<string, number>;
    expect(Object.keys(dv)).not.toContain('ln_thuan');

    // TM và PROC bị từ chối trên số nhạy cảm, đọc theo id đã biết (không dùng .catch).
    for (const c of [tm, proc]) {
      await denied(get(c, 'tai_chinh_don', tai_chinh.id));
      await denied(get(c, 'gia_ban_dong', gia[0]!.id));
      await denied(query(c, 'lich_su', byOrder(don.id)));
    }
    // Dòng hàng thì đọc được (không có giá bán).
    expect((await get(tm, 'dong_hang', dong[0]!.id)).id).toBe(dong[0]!.id);

    // Đề xuất mua hàng: chỉ PROC ghi; AM và TM không đọc được.
    const de = await create(proc, 'de_xuat_mua_hang', { dong_hang: dong[0]!.id, don_hang: don.id, gia_mua_de_xuat: 39_000_000 });
    expect((await get(sd, 'de_xuat_mua_hang', de.id)).id).toBe(de.id);
    await denied(get(am, 'de_xuat_mua_hang', de.id));
    await denied(get(tm, 'de_xuat_mua_hang', de.id));

    // Lịch sử: AM đọc được, có gui_duyet và chot_pl; không sửa, không xóa được.
    await expect.poll(async () => (await query(am, 'lich_su', byOrder(don.id))).map((h) => h.body.hanh_dong), POLL).toEqual(expect.arrayContaining(['gui_duyet', 'chot_pl']));
    const h = (await query(am, 'lich_su', byOrder(don.id)))[0]!;
    await denied(patch(am, 'lich_su', h.id, { ghi_chu: 'sửa lịch sử' }));
    await denied(remove(am, 'lich_su', h.id));

    // Người được chia chỉ tiêu (am2) đọc được đơn và số của nó; người không liên quan (am3) thì không.
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.nguoi_duoc_chia, POLL).toEqual(expect.arrayContaining([uid('am2')]));
    expect((await get(as('am2'), 'don_hang', don.id)).id).toBe(don.id);
    expect((await get(as('am2'), 'tai_chinh_don', tai_chinh.id)).id).toBe(tai_chinh.id);
    await denied(get(as('am3'), 'don_hang', don.id));
    await denied(get(as('am3'), 'tai_chinh_don', tai_chinh.id));
  });

  it('Review Focus: sau khi gửi duyệt, không ai sửa được dòng, giá bán, tài chính hay đơn; người ngoài không sửa được', async () => {
    const am = as('am1'); const tm = as('tm1');
    const { don, tai_chinh, gia, dong } = await newOrder('mixed');
    await submitT11(don.id);
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.trang_thai, POLL).toBe('dang_xu_ly');
    await denied(patch(am, 'dong_hang', dong[0]!.id, { so_luong: 99 }));
    await denied(patch(am, 'gia_ban_dong', gia[0]!.id, { don_gia_ban: 1 }));
    await denied(patch(am, 'tai_chinh_don', tai_chinh.id, { cpbh: 1 }));
    await denied(patch(am, 'don_hang', don.id, { ten_kh: 'Đổi tên sau khi gửi' }));
    await denied(patch(tm, 'dong_hang', dong[0]!.id, { so_luong: 99 }));
    await denied(patch(am, 'don_hang', don.id, { nguoi_duoc_chia: [uid('am3')] }));
  });

  it('Review Focus: mã KH không trùng; xóa đơn chỉ Admin', async () => {
    const am = as('am1');
    const ma_kh = `TRUNG${tag.slice(-6)}`;
    await create(am, 'khach_hang', { ma_kh, ten: 'KH trùng mã' });
    await denied(create(am, 'khach_hang', { ma_kh, ten: 'KH trùng mã lần hai' }));
    const { don } = await newOrder('service');
    expect(String((await get(am, 'don_hang', don.id)).body.ma_don)).toMatch(/^DV-/);
    await denied(remove(am, 'don_hang', don.id));
    await remove(as('admin'), 'don_hang', don.id);
    await denied(get(am, 'don_hang', don.id));
  });
});
