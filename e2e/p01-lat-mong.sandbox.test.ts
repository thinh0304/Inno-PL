// Phase 1 trên sandbox: lát mỏng t11 → t22 ∥ t23 → t31, và quyền trên task. Cần `pnpm af deploy --sandbox` trước.
import { ok } from '@reflexify/agentflow-sdk';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/domain/config';
import { computePl } from '../src/domain/pl';
import { plInputFromForm } from '../src/domain/plinput';
import { E, POLL, as, finish, get, live, newOrder, patch, proposeAll, query, submitT11, tasksOf, type Client } from './helpers';

describe('Phase 1: lát mỏng', () => {
  it('đơn hỗn hợp: t22 ∥ t23 → đúng một t31; TM không đọc được số; trả lại rồi duyệt lại; SD duyệt → đã phê duyệt', async () => {
    const am = as('am1'); const tm = as('tm1'); const proc = as('proc1'); const sd = as('sd1');
    const placed = await newOrder('mixed');
    const { don, order, lines } = placed;
    await proposeAll(placed);
    await submitT11(don.id);

    // t22 cho TM, t23 cho PROC; số P&L được chốt đúng bằng computePl.
    await expect.poll(async () => { const ts = await tasksOf(am, don.id); return [live(ts, 't22').length, live(ts, 't23').length]; }, POLL).toEqual([1, 1]);
    const want = computePl(plInputFromForm(order, lines), DEFAULT_CONFIG);
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
    const { don } = await newOrder('service');
    await submitT11(don.id);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't22').length, POLL).toBe(1);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't23')[0]?.body.trang_thai, POLL).toBe('bo_qua');
    await finish(tm, live(await tasksOf(tm, don.id), 't22')[0]!, 'xong');
    await expect.poll(async () => (await get(am, 'don_hang', don.id)).body.trang_thai, POLL).toBe('da_phe_duyet');
    await expect.poll(async () => live(await tasksOf(am, don.id), 't31')[0]?.body.trang_thai, POLL).toBe('xong');
  });
  it('nền tảng: task có hạn theo ngày làm việc và hiện trong My Work của đúng người', async () => {
    const am = as('am1'); const tm = as('tm1'); const proc = as('proc1');
    const { don } = await newOrder('mixed');
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
    const { don: forged } = await newOrder('mixed');
    const t11 = live(await tasksOf(am, forged.id), 't11')[0]!;
    try { await ok(am.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id: E('task'), record_id: t11.id } } })); } catch { /* đã giữ */ }
    await expect(patch(am, 'task', t11.id, { ma: 't31', trang_thai: 'xong' })).rejects.toThrow();
    await expect(patch(am, 'task', t11.id, { vai_tro: 'sd' })).rejects.toThrow();
    expect((await get(am, 'don_hang', forged.id)).body.trang_thai).toBe('nhap');

    // I1: PROC không được "trả lại" (chỉ t22, t31 mới có), không đưa task đã xong về lại.
    const { don } = await newOrder('mixed');
    await submitT11(don.id);
    await expect.poll(async () => live(await tasksOf(am, don.id), 't23').length, POLL).toBe(1);
    const t23 = live(await tasksOf(proc, don.id), 't23')[0]!;
    await expect(finish(proc, t23, 'tra_lai', 'thử trả lại')).rejects.toThrow();
    await finish(proc, t23, 'xong');
    await expect(patch(proc, 'task', t23.id, { trang_thai: 'dang_lam' })).rejects.toThrow();
    await expect(patch(proc, 'task', t23.id, { trang_thai: 'tra_lai' })).rejects.toThrow();
  });
});
