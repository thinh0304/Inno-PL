// The P&L engine's data: its configuration (what Admin edits) and one order's input.
// Money is VND before VAT; rates are fractions (0.08 = 8%).

export type ContractType = 'tm_once' | 'tmdk' | 'dv_once' | 'dv_recurring' | 'fulfillment';
export type CustomerTier = 'vip' | 'potential' | 'standard';
export type PurchaseGroup = 'goods' | 'service';
export type RevenueStructure = 'one_time' | 'recurring';
export type TechSupport = 'none' | 'internal' | 'outsource';
export type WeightSet = 'new_tm' | 'new_dvdk' | 'tmdk' | 'dvdk';
export type DealStage = 'lead' | 'opportunity' | 'clarification' | 'quotation' | 'negotiation' | 'close' | 'contract';
export type TaskRole = 'am' | 'sa' | 'tm' | 'sd' | 'proc' | 'acc';

export interface ItemType {
  code: string; name: string; contractType: Exclude<ContractType, 'fulfillment'>;
  purchaseGroup: PurchaseGroup; revenueStructure: RevenueStructure;
  monthly: boolean; termed: boolean; foreign: boolean;
  vatExemptSale: boolean; vatExemptPurchase: boolean;
  warrantyBase: boolean; licenseSupportBase: boolean; techSupport: TechSupport; deployBonusBase: boolean;
  sortOrder: number;
}
export interface ContractTypeRate { code: ContractType; name: string; threshold: number; techSupportBonus: number;
  deployBonus: number; consultBonus: number; salesBonus: number; provision: number; }
export interface FinCostTier { tier: CustomerTier; fromRatio: number; rate: number; }
export interface VatRate { code: string; label: string; rate: number; isDefault: boolean; }
export interface PlSettings { exchangeRate: number; annualInterest: number; foreignContractorTax: number;
  licenseSupportRate: number; techSupportInternalRate: number; techSupportOutsourceRate: number; warrantyRate: number;
  autoApproveLimit: number; contractFileLimit: number; debtBaseDays: number; debtStepDays: number; debtStepRate: number;
  proposalBonus: number; pocBonus: number; }
export interface TaskSla { taskCode: string; name: string; role: TaskRole; slaDays: number; }
export interface PlConfig { itemTypes: ItemType[]; contractTypeRates: ContractTypeRate[]; finCostTiers: FinCostTier[];
  vatRates: VatRate[]; settings: PlSettings; dealStageWeights: Record<WeightSet, Record<DealStage, number>>;
  taskSlas: TaskSla[]; }

export interface PlLineInput { id: string; itemTypeCode: string; quantity: number | null; months: number | null;
  unitPrice: number | null; discountPct: number | null; vatRate: number | null; unitCost: number | null; }
export interface PlOrderInput { lines: PlLineInput[]; customerTier: CustomerTier; debtDays: number | null;
  salesCost: number | null; contractTypeOverride: ContractType | null;
  deployStaff: string | null; consultStaff: string | null; proposal: boolean; poc: boolean;
  useProvisionFund: boolean; provisionFundBalance: number;
  isNewOrder: boolean; isNewLogo: boolean; leadPerson: string | null;
  dealStages: { stage: Exclude<DealStage, 'lead'>; person: string | null }[]; }
