// Code step `dieu_phoi` của workflow điều phối: đọc đơn + task + dòng hàng, quyết định task nào mở, chốt P&L khi cần.
// Bundle bởi scripts/build-code.mjs thành config/code/dieu-phoi.js; `main(inputs)` gọi `run`.
import { DEFAULT_CONFIG, type PlConfig, type TaskCode } from '../domain/config';
import { type FlowTask, type OrderStatus, type Role, type TaskStatus, nextActions } from '../domain/flow';
import { isGoods, isService } from '../domain/lines';
import { computePl } from '../domain/pl';
import { plInputFromForm } from '../domain/plinput';
import { flat, formFromRecords, idOf, list, n, str } from '../domain/records';
import { recipientsOf } from '../domain/stages';
import { summaryFor } from '../domain/summary';
import { validateOrder } from '../domain/validate';

/** Phase 1 chỉ mở t11–t31 (lộ trình Phase 3 mở hết). */
export const SCOPE: TaskCode[] = ['t11', 't22', 't23', 't31'];


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
  don: {
    trang_thai: string; giai_doan: number; co_dich_vu: boolean; co_hang_hoa: boolean; ky_thuat: string[]; mua_hang: string[];
    nguoi_duoc_chia: string[]; ly_do_gui: string;
  };
  chot: null | { pl_chot: string; cau_hinh_chot: string; ln_thuan_chot: number; dat_chot: boolean };
  /** Bản tóm tắt cho TM (phần dịch vụ) và PROC (phần hàng hóa); chỉ ghi khi chốt P&L. */
  tom_tat: { don_hang: string; phan: 'dich_vu' | 'hang_hoa'; du_lieu: string; nhom_xem: string[] }[];
  lich_su: { don_hang: string; hanh_dong: string; task: string; ghi_chu: string; sau: string }[];
}

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
  const cfg = mergeConfig(DEFAULT_CONFIG, list(inputs.cau_hinh)[0]?.gia_tri);
  const groups: Record<'tm' | 'proc' | 'sd' | 'acc', string> = {
    tm: inputs.nhom_tm, proc: inputs.nhom_proc, sd: inputs.nhom_sd, acc: inputs.nhom_acc,
  };

  const { order, lines } = formFromRecords({ don: inputs.don, finance: list(inputs.tai_chinh)[0], dong: inputs.dong, gia_ban: inputs.gia_ban });
  const plInput = plInputFromForm(order, lines);
  const pl = computePl(plInput, cfg);
  const hasService = plInput.lines.some((l) => isService(l.type));
  const hasGoods = plInput.lines.some((l) => isGoods(l.type));
  const status = str(don.trang_thai);

  // Máy chủ không tin module: t11 "xong" mà đơn còn thiếu hoặc sai trường thì trả lại cho AM thay vì mở task cho người khác.
  const issues = validateOrder(order, lines);
  const t11Done = tasks.some((t) => t.ma === 't11' && t.trang_thai === 'xong');
  const gated = t11Done && issues.length > 0 && (status === 'nhap' || status === 'tra_lai');
  const flowTasks: FlowTask[] = tasks.map((t) => ({
    id: t.id, code: t.ma as TaskCode, status: gated && t.ma === 't11' && t.trang_thai === 'xong' ? 'tra_lai' : (t.trang_thai as TaskStatus),
  }));
  const actions = nextActions(
    { hasService, hasGoods, advanceFirst: order.tu_truoc, revenue: pl.revenue, passed: pl.passed, status: status as OrderStatus },
    flowTasks, SCOPE,
  );
  const returned = tasks.find((t) => t.trang_thai === 'tra_lai');
  const returning = gated || !!returned;
  const reason = gated ? issues.map((i) => i.field).join(', ') : str(returned?.ly_do);
  const locked = !!actions.order.lockPl;

  const groupOf = (role: Role): string[] => (role === 'am' || role === 'is' ? [] : [groups[role]]);
  const history = (hanh_dong: string, task = '', ghi_chu = '', sau = '') => ({ don_hang: don.id, hanh_dong, task, ghi_chu, sau });
  const lich_su: DieuPhoiOutput['lich_su'] = [];
  if (gated) lich_su.push(history('tra_lai_may_chu', 't11', reason));
  else if (returned) lich_su.push(history('tra_lai', str(returned.ma), reason));
  else if (actions.create.some((c) => c.code === 't22' || c.code === 't23')) lich_su.push(history('gui_duyet', 't11'));
  if (!returning) for (const c of actions.create) lich_su.push(history('mo_task', c.code, c.status));
  for (const u of actions.update) lich_su.push(history('huy_task', tasks.find((t) => t.id === u.id)?.ma as string ?? '', ''));
  if (locked && !returning) lich_su.push(history('chot_pl', '', '', String(pl.netProfit)));
  if (actions.order.status === 'da_phe_duyet' && status !== 'da_phe_duyet') lich_su.push(history('phe_duyet', 't31'));

  const tom_tat: DieuPhoiOutput['tom_tat'] = [];
  if (locked && !returning) {
    if (hasService) tom_tat.push({ don_hang: don.id, phan: 'dich_vu', du_lieu: JSON.stringify(summaryFor('dich_vu', plInput.lines, pl, cfg)), nhom_xem: [groups.tm] });
    if (hasGoods) tom_tat.push({ don_hang: don.id, phan: 'hang_hoa', du_lieu: JSON.stringify(summaryFor('hang_hoa', plInput.lines, pl, cfg)), nhom_xem: [groups.proc] });
  }

  return {
    tao: actions.create.map((c) => ({ don_hang: don.id, ma: c.code, vai_tro: c.role, trang_thai: c.status, sla_ngay: cfg.slaDays[c.code] ?? 0,
      am: idOf(don.am), is: idOf(don.is), nhom: groupOf(c.role) })),
    cap_nhat: actions.update.map((u) => ({ id: u.id, trang_thai: u.status })),
    don: { trang_thai: actions.order.status ?? status, giai_doan: actions.order.stage ?? n(don.giai_doan),
      co_dich_vu: hasService, co_hang_hoa: hasGoods, ky_thuat: hasService ? [groups.tm] : [], mua_hang: hasGoods ? [groups.proc] : [],
      nguoi_duoc_chia: recipientsOf(order.giai_doan, { kind: order.nguon_kh, nguoi: order.nguon_kh_nguoi }),
      ly_do_gui: returning ? reason : '' },
    chot: locked && !returning
      ? { pl_chot: JSON.stringify(pl), cau_hinh_chot: JSON.stringify(cfg), ln_thuan_chot: pl.netProfit, dat_chot: pl.passed }
      : null,
    tom_tat, lich_su,
  };
}
