import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/domain/config';
import type { Line } from '../../src/domain/lines';
import { computePl } from '../../src/domain/pl';
import { summaryFor } from '../../src/domain/summary';

const lines: Line[] = [
  { type: 'TB', qty: 2, sell: 50_000_000, discountPct: 0, buy: 40_000_000, months: 12 },
  { type: 'LIC', qty: 1, sell: 3_000_000, discountPct: 0, buy: 2_000_000, months: 0 },
  { type: 'DVTK-I', qty: 1, sell: 20_000_000, discountPct: 0, buy: 5_000_000, months: 0 },
  { type: 'DVDK-I', qty: 1, sell: 4_000_000, discountPct: 0, buy: 2_000_000, months: 12 },
];
const pl = computePl({ lines, tier: 'pho_thong', creditDays: 30, salesCost: 3_000_000, deployStaff: true, consultStaff: false, proposal: false, poc: false }, DEFAULT_CONFIG);

describe('summaryFor', () => {
  it('phần dịch vụ (cho TM): doanh thu và giá vốn từng loại dịch vụ, hỗ trợ KT, thưởng triển khai; không có số của hàng hóa hay LN', () => {
    const s = summaryFor('dich_vu', lines, pl, DEFAULT_CONFIG);
    expect(s).toEqual({
      'doanh_thu.dvtk_i': 20_000_000, 'gia_von.dvtk_i': 5_000_000,
      'doanh_thu.dvdk_i': 48_000_000, 'gia_von.dvdk_i': 24_000_000,
      ho_tro_kt: pl.techSupport, thuong_trien_khai: pl.deployBonus, thuong_tu_van: pl.consultBonus,
    });
  });

  it('phần hàng hóa (cho PROC): tổng giá vốn TB/License và số dòng; không có giá bán, CPBH, LN', () => {
    expect(summaryFor('hang_hoa', lines, pl, DEFAULT_CONFIG)).toEqual({ tong_gia_von: 82_000_000, so_dong: 2 });
  });

  it('đơn không có phần nào thì tóm tắt rỗng, không NaN', () => {
    expect(summaryFor('dich_vu', [lines[0]!], pl, DEFAULT_CONFIG)).toEqual({ ho_tro_kt: pl.techSupport, thuong_trien_khai: pl.deployBonus, thuong_tu_van: pl.consultBonus });
    expect(summaryFor('hang_hoa', [lines[2]!], pl, DEFAULT_CONFIG)).toEqual({ tong_gia_von: 0, so_dong: 0 });
  });
});
