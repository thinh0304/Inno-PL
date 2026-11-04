// Công thức P&L một đơn (spec §4.4). Hàm thuần: module dùng để tính khi gõ, Code step dùng để chốt số.
import type { CustomerTier, PlConfig } from './config';
import { type ContractKind, type Line, detectContractKinds, isForeign, lineBuy, lineSell } from './lines';

export type { CustomerTier } from './config';

export interface PlInput {
  lines: Line[];
  tier: CustomerTier;
  creditDays: number;
  salesCost: number;
  /** Loại HĐ người lập chọn; chỉ dùng khi nằm trong các loại của đơn, hoặc là Fulfillment (spec §4.3). */
  chosenKind?: ContractKind;
  deployStaff: boolean;
  consultStaff: boolean;
  proposal: boolean;
  poc: boolean;
  /** Bù từ quỹ dự phòng, cộng vào LN thuần (spec §4.4 bước 13). */
  fundTopUp?: number;
}

export interface PlResult {
  kind: ContractKind;
  revenue: number;
  cost: number;
  grossProfit: number;
  salesCost: number;
  financeRate: number;
  financeCost: number;
  warranty: number;
  licenseSupport: number;
  techSupport: number;
  deployBonus: number;
  provision: number;
  consultRate: number;
  consultBonus: number;
  fundTopUp: number;
  netProfit: number;
  threshold: number;
  margin: number;
  passed: boolean;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Loại HĐ áp ngưỡng: loại người lập chọn nếu hợp lệ, ngược lại loại có doanh thu lớn nhất. */
export function contractKindFor(lines: Line[], chosen?: ContractKind): ContractKind {
  if (chosen === 'Fulfillment') return chosen;
  const found = detectContractKinds(lines);
  if (chosen && (found.length === 0 || found.some((x) => x.kind === chosen))) return chosen;
  if (found.length === 0) return 'Thương Mại';
  return found.reduce((best, x) => (x.revenue > best.revenue ? x : best)).kind;
}

function financeRate(salesCost: number, cost: number, tier: CustomerTier, cfg: PlConfig): number {
  if (salesCost <= 0) return 0;
  const ratio = cost ? salesCost / cost : 0;
  const table = cfg.finance[tier];
  let rate = table.below;
  for (const s of [...table.steps].sort((a, b) => a.from - b.from)) if (ratio >= s.from) rate = s.rate;
  return rate;
}

export function computePl(input: PlInput, cfg: PlConfig): PlResult {
  const { lines } = input;
  const kind = contractKindFor(lines, input.chosenKind);
  const params = cfg.contracts[kind];
  const revenue = sum(lines.map(lineSell));
  const cost = sum(lines.map((l) => lineBuy(l, cfg)));
  const grossProfit = revenue - cost;
  const salesCost = input.salesCost || 0;
  const rate = financeRate(salesCost, cost, input.tier, cfg);
  const financeCost = salesCost > 0 ? Math.round((salesCost * rate) / (1 - rate)) : 0;
  const afterSales = grossProfit - salesCost - financeCost;

  const buyOf = (pick: (l: Line) => boolean) => sum(lines.filter(pick).map((l) => lineBuy(l, cfg)));
  const warrantyBase = sum(
    lines.filter((l) => l.type === 'TB' && l.months > 0).map((l) => lineBuy(l, cfg) * Math.ceil(l.months / 12)),
  );
  const warranty = Math.round(warrantyBase * cfg.warrantyPerYear);
  const licenseBase = buyOf((l) => ['LIC', 'LIC-DK', 'LIC-NTNN'].includes(l.type) || isForeign(l.type));
  const licenseSupport = Math.round(licenseBase * cfg.licenseSupport);
  const techSupport = Math.round(
    buyOf((l) => l.type === 'DVDK-I') * cfg.techSupportInternal + buyOf((l) => l.type === 'DVTK-O') * cfg.techSupportOutsourced,
  );
  const deployBonus = input.deployStaff
    ? Math.round(sum(lines.filter((l) => l.type === 'DVTK-I').map(lineSell)) * params.deployBonus)
    : 0;
  const provision = Math.round(cost * params.provision);

  const running = afterSales - warranty - licenseSupport - techSupport - deployBonus - provision;
  const consultRate = input.consultStaff
    ? params.consultBonus + (input.proposal ? cfg.proposalBonus : 0) + (input.poc ? cfg.pocBonus : 0)
    : 0;
  const consultBonus = input.consultStaff ? Math.round(Math.max(0, running) * consultRate) : 0;
  const fundTopUp = input.fundTopUp || 0;
  const netProfit = running - consultBonus + fundTopUp;

  const extraSteps = Math.max(0, Math.floor((input.creditDays - cfg.creditBaseDays) / cfg.creditStepDays));
  const threshold = params.threshold + extraSteps * cfg.creditStepRate;
  const margin = cost ? netProfit / cost : 0;

  return {
    kind, revenue, cost, grossProfit, salesCost, financeRate: rate, financeCost, warranty, licenseSupport, techSupport,
    deployBonus, provision, consultRate, consultBonus, fundTopUp, netProfit, threshold, margin,
    passed: cost > 0 && margin >= threshold,
  };
}
