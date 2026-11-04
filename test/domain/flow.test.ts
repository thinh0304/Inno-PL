import { describe, expect, it } from 'vitest';
import { type FlowOrder, type FlowTask, type TaskCode, nextActions } from '../../src/domain/flow';

const P1: TaskCode[] = ['t11', 't22', 't23', 't31'];
const MIXED: FlowOrder = { hasService: true, hasGoods: true, advanceFirst: false, revenue: 500_000_000, passed: true };
const SERVICE_ONLY: FlowOrder = { hasService: true, hasGoods: false, advanceFirst: false, revenue: 250_000_000, passed: true };
const t = (id: string, code: TaskCode, status: FlowTask['status']): FlowTask => ({ id, code, status });

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
    expect(a.order).toEqual({ status: 'tra_lai', stage: 1 });
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
