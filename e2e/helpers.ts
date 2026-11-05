// Hàm dùng chung của các test sandbox: gọi API bằng người của sandbox.json, tạo đơn hợp lệ đủ trường, theo dõi task.
import { ok } from '@reflexify/agentflow-sdk';
import { as, idsByKey, readSandbox } from '@reflexify/agentflow-sdk/testing';
import { expect } from 'vitest';
import type { LogicalKey } from '../src/generated/app';
import type { LineForm, OrderForm } from '../src/domain/form';
import { isGoods } from '../src/domain/lines';
import { LINE_TYPE_OF_CODE } from '../src/domain/codes';
import { financePayload, forCreate, linePayload, orderPayload } from '../src/domain/records';
import { validLine, validOrder } from '../test/domain/fixtures/order-form';

export { as };
export type Client = ReturnType<typeof as>;
export type Rec = { id: string; updated_at: string; body: Record<string, unknown> };

const ids = idsByKey<LogicalKey>();
export const people = readSandbox().people;
export const uid = (handle: string): string => people[handle]!.user_id;
export const E = (k: string): string => ids[`entity:${k}` as LogicalKey];
export const tag = `${Date.now()}`;
export const POLL = { timeout: 170_000, interval: 3_000 };

export async function create(c: Client, entity: string, form_payload: Record<string, unknown>): Promise<Rec> {
  return (await ok(c.POST('/entities/{entity_id}/records', { params: { path: { entity_id: E(entity) } }, body: { form_payload } as never }))) as unknown as Rec;
}
export async function query(c: Client, entity: string, filters: { field: string; op: string; value: unknown }[] = []): Promise<Rec[]> {
  const page = await ok(c.POST('/entities/{entity_id}/records/query', {
    params: { path: { entity_id: E(entity) } }, body: { filter: { field_filters: filters }, limit: 200 } as never,
  }));
  return page.items as unknown as Rec[];
}
export async function get(c: Client, entity: string, id: string): Promise<Rec> {
  return (await ok(c.GET('/entities/{entity_id}/records/{record_id}', { params: { path: { entity_id: E(entity), record_id: id } } }))) as unknown as Rec;
}
export async function patch(c: Client, entity: string, id: string, changes: Record<string, unknown>): Promise<void> {
  const cur = await get(c, entity, id);
  await ok(c.PATCH('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: E(entity), record_id: id } }, body: { changes, expected_updated_at: cur.updated_at } as never,
  }));
}
export async function remove(c: Client, entity: string, id: string): Promise<void> {
  const cur = await get(c, entity, id);
  await ok(c.DELETE('/entities/{entity_id}/records/{record_id}', {
    params: { path: { entity_id: E(entity), record_id: id }, query: { expected_updated_at: cur.updated_at } as never },
  }));
}
/** Phải bị từ chối (403, 404 hoặc 422). */
export const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow();

export const tasksOf = (c: Client, don: string) => query(c, 'task', [{ field: 'don_hang', op: 'eq', value: don }]);
export const live = (ts: Rec[], ma: string) => ts.filter((t) => t.body.ma === ma && t.body.trang_thai !== 'huy');

/** Nhận task nếu chưa ai giữ (task giao cho nhóm), rồi đổi trạng thái. */
export async function finish(c: Client, t: Rec, trang_thai: string, ly_do?: string) {
  if (!t.body.claimed_by) {
    try { await ok(c.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id: E('task'), record_id: t.id } } })); } catch { /* đã giữ */ }
  }
  await patch(c, 'task', t.id, ly_do ? { trang_thai, ly_do } : { trang_thai });
}

/** Tìm hoặc tạo nhà cung cấp thử (tên là khóa tự nhiên). */
export async function supplier(): Promise<string> {
  const ten = `NCC thử ${tag}`;
  const found = await query(as('proc1'), 'nha_cung_cap', [{ field: 'ten', op: 'eq', value: ten }]);
  return found[0]?.id ?? (await create(as('proc1'), 'nha_cung_cap', { ten, nguoi_lien_he: 'Anh NCC', cong_no_ngay: 30 })).id;
}

export interface NewOrder { don: Rec; order: OrderForm; lines: LineForm[]; tai_chinh: Rec; dong: Rec[]; gia: Rec[] }

/** Tạo một đơn hợp lệ đầy đủ trường bằng người dùng AM (như module làm), cùng task t11. `edit` chỉnh form trước khi lưu. */
export async function newOrder(kind: 'mixed' | 'service', edit: (o: OrderForm) => void = () => {}): Promise<NewOrder> {
  const am = as('am1');
  const ncc = await supplier();
  const order: OrderForm = { ...validOrder(), am: uid('am1'), is: uid('is1'), ma_kh: `KH${tag.slice(-8)}${kind === 'mixed' ? 'M' : 'S'}`, cpbh: kind === 'mixed' ? 3_000_000 : 0,
    giai_doan: validOrder().giai_doan.map((s, i) => ({ ...s, nv: i === 5 ? uid('is1') : uid('am1') })) };
  edit(order);
  const lines: LineForm[] = kind === 'mixed'
    ? [validLine({ so_luong: 2, so_thang: 12, gia_mua: 40_000_000, don_gia_ban: 50_000_000, ncc_id: ncc }),
      validLine({ loai: 'dvtk_i', sku: '', co_cq: '', so_luong: 1, so_thang: 0, gia_mua: 0, don_gia_ban: 20_000_000, ncc_id: ncc })]
    : [validLine({ loai: 'dvtk_o', sku: '', co_cq: '', so_luong: 1, so_thang: 1, gia_mua: 40_000_000, don_gia_ban: 100_000_000, ncc_id: ncc })];
  const khach = (await query(am, 'khach_hang', [{ field: 'ma_kh', op: 'eq', value: order.ma_kh }]))[0]
    ?? await create(am, 'khach_hang', { ma_kh: order.ma_kh, ten: order.ten_kh, mst: order.mst });
  const ma_loai = lines.some((l) => { const t = LINE_TYPE_OF_CODE[l.loai]; return !!t && isGoods(t); }) ? 'tm' : 'dv';
  const don = await create(am, 'don_hang', { ...forCreate(orderPayload({ ...order, khach_hang_id: khach.id })), ma_loai });
  const tai_chinh = await create(am, 'tai_chinh_don', { don_hang: don.id, ...forCreate(financePayload(order)) });
  const dong: Rec[] = []; const gia: Rec[] = [];
  for (const [i, l] of lines.entries()) {
    const d = await create(am, 'dong_hang', forCreate(linePayload(don.id, l, i + 1)));
    dong.push(d);
    gia.push(await create(am, 'gia_ban_dong', { dong_hang: d.id, don_hang: don.id, don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau }));
  }
  await create(am, 'task', { don_hang: don.id, ma: 't11', vai_tro: 'am', trang_thai: 'dang_lam', am: uid('am1'), is: uid('is1') });
  return { don, order, lines, tai_chinh, dong, gia };
}

export const submitT11 = async (donId: string) => {
  const am = as('am1');
  await expect.poll(async () => live(await tasksOf(am, donId), 't11').filter((t) => t.body.trang_thai === 'dang_lam').length, POLL).toBe(1);
  await finish(am, live(await tasksOf(am, donId), 't11')[0]!, 'xong');
};

/** PROC đề xuất giá mua và NCC cho mọi dòng TB/License của đơn (điều kiện để t23 xong, spec §7.2). */
export const proposeAll = async (o: NewOrder, price = 38_000_000) => {
  const ncc = await supplier();
  for (const [i, l] of o.lines.entries()) {
    if (!['tb', 'lic', 'lic_dk', 'lic_ntnn'].includes(l.loai)) continue;
    await create(as('proc1'), 'de_xuat_mua_hang', { dong_hang: o.dong[i]!.id, don_hang: o.don.id, gia_mua_de_xuat: price, ncc_id: ncc });
  }
};
