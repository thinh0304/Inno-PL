// Phase 1 trên sandbox: lát mỏng t11 → t22 ∥ t23 → t31. Cần `pnpm af deploy --sandbox` trước.
import { ok } from '@reflexify/agentflow-sdk';
import { as, idsByKey, readSandbox } from '@reflexify/agentflow-sdk/testing';
import { describe, expect, it } from 'vitest';
import type { LogicalKey } from '../src/generated/app';
import { DEFAULT_CONFIG } from '../src/domain/config';
import { computePl } from '../src/domain/pl';

type Client = ReturnType<typeof as>;
type Rec = { id: string; updated_at: string; body: Record<string, unknown> };

const ids = idsByKey<LogicalKey>();
const people = readSandbox().people;
const E = (k: string) => ids[`entity:${k}` as LogicalKey];
const tag = `p01-${Date.now()}`;
const POLL = { timeout: 170_000, interval: 3_000 };

async function create(c: Client, entity: string, form_payload: Record<string, unknown>): Promise<Rec> {
  return (await ok(c.POST('/entities/{entity_id}/records', { params: { path: { entity_id: E(entity) } }, body: { form_payload } as never }))) as unknown as Rec;
}
async function query(c: Client, entity: string, filters: { field: string; op: string; value: unknown }[]): Promise<Rec[]> {
  const page = await ok(c.POST('/entities/{entity_id}/records/query', {
    params: { path: { entity_id: E(entity) } }, body: { filter: { field_filters: filters }, limit: 200 } as never,
  }));
  return page.items as unknown as Rec[];
}
async function get(c: Client, entity: string, id: string): Promise<Rec> {
  return (await ok(c.GET('/entities/{entity_id}/records/{record_id}', { params: { path: { entity_id: E(entity), record_id: id } } }))) as unknown as Rec;
}
async function patch(c: Client, entity: string, id: string, changes: Record<string, unknown>): Promise<void> {
  const cur = await get(c, entity, id);
  await ok(c.PATCH('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: E(entity), record_id: id } }, body: { changes, expected_updated_at: cur.updated_at } as never,
  }));
}
const tasksOf = (c: Client, don: string) => query(c, 'task', [{ field: 'don_hang', op: 'eq', value: don }]);
const live = (ts: Rec[], ma: string) => ts.filter((t) => t.body.ma === ma && t.body.trang_thai !== 'huy');

/** Nhận task nếu chưa ai giữ (task giao cho nhóm), rồi đổi trạng thái. */
async function finish(c: Client, t: Rec, trang_thai: string, ly_do?: string) {
  if (!t.body.claimed_by) {
    try { await ok(c.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id: E('task'), record_id: t.id } } })); } catch { /* đã giữ */ }
  }
  await patch(c, 'task', t.id, ly_do ? { trang_thai, ly_do } : { trang_thai });
}

async function newOrder(kind: 'mixed' | 'service') {
  const am = as('am1');
  const don = await create(am, 'don_hang', {
    ten_kh: `KH ${tag}`, ma_kh: 'KHTEST', mst: '0312345678', nguoi_lien_he: 'Anh Test', noi_dung: tag, so_hd_noi_bo: `NB-${tag}`,
    am: people.am1!.user_id, is: people.is1!.user_id, hang_kh: 'pho_thong', cong_no_ngay: 30,
  });
  await create(am, 'tai_chinh_don', { don_hang: don.id, cpbh: kind === 'mixed' ? 3_000_000 : 0 });
  const lines = kind === 'mixed'
    ? [{ loai: 'tb', so_luong: 2, so_thang: 12, gia_mua: 40_000_000, ban: 50_000_000 }, { loai: 'dvtk_i', so_luong: 1, so_thang: 0, gia_mua: 0, ban: 20_000_000 }]
    : [{ loai: 'dvtk_o', so_luong: 1, so_thang: 1, gia_mua: 40_000_000, ban: 100_000_000 }];
  for (const [i, l] of lines.entries()) {
    const dong = await create(am, 'dong_hang', { don_hang: don.id, stt: i + 1, mo_ta: `Dòng ${i + 1}`, dvt: 'Cái', so_luong: l.so_luong, loai: l.loai, so_thang: l.so_thang, gia_mua: l.gia_mua });
    await create(am, 'gia_ban_dong', { dong_hang: dong.id, don_hang: don.id, don_gia_ban: l.ban, chiet_khau: 0 });
  }
  await create(am, 'task', { don_hang: don.id, ma: 't11', vai_tro: 'am', trang_thai: 'dang_lam', am: people.am1!.user_id, is: people.is1!.user_id });
  return don;
}

const submitT11 = async (donId: string) => {
  const am = as('am1');
  await expect.poll(async () => live(await tasksOf(am, donId), 't11').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
  await finish(am, live(await tasksOf(am, donId), 't11')[0]!, 'xong');
};

describe('Phase 1: lát mỏng', () => {
  it('đơn hỗn hợp: t22 ∥ t23 → đúng một t31; TM không đọc được số; trả lại rồi duyệt lại; SD duyệt → đã phê duyệt', async () => {
    const am = as('am1'); const tm = as('tm1'); const proc = as('proc1'); const sd = as('sd1');
    const don = await newOrder('mixed');
    await submitT11(don.id);

    // t22 cho TM, t23 cho PROC; số P&L được chốt đúng bằng computePl.
    await expect.poll(async () => { const ts = await tasksOf(am, don.id); return [live(ts, 't22').length, live(ts, 't23').length]; }, POLL).toEqual([1, 1]);
    const want = computePl({
      lines: [{ type: 'TB', qty: 2, sell: 50_000_000, discountPct: 0, buy: 40_000_000, months: 12 }, { type: 'DVTK-I', qty: 1, sell: 20_000_000, discountPct: 0, buy: 0, months: 0 }],
      tier: 'pho_thong', creditDays: 30, salesCost: 3_000_000, deployStaff: false, consultStaff: false, proposal: false, poc: false,
    }, DEFAULT_CONFIG);
    await expect.poll(async () => (await query(am, 'tai_chinh_don', [{ field: 'don_hang', op: 'eq', value: don.id }]))[0]?.body.ln_thuan_chot, POLL).toBe(want.netProfit);

    // TM đọc được đơn nhưng không đọc được số nhạy cảm.
    expect((await get(tm, 'don_hang', don.id)).id).toBe(don.id);
    expect(await query(tm, 'tai_chinh_don', [{ field: 'don_hang', op: 'eq', value: don.id }]).catch(() => [])).toEqual([]);
    expect(await query(tm, 'gia_ban_dong', [{ field: 'don_hang', op: 'eq', value: don.id }]).catch(() => [])).toEqual([]);

    // TM duyệt t22 và PROC xong t23 gần như đồng thời → đúng một t31.
    const [t22, t23] = [live(await tasksOf(tm, don.id), 't22')[0]!, live(await tasksOf(proc, don.id), 't23')[0]!];
    await Promise.all([finish(tm, t22, 'xong'), finish(proc, t23, 'xong')]);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't31').length, POLL).toBe(1);
    await new Promise((r) => setTimeout(r, 20_000));
    expect(live(await tasksOf(am, don.id), 't31').length).toBe(1);

    // SD trả lại: t11 mới cho AM, đơn bị trả lại, task cũ bị hủy.
    await finish(sd, live(await tasksOf(sd, don.id), 't31')[0]!, 'tra_lai', 'Thiếu giá NCC');
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.trang_thai, POLL).toBe('tra_lai');
    await expect.poll(async () => live(await tasksOf(am, don.id), 't11').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
    expect(live(await tasksOf(am, don.id), 't22')).toEqual([]);

    // Gửi lại: t22, t23 mở lại; duyệt hết; SD duyệt t31 → đã phê duyệt.
    await submitT11(don.id);
    await expect.poll(async () => { const ts = await tasksOf(am, don.id); return [live(ts, 't22').length, live(ts, 't23').length]; }, POLL).toEqual([1, 1]);
    await Promise.all([finish(tm, live(await tasksOf(tm, don.id), 't22')[0]!, 'xong'), finish(proc, live(await tasksOf(proc, don.id), 't23')[0]!, 'xong')]);
    await expect.poll(async () => live(await tasksOf(sd, don.id), 't31').length, POLL).toBe(1);
    await finish(sd, live(await tasksOf(sd, don.id), 't31')[0]!, 'xong');
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.trang_thai, POLL).toBe('da_phe_duyet');
  });

  it('đơn chỉ dịch vụ ≤ 300 triệu, đạt ngưỡng: t23 bỏ qua, t31 tự duyệt', async () => {
    const am = as('am1'); const tm = as('tm1');
    const don = await newOrder('service');
    await submitT11(don.id);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't22').length, POLL).toBe(1);
    expect(live(await tasksOf(am, don.id), 't23')[0]?.body.trang_thai).toBe('bo_qua');
    await finish(tm, live(await tasksOf(tm, don.id), 't22')[0]!, 'xong');
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.trang_thai, POLL).toBe('da_phe_duyet');
    expect(live(await tasksOf(am, don.id), 't31')[0]?.body.trang_thai).toBe('xong');
  });
  it('nền tảng: task có hạn theo ngày làm việc và hiện trong My Work của đúng người', async () => {
    const am = as('am1'); const tm = as('tm1'); const proc = as('proc1');
    const don = await newOrder('mixed');
    await submitT11(don.id);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't22').length, POLL).toBe(1);
    const t22 = live(await tasksOf(am, don.id), 't22')[0]!;
    expect(typeof t22.body.han).toBe('string'); // add_business_days(now(), 1) đã ghi hạn
    const inWork = async (c: Client, id: string) => {
      const page = await ok(c.GET('/work', { params: { query: { view: 'all' } as never } }));
      return (page.items as unknown as { id: string }[]).some((x) => x.id === id);
    };
    expect(await inWork(tm, t22.id)).toBe(true);
    expect(await inWork(proc, t22.id)).toBe(false);
  });
  it('quyền trên task: AM không đổi mã task để tự duyệt; chỉ chuyển trạng thái đúng đường', async () => {
    const am = as('am1'); const proc = as('proc1');

    // C1: AM giữ t11 đang làm, thử biến nó thành t31 đã xong để tự phê duyệt đơn.
    const forged = await newOrder('mixed');
    const t11 = live(await tasksOf(am, forged.id), 't11')[0]!;
    try { await ok(am.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id: E('task'), record_id: t11.id } } })); } catch { /* đã giữ */ }
    await expect(patch(am, 'task', t11.id, { ma: 't31', trang_thai: 'xong' })).rejects.toThrow();
    await expect(patch(am, 'task', t11.id, { vai_tro: 'sd' })).rejects.toThrow();
    expect((await get(am, 'don_hang', forged.id)).body.trang_thai).toBe('nhap');

    // I1: PROC không được "trả lại" (chỉ t22, t31 mới có), không đưa task đã xong về lại.
    const don = await newOrder('mixed');
    await submitT11(don.id);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't23').length, POLL).toBe(1);
    const t23 = live(await tasksOf(proc, don.id), 't23')[0]!;
    await expect(finish(proc, t23, 'tra_lai', 'thử trả lại')).rejects.toThrow();
    await finish(proc, t23, 'xong');
    await expect(patch(proc, 'task', t23.id, { trang_thai: 'dang_lam' })).rejects.toThrow();
    await expect(patch(proc, 'task', t23.id, { trang_thai: 'tra_lai' })).rejects.toThrow();
  });
});
