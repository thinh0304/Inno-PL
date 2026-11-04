// Luật mở task của quy trình (spec §7). Hàm thuần: Code step điều phối và module dùng chung.
import { TASK_CODES, type TaskCode } from './config';

export { TASK_CODES, type TaskCode } from './config';

export type Role = 'am' | 'is' | 'tm' | 'proc' | 'sd' | 'acc';
export type TaskStatus = 'cho' | 'dang_lam' | 'xong' | 'khong_ap_dung' | 'bo_qua' | 'tra_lai' | 'yeu_cau_sua' | 'huy';
/** Task "yêu cầu" do IS tạo (Close-lost, Xin duyệt lại): không phải bước của quy trình, điều phối xử lý rồi hủy. */
export type RequestCode = 'yc_close_lost' | 'yc_xin_duyet_lai';
export type OrderStatus = 'nhap' | 'dang_xu_ly' | 'tra_lai' | 'da_phe_duyet' | 'hoan_tat' | 'close_lost';

export interface TaskDef {
  code: TaskCode;
  role: Role;
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  requires: TaskCode[];
  when: 'always' | 'service' | 'goods';
  optional: boolean;
  kind: 'submit' | 'approve' | 'do' | 'draft_review';
}

const def = (code: TaskCode, role: Role, stage: TaskDef['stage'], requires: TaskCode[], when: TaskDef['when'],
  kind: TaskDef['kind'], optional = false): TaskDef => ({ code, role, stage, requires, when, optional, kind });

/** Bảng §7.2. Tiền đề có điều kiện (t51 trước t61/t62 khi KH tạm ứng trước) thêm trong `requiresOf`. */
export const TASKS: Record<TaskCode, TaskDef> = {
  t11: def('t11', 'am', 1, [], 'always', 'submit'),
  t22: def('t22', 'tm', 2, ['t11'], 'service', 'approve'),
  t23: def('t23', 'proc', 2, ['t11'], 'goods', 'do'),
  t31: def('t31', 'sd', 3, ['t22', 't23'], 'always', 'approve'),
  t40: def('t40', 'is', 4, ['t31'], 'always', 'do'),
  t44: def('t44', 'proc', 4, ['t31'], 'goods', 'do'),
  t42: def('t42', 'sd', 4, ['t40', 't44'], 'always', 'draft_review'),
  t41: def('t41', 'is', 4, ['t42'], 'always', 'do'),
  t45: def('t45', 'proc', 4, ['t42'], 'goods', 'do'),
  t51: def('t51', 'acc', 5, ['t41'], 'always', 'do', true),
  t53: def('t53', 'acc', 5, ['t45'], 'goods', 'do', true),
  t61: def('t61', 'proc', 6, ['t45', 't53'], 'goods', 'do'),
  t62: def('t62', 'tm', 6, ['t41'], 'service', 'do'),
  t71: def('t71', 'acc', 7, ['t61', 't62'], 'always', 'do'),
  t72: def('t72', 'acc', 7, ['t71'], 'always', 'do'),
};

export interface FlowOrder {
  hasService: boolean;
  hasGoods: boolean;
  /** "KH tạm ứng trước khi giao / triển khai": t61, t62 chờ thêm t51. */
  advanceFirst: boolean;
  revenue: number;
  passed: boolean;
  /** Trạng thái hiện tại của đơn, để chỉ chốt P&L lúc vừa phê duyệt. */
  status?: OrderStatus;
  /** Đơn đang chờ SD duyệt lại sau "Xin duyệt lại" (§12.6). */
  reapproval?: boolean;
}

export interface FlowTask { id: string; code: TaskCode | RequestCode; status: TaskStatus }

export interface FlowActions {
  create: { code: TaskCode; role: Role; status: 'dang_lam' | 'bo_qua' | 'xong' }[];
  update: { id: string; status: TaskStatus }[];
  order: { status?: 'dang_xu_ly' | 'tra_lai' | 'da_phe_duyet' | 'hoan_tat' | 'close_lost'; stage?: number; lockPl?: boolean; choDuyetLai?: boolean };
  flags?: { closeLost?: boolean; closeLostRejected?: boolean; reapproval?: boolean; reapprovalRejected?: boolean; draftRevision?: boolean; completed?: boolean };
}

const DONE: readonly TaskStatus[] = ['xong', 'khong_ap_dung', 'bo_qua'];
const AUTO_APPROVE_MAX = 300_000_000;

const applies = (d: TaskDef, o: FlowOrder): boolean =>
  d.when === 'always' || (d.when === 'service' ? o.hasService : o.hasGoods);

const requiresOf = (d: TaskDef, o: FlowOrder): TaskCode[] =>
  o.advanceFirst && (d.code === 't61' || d.code === 't62') ? [...d.requires, 't51'] : d.requires;

/**
 * Việc điều phối phải làm, tính lại hoàn toàn từ dữ liệu hiện có (gọi lại bao nhiêu lần cũng không tạo trùng).
 * `scope` giới hạn các task được tạo: Phase 1 truyền t11–t31.
 */
export function nextActions(order: FlowOrder, allTasks: FlowTask[], scope: readonly TaskCode[]): FlowActions {
  const requests = allTasks.filter((x): x is FlowTask & { code: RequestCode } => x.code.startsWith('yc_') && x.status === 'dang_lam');
  const tasks = allTasks.filter((x) => !x.code.startsWith('yc_')) as (FlowTask & { code: TaskCode })[];
  const live = tasks.filter((x) => x.status !== 'huy');
  const dropRequests = (): FlowActions['update'] => requests.map((r) => ({ id: r.id, status: 'huy' as const }));
  const request = (code: RequestCode) => requests.find((r) => r.code === code);
  const doneNow = (c: TaskCode) => live.some((x) => x.code === c && DONE.includes(x.status));

  if (order.status === 'close_lost' || order.status === 'hoan_tat') return { create: [], update: dropRequests(), order: {} };

  // Close-lost của IS: được tới hết t41 (spec §7.4), sau đó bị từ chối.
  if (request('yc_close_lost')) {
    if (doneNow('t41')) return { create: [], update: dropRequests(), order: {}, flags: { closeLostRejected: true } };
    return { create: [], update: [...live.map((x) => ({ id: x.id, status: 'huy' as const })), ...dropRequests()], order: { status: 'close_lost' }, flags: { closeLost: true } };
  }

  // Xin duyệt lại (§12.6): chỉ khi đơn đã phê duyệt; hủy GĐ4 trở đi, mở t31 mới cho SD, không tự duyệt.
  if (request('yc_xin_duyet_lai')) {
    if (order.status !== 'da_phe_duyet') return { create: [], update: dropRequests(), order: {}, flags: { reapprovalRejected: true } };
    const stage4 = live.filter((x) => TASKS[x.code].stage >= 4 || x.code === 't31');
    return {
      create: [{ code: 't31', role: 'sd', status: 'dang_lam' }],
      update: [...stage4.map((x) => ({ id: x.id, status: 'huy' as const })), ...dropRequests()],
      order: { status: 'dang_xu_ly', stage: 3, choDuyetLai: true },
      flags: { reapproval: true },
    };
  }

  if (live.some((x) => x.status === 'tra_lai')) {
    return {
      create: [{ code: 't11', role: 'am', status: 'dang_lam' }],
      update: live.map((x) => ({ id: x.id, status: 'huy' as const })),
      order: { status: 'tra_lai', stage: 1, choDuyetLai: false },
    };
  }

  // t42 "Yêu cầu sửa dự thảo": hủy t42 cùng t40, t44 để mở lại (task cũ giữ trong lịch sử).
  const revise = live.some((x) => x.code === 't42' && x.status === 'yeu_cau_sua');
  const update: FlowActions['update'] = [];
  const gone = new Set<string>();
  if (revise) {
    for (const x of live.filter((y) => y.code === 't42' || y.code === 't40' || y.code === 't44')) { update.push({ id: x.id, status: 'huy' }); gone.add(x.id); }
  }
  const kept = live.filter((x) => !gone.has(x.id));

  const status = new Map<TaskCode, TaskStatus>(kept.map((x) => [x.code, x.status]));
  const isDone = (c: TaskCode) => DONE.includes(status.get(c) as TaskStatus);
  const create: FlowActions['create'] = [];

  for (let changed = true; changed; ) {
    changed = false;
    for (const code of TASK_CODES) {
      const d = TASKS[code];
      if (!scope.includes(code) || d.kind === 'submit' || status.has(code)) continue;
      if (!requiresOf(d, order).every(isDone)) continue;
      let s: 'dang_lam' | 'bo_qua' | 'xong' = applies(d, order) ? 'dang_lam' : 'bo_qua';
      if (code === 't31' && !order.reapproval && order.revenue <= AUTO_APPROVE_MAX && !order.hasGoods && order.passed) s = 'xong';
      create.push({ code, role: d.role, status: s });
      status.set(code, s);
      changed = true;
    }
  }

  // t11 đang chờ AM (đơn vừa bị trả lại hoặc còn nháp): một lượt chạy muộn không được ghi đè trạng thái đơn.
  if (status.get('t11') === 'dang_lam') return { create, update: [], order: {} };

  const approved = isDone('t31');
  const completed = isDone('t72');
  const pending = scope.filter((c) => !isDone(c) && (status.has(c) || TASKS[c].kind !== 'submit'));
  const stage = completed ? 7 : pending.length ? Math.min(...pending.map((c) => TASKS[c].stage)) : Math.max(...scope.map((c) => TASKS[c].stage)) + 1;
  const firstWave = create.some((c) => TASKS[c.code].requires.includes('t11'));
  const justApproved = approved && order.status !== 'da_phe_duyet';

  return {
    create,
    update,
    order: {
      status: completed ? 'hoan_tat' : approved ? 'da_phe_duyet' : 'dang_xu_ly',
      stage,
      ...(firstWave || justApproved ? { lockPl: true } : {}),
      ...(order.reapproval ? { choDuyetLai: !approved } : {}),
    },
    ...(revise || completed ? { flags: { ...(revise ? { draftRevision: true } : {}), ...(completed ? { completed: true } : {}) } } : {}),
  };
}
