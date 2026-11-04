// Đọc và ghi bản ghi qua host.api. Id entity lấy từ GET /app/objects (getAppObjects), không viết cứng.
import { getAppObjects, ok, type AppHost, type components } from '@reflexify/agentflow-sdk';
import type { EntityKey, LogicalKey } from '../generated/app.js';
import { LINE_TYPE_OF_CODE } from '../domain/codes.js';
import { emptyOrder, type LineForm, type OrderForm } from '../domain/form.js';
import type { FlowTask } from '../domain/flow.js';
import { isGoods } from '../domain/lines.js';
import type { PlResult } from '../domain/pl.js';
import { financePayload, forCreate, formFromRecords, linePayload, orderPayload, str } from '../domain/records.js';
import { shouldCreateCustomer, type CustomerRec } from './customerBook.js';
import { onlyMine } from './model.js';
import { taskKind, type MyTask } from './screens/ViecCuaBan.js';

type Wire = components['schemas']['EntityRecord'];
type Page = components['schemas']['EntityRecordPage'];
type Body = Record<string, unknown>;

export interface OrderRow { id: string; ma_don: string; ten_kh: string; am: string; trang_thai: string; giai_doan: number; revenue: number | null }
export interface TaskRow { id: string; ma: string; trang_thai: FlowTask['status']; vai_tro: string; claimedBy: string | null; han: string | null }
export interface ProposalRow { id?: string; dong_hang: string; gia_mua_de_xuat: number | null; ncc_id: string; ly_do: string }
export type TaskAct = 'xong' | 'tra_lai' | 'yeu_cau_sua' | 'khong_ap_dung';
export interface SupplierRec { id: string; ten: string }
export interface Summary { phan: 'dich_vu' | 'hang_hoa'; data: Record<string, number> }
export interface LoadedOrder {
  order: OrderForm;
  lines: LineForm[];
  trang_thai: string;
  ma_don: string;
  giai_doan: number;
  /** Đơn đã phê duyệt đang chờ SD duyệt lại: AM, IS sửa được dòng hàng và giá (spec §12.6). */
  choDuyetLai: boolean;
  lyDoGui: string;
  locked: { result: PlResult; at: string | null } | null;
  /** false khi người xem không đọc được giá bán / tài chính (Kỹ thuật, Mua hàng): ẩn P&L, hiện bản tóm tắt phần của họ. */
  seesMoney: boolean;
  summaries: Summary[];
  /** Đề xuất giá mua của PROC; `null` khi người xem không đọc được (Kỹ thuật). */
  proposals: ProposalRow[] | null;
  tasks: TaskRow[];
  /** Task đang nằm trong My Work của người xem: chỉ với các task này mới hiện nút thao tác. */
  workIds: Set<string>;
}

const bodyOf = (r: Wire): Body => r.body as Body;
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);


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

  /** `updated_at` của từng bản ghi lúc người dùng mở đơn: lưu mà có người sửa xen vào thì báo 409, không ghi đè lặng lẽ. */
  const seen = new Map<string, string>();

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
    const expected = seen.get(id) ?? (await read(key, id)).updated_at;
    const saved = (await ok(host.api.PATCH('/entities/{entity_id}/records/{record_id}', {
      params: { path: { entity_id, record_id: id } }, body: { changes, expected_updated_at: expected } as never,
    }))) as unknown as Wire | undefined;
    if (saved?.updated_at) seen.set(id, saved.updated_at); else seen.delete(id);
  }

  async function remove(key: EntityKey, id: string): Promise<void> {
    const entity_id = await entityId(key);
    const expected = seen.get(id) ?? (await read(key, id)).updated_at;
    await ok(host.api.DELETE('/entities/{entity_id}/records/{record_id}', {
      params: { path: { entity_id, record_id: id }, query: { expected_updated_at: expected } as never },
    }));
    seen.delete(id);
  }

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

  const customerRec = (r: Wire): CustomerRec => {
    const b = bodyOf(r);
    return { id: r.id, ma_kh: str(b.ma_kh), ten: str(b.ten), mst: str(b.mst), dia_chi: str(b.dia_chi), nguoi_dai_dien: str(b.nguoi_dai_dien), chuc_vu: str(b.chuc_vu),
      so_tk: str(b.so_tk), ngan_hang: str(b.ngan_hang), nguoi_lien_he: str(b.nguoi_lien_he), email: str(b.email), dien_thoai: str(b.dien_thoai), hang_kh: str(b.hang_kh) };
  };
  const customerPayload = (o: OrderForm): Body => ({
    ma_kh: o.ma_kh, ten: o.ten_kh, mst: o.mst, dia_chi: o.dia_chi, nguoi_dai_dien: o.nguoi_dai_dien, chuc_vu: o.chuc_vu, so_tk: o.so_tk,
    ngan_hang: o.ngan_hang, hang_kh: o.hang_kh, nguoi_lien_he: o.nguoi_lien_he, email: o.email, dien_thoai: o.dien_thoai,
  });

  /** Mã KH không trùng (Review Focus): dùng hồ sơ có sẵn nếu đã có mã này, chỉ tạo khi chưa có. */
  async function ensureCustomer(o: OrderForm): Promise<string> {
    if (o.khach_hang_id) return o.khach_hang_id;
    if (!shouldCreateCustomer(o)) return '';
    const find = async () => (await queryAll('khach_hang', [{ field: 'ma_kh', op: 'eq', value: o.ma_kh }]))[0]?.id;
    const found = await find();
    if (found) return found;
    try { return (await create('khach_hang', forCreate(customerPayload(o)))).id; }
    catch (e) { const again = await find(); if (again) return again; throw e; }
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
      seen.clear();
      const rec = await read('don_hang', id);
      const b = bodyOf(rec);
      const [dong, prices, finance, tasks, mine, tomTat, de_xuat] = await Promise.all([
        queryAll('dong_hang', [{ field: 'don_hang', op: 'eq', value: id }], 'stt'),
        queryAll('gia_ban_dong', [{ field: 'don_hang', op: 'eq', value: id }]).catch(() => null),
        queryAll('tai_chinh_don', [{ field: 'don_hang', op: 'eq', value: id }]).catch(() => null),
        queryAll('task', [{ field: 'don_hang', op: 'eq', value: id }]),
        workIds().catch(() => new Set<string>()),
        queryAll('tom_tat_don', [{ field: 'don_hang', op: 'eq', value: id }]).catch(() => [] as Wire[]),
        queryAll('de_xuat_mua_hang', [{ field: 'don_hang', op: 'eq', value: id }]).catch(() => null),
      ]);
      for (const r of [rec, ...dong, ...(prices ?? []), ...(finance ?? [])]) seen.set(r.id, r.updated_at);
      const fin = finance?.[0];
      const fb = fin ? bodyOf(fin) : {};
      const { order, lines } = formFromRecords({ don: rec, finance: fin, dong, gia_ban: prices ?? [] });
      let locked: LoadedOrder['locked'] = null;
      if (fb.pl_chot) { try { locked = { result: JSON.parse(str(fb.pl_chot)) as PlResult, at: str(fb.chot_luc) || null }; } catch { locked = null; } }
      return {
        order, lines, trang_thai: str(b.trang_thai), ma_don: str(b.ma_don), giai_doan: num(b.giai_doan), lyDoGui: str(b.ly_do_gui), choDuyetLai: b.cho_duyet_lai === true, locked,
        seesMoney: prices !== null && finance !== null,
        proposals: de_xuat ? de_xuat.map((x) => { const pb = bodyOf(x); return { id: x.id, dong_hang: str(pb.dong_hang), gia_mua_de_xuat: pb.gia_mua_de_xuat == null ? null : num(pb.gia_mua_de_xuat), ncc_id: str(pb.ncc_id), ly_do: str(pb.ly_do) }; }) : null,
        summaries: tomTat.map((t) => {
          let data: Record<string, number> = {};
          try { data = JSON.parse(str(bodyOf(t).du_lieu)) as Record<string, number>; } catch { /* rỗng */ }
          return { phan: str(bodyOf(t).phan) as Summary['phan'], data };
        }),
        tasks: tasks.map((t) => {
          const tb = bodyOf(t);
          return { id: t.id, ma: str(tb.ma), trang_thai: str(tb.trang_thai) as TaskRow['trang_thai'], vai_tro: str(tb.vai_tro), claimedBy: str(tb.claimed_by) || null, han: str(tb.han) || null };
        }),
        workIds: mine,
      };
    },

    /** Tạo đơn mới cùng khách hàng (nếu mã KH chưa có), dòng hàng, giá bán, tài chính và task t11. Trả id đơn. */
    async createOrder(o: OrderForm, lines: LineForm[]): Promise<string> {
      const khach = await ensureCustomer(o);
      const ma_loai = lines.some((l) => { const t = LINE_TYPE_OF_CODE[l.loai]; return !!t && isGoods(t); }) ? 'tm' : 'dv';
      const don = await create('don_hang', { ...forCreate(orderPayload({ ...o, khach_hang_id: khach })), ma_loai });
      await create('tai_chinh_don', { don_hang: don.id, ...forCreate(financePayload(o)) });
      for (const [i, l] of lines.entries()) {
        const dong = await create('dong_hang', forCreate(linePayload(don.id, l, i + 1)));
        await create('gia_ban_dong', { dong_hang: dong.id, don_hang: don.id, don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau });
      }
      await create('task', { don_hang: don.id, ma: 't11', vai_tro: 'am', trang_thai: 'dang_lam', am: o.am, is: o.is });
      return don.id;
    },

    /** Lưu đơn đang sửa: sửa đơn và tài chính, sửa/tạo/xóa dòng và giá bán. */
    async saveOrder(o: OrderForm, lines: LineForm[], before: LineForm[]): Promise<void> {
      const id = o.id!;
      const khach = await ensureCustomer(o);
      await patch('don_hang', id, orderPayload({ ...o, khach_hang_id: khach }));
      if (o.financeId) await patch('tai_chinh_don', o.financeId, financePayload(o));
      const keep = new Set(lines.map((l) => l.id).filter(Boolean));
      for (const gone of before.filter((l) => l.id && !keep.has(l.id))) await remove('dong_hang', gone.id!);
      for (const [i, l] of lines.entries()) {
        if (l.id) {
          await patch('dong_hang', l.id, linePayload(id, l, i + 1));
          if (l.priceId) await patch('gia_ban_dong', l.priceId, { don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau });
        } else {
          const dong = await create('dong_hang', forCreate(linePayload(id, l, i + 1)));
          await create('gia_ban_dong', { dong_hang: dong.id, don_hang: id, don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau });
        }
      }
    },

    async customers(): Promise<CustomerRec[]> { return (await queryAll('khach_hang')).map(customerRec); },
    async suppliers(): Promise<SupplierRec[]> { return (await queryAll('nha_cung_cap')).map((r) => ({ id: r.id, ten: str(bodyOf(r).ten) })); },

    /** Các đơn trước của cùng khách hàng (theo mã KH), để sao chép danh mục. */
    async previousOrders(maKh: string, excludeId?: string): Promise<{ id: string; ma_don: string }[]> {
      if (!maKh.trim()) return [];
      const rows = await queryAll('don_hang', [{ field: 'ma_kh', op: 'eq', value: maKh }], 'created_at', 'desc');
      return rows.filter((r) => r.id !== excludeId).map((r) => ({ id: r.id, ma_don: str(bodyOf(r).ma_don) }));
    },
    /** Danh mục của một đơn cũ, bỏ id để lưu thành dòng mới. */
    async linesOf(orderId: string): Promise<LineForm[]> {
      const [dong, prices] = await Promise.all([queryAll('dong_hang', [{ field: 'don_hang', op: 'eq', value: orderId }], 'stt'), queryAll('gia_ban_dong', [{ field: 'don_hang', op: 'eq', value: orderId }])]);
      return formFromRecords({ don: { id: orderId, body: {} }, dong, gia_ban: prices }).lines.map((l) => ({ ...l, id: undefined, priceId: undefined }));
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
        return { id: t.id, ma: str(b.ma), orderId, orderCode: code.get(orderId) ?? orderId, kind: taskKind(str(b.ma)), han: str(b.han) || null };
      });
    },

    /** Người làm task: nhận task nếu chưa giữ (task giao cho nhóm), rồi đổi trạng thái. Trả lại ghi lý do lên task. */
    async actOnTask(taskId: string, status: TaskAct, reason: string): Promise<void> {
      const entity_id = await entityId('task');
      const rec = await read('task', taskId);
      if (!str(bodyOf(rec).claimed_by)) {
        try {
          await ok(host.api.POST('/entities/{entity_id}/records/{record_id}/work/claim', { params: { path: { entity_id, record_id: taskId } } }));
        } catch { /* đã được giao thẳng cho người này, hoặc đã nhận */ }
      }
      await patch('task', taskId, reason ? { trang_thai: status, ly_do: reason } : { trang_thai: status });
    },

    /** IS / AM của đơn gửi yêu cầu Close-lost hoặc Xin duyệt lại: một task yêu cầu, điều phối xử lý (spec §7.4, §12.6). */
    async requestOrder(orderId: string, kind: 'close_lost' | 'xin_duyet_lai', reason: string): Promise<void> {
      await create('task', { don_hang: orderId, ma: kind === 'close_lost' ? 'yc_close_lost' : 'yc_xin_duyet_lai', vai_tro: 'is', trang_thai: 'dang_lam', ly_do: reason });
    },

    /** PROC lưu đề xuất giá mua và NCC cho từng dòng TB/License (tạo hoặc sửa). */
    async saveProposals(orderId: string, rows: ProposalRow[]): Promise<void> {
      for (const r of rows) {
        const body = forCreate({ dong_hang: r.dong_hang, don_hang: orderId, gia_mua_de_xuat: r.gia_mua_de_xuat, ncc_id: r.ncc_id || null, ly_do: r.ly_do });
        if (r.id) await patch('de_xuat_mua_hang', r.id, { gia_mua_de_xuat: r.gia_mua_de_xuat, ncc_id: r.ncc_id || null, ly_do: r.ly_do });
        else await create('de_xuat_mua_hang', body);
      }
    },

    emptyOrder: () => emptyOrder(me),
  };
}

export type Api = ReturnType<typeof makeApi>;
