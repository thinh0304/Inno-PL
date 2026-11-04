// Code step `dieu_phoi` của workflow điều phối: đọc đơn + task + dòng hàng, quyết định task nào mở, chốt P&L khi cần.
// Bundle bởi scripts/build-code.mjs thành config/code/dieu-phoi.js; `main(inputs)` gọi `run`.
import { DEFAULT_CONFIG, type PlConfig, type TaskCode } from '../domain/config';
import { type FlowTask, type OrderStatus, type Role, type TaskStatus, nextActions } from '../domain/flow';
import { CONTRACT_KIND_OF_CODE, LINE_TYPE_OF_CODE } from '../domain/codes';
import { type Line, isGoods, isService } from '../domain/lines';
import { type CustomerTier, computePl } from '../domain/pl';

/** Phase 1 chỉ mở t11–t31 (lộ trình Phase 3 mở hết). */
export const SCOPE: TaskCode[] = ['t11', 't22', 't23', 't31'];

type Rec = Record<string, unknown> & { id: string };

export interface DieuPhoiInputs {
  don: unknown;
  tasks: unknown;
  dong: unknown;
  gia_ban: unknown;
  tai_chinh: unknown;
  cau_hinh: unknown;
  /** Id nhóm của các tham số nhom_*, đọc bằng readParameters (một input mỗi nhóm). */
  nhom_tm: string;
  nhom_proc: string;
  nhom_sd: string;
  nhom_acc: string;
}

export interface DieuPhoiOutput {
  tao: { don_hang: string; ma: TaskCode; vai_tro: Role; trang_thai: TaskStatus; sla_ngay: number; am: string | null; is: string | null; nhom: string[] }[];
  cap_nhat: { id: string; trang_thai: TaskStatus }[];
  don: { trang_thai: string; giai_doan: number; co_dich_vu: boolean; co_hang_hoa: boolean; ky_thuat: string[]; mua_hang: string[] };
  chot: null | { pl_chot: string; cau_hinh_chot: string; ln_thuan_chot: number; dat_chot: boolean };
}

/** Bản ghi API có thể để trường dưới `body` (AGENTS.md) hoặc phẳng; trả về dạng phẳng có `id`. */
const flat = (r: unknown): Rec => {
  const o = (r ?? {}) as Record<string, unknown>;
  return (o.body && typeof o.body === 'object' ? { ...(o.body as object), id: o.id } : o) as Rec;
};
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.map(flat) : []);
const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as Rec).id) : v ? String(v) : null);

function mergeConfig(base: PlConfig, raw: unknown): PlConfig {
  let over: unknown = {};
  try { over = JSON.parse(String(raw || '{}')); } catch { over = {}; }
  const merge = (a: unknown, b: unknown): unknown => {
    if (!b || typeof b !== 'object' || Array.isArray(b) || !a || typeof a !== 'object' || Array.isArray(a)) return b ?? a;
    const out: Record<string, unknown> = { ...(a as object) };
    for (const [k, v] of Object.entries(b)) out[k] = merge((a as Record<string, unknown>)[k], v);
    return out;
  };
  return merge(base, over) as PlConfig;
}

export function run(inputs: DieuPhoiInputs): DieuPhoiOutput {
  const don = flat(inputs.don);
  const tasks = list(inputs.tasks);
  const prices = new Map(list(inputs.gia_ban).map((p) => [idOf(p.dong_hang), p]));
  const finance = list(inputs.tai_chinh)[0];
  const cfg = mergeConfig(DEFAULT_CONFIG, list(inputs.cau_hinh)[0]?.gia_tri);
  const groups: Record<'tm' | 'proc' | 'sd' | 'acc', string> = {
    tm: inputs.nhom_tm, proc: inputs.nhom_proc, sd: inputs.nhom_sd, acc: inputs.nhom_acc,
  };

  const lines: Line[] = list(inputs.dong).map((l) => {
    const p = prices.get(l.id);
    return { type: LINE_TYPE_OF_CODE[String(l.loai)] ?? 'TB', qty: n(l.so_luong), sell: n(p?.don_gia_ban), discountPct: n(p?.chiet_khau),
      buy: n(l.gia_mua), months: n(l.so_thang) };
  });
  const pl = computePl({
    lines, tier: (don.hang_kh as CustomerTier) || 'pho_thong', creditDays: n(don.cong_no_ngay), salesCost: n(finance?.cpbh),
    chosenKind: don.loai_hd_chon ? CONTRACT_KIND_OF_CODE[String(don.loai_hd_chon)] : undefined,
    deployStaff: !!don.nv_trien_khai, consultStaff: !!don.nv_tu_van, proposal: !!don.tv_proposal, poc: !!don.tv_poc,
  }, cfg);

  const hasService = lines.some((l) => isService(l.type));
  const hasGoods = lines.some((l) => isGoods(l.type));
  // Máy chủ không tin module: t11 "xong" mà đơn chưa có dòng nào thì trả lại cho AM thay vì mở task cho người khác.
  const flowTasks: FlowTask[] = tasks.map((t) => ({
    id: t.id, code: t.ma as TaskCode,
    status: t.ma === 't11' && t.trang_thai === 'xong' && lines.length === 0 ? 'tra_lai' : (t.trang_thai as TaskStatus),
  }));
  const actions = nextActions(
    { hasService, hasGoods, advanceFirst: !!don.tu_truoc, revenue: pl.revenue, passed: pl.passed, status: don.trang_thai as OrderStatus },
    flowTasks, SCOPE,
  );

  const groupOf = (role: Role): string[] => (role === 'am' || role === 'is' ? [] : [groups[role]]);
  return {
    tao: actions.create.map((c) => ({ don_hang: don.id, ma: c.code, vai_tro: c.role, trang_thai: c.status, sla_ngay: cfg.slaDays[c.code] ?? 0,
      am: idOf(don.am), is: idOf(don.is), nhom: groupOf(c.role) })),
    cap_nhat: actions.update.map((u) => ({ id: u.id, trang_thai: u.status })),
    don: { trang_thai: actions.order.status ?? String(don.trang_thai), giai_doan: actions.order.stage ?? n(don.giai_doan),
      co_dich_vu: hasService, co_hang_hoa: hasGoods, ky_thuat: hasService ? [groups.tm] : [], mua_hang: hasGoods ? [groups.proc] : [] },
    chot: actions.order.lockPl
      ? { pl_chot: JSON.stringify(pl), cau_hinh_chot: JSON.stringify(cfg), ln_thuan_chot: pl.netProfit, dat_chot: pl.passed }
      : null,
  };
}
