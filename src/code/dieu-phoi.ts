// Code step `dieu_phoi` của workflow điều phối: đọc đơn + task + dòng hàng, quyết định task nào mở, chốt P&L khi cần.
// Bundle bởi scripts/build-code.mjs thành config/code/dieu-phoi.js; `main(inputs)` gọi `run`.
import { DEFAULT_CONFIG, TASK_CODES, type PlConfig, type TaskCode } from '../domain/config';
import { type FlowTask, type OrderStatus, type Role, type TaskStatus, nextActions } from '../domain/flow';
import { isGoods, isService } from '../domain/lines';
import { computePl } from '../domain/pl';
import { plInputFromForm } from '../domain/plinput';
import { checkProposals, type Proposal } from '../domain/purchase';
import { type Rec, flat, formFromRecords, idOf, list, n, str } from '../domain/records';
import { renewalOf } from '../domain/renewal';
import { lateness, parseTime } from '../domain/sla';
import { recipientsOf } from '../domain/stages';
import { summaryFor } from '../domain/summary';
import { validateOrder } from '../domain/validate';

/** Từ Phase 3 điều phối mở đủ 15 task. */
export const SCOPE: readonly TaskCode[] = TASK_CODES;

export interface DieuPhoiInputs {
  don: unknown;
  tasks: unknown;
  dong: unknown;
  gia_ban: unknown;
  tai_chinh: unknown;
  cau_hinh: unknown;
  /** Đề xuất giá mua của PROC (t23). */
  de_xuat: unknown;
  /** Task vừa kích hoạt lượt chạy, để ghi cảnh báo hoàn thành quá hạn. */
  kich_hoat: unknown;
  /** Id nhóm của các tham số nhom_*, đọc bằng readParameters (một input mỗi nhóm). */
  nhom_tm: string;
  nhom_proc: string;
  nhom_sd: string;
  nhom_acc: string;
}

export interface DieuPhoiOutput {
  /** Lượt này có ghi đơn, tạo task, tóm tắt không; false khi chỉ hủy một yêu cầu bị từ chối. */
  ghi: boolean;
  tao: { don_hang: string; ma: TaskCode; vai_tro: Role; trang_thai: TaskStatus; sla_ngay: number; am: string | null; is: string | null; nhom: string[] }[];
  /** Task không theo dõi hạn (N = 0): tạo không kèm `han`. */
  tao_khong_han: DieuPhoiOutput['tao'];
  cap_nhat: { id: string; trang_thai: TaskStatus }[];
  don: {
    trang_thai: string; giai_doan: number; co_dich_vu: boolean; co_hang_hoa: boolean; ky_thuat: string[]; mua_hang: string[];
    nguoi_duoc_chia: string[]; ly_do_gui: string; cho_duyet_lai: boolean; ngay_het_han: string; theo_doi_tai_ky: boolean;
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

const dateOnly = (v: unknown): string | null => /^(\d{4}-\d{2}-\d{2})/.exec(str(v))?.[1] ?? null;

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

  // Task yêu cầu (Close-lost, Xin duyệt lại): chỉ AM hoặc IS của đơn tạo được, và phải có lý do.
  // Spec §7.4: Close-lost và Xin duyệt lại do IS.
  const isId = idOf(don.is);
  const badRequest = (t: Rec) => str(t.ma).startsWith('yc_') && t.trang_thai === 'dang_lam' && (!isId || idOf(t.nguoi_tao) !== isId || !str(t.ly_do).trim());
  const rejected = tasks.filter(badRequest);

  // t23 "xong" khi chưa đủ đề xuất giá mua: mở lại t23 (task cũ bị hủy), không mở t31.
  const proposals: Proposal[] = list(inputs.de_xuat).map((p) => ({
    dong_hang: idOf(p.dong_hang) ?? '', gia_mua_de_xuat: p.gia_mua_de_xuat == null ? null : n(p.gia_mua_de_xuat), ncc_id: idOf(p.ncc_id) ?? '', ly_do: str(p.ly_do),
  }));
  const t23 = tasks.find((t) => t.ma === 't23' && t.trang_thai === 'xong');
  const t31Exists = tasks.some((t) => t.ma === 't31' && t.trang_thai !== 'huy');
  const proposalIssues = t23 && !t31Exists ? checkProposals(lines, proposals) : [];
  const reopenT23 = proposalIssues.length > 0 && !!t23;

  const dropped = new Set<string>([...rejected.map((t) => t.id), ...(reopenT23 ? [t23!.id] : [])]);
  const flowTasks: FlowTask[] = tasks.filter((t) => !dropped.has(t.id)).map((t) => ({
    id: t.id, code: str(t.ma) as FlowTask['code'], status: gated && t.ma === 't11' && t.trang_thai === 'xong' ? 'tra_lai' : (t.trang_thai as TaskStatus),
  }));
  const actions = nextActions(
    { hasService, hasGoods, advanceFirst: order.tu_truoc, revenue: pl.revenue, passed: pl.passed, status: status as OrderStatus, reapproval: don.cho_duyet_lai === true },
    flowTasks, SCOPE,
  );
  for (const id of dropped) actions.update.push({ id, status: 'huy' });

  const returned = tasks.find((t) => t.trang_thai === 'tra_lai');
  const returning = gated || !!returned;
  const reason = gated ? issues.map((i) => i.field).join(', ') : str(returned?.ly_do);
  const locked = !!actions.order.lockPl;
  const newStatus = actions.order.status ?? status;
  const newStage = actions.order.stage ?? n(don.giai_doan);

  const groupOf = (role: Role): string[] => (role === 'am' || role === 'is' ? [] : [groups[role]]);
  const history = (hanh_dong: string, task = '', ghi_chu = '', sau = '') => ({ don_hang: don.id, hanh_dong, task, ghi_chu, sau });
  const lich_su: DieuPhoiOutput['lich_su'] = [];
  const request = tasks.find((t) => str(t.ma).startsWith('yc_') && t.trang_thai === 'dang_lam' && !dropped.has(t.id));
  const flags = actions.flags ?? {};
  if (gated) lich_su.push(history('tra_lai_may_chu', 't11', reason));
  else if (returned) lich_su.push(history('tra_lai', str(returned.ma), reason));
  else if (actions.create.some((c) => (c.code === 't22' || c.code === 't23') && !reopenT23)) lich_su.push(history('gui_duyet', 't11'));
  if (reopenT23) lich_su.push(history('tra_lai_may_chu', 't23', proposalIssues.map((i) => i.field).join(', ')));
  for (const t of rejected) lich_su.push(history('tu_choi_yeu_cau', str(t.ma), str(t.ly_do) || 'thiếu lý do hoặc không phải IS của đơn'));
  if (flags.closeLost && request) lich_su.push(history('close_lost', '', str(request.ly_do)));
  if (flags.closeLostRejected && request) lich_su.push(history('tu_choi_yeu_cau', str(request.ma), 'đã qua t41'));
  if (flags.reapproval && request) lich_su.push(history('xin_duyet_lai', 't31', str(request.ly_do)));
  if (flags.reapprovalRejected && request) lich_su.push(history('tu_choi_yeu_cau', str(request.ma), 'đơn chưa ở trạng thái đã phê duyệt'));
  if (flags.draftRevision) lich_su.push(history('yeu_cau_sua', 't42', str(tasks.find((t) => t.ma === 't42' && t.trang_thai === 'yeu_cau_sua')?.ly_do)));
  if (!returning) for (const c of actions.create) lich_su.push(history('mo_task', c.code, c.status));
  for (const u of actions.update) {
    const old = tasks.find((t) => t.id === u.id);
    if (old && !str(old.ma).startsWith('yc_')) lich_su.push(history('huy_task', str(old.ma), ''));
  }
  if (locked && !returning) lich_su.push(history('chot_pl', '', '', String(pl.netProfit)));
  if (actions.order.status === 'da_phe_duyet' && status !== 'da_phe_duyet') lich_su.push(history('phe_duyet', 't31'));

  // "Hoàn tất GĐn" khi đơn sang giai đoạn sau (spec §7.1), và khi hoàn tất cả đơn.
  if (!returning && newStatus !== 'close_lost') {
    const from = n(don.giai_doan);
    const to = newStatus === 'hoan_tat' ? 8 : newStage;
    for (let g = Math.max(from, 1); g < to && from > 0; g += 1) lich_su.push(history('hoan_tat_gd', '', `GĐ${g}`));
  }
  if (flags.completed) lich_su.push(history('hoan_tat', 't72'));

  // Cảnh báo hoàn thành task quá hạn (§7.5).
  const trigger = flat(inputs.kich_hoat);
  if (trigger.trang_thai === 'xong' && !str(trigger.ma).startsWith('yc_')) {
    const done = parseTime(str(trigger.done_at)) ?? Date.now();
    const late = lateness(str(trigger.han) || null, done);
    if (!late.onTime) lich_su.push(history('canh_bao', str(trigger.ma), `Hoàn thành quá hạn, trễ ${late.daysLate} ngày`, 'qua_han'));
  }

  // Đi tiếp khi P&L không đạt ngưỡng (t11 gửi, t31 duyệt): lý do người dùng ghi trên task được lưu thành cảnh báo.
  if (trigger.trang_thai === 'xong' && (trigger.ma === 't11' || trigger.ma === 't31') && !pl.passed && !returning) {
    lich_su.push(history('canh_bao', str(trigger.ma), str(trigger.ly_do) || 'không có lý do', 'pl_khong_dat'));
  }

  const tom_tat: DieuPhoiOutput['tom_tat'] = [];
  if (locked && !returning) {
    if (hasService) tom_tat.push({ don_hang: don.id, phan: 'dich_vu', du_lieu: JSON.stringify(summaryFor('dich_vu', plInput.lines, pl, cfg)), nhom_xem: [groups.tm] });
    if (hasGoods) tom_tat.push({ don_hang: don.id, phan: 'hang_hoa', du_lieu: JSON.stringify(summaryFor('hang_hoa', plInput.lines, pl, cfg)), nhom_xem: [groups.proc] });
  }

  // Hoàn tất: ngày hết hạn và cờ theo dõi tái ký cho CRM (§7.4); ngày giao là lúc t61 xong.
  const t61 = tasks.find((t) => t.ma === 't61' && t.trang_thai === 'xong');
  const renewal = flags.completed ? renewalOf(lines, dateOnly(t61?.done_at)) : { ngay_het_han: str(don.ngay_het_han), theo_doi_tai_ky: don.theo_doi_tai_ky === true };

  const toTask = (c: (typeof actions.create)[number]) => ({ don_hang: don.id, ma: c.code, vai_tro: c.role, trang_thai: c.status, sla_ngay: cfg.slaDays[c.code] ?? 0,
    am: idOf(don.am), is: idOf(don.is), nhom: groupOf(c.role) });
  // Lượt do một yêu cầu bị từ chối khởi động chỉ hủy yêu cầu đó: việc khác đã có lượt điều phối thường lo, ghi chồng lên có thể đè trạng thái mới hơn.
  const quiet = !!flags.noWrite || (str(trigger.ma).startsWith('yc_') && rejected.some((t) => t.id === trigger.id));
  return {
    ghi: !quiet,
    tao: quiet ? [] : actions.create.map(toTask).filter((t) => t.sla_ngay > 0),
    tao_khong_han: quiet ? [] : actions.create.map(toTask).filter((t) => t.sla_ngay <= 0),
    cap_nhat: actions.update.map((u) => ({ id: u.id, trang_thai: u.status })),
    don: { trang_thai: newStatus, giai_doan: newStage,
      co_dich_vu: hasService, co_hang_hoa: hasGoods, ky_thuat: hasService ? [groups.tm] : [], mua_hang: hasGoods ? [groups.proc] : [],
      nguoi_duoc_chia: recipientsOf(order.giai_doan, { kind: order.nguon_kh, nguoi: order.nguon_kh_nguoi }),
      ly_do_gui: returning ? reason : '',
      cho_duyet_lai: actions.order.choDuyetLai ?? (don.cho_duyet_lai === true),
      ...renewal },
    chot: locked && !returning
      ? { pl_chot: JSON.stringify(pl), cau_hinh_chot: JSON.stringify(cfg), ln_thuan_chot: pl.netProfit, dat_chot: pl.passed }
      : null,
    tom_tat, lich_su,
  };
}
