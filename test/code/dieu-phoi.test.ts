import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/domain/config';
import type { LineForm, OrderForm } from '../../src/domain/form';
import { plInputFromForm } from '../../src/domain/plinput';
import { computePl } from '../../src/domain/pl';
import { financePayload, linePayload, orderPayload } from '../../src/domain/records';
import { validLine, validOrder } from '../domain/fixtures/order-form';
import { runCode } from './run-code';

const NHOM = { nhom_tm: 'g-tm', nhom_proc: 'g-proc', nhom_sd: 'g-sd', nhom_acc: 'g-acc' };
const TB = validLine({ so_luong: 2, so_thang: 12, gia_mua: 40_000_000, don_gia_ban: 50_000_000 });
const DV = validLine({ loai: 'dvtk_i', sku: '', co_cq: '', so_luong: 1, so_thang: 0, gia_mua: 0, don_gia_ban: 20_000_000 });

function inputs(order: OrderForm, lines: LineForm[], tasks: unknown[], status = 'dang_xu_ly') {
  return {
    don: { id: 'don1', body: { ...orderPayload(order), trang_thai: status } },
    tai_chinh: [{ id: 'tc1', body: { don_hang: 'don1', ...financePayload(order) } }],
    dong: lines.map((l, i) => ({ id: `l${i}`, body: linePayload('don1', l, i + 1) })),
    gia_ban: lines.map((l, i) => ({ id: `p${i}`, body: { dong_hang: `l${i}`, don_gia_ban: l.don_gia_ban, chiet_khau: l.chiet_khau } })),
    cau_hinh: [{ id: 'c1', body: { ten: 'mac_dinh', gia_tri: '{}' } }],
    tasks, ...NHOM,
  };
}
const T11_DONE = [{ id: 'k1', ma: 't11', trang_thai: 'xong' }];
const ALL_DONE = ['t11', 't22', 't23', 't31'].map((ma, i) => ({ id: `k${i + 1}`, ma, trang_thai: 'xong' }));

describe('Code step dieu_phoi', () => {
  it('t11 xong trên đơn hợp lệ, hỗn hợp: mở t22 cho nhóm TM, t23 cho nhóm PROC, chốt P&L, ghi người được chia', async () => {
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [TB, DV], T11_DONE, 'nhap'));
    expect(out.tao).toEqual([
      { don_hang: 'don1', ma: 't22', vai_tro: 'tm', trang_thai: 'dang_lam', sla_ngay: 1, am: 'u-am', is: 'u-is', nhom: ['g-tm'] },
      { don_hang: 'don1', ma: 't23', vai_tro: 'proc', trang_thai: 'dang_lam', sla_ngay: 1, am: 'u-am', is: 'u-is', nhom: ['g-proc'] },
    ]);
    expect(out.don).toEqual({ trang_thai: 'dang_xu_ly', giai_doan: 2, co_dich_vu: true, co_hang_hoa: true, ky_thuat: ['g-tm'], mua_hang: ['g-proc'],
      nguoi_duoc_chia: ['u-am', 'u-is'], ly_do_gui: '' });
    const want = computePl(plInputFromForm(validOrder(), [TB, DV]), DEFAULT_CONFIG);
    expect(out.chot.ln_thuan_chot).toBe(want.netProfit);
    expect(out.chot.dat_chot).toBe(want.passed);
    expect(JSON.parse(out.chot.pl_chot).netProfit).toBe(want.netProfit);
  });

  it('ghi tóm tắt đúng phần cho TM và PROC, không có số nhạy cảm; ghi lịch sử gửi duyệt và chốt P&L', async () => {
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [TB, DV], T11_DONE, 'nhap'));
    expect(out.tom_tat.map((t: { phan: string; nhom_xem: string[] }) => [t.phan, t.nhom_xem])).toEqual([['dich_vu', ['g-tm']], ['hang_hoa', ['g-proc']]]);
    const dv = JSON.parse(out.tom_tat[0].du_lieu);
    expect(Object.keys(dv)).not.toContain('ln_thuan');
    expect(Object.keys(dv)).not.toContain('cpbh');
    expect(JSON.parse(out.tom_tat[1].du_lieu)).toEqual({ tong_gia_von: 80_000_000, so_dong: 1 });
    expect(out.lich_su.map((h: { hanh_dong: string }) => h.hanh_dong)).toEqual(expect.arrayContaining(['gui_duyet', 'mo_task', 'chot_pl']));
  });

  it('đơn chỉ dịch vụ: chỉ có bản tóm tắt phần dịch vụ', async () => {
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [DV], T11_DONE, 'nhap'));
    expect(out.tom_tat.map((t: { phan: string }) => t.phan)).toEqual(['dich_vu']);
    expect(out.don.mua_hang).toEqual([]);
  });

  it('Review Focus: t11 xong nhưng đơn thiếu MST bị máy chủ trả lại, nêu rõ trường thiếu, không mở task cho người khác', async () => {
    const out = await runCode('dieu-phoi.js', inputs({ ...validOrder(), mst: '' }, [TB, DV], T11_DONE, 'nhap'));
    expect(out.tao.map((x: { ma: string }) => x.ma)).toEqual(['t11']);
    expect(out.cap_nhat).toEqual([{ id: 'k1', trang_thai: 'huy' }]);
    expect(out.don.trang_thai).toBe('tra_lai');
    expect(out.don.ly_do_gui).toContain('mst');
    expect(out.chot).toBeNull();
    expect(out.tom_tat).toEqual([]);
    expect(out.lich_su.map((h: { hanh_dong: string }) => h.hanh_dong)).toContain('tra_lai_may_chu');
  });

  it('t11 xong nhưng đơn không có dòng nào: trả lại cho AM', async () => {
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [], T11_DONE, 'nhap'));
    expect(out.tao.map((x: { ma: string }) => x.ma)).toEqual(['t11']);
    expect(out.don.ly_do_gui).toContain('dong_hang');
  });

  it('SD duyệt t31: đơn đã phê duyệt và có lịch sử phê duyệt', async () => {
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [TB, DV], ALL_DONE));
    expect(out.tao).toEqual([]);
    expect(out.don.trang_thai).toBe('da_phe_duyet');
    expect(out.chot).not.toBeNull();
    expect(out.lich_su.map((h: { hanh_dong: string }) => h.hanh_dong)).toContain('phe_duyet');
  });

  it('không chốt lại và không ghi lịch sử lại khi đơn đã phê duyệt', async () => {
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [TB, DV], ALL_DONE, 'da_phe_duyet'));
    expect(out.chot).toBeNull();
    expect(out.lich_su).toEqual([]);
  });

  it('SD trả lại t31: hủy các task, mở t11 mới cho AM, lý do của SD thành lý do trả lại của đơn', async () => {
    const tasks = ALL_DONE.map((t) => (t.ma === 't31' ? { ...t, trang_thai: 'tra_lai', ly_do: 'Thiếu giá NCC' } : t));
    const out = await runCode('dieu-phoi.js', inputs(validOrder(), [TB, DV], tasks));
    expect(out.cap_nhat).toEqual(['k1', 'k2', 'k3', 'k4'].map((id) => ({ id, trang_thai: 'huy' })));
    expect(out.tao).toEqual([{ don_hang: 'don1', ma: 't11', vai_tro: 'am', trang_thai: 'dang_lam', sla_ngay: 1, am: 'u-am', is: 'u-is', nhom: [] }]);
    expect(out.don.trang_thai).toBe('tra_lai');
    expect(out.don.ly_do_gui).toBe('Thiếu giá NCC');
    expect(out.chot).toBeNull();
  });

  it('nguồn KH là Team Marketing: không ai được chia thêm; nguồn là một người: người đó được chia và đọc đơn', async () => {
    const a = await runCode('dieu-phoi.js', inputs({ ...validOrder(), nguon_kh: 'marketing' }, [TB], T11_DONE, 'nhap'));
    expect(a.don.nguoi_duoc_chia).toEqual(['u-am', 'u-is']);
    const b = await runCode('dieu-phoi.js', inputs({ ...validOrder(), nguon_kh: 'nguoi', nguon_kh_nguoi: 'u-sale2' }, [TB], T11_DONE, 'nhap'));
    expect(b.don.nguoi_duoc_chia).toEqual(['u-am', 'u-is', 'u-sale2']);
  });
});
