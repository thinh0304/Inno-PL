// Năm đơn mẫu chép từ docs/superpowers/specs/source/pl-artifact.html (khối `const DEALS=[`, dòng 994).
// Sinh tự động từ dữ liệu artifact; số liệu không sửa tay.
import type { PlInput } from '../../../src/domain/pl';

export const ARTIFACT_ORDERS: Record<string, PlInput> = {
  'TM-1036': {
    tier: 'vip', creditDays: 45, salesCost: 73500000, chosenKind: 'Thương Mại',
    deployStaff: false, consultStaff: true, proposal: true, poc: true,
    lines: [
    { type: 'TB', qty: 16, sell: 4900000, discountPct: 0, buy: 3641407, months: 24 },
    { type: 'TB', qty: 7, sell: 6200000, discountPct: 0, buy: 5200000, months: 36 },
    { type: 'TB', qty: 3, sell: 8400000, discountPct: 0, buy: 10837500, months: 36 },
    { type: 'LIC-DK', qty: 17, sell: 950000, discountPct: 0, buy: 950000, months: 0 },
    { type: 'TB', qty: 1, sell: 100000000, discountPct: 0, buy: 76500000, months: 0 },
    { type: 'TB', qty: 14, sell: 18300000, discountPct: 0, buy: 13281000, months: 12 },
    { type: 'TB', qty: 3, sell: 17400000, discountPct: 0, buy: 16825000, months: 24 },
    { type: 'TB', qty: 3, sell: 11480000, discountPct: 0, buy: 5343000, months: 12 },
    { type: 'TB', qty: 1, sell: 12000000, discountPct: 0, buy: 6945000, months: 12 },
    { type: 'TB', qty: 1, sell: 80000000, discountPct: 0, buy: 25710000, months: 24 },
    { type: 'LIC', qty: 1, sell: 2400000, discountPct: 0, buy: 2000000, months: 0 },
    { type: 'LIC', qty: 23, sell: 1100000, discountPct: 0, buy: 900000, months: 0 },
    { type: 'DVTK-O', qty: 1, sell: 100000000, discountPct: 0, buy: 90000000, months: 1 },
    { type: 'DVTK-O', qty: 1, sell: 80000000, discountPct: 0, buy: 0, months: 1 },
    ],
  },
  'TM-1041': {
    tier: 'pho_thong', creditDays: 60, salesCost: 5000000, chosenKind: 'Thương Mại',
    deployStaff: false, consultStaff: false, proposal: false, poc: false,
    lines: [
    { type: 'TB', qty: 2, sell: 120000000, discountPct: 0, buy: 118000000, months: 36 },
    { type: 'TB', qty: 4, sell: 45000000, discountPct: 0, buy: 44000000, months: 12 },
    { type: 'LIC', qty: 2, sell: 15000000, discountPct: 0, buy: 15000000, months: 0 },
    { type: 'DVTK-I', qty: 1, sell: 10000000, discountPct: 0, buy: 0, months: 0 },
    { type: 'LIC', qty: 20, sell: 3400000, discountPct: 0, buy: 2900000, months: 0 },
    { type: 'TB', qty: 1, sell: 38000000, discountPct: 0, buy: 31000000, months: 12 },
    { type: 'TB', qty: 1, sell: 25000000, discountPct: 0, buy: 21000000, months: 0 },
    { type: 'TB', qty: 2, sell: 42000000, discountPct: 5, buy: 36500000, months: 0 },
    ],
  },
  'DV-0207': {
    tier: 'tiem_nang', creditDays: 15, salesCost: 8000000, chosenKind: 'Dịch vụ Loại I',
    deployStaff: true, consultStaff: true, proposal: false, poc: false,
    lines: [
    { type: 'Cloud Server', qty: 1, sell: 8000000, discountPct: 0, buy: 4000000, months: 12 },
    { type: 'Manage Service', qty: 1, sell: 6000000, discountPct: 0, buy: 2000000, months: 12 },
    { type: 'Veeam', qty: 1, sell: 3000000, discountPct: 0, buy: 1500000, months: 12 },
    { type: 'LIC-DK', qty: 5, sell: 12000000, discountPct: 0, buy: 10000000, months: 0 },
    ],
  },
  'TM-1050': {
    tier: 'pho_thong', creditDays: 30, salesCost: 0, chosenKind: 'Thương Mại',
    deployStaff: false, consultStaff: false, proposal: false, poc: false,
    lines: [
    { type: 'TB', qty: 5, sell: 20000000, discountPct: 0, buy: 16000000, months: 24 },
    { type: 'TB', qty: 5, sell: 3000000, discountPct: 0, buy: 2000000, months: 0 },
    ],
  },
  'DV-0210': {
    tier: 'vip', creditDays: 60, salesCost: 6000000, chosenKind: 'Dịch vụ Loại II',
    deployStaff: false, consultStaff: true, proposal: false, poc: false,
    lines: [
    { type: 'LIC-NTNN', qty: 10, sell: 6000000, discountPct: 0, buy: 5000000, months: 0 },
    { type: 'DVDK-NTNN', qty: 1, sell: 4000000, discountPct: 0, buy: 2000000, months: 12 },
    { type: 'TB', qty: 5, sell: 22000000, discountPct: 0, buy: 18000000, months: 12 },
    ],
  },
};
