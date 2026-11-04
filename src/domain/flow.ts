// Luật mở task của quy trình (spec §7). Hàm thuần: Code step điều phối và module dùng chung.
import { TASK_CODES, type TaskCode } from './config';

export { TASK_CODES, type TaskCode } from './config';

export type Role = 'am' | 'is' | 'tm' | 'proc' | 'sd' | 'acc';
export type TaskStatus = 'cho' | 'dang_lam' | 'xong' | 'khong_ap_dung' | 'bo_qua' | 'tra_lai' | 'huy';
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
}

export interface FlowTask { id: string; code: TaskCode; status: TaskStatus }

export interface FlowActions {
  create: { code: TaskCode; role: Role; status: 'dang_lam' | 'bo_qua' | 'xong' }[];
  update: { id: string; status: TaskStatus }[];
  order: { status?: 'dang_xu_ly' | 'tra_lai' | 'da_phe_duyet'; stage?: number; lockPl?: boolean };
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
export function nextActions(order: FlowOrder, tasks: FlowTask[], scope: readonly TaskCode[]): FlowActions {
  const live = tasks.filter((x) => x.status !== 'huy');

  if (live.some((x) => x.status === 'tra_lai')) {
    return {
      create: [{ code: 't11', role: 'am', status: 'dang_lam' }],
      update: live.map((x) => ({ id: x.id, status: 'huy' as const })),
      order: { status: 'tra_lai', stage: 1 },
    };
  }

  const status = new Map<TaskCode, TaskStatus>(live.map((x) => [x.code, x.status]));
  const isDone = (c: TaskCode) => DONE.includes(status.get(c) as TaskStatus);
  const create: FlowActions['create'] = [];

  for (let changed = true; changed; ) {
    changed = false;
    for (const code of TASK_CODES) {
      const d = TASKS[code];
      if (!scope.includes(code) || d.kind === 'submit' || status.has(code)) continue;
      if (!requiresOf(d, order).every(isDone)) continue;
      let s: 'dang_lam' | 'bo_qua' | 'xong' = applies(d, order) ? 'dang_lam' : 'bo_qua';
      if (code === 't31' && order.revenue <= AUTO_APPROVE_MAX && !order.hasGoods && order.passed) s = 'xong';
      create.push({ code, role: d.role, status: s });
      status.set(code, s);
      changed = true;
    }
  }

  const approved = isDone('t31');
  const pending = scope.filter((c) => !isDone(c) && (status.has(c) || TASKS[c].kind !== 'submit'));
  const stage = pending.length ? Math.min(...pending.map((c) => TASKS[c].stage)) : Math.max(...scope.map((c) => TASKS[c].stage)) + 1;
  const firstWave = create.some((c) => TASKS[c.code].requires.includes('t11'));
  const justApproved = approved && order.status !== 'da_phe_duyet';

  return {
    create,
    update: [],
    order: {
      status: approved ? 'da_phe_duyet' : 'dang_xu_ly',
      stage,
      ...(firstWave || justApproved ? { lockPl: true } : {}),
    },
  };
}
