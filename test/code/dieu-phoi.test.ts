import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/domain/config';
import { computePl } from '../../src/domain/pl';
import { runCode } from './run-code';

const NHOM = { nhom_tm: 'g-tm', nhom_proc: 'g-proc', nhom_sd: 'g-sd', nhom_acc: 'g-acc' };
const don = (trang_thai = 'dang_xu_ly') => ({
  id: 'don1', ma_don: 'DH-0001', am: 'u-am', is: 'u-is', hang_kh: 'pho_thong', cong_no_ngay: 30, loai_hd_chon: null,
  nv_trien_khai: null, nv_tu_van: null, tv_proposal: false, tv_poc: false, tu_truoc: false, trang_thai,
});
// Đơn hỗn hợp: 1 TB + 1 DVTK-I. Giá bán nằm ở entity riêng, nối theo dong_hang.
const dong = [
  { id: 'l1', don_hang: 'don1', loai: 'tb', so_luong: 2, so_thang: 12, gia_mua: 40_000_000 },
  { id: 'l2', don_hang: 'don1', loai: 'dvtk_i', so_luong: 1, so_thang: 0, gia_mua: 0 },
];
const gia_ban = [
  { id: 'p1', dong_hang: 'l1', don_hang: 'don1', don_gia_ban: 50_000_000, chiet_khau: 0 },
  { id: 'p2', dong_hang: 'l2', don_hang: 'don1', don_gia_ban: 20_000_000, chiet_khau: 0 },
];
const tai_chinh = [{ id: 'tc1', don_hang: 'don1', cpbh: 3_000_000 }];
const cau_hinh = [{ id: 'c1', ten: 'mac_dinh', gia_tri: '{}' }];
const base = { dong, gia_ban, tai_chinh, cau_hinh, ...NHOM };

describe('Code step dieu_phoi', () => {
  it('t11 xong trên đơn hỗn hợp: mở t22 cho nhóm TM, t23 cho nhóm PROC và chốt P&L', async () => {
    const out = await runCode('dieu-phoi.js', { ...base, don: don('nhap'), tasks: [{ id: 'k1', ma: 't11', trang_thai: 'xong' }] });
    expect(out.tao).toEqual([
      { don_hang: 'don1', ma: 't22', vai_tro: 'tm', trang_thai: 'dang_lam', sla_ngay: 1, am: 'u-am', is: 'u-is', nhom: ['g-tm'] },
      { don_hang: 'don1', ma: 't23', vai_tro: 'proc', trang_thai: 'dang_lam', sla_ngay: 1, am: 'u-am', is: 'u-is', nhom: ['g-proc'] },
    ]);
    expect(out.don).toEqual({ trang_thai: 'dang_xu_ly', giai_doan: 2, co_dich_vu: true, co_hang_hoa: true,
      ky_thuat: ['g-tm'], mua_hang: ['g-proc'] });
    const want = computePl({
      lines: [
        { type: 'TB', qty: 2, sell: 50_000_000, discountPct: 0, buy: 40_000_000, months: 12 },
        { type: 'DVTK-I', qty: 1, sell: 20_000_000, discountPct: 0, buy: 0, months: 0 },
      ],
      tier: 'pho_thong', creditDays: 30, salesCost: 3_000_000, deployStaff: false, consultStaff: false, proposal: false, poc: false,
    }, DEFAULT_CONFIG);
    expect(out.chot.ln_thuan_chot).toBe(want.netProfit);
    expect(out.chot.dat_chot).toBe(want.passed);
    expect(JSON.parse(out.chot.pl_chot).netProfit).toBe(want.netProfit);
  });

  it('SD duyệt t31: đơn đã phê duyệt', async () => {
    const tasks = [
      { id: 'k1', ma: 't11', trang_thai: 'xong' }, { id: 'k2', ma: 't22', trang_thai: 'xong' },
      { id: 'k3', ma: 't23', trang_thai: 'xong' }, { id: 'k4', ma: 't31', trang_thai: 'xong' },
    ];
    const out = await runCode('dieu-phoi.js', { ...base, don: don('dang_xu_ly'), tasks });
    expect(out.tao).toEqual([]);
    expect(out.don.trang_thai).toBe('da_phe_duyet');
    expect(out.chot).not.toBeNull();
  });

  it('SD trả lại t31: hủy các task, mở t11 mới cho AM, đơn bị trả lại', async () => {
    const tasks = [
      { id: 'k1', ma: 't11', trang_thai: 'xong' }, { id: 'k2', ma: 't22', trang_thai: 'xong' },
      { id: 'k3', ma: 't23', trang_thai: 'xong' }, { id: 'k4', ma: 't31', trang_thai: 'tra_lai' },
    ];
    const out = await runCode('dieu-phoi.js', { ...base, don: don('dang_xu_ly'), tasks });
    expect(out.cap_nhat).toEqual(['k1', 'k2', 'k3', 'k4'].map((id) => ({ id, trang_thai: 'huy' })));
    expect(out.tao).toEqual([{ don_hang: 'don1', ma: 't11', vai_tro: 'am', trang_thai: 'dang_lam', sla_ngay: 1, am: 'u-am', is: 'u-is', nhom: [] }]);
    expect(out.don.trang_thai).toBe('tra_lai');
    expect(out.chot).toBeNull();
  });

  it('không chốt lại khi đơn đã phê duyệt', async () => {
    const tasks = [
      { id: 'k1', ma: 't11', trang_thai: 'xong' }, { id: 'k2', ma: 't22', trang_thai: 'xong' },
      { id: 'k3', ma: 't23', trang_thai: 'xong' }, { id: 'k4', ma: 't31', trang_thai: 'xong' },
    ];
    const out = await runCode('dieu-phoi.js', { ...base, don: don('da_phe_duyet'), tasks });
    expect(out.chot).toBeNull();
  });
  it('t11 xong nhưng đơn không có dòng nào: trả lại cho AM, không mở task nào cho TM/PROC/SD', async () => {
    const out = await runCode('dieu-phoi.js', { ...base, dong: [], gia_ban: [], don: don('nhap'), tasks: [{ id: 'k1', ma: 't11', trang_thai: 'xong' }] });
    expect(out.tao.map((x: { ma: string }) => x.ma)).toEqual(['t11']);
    expect(out.cap_nhat).toEqual([{ id: 'k1', trang_thai: 'huy' }]);
    expect(out.don.trang_thai).toBe('tra_lai');
    expect(out.chot).toBeNull();
  });
});
