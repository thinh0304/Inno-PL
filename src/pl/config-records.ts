// The configuration entities' records (snake_case fields, any order) turned into the engine's PlConfig.
import { DEFAULT_CONFIG } from './defaults';
import type { ContractType, ContractTypeRate, CustomerTier, DealStage, FinCostTier, ItemType, PlConfig, PlSettings,
  TaskSla, VatRate, WeightSet } from './types';

type Rec = Record<string, unknown>;

export interface ConfigRecords { item_type: Rec[]; contract_type_rate: Rec[]; fin_cost_tier: Rec[]; vat_rate: Rec[];
  pl_setting: Rec[]; task_sla: Rec[]; deal_stage_weight: Rec[] }

const CONTRACT_TYPE_ORDER: ContractType[] = ['tm_once', 'tmdk', 'dv_once', 'dv_recurring', 'fulfillment'];
const TIER_ORDER: CustomerTier[] = ['vip', 'potential', 'standard'];
const WEIGHT_SETS: WeightSet[] = ['new_tm', 'new_dvdk', 'tmdk', 'dvdk'];
const STAGES: DealStage[] = ['lead', 'opportunity', 'clarification', 'quotation', 'negotiation', 'close', 'contract'];

const str = (value: unknown) => (typeof value === 'string' ? value : '');
// A number may come back from a record read as a string ("0.08"); anything else that is not a number is undefined.
export function parseNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}
const num = (value: unknown) => parseNumber(value) ?? 0;
const bool = (value: unknown) => value === true;
const rank = <T>(order: T[], value: T) => (order.indexOf(value) + 1 || order.length + 1);
const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function itemType(r: Rec): ItemType {
  return {
    code: str(r.code), name: str(r.name), contractType: str(r.contract_type) as ItemType['contractType'],
    purchaseGroup: str(r.purchase_group) as ItemType['purchaseGroup'],
    revenueStructure: str(r.revenue_structure) as ItemType['revenueStructure'],
    monthly: bool(r.monthly), termed: bool(r.termed), foreign: bool(r.foreign),
    vatExemptSale: bool(r.vat_exempt_sale), vatExemptPurchase: bool(r.vat_exempt_purchase),
    warrantyBase: bool(r.warranty_base), licenseSupportBase: bool(r.license_support_base),
    techSupport: (str(r.tech_support) || 'none') as ItemType['techSupport'], deployBonusBase: bool(r.deploy_bonus_base),
    sortOrder: num(r.sort_order),
  };
}

function contractTypeRate(r: Rec): ContractTypeRate {
  return { code: str(r.code) as ContractType, name: str(r.name), threshold: num(r.threshold),
    techSupportBonus: num(r.tech_support_bonus), deployBonus: num(r.deploy_bonus), consultBonus: num(r.consult_bonus),
    salesBonus: num(r.sales_bonus), provision: num(r.provision) };
}

// A setting the record leaves blank keeps its default.
function settings(r: Rec | undefined): PlSettings {
  const defaults = DEFAULT_CONFIG.settings;
  if (!r) return { ...defaults };
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) =>
    [key, parseNumber(r[snake(key)]) ?? fallback])) as unknown as PlSettings;
}

export function configFromRecords(r: ConfigRecords): PlConfig {
  const itemTypes = r.item_type.filter((row) => row.active !== false).map(itemType)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  // The engine needs a rate for every contract type: one with no record keeps its default.
  const recordedRates = new Map(r.contract_type_rate.map(contractTypeRate).map((rate) => [rate.code, rate]));
  const contractTypeRates = [...DEFAULT_CONFIG.contractTypeRates.map((rate) => recordedRates.get(rate.code) ?? rate),
    ...[...recordedRates.values()].filter((rate) => !CONTRACT_TYPE_ORDER.includes(rate.code))];
  // No tier records at all → the default tiers, not a finance cost of 0.
  const finCostTiers: FinCostTier[] = r.fin_cost_tier.length === 0 ? [...DEFAULT_CONFIG.finCostTiers] : r.fin_cost_tier
    .map((row) => ({ tier: str(row.tier) as CustomerTier, fromRatio: num(row.from_ratio), rate: num(row.rate) }))
    .sort((a, b) => rank(TIER_ORDER, a.tier) - rank(TIER_ORDER, b.tier) || a.fromRatio - b.fromRatio);
  const vatRates: VatRate[] = [...r.vat_rate].sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((row) => ({ code: str(row.code), label: str(row.label), rate: num(row.rate), isDefault: bool(row.is_default) }));
  const taskSlas: TaskSla[] = [...r.task_sla].sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((row) => ({ taskCode: str(row.task_code), name: str(row.name), role: str(row.role) as TaskSla['role'],
      slaDays: num(row.sla_days) }));

  // No weight records at all → the default weights; otherwise a weight with no record counts as 0.
  const dealStageWeights = Object.fromEntries(WEIGHT_SETS.map((set) =>
    [set, Object.fromEntries(STAGES.map((stage) =>
      [stage, r.deal_stage_weight.length === 0 ? DEFAULT_CONFIG.dealStageWeights[set][stage] : 0]))])) as
    PlConfig['dealStageWeights'];
  for (const row of r.deal_stage_weight) {
    const set = str(row.weight_set) as WeightSet;
    const stage = str(row.stage) as DealStage;
    if (dealStageWeights[set] && stage in dealStageWeights[set]) dealStageWeights[set][stage] = num(row.weight);
  }

  // The setting record keyed "default" (the seed's) wins, whatever order the records come back in.
  const setting = r.pl_setting.find((row) => row.key === 'default') ?? r.pl_setting[0];
  return { itemTypes, contractTypeRates, finCostTiers, vatRates, settings: settings(setting),
    dealStageWeights, taskSlas };
}
