// One order's P&L: Đặc tả 4.2 steps 3–15, with Thiết kế 13.1–13.3 and 6.5 where they replace it.
import { splitKpi } from './kpi';
import { computeLine, num, type PlLineResult } from './line';
import type { ContractType, ContractTypeRate, PlConfig, PlOrderInput, PurchaseGroup, RevenueStructure,
  WeightSet } from './types';

export interface PlResult {
  lines: PlLineResult[]; unknownItemTypes: string[];
  byType: Record<string, { revenue: number; cost: number; vatOut: number; vatIn: number }>;
  byStructure: Record<RevenueStructure, { revenue: number; cost: number }>;
  byPurchaseGroup: Record<PurchaseGroup, { revenue: number; cost: number }>;
  contractTypes: ContractType[]; appliedContractType: ContractType | null;
  revenue: number; cost: number; grossProfit: number; vatOut: number; vatIn: number;
  salesCost: number; finCostRate: number; finCost: number; profitAfterSales: number;
  warranty: number; licenseSupport: number; techSupport: number; deployBonus: number; provision: number;
  consultBonusRate: number; consultBonus: number;
  netProfitBeforeFund: number; provisionFundDraw: number; netProfit: number;
  netMargin: number | null; threshold: number; passed: boolean;
  weightSet: WeightSet; kpiSplit: { person: string; weight: number; amount: number }[];
}

// The order contract types are listed in, and the tie-break when two carry the same revenue.
const CONTRACT_TYPE_ORDER: ContractType[] = ['tm_once', 'tmdk', 'dv_once', 'dv_recurring'];

const sum = (lines: PlLineResult[], value: (line: PlLineResult) => number) =>
  lines.reduce((total, line) => total + value(line), 0);

function rateFor(config: PlConfig, code: ContractType | null): ContractTypeRate {
  const rates = config.contractTypeRates;
  return rates.find((rate) => rate.code === (code ?? 'tm_once')) ?? rates.find((rate) => rate.code === 'tm_once')!;
}

export function computePl(input: PlOrderInput, config: PlConfig): PlResult {
  const { settings } = config;
  const itemTypes = new Map(config.itemTypes.map((type) => [type.code, type]));
  const lines = input.lines.map((line) => computeLine(line, itemTypes.get(line.itemTypeCode) ?? null, settings));
  const months = new Map(input.lines.map((line) => [line.id, num(line.months)]));

  const unknownItemTypes = [...new Set(lines.filter((line) => !line.itemType).map((line) => line.itemTypeCode))];

  const byType: PlResult['byType'] = {};
  const byStructure: PlResult['byStructure'] = { one_time: { revenue: 0, cost: 0 }, recurring: { revenue: 0, cost: 0 } };
  const byPurchaseGroup: PlResult['byPurchaseGroup'] = { goods: { revenue: 0, cost: 0 }, service: { revenue: 0, cost: 0 } };
  const revenueByContractType = new Map<ContractType, number>();
  for (const line of lines) {
    const type = (byType[line.itemTypeCode] ??= { revenue: 0, cost: 0, vatOut: 0, vatIn: 0 });
    type.revenue += line.revenue; type.cost += line.cost; type.vatOut += line.vatOut; type.vatIn += line.vatIn;
    // An unknown item type counts as one-off goods, like a TB line with no flags.
    const structure = byStructure[line.itemType?.revenueStructure ?? 'one_time'];
    structure.revenue += line.revenue; structure.cost += line.cost;
    const group = byPurchaseGroup[line.itemType?.purchaseGroup ?? 'goods'];
    group.revenue += line.revenue; group.cost += line.cost;
    if (line.itemType) {
      const code = line.itemType.contractType;
      revenueByContractType.set(code, (revenueByContractType.get(code) ?? 0) + line.revenue);
    }
  }
  const contractTypes = CONTRACT_TYPE_ORDER.filter((code) => revenueByContractType.has(code));
  // BR-02: the type with the largest revenue, unless Sale chose another type the order holds;
  // Fulfillment may always be chosen (Thiết kế 13.5). An override the order does not hold is ignored.
  const override = input.contractTypeOverride;
  const appliedContractType = override && (override === 'fulfillment' || contractTypes.includes(override))
    ? override
    : contractTypes.reduce<ContractType | null>((best, code) =>
      best === null || revenueByContractType.get(code)! > revenueByContractType.get(best)! ? code : best, null);
  const rate = rateFor(config, appliedContractType);

  const revenue = sum(lines, (line) => line.revenue);
  const cost = sum(lines, (line) => line.cost);
  const grossProfit = revenue - cost;

  const salesCost = num(input.salesCost);
  const ratio = cost > 0 ? salesCost / cost : 0;
  const finCostRate = config.finCostTiers
    .filter((tier) => tier.tier === input.customerTier && tier.fromRatio <= ratio)
    .reduce<{ fromRatio: number; rate: number } | null>((best, tier) =>
      best === null || tier.fromRatio > best.fromRatio ? tier : best, null)?.rate ?? 0;
  const finCost = salesCost > 0 && finCostRate < 1 ? salesCost * finCostRate / (1 - finCostRate) : 0;
  const profitAfterSales = grossProfit - salesCost - finCost;

  const warranty = sum(lines, (line) => {
    const lineMonths = months.get(line.id) ?? 0;
    return line.itemType?.warrantyBase && lineMonths > 0
      ? line.cost * Math.ceil(lineMonths / 12) * settings.warrantyRate : 0;
  });
  const licenseSupport = sum(lines, (line) => line.itemType?.licenseSupportBase ? line.cost : 0)
    * settings.licenseSupportRate;
  const techSupport = sum(lines, (line) => line.itemType?.techSupport === 'internal' ? line.cost : 0)
    * settings.techSupportInternalRate
    + sum(lines, (line) => line.itemType?.techSupport === 'outsource' ? line.cost : 0)
    * settings.techSupportOutsourceRate;
  const deployBonus = input.deployStaff
    ? sum(lines, (line) => line.itemType?.deployBonusBase ? line.revenue : 0) * rate.deployBonus : 0;
  const provision = cost * rate.provision;

  const beforeConsult = profitAfterSales - warranty - licenseSupport - techSupport - deployBonus - provision;
  const consultBonusRate = rate.consultBonus + (input.proposal ? settings.proposalBonus : 0)
    + (input.poc ? settings.pocBonus : 0);
  const consultBonus = input.consultStaff ? Math.max(0, beforeConsult) * consultBonusRate : 0;
  const netProfitBeforeFund = beforeConsult - consultBonus;

  // Step 14: +debtStepRate for each whole debtStepDays of debt beyond debtBaseDays, never less than the base.
  const threshold = rate.threshold
    + Math.floor(Math.max(0, num(input.debtDays) - settings.debtBaseDays) / settings.debtStepDays) * settings.debtStepRate;

  // Thiết kế 6.5: when Sale chooses the fund, draw just enough to reach the threshold, up to the fund's balance.
  const need = Math.max(0, threshold * cost - netProfitBeforeFund);
  const provisionFundDraw = input.useProvisionFund ? Math.min(need, Math.max(0, num(input.provisionFundBalance))) : 0;
  const netProfit = netProfitBeforeFund + provisionFundDraw;
  const netMargin = cost > 0 ? netProfit / cost : null;
  // A draw sized to the threshold lands on it only up to rounding, so compare with a tolerance far below 1 VND.
  const passed = cost > 0 ? netProfit >= threshold * cost - 1e-6 : netProfit > 0;
  const kpi = splitKpi(input, config.dealStageWeights, netProfit, appliedContractType);

  return {
    lines, unknownItemTypes, byType, byStructure, byPurchaseGroup, contractTypes, appliedContractType,
    revenue, cost, grossProfit, vatOut: sum(lines, (line) => line.vatOut), vatIn: sum(lines, (line) => line.vatIn),
    salesCost, finCostRate, finCost, profitAfterSales,
    warranty, licenseSupport, techSupport, deployBonus, provision, consultBonusRate, consultBonus,
    netProfitBeforeFund, provisionFundDraw, netProfit, netMargin, threshold, passed,
    weightSet: kpi.weightSet, kpiSplit: kpi.split,
  };
}
