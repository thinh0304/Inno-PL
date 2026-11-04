import { describe, expect, it } from 'vitest';
import { type FlowOrder, type FlowTask, type RequestCode, type TaskCode, nextActions } from '../../src/domain/flow';

const P1: TaskCode[] = ['t11', 't22', 't23', 't31'];
const MIXED: FlowOrder = { hasService: true, hasGoods: true, advanceFirst: false, revenue: 500_000_000, passed: true };
const SERVICE_ONLY: FlowOrder = { hasService: true, hasGoods: false, advanceFirst: false, revenue: 250_000_000, passed: true };
const t = (id: string, code: FlowTask['code'], status: FlowTask['status']): FlowTask => ({ id, code, status });

describe('nextActions', () => {
  it('t11 xong, đơn hỗn hợp: mở t22 cho TM và t23 cho PROC, chốt P&L', () => {
    const a = nextActions(MIXED, [t('a', 't11', 'xong')], P1);
    expect(a.create).toEqual([
      { code: 't22', role: 'tm', status: 'dang_lam' },
      { code: 't23', role: 'proc', status: 'dang_lam' },
    ]);
    expect(a.update).toEqual([]);
    expect(a.order).toEqual({ status: 'dang_xu_ly', stage: 2, lockPl: true });
  });

  it('t11 xong, chỉ dịch vụ: t23 bỏ qua', () => {
    const a = nextActions(SERVICE_ONLY, [t('a', 't11', 'xong')], P1);
    expect(a.create).toEqual([
      { code: 't22', role: 'tm', status: 'dang_lam' },
      { code: 't23', role: 'proc', status: 'bo_qua' },
    ]);
  });

  it('t22 xong còn t23 đang làm: không tạo gì', () => {
    const a = nextActions(MIXED, [t('a', 't11', 'xong'), t('b', 't22', 'xong'), t('c', 't23', 'dang_lam')], P1);
    expect(a.create).toEqual([]);
    expect(a.order.lockPl).toBeFalsy();
  });

  it('t22 và t23 xong: mở đúng một t31, chạy lại không tạo trùng', () => {
    const tasks = [t('a', 't11', 'xong'), t('b', 't22', 'xong'), t('c', 't23', 'xong')];
    const first = nextActions(MIXED, tasks, P1);
    expect(first.create).toEqual([{ code: 't31', role: 'sd', status: 'dang_lam' }]);
    const again = nextActions(MIXED, [...tasks, t('d', 't31', 'dang_lam')], P1);
    expect(again.create).toEqual([]);
  });

  it('chỉ dịch vụ, ≤ 300 triệu, đạt ngưỡng: t31 tự duyệt, đơn đã phê duyệt', () => {
    const a = nextActions(SERVICE_ONLY, [t('a', 't11', 'xong'), t('b', 't22', 'xong'), t('c', 't23', 'bo_qua')], P1);
    expect(a.create).toEqual([{ code: 't31', role: 'sd', status: 'xong' }]);
    expect(a.order).toEqual({ status: 'da_phe_duyet', stage: 4, lockPl: true });
  });

  it('chỉ dịch vụ, ≤ 300 triệu nhưng không đạt ngưỡng: SD duyệt', () => {
    const a = nextActions({ ...SERVICE_ONLY, passed: false }, [t('a', 't11', 'xong'), t('b', 't22', 'xong'), t('c', 't23', 'bo_qua')], P1);
    expect(a.create).toEqual([{ code: 't31', role: 'sd', status: 'dang_lam' }]);
  });

  it('SD duyệt t31: đơn đã phê duyệt, chốt P&L lần nữa', () => {
    const a = nextActions(MIXED, [t('a', 't11', 'xong'), t('b', 't22', 'xong'), t('c', 't23', 'xong'), t('d', 't31', 'xong')], P1);
    expect(a.create).toEqual([]);
    expect(a.order).toEqual({ status: 'da_phe_duyet', stage: 4, lockPl: true });
  });

  it('t31 trả lại: hủy các task, mở t11 mới cho AM, đơn bị trả lại', () => {
    const a = nextActions(MIXED, [t('a', 't11', 'xong'), t('b', 't22', 'xong'), t('c', 't23', 'xong'), t('d', 't31', 'tra_lai')], P1);
    expect(a.update).toEqual([
      { id: 'a', status: 'huy' },
      { id: 'b', status: 'huy' },
      { id: 'c', status: 'huy' },
      { id: 'd', status: 'huy' },
    ]);
    expect(a.create).toEqual([{ code: 't11', role: 'am', status: 'dang_lam' }]);
    expect(a.order).toEqual({ status: 'tra_lai', stage: 1, choDuyetLai: false });
  });

  it('sau khi trả lại, gửi lại: t22, t23 mở lại từ đầu, bỏ qua các task đã hủy', () => {
    const tasks = [t('a', 't11', 'huy'), t('b', 't22', 'huy'), t('c', 't23', 'huy'), t('d', 't31', 'huy'), t('e', 't11', 'xong')];
    const a = nextActions(MIXED, tasks, P1);
    expect(a.create.map((x) => x.code)).toEqual(['t22', 't23']);
    expect(a.update).toEqual([]);
  });
  it('đơn đã bị trả lại, t11 mới còn đang làm: một lượt chạy muộn không ghi đè trạng thái đơn', () => {
    const tasks = [t('a', 't11', 'huy'), t('b', 't22', 'huy'), t('c', 't23', 'huy'), t('d', 't31', 'huy'), t('e', 't11', 'dang_lam')];
    const a = nextActions({ ...MIXED, status: 'tra_lai' }, tasks, P1);
    expect(a.create).toEqual([]);
    expect(a.order).toEqual({});
  });
});

const ALL: TaskCode[] = ['t11', 't22', 't23', 't31', 't40', 't44', 't42', 't41', 't45', 't51', 't53', 't61', 't62', 't71', 't72'];
const codes = (a: { code: TaskCode }[]) => a.map((x) => x.code);
const upTo = (...pairs: [TaskCode | RequestCode, FlowTask['status']][]): FlowTask[] => pairs.map(([c, s], i) => t(`id${i}`, c, s));
const D = (c: TaskCode): [TaskCode, FlowTask['status']] => [c, 'xong'];

describe('nextActions: đủ 15 task', () => {
  it('t31 xong: mở t40, t44 (đơn có hàng); t42 chờ cả hai', () => {
    const base = upTo(D('t11'), D('t22'), D('t23'), D('t31'));
    expect(codes(nextActions({ ...MIXED, status: 'da_phe_duyet' }, base, ALL).create)).toEqual(['t40', 't44']);
    const half = upTo(D('t11'), D('t22'), D('t23'), D('t31'), D('t40'), ['t44', 'dang_lam']);
    expect(nextActions({ ...MIXED, status: 'da_phe_duyet' }, half, ALL).create).toEqual([]);
  });
  it('đơn chỉ dịch vụ: t44, t45, t53, t61 bỏ qua nối tiếp nhau trong một lượt', () => {
    const tasks = upTo(D('t11'), D('t22'), ['t23', 'bo_qua'], D('t31'), D('t40'), ['t44', 'bo_qua']);
    const a = nextActions({ ...SERVICE_ONLY, status: 'da_phe_duyet' }, tasks, ALL);
    expect(a.create).toEqual([{ code: 't42', role: 'sd', status: 'dang_lam' }]);
    const b = nextActions({ ...SERVICE_ONLY, status: 'da_phe_duyet' }, [...tasks, ...upTo(D('t42'))], ALL);
    expect(b.create).toEqual([
      { code: 't41', role: 'is', status: 'dang_lam' },
      { code: 't45', role: 'proc', status: 'bo_qua' },
      { code: 't53', role: 'acc', status: 'bo_qua' },
      { code: 't61', role: 'proc', status: 'bo_qua' },
    ]);
  });
  it('t51 / t53 "Không áp dụng" tính là xong: t61 mở khi t45 và t53 xong', () => {
    const tasks = upTo(D('t11'), D('t22'), D('t23'), D('t31'), D('t40'), D('t44'), D('t42'), D('t41'), D('t45'), ['t51', 'khong_ap_dung'], ['t53', 'khong_ap_dung']);
    expect(codes(nextActions({ ...MIXED, status: 'da_phe_duyet' }, tasks, ALL).create)).toEqual(['t61', 't62']);
  });
  it('KH tạm ứng trước = Có: t61, t62 chờ t51', () => {
    const tasks = upTo(D('t11'), D('t22'), D('t23'), D('t31'), D('t40'), D('t44'), D('t42'), D('t41'), D('t45'), ['t51', 'dang_lam'], D('t53'));
    expect(nextActions({ ...MIXED, advanceFirst: true, status: 'da_phe_duyet' }, tasks, ALL).create).toEqual([]);
    expect(codes(nextActions({ ...MIXED, status: 'da_phe_duyet' }, tasks, ALL).create)).toEqual(['t61', 't62']);
  });
  it('t72 xong: đơn hoàn tất', () => {
    const done = ALL.map((c) => D(c));
    const a = nextActions({ ...MIXED, status: 'da_phe_duyet' }, upTo(...done), ALL);
    expect(a.create).toEqual([]);
    expect(a.order.status).toBe('hoan_tat');
    expect(a.flags?.completed).toBe(true);
  });
  it('t42 yêu cầu sửa: hủy t42, t40, t44 rồi mở lại t40, t44', () => {
    const tasks = upTo(D('t11'), D('t22'), D('t23'), D('t31'), D('t40'), D('t44'), ['t42', 'yeu_cau_sua']);
    const a = nextActions({ ...MIXED, status: 'da_phe_duyet' }, tasks, ALL);
    expect(a.update.map((u) => u.id).sort()).toEqual(['id4', 'id5', 'id6']);
    expect(a.update.every((u) => u.status === 'huy')).toBe(true);
    expect(codes(a.create)).toEqual(['t40', 't44']);
    expect(a.flags?.draftRevision).toBe(true);
  });
  it('Close-lost trước t41: hủy mọi task còn sống, đơn close_lost', () => {
    const tasks = upTo(D('t11'), D('t22'), D('t23'), D('t31'), ['t40', 'dang_lam'], ['yc_close_lost', 'dang_lam']);
    const a = nextActions({ ...MIXED, status: 'da_phe_duyet' }, tasks, ALL);
    expect(a.order.status).toBe('close_lost');
    expect(a.update.length).toBe(6);
    expect(a.update.every((u) => u.status === 'huy')).toBe(true);
    expect(a.create).toEqual([]);
  });
  it('Close-lost sau khi t41 xong: bị từ chối, chỉ hủy yêu cầu', () => {
    const tasks = upTo(D('t11'), D('t22'), D('t23'), D('t31'), D('t40'), D('t44'), D('t42'), D('t41'), ['yc_close_lost', 'dang_lam']);
    const a = nextActions({ ...MIXED, status: 'da_phe_duyet' }, tasks, ALL);
    expect(a.update).toEqual([{ id: 'id8', status: 'huy' }]);
    expect(a.order.status).toBeUndefined();
    expect(a.flags?.closeLostRejected).toBe(true);
  });
  it('Xin duyệt lại: hủy task GĐ4 trở đi, mở t31 mới cho SD (không tự duyệt), bật cờ', () => {
    const tasks = upTo(D('t11'), D('t22'), ['t23', 'bo_qua'], D('t31'), ['t40', 'dang_lam'], ['t44', 'bo_qua'], ['yc_xin_duyet_lai', 'dang_lam']);
    const a = nextActions({ ...SERVICE_ONLY, status: 'da_phe_duyet' }, tasks, ALL);
    expect(a.update.map((u) => u.id).sort()).toEqual(['id3', 'id4', 'id5', 'id6']);
    expect(a.create).toEqual([{ code: 't31', role: 'sd', status: 'dang_lam' }]);
    expect(a.order).toMatchObject({ status: 'dang_xu_ly', stage: 3, choDuyetLai: true });
  });
  it('Xin duyệt lại, SD duyệt t31 mới: tắt cờ, chốt lại số, mở lại t40', () => {
    const tasks = upTo(D('t11'), D('t22'), ['t23', 'bo_qua'], ['t31', 'huy'], ['t40', 'huy'], ['t44', 'huy'], D('t31'));
    const a = nextActions({ ...SERVICE_ONLY, status: 'dang_xu_ly', reapproval: true }, tasks, ALL);
    expect(codes(a.create)).toEqual(['t40', 't44']);
    expect(a.order).toMatchObject({ status: 'da_phe_duyet', choDuyetLai: false, lockPl: true });
  });
  it('Xin duyệt lại khi đơn chưa phê duyệt: bị từ chối', () => {
    const tasks = upTo(D('t11'), ['t22', 'dang_lam'], ['yc_xin_duyet_lai', 'dang_lam']);
    const a = nextActions({ ...MIXED, status: 'dang_xu_ly' }, tasks, ALL);
    expect(a.update).toEqual([{ id: 'id2', status: 'huy' }]);
    expect(a.flags?.reapprovalRejected).toBe(true);
  });
  it('đơn đã close_lost: hủy nốt task còn sống, không tạo gì', () => {
    expect(nextActions({ ...MIXED, status: 'close_lost' }, upTo(D('t11')), ALL)).toMatchObject({ create: [], update: [{ id: 'id0', status: 'huy' }], order: {} });
  });
});

describe('nextActions: review cuối Phase 3', () => {
  it('Close-lost lúc đang chờ duyệt lại: tắt cờ duyệt lại', () => {
    const tasks = upTo(D('t11'), D('t22'), ['t23', 'bo_qua'], ['t31', 'dang_lam'], ['yc_close_lost', 'dang_lam']);
    const a = nextActions({ ...SERVICE_ONLY, status: 'dang_xu_ly', reapproval: true }, tasks, ALL);
    expect(a.order).toEqual({ status: 'close_lost', choDuyetLai: false });
  });
  it('đơn đã close_lost mà còn task sống (lượt chạy chồng): hủy nốt', () => {
    const a = nextActions({ ...MIXED, status: 'close_lost' }, upTo(D('t11'), ['t41', 'dang_lam']), ALL);
    expect(a.update).toEqual([{ id: 'id0', status: 'huy' }, { id: 'id1', status: 'huy' }]);
  });
  it('yêu cầu bị từ chối: không ghi gì ngoài hủy yêu cầu (flag noWrite)', () => {
    const a = nextActions({ ...MIXED, status: 'dang_xu_ly' }, upTo(D('t11'), ['yc_xin_duyet_lai', 'dang_lam']), ALL);
    expect(a.flags?.reapprovalRejected).toBe(true);
    expect(a.flags?.noWrite).toBe(true);
  });
});
