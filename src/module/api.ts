// Đọc và ghi bản ghi qua host.api. Id entity lấy từ GET /app/objects (getAppObjects), không viết cứng.
import { getAppObjects, ok, type AppHost, type components } from '@reflexify/agentflow-sdk';
import type { EntityKey, LogicalKey } from '../generated/app.js';
import type { PlResult } from '../domain/pl.js';
import type { FlowTask } from '../domain/flow.js';
import { emptyOrder, onlyMine, type LineDraft, type OrderDraft } from './model.js';
import type { MyTask } from './screens/ViecCuaBan.js';

type Wire = components['schemas']['EntityRecord'];
type Page = components['schemas']['EntityRecordPage'];
type Body = Record<string, unknown>;

export interface OrderRow { id: string; ma_don: string; ten_kh: string; am: string; trang_thai: string; giai_doan: number; revenue: number | null }
export interface TaskRow { id: string; ma: string; trang_thai: FlowTask['status']; vai_tro: string; claimedBy: string | null }
export interface LoadedOrder {
  order: OrderDraft;
  lines: LineDraft[];
  trang_thai: string;
  ma_don: string;
  giai_doan: number;
  locked: { result: PlResult; at: string | null } | null;
  /** false khi người xem không đọc được giá bán / tài chính (Kỹ thuật, Mua hàng): ẩn P&L. */
  seesMoney: boolean;
  tasks: TaskRow[];
  /** Task đang nằm trong My Work của người xem: chỉ với các task này mới hiện nút thao tác. */
  workIds: Set<string>;
}

const bodyOf = (r: Wire): Body => r.body as Body;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const TASK_KIND: Record<string, MyTask['kind']> = { t11: 'submit', t22: 'approve', t31: 'approve', t23: 'do' };

export function makeApi(host: Pick<AppHost, 'api' | 'context'>) {
  const objects = getAppObjects<LogicalKey>(host.api);
  const me = host.context.person.id;

  async function entityId(key: EntityKey): Promise<string> {
    await objects.load();
    const id = objects.id(`entity:${key}` as LogicalKey);
    if (!id) throw new Error(`entity ${key} is not installed`);
    return id;
  }

  async function queryAll(key: EntityKey, field_filters: { field: string; op: string; value?: unknown }[] = [], sort = 'created_at', dir: 'asc' | 'desc' = 'asc'): Promise<Wire[]> {
    const entity_id = await entityId(key);
    const items: Wire[] = [];
    let cursor: string | null = null;
    do {
      const page: Page = await ok(host.api.POST('/entities/{entity_id}/records/query', {
        params: { path: { entity_id } },
        body: { filter: { field_filters }, sort, dir, limit: 200, cursor } as never,
      }));
      items.push(...page.items);
      cursor = page.next_cursor;
    } while (cursor);
    return items;
  }

  async function create(key: EntityKey, form_payload: Body): Promise<Wire> {
    const entity_id = await entityId(key);
    return ok(host.api.POST('/entities/{entity_id}/records', { params: { path: { entity_id } }, body: { form_payload } as never })) as Promise<Wire>;
  }

  async function read(key: EntityKey, id: string): Promise<Wire> {
    const entity_id = await entityId(key);
    return ok(host.api.GET('/entities/{entity_id}/records/{record_id}', { params: { path: { entity_id, record_id: id } } })) as Promise<Wire>;
  }

  /** Đọc bản ghi để lấy `updated_at` hiện tại rồi sửa các trường (409 STALE_VERSION nếu có người sửa xen vào). */
  async function patch(key: EntityKey, id: string, changes: Body): Promise<void> {
    const entity_id = await entityId(key);
    const current = await read(key, id);
    await ok(host.api.PATCH('/entities/{entity_id}/records/{record_id}', {
      params: { path: { entity_id, record_id: id } }, body: { changes, expected_updated_at: current.updated_at } as never,
    }));
  }

  async function remove(key: EntityKey, id: string): Promise<void> {
    const entity_id = await entityId(key);
    const current = await read(key, id);
    await ok(host.api.DELETE('/entities/{entity_id}/records/{record_id}', {
      params: { path: { entity_id, record_id: id }, query: { expected_updated_at: current.updated_at } as never },
    }));
  }

  const orderPayload = (o: OrderDraft): Body => ({
    ten_kh: o.ten_kh, ma_kh: o.ma_kh, mst: o.mst, nguoi_lien_he: o.nguoi_lien_he, noi_dung: o.noi_dung, so_hd_noi_bo: o.so_hd_noi_bo,
    am: o.am, is: o.is, hang_kh: o.hang_kh, cong_no_ngay: o.cong_no_ngay, nv_trien_khai: o.nv_trien_khai || null, nv_tu_van: o.nv_tu_van || null,
    tv_proposal: o.tv_proposal, tv_poc: o.tv_poc, loai_hd_chon: o.loai_hd_chon || null, tu_truoc: o.tu_truoc,
  });
  const linePayload = (donId: string, l: LineDraft, stt: number): Body => ({
    don_hang: donId, stt, sku: l.sku, mo_ta: l.mo_ta, dvt: l.dvt, so_luong: l.so_luong, loai: l.loai, so_thang: l.so_thang, gia_mua: l.gia_mua, ncc: l.ncc,
  });

  /** Id các task trong My Work của người xem (việc họ giữ hoặc được giao). */
  async function workIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: { items: { id: string }[]; next_cursor: string | null } = (await ok(host.api.GET('/work', {
        params: { query: { view: 'all', ...(cursor ? { cursor } : {}) } as never },
      }))) as never;
      for (const x of page.items) ids.add(x.id);
      cursor = page.next_cursor;
    } while (cursor);
    return ids;
  }

  return {
    me,

    async listOrders(): Promise<OrderRow[]> {
      const [orders, finance] = await Promise.all([
        queryAll('don_hang', [], 'created_at', 'desc'),
        queryAll('tai_chinh_don').catch(() => [] as Wire[]),
      ]);
      const revenue = new Map<string, number>();
      for (const f of finance) {
        try { revenue.set(str(bodyOf(f).don_hang), (JSON.parse(str(bodyOf(f).pl_chot)) as PlResult).revenue); } catch { /* chưa chốt */ }
      }
      return orders.map((o) => {
        const b = bodyOf(o);
        return { id: o.id, ma_don: str(b.ma_don), ten_kh: str(b.ten_kh), am: o.ref_labels?.am?.[str(b.am)] ?? '', trang_thai: str(b.trang_thai),
          giai_doan: num(b.giai_doan), revenue: revenue.get(o.id) ?? null };
      });
    },

    async loadOrder(id: string): Promise<LoadedOrder> {
      const rec = await read('don_hang', id);
      const b = bodyOf(rec);
      const [dong, prices, finance, tasks, mine] = await Promise.all([
        queryAll('dong_hang', [{ field: 'don_hang', op: 'eq', value: id }], 'stt'),
        queryAll('gia_ban_dong', [{ field: 'don_hang', op: 'eq', value: id }]).catch(() => null),
        queryAll('tai_chinh_don', [{ field: 'don_hang', op: 'eq', value: id }]).catch(() => null),
        queryAll('task', [{ field: 'don_hang', op: 'eq', value: id }]),
        workIds().catch(() => new Set<string>()),
      ]);
      const priceOf = new Map((prices ?? []).map((p) => [str(bodyOf(p).dong_hang), p]));
      const fin = finance?.[0];
      const fb = fin ? bodyOf(fin) : {};
      let locked: LoadedOrder['locked'] = null;
      if (fb.pl_chot) { try { locked = { result: JSON.parse(str(fb.pl_chot)) as PlResult, at: str(fb.chot_luc) || null }; } catch { locked = null; } }
      return {
        order: {
          id, financeId: fin?.id, ten_kh: str(b.ten_kh), ma_kh: str(b.ma_kh), mst: str(b.mst), nguoi_lien_he: str(b.nguoi_lien_he), noi_dung: str(b.noi_dung),
          so_hd_noi_bo: str(b.so_hd_noi_bo), am: str(b.am), is: str(b.is), hang_kh: (str(b.hang_kh) || 'pho_thong') as OrderDraft['hang_kh'],
          cong_no_ngay: num(b.cong_no_ngay), cpbh: num(fb.cpbh), nv_trien_khai: str(b.nv_trien_khai), nv_tu_van: str(b.nv_tu_van),
          tv_proposal: b.tv_proposal === true, tv_poc: b.tv_poc === true, loai_hd_chon: str(b.loai_hd_chon), tu_truoc: b.tu_truoc === true,
        },
        lines: dong.map((d) => {
          const db = bodyOf(d); const p = priceOf.get(d.id); const pb = p ? bodyOf(p) : {};
          return { id: d.id, priceId: p?.id, sku: str(db.sku), mo_ta: str(db.mo_ta), dvt: str(db.dvt), so_luong: num(db.so_luong), loai: str(db.loai) || 'tb',
            so_thang: num(db.so_thang), gia_mua: num(db.gia_mua), don_gia_ban: num(pb.don_gia_ban), chiet_khau: num(pb.chiet_khau), ncc: str(db.ncc) };
        }),
        trang_thai: str(b.trang_thai), ma_don: str(b.ma_don), giai_doan: num(b.giai_doan), locked,
        seesMoney: prices !== null && finance !== null,
        workIds: mine,
        tasks: tasks.map((t) => {
          const tb = bodyOf(t);
          return { id: t.id, ma: str(tb.ma), trang_thai: str(tb.trang_thai) as TaskRow['trang_thai'], vai_tro: str(tb.vai_tro), claimedBy: str(tb.claimed_by) || null };
        }),
      };
    },

    /** Tạo đơn mới cùng dòng hàng, giá bán, tài chính và task t11. Trả id đơn. */
    async createOrder(o: OrderDraft, lines: LineDraft[]): Promise<string> {
      const don = await create('don_hang', orderPayload(o));
      await create('tai_chinh_don', { don_hang: don.id, cpbh: o.cpbh });
      for (const [i, l] of lines.entries()) {
        const dong = await create('dong_hang', linePayload(don.id, l, i + 1));
        await create('gia_ban_dong', { dong_hang: dong.id, don_hang: don.id, don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau });
      }
      await create('task', { don_hang: don.id, ma: 't11', vai_tro: 'am', trang_thai: 'dang_lam', am: o.am, is: o.is });
      return don.id;
    },

    /** Lưu đơn đang sửa: sửa đơn và CPBH, sửa/tạo/xóa dòng và giá bán. */
    async saveOrder(o: OrderDraft, lines: LineDraft[], before: LineDraft[]): Promise<void> {
      const id = o.id!;
      await patch('don_hang', id, orderPayload(o));
      if (o.financeId) await patch('tai_chinh_don', o.financeId, { cpbh: o.cpbh });
      const keep = new Set(lines.map((l) => l.id).filter(Boolean));
      for (const gone of before.filter((l) => l.id && !keep.has(l.id))) await remove('dong_hang', gone.id!);
      for (const [i, l] of lines.entries()) {
        if (l.id) {
          await patch('dong_hang', l.id, linePayload(id, l, i + 1));
          if (l.priceId) await patch('gia_ban_dong', l.priceId, { don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau });
        } else {
          const dong = await create('dong_hang', linePayload(id, l, i + 1));
          await create('gia_ban_dong', { dong_hang: dong.id, don_hang: id, don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau });
        }
      }
    },

    /** Task đang chờ người xem: các task `dang_lam` họ đọc được (quyền do server lọc), kèm đơn của chúng. */
    async myTasks(): Promise<MyTask[]> {
      const [all, mine] = await Promise.all([queryAll('task', [{ field: 'trang_thai', op: 'eq', value: 'dang_lam' }]), workIds()]);
      const tasks = onlyMine(all, mine);
      const orders = await queryAll('don_hang').catch(() => [] as Wire[]);
      const code = new Map(orders.map((o) => [o.id, str(bodyOf(o).ma_don)]));
      return tasks.map((t) => {
        const b = bodyOf(t);
        const orderId = str(b.don_hang);
        return { id: t.id, ma: str(b.ma), orderId, orderCode: code.get(orderId) ?? orderId, kind: TASK_KIND[str(b.ma)] ?? 'do' };
      });
    },

    /** Người làm task: nhận task nếu chưa giữ (task giao cho nhóm), rồi đổi trạng thái. Trả lại ghi lý do lên task. */
    async actOnTask(taskId: string, status: 'xong' | 'tra_lai', reason: string): Promise<void> {
      const entity_id = await entityId('task');
      const rec = await read('task', taskId);
      if (!str(bodyOf(rec).claimed_by)) {
        try {
          await ok(host.api.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id, record_id: taskId } } }));
        } catch { /* đã được giao thẳng cho người này, hoặc đã nhận */ }
      }
      await patch('task', taskId, reason ? { trang_thai: status, ly_do: reason } : { trang_thai: status });
    },

    emptyOrder: () => emptyOrder(me),
  };
}

export type Api = ReturnType<typeof makeApi>;
