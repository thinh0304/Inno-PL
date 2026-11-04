// Tham số P&L và quy trình (spec §4.3, §4.5, §7.2, §12.4). Admin sửa ở Cấu hình; đây là giá trị mặc định.
import type { ContractKind } from './lines';

/** Mã 15 task của quy trình (spec §7.2). `flow.ts` dùng lại kiểu này. */
export const TASK_CODES = ['t11', 't22', 't23', 't31', 't40', 't44', 't42', 't41', 't45', 't51', 't53', 't61', 't62', 't71', 't72'] as const;
export type TaskCode = (typeof TASK_CODES)[number];

export type CustomerTier = 'vip' | 'tiem_nang' | 'pho_thong';

/** Tham số theo loại HĐ (spec §4.3). */
export interface ContractParams {
  threshold: number;
  deployBonus: number;
  consultBonus: number;
  provision: number;
  techSupportBonus: number;
  salesBonus: number;
}

/** Một bậc của bảng r: từ tỷ lệ CPBH / giá vốn `from` trở lên thì r = `rate`. */
export interface FinanceStep { from: number; rate: number }

export interface PlConfig {
  contracts: Record<ContractKind, ContractParams>;
  /** r khi CPBH / giá vốn dưới bậc đầu, và các bậc tăng dần (spec §4.5). */
  finance: Record<CustomerTier, { below: number; steps: FinanceStep[] }>;
  foreignFactor: number;
  licenseSupport: number;
  techSupportInternal: number;
  techSupportOutsourced: number;
  warrantyPerYear: number;
  proposalBonus: number;
  pocBonus: number;
  creditBaseDays: number;
  creditStepDays: number;
  creditStepRate: number;
  baseExchangeRate: number;
  annualInterest: number;
  defaultVat: number;
  autoApproveMaxRevenue: number;
  contractFileMinValue: number;
  slaDays: Record<TaskCode, number>;
}

const steps = (below: number): { below: number; steps: FinanceStep[] } => ({
  below,
  steps: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((from, i) => ({ from, rate: Math.round((below + 0.05 * (i + 1)) * 100) / 100 })),
});

const contract = (threshold: number, consultBonus: number, provision: number, salesBonus: number): ContractParams => ({
  threshold, deployBonus: 0.05, consultBonus, provision, techSupportBonus: 0.03, salesBonus,
});

export const DEFAULT_CONFIG: PlConfig = {
  contracts: {
    'Thương Mại': contract(0.08, 0.03, 0.01, 0.1),
    'License/Runrate': contract(0.05, 0.01, 0.005, 0.08),
    'Dịch vụ Loại I': contract(0.4, 0.03, 0.05, 0.1),
    'Dịch vụ Loại II': contract(0.1, 0.03, 0.05, 0.1),
    Fulfillment: contract(0.03, 0.01, 0, 0),
  },
  finance: { vip: steps(0.15), tiem_nang: steps(0.2), pho_thong: steps(0.25) },
  foreignFactor: 0.12,
  licenseSupport: 0.005,
  techSupportInternal: 0.05,
  techSupportOutsourced: 0.02,
  warrantyPerYear: 0.002,
  proposalBonus: 0.02,
  pocBonus: 0.02,
  creditBaseDays: 30,
  creditStepDays: 15,
  creditStepRate: 0.005,
  baseExchangeRate: 26000,
  annualInterest: 0.146,
  defaultVat: 0.08,
  autoApproveMaxRevenue: 300_000_000,
  contractFileMinValue: 20_000_000,
  slaDays: { t11: 1, t22: 1, t23: 1, t31: 1, t40: 2, t44: 1, t42: 1, t41: 3, t45: 2, t51: 3, t53: 2, t61: 7, t62: 7, t71: 2, t72: 1 },
};
