// Default configuration: Đặc tả 4.1–4.3, Module 6, and the Define sheet (Thiết kế 13.3).
// The config entities' seeds carry these same values; test/pl/config-records.test.ts keeps them in step.
import type { ContractTypeRate, CustomerTier, FinCostTier, ItemType, PlConfig } from './types';

type Flags = Partial<Omit<ItemType, 'code' | 'name' | 'contractType' | 'purchaseGroup' | 'revenueStructure' | 'sortOrder'>>;

function itemType(sortOrder: number, code: string, name: string, contractType: ItemType['contractType'],
  purchaseGroup: ItemType['purchaseGroup'], revenueStructure: ItemType['revenueStructure'], flags: Flags = {}): ItemType {
  return {
    code, name, contractType, purchaseGroup, revenueStructure,
    monthly: false, termed: false, foreign: false, vatExemptSale: false, vatExemptPurchase: false,
    warrantyBase: false, licenseSupportBase: false, techSupport: 'none', deployBonusBase: false,
    ...flags, sortOrder,
  };
}

const internalRecurring: Flags = { monthly: true, termed: true, vatExemptPurchase: true, techSupport: 'internal' };

const ITEM_TYPES: ItemType[] = [
  itemType(1, 'TB', 'Thiết bị', 'tm_once', 'goods', 'one_time', { warrantyBase: true }),
  itemType(2, 'LIC', 'License vĩnh viễn', 'tm_once', 'goods', 'one_time',
    { vatExemptSale: true, vatExemptPurchase: true, licenseSupportBase: true }),
  itemType(3, 'LIC-DK', 'License có kỳ hạn', 'tmdk', 'goods', 'recurring',
    { termed: true, vatExemptSale: true, vatExemptPurchase: true, licenseSupportBase: true }),
  itemType(4, 'LIC-NTNN', 'License nhà thầu nước ngoài', 'tmdk', 'service', 'recurring',
    { termed: true, foreign: true, vatExemptSale: true, vatExemptPurchase: true, licenseSupportBase: true }),
  itemType(5, 'DVTK-I', 'Dịch vụ triển khai nội bộ', 'dv_once', 'service', 'one_time',
    { vatExemptPurchase: true, deployBonusBase: true }),
  itemType(6, 'DVTK-O', 'Dịch vụ triển khai thuê ngoài', 'dv_once', 'service', 'one_time', { techSupport: 'outsource' }),
  itemType(7, 'Cloud Server', 'Cloud Server', 'dv_recurring', 'service', 'recurring', internalRecurring),
  itemType(8, 'Colocation', 'Colocation', 'dv_recurring', 'service', 'recurring', internalRecurring),
  itemType(9, 'Veeam', 'Veeam (Backup/DR)', 'dv_recurring', 'service', 'recurring', internalRecurring),
  itemType(10, 'Manage Service', 'Manage Service', 'dv_recurring', 'service', 'recurring', internalRecurring),
  itemType(11, 'Other Services', 'Dịch vụ khác', 'dv_recurring', 'service', 'recurring', internalRecurring),
  itemType(12, 'DVDK-O', 'Dịch vụ định kỳ thuê ngoài', 'dv_recurring', 'service', 'recurring',
    { monthly: true, termed: true }),
  itemType(13, 'DVDK-NTNN', 'Dịch vụ định kỳ nhà thầu nước ngoài', 'dv_recurring', 'service', 'recurring',
    { monthly: true, termed: true, foreign: true, licenseSupportBase: true }),
];

function rate(code: ContractTypeRate['code'], name: string, threshold: number, techSupportBonus: number,
  deployBonus: number, consultBonus: number, salesBonus: number, provision: number): ContractTypeRate {
  return { code, name, threshold, techSupportBonus, deployBonus, consultBonus, salesBonus, provision };
}

const CONTRACT_TYPE_RATES: ContractTypeRate[] = [
  rate('tm_once', 'Thương mại 1 lần', 0.08, 0.03, 0.05, 0.03, 0.10, 0.01),
  rate('tmdk', 'Thương mại định kỳ', 0.05, 0.03, 0.05, 0.01, 0.08, 0.005),
  rate('dv_once', 'Dịch vụ 1 lần', 0.40, 0.03, 0.05, 0.03, 0.10, 0.05),
  rate('dv_recurring', 'Dịch vụ định kỳ', 0.10, 0.03, 0.05, 0.03, 0.10, 0.05),
  rate('fulfillment', 'Fulfillment', 0.03, 0.03, 0.05, 0.01, 0, 0),
];

// Đặc tả 4.3: eight steps of 10% in CPBH / cost; each tier starts at its own rate and rises 5% a step.
// Written out rather than computed so that every value is the exact decimal the seed holds.
const TIER_RATES: Record<CustomerTier, number[]> = {
  vip: [0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50],
  potential: [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55],
  standard: [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60],
};
const FROM_RATIOS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
const FIN_COST_TIERS: FinCostTier[] = (Object.keys(TIER_RATES) as CustomerTier[]).flatMap((tier) =>
  FROM_RATIOS.map((fromRatio, step) => ({ tier, fromRatio, rate: TIER_RATES[tier][step] })));

export const DEFAULT_CONFIG: PlConfig = {
  itemTypes: ITEM_TYPES,
  contractTypeRates: CONTRACT_TYPE_RATES,
  finCostTiers: FIN_COST_TIERS,
  vatRates: [
    { code: 'kct', label: 'KCT', rate: 0, isDefault: false },
    { code: '0', label: '0%', rate: 0, isDefault: false },
    { code: '5', label: '5%', rate: 0.05, isDefault: false },
    { code: '8', label: '8%', rate: 0.08, isDefault: true },
    { code: '10', label: '10%', rate: 0.10, isDefault: false },
  ],
  settings: {
    exchangeRate: 26000, annualInterest: 0.146, foreignContractorTax: 0.12,
    licenseSupportRate: 0.005, techSupportInternalRate: 0.05, techSupportOutsourceRate: 0.02, warrantyRate: 0.002,
    autoApproveLimit: 300_000_000, contractFileLimit: 20_000_000,
    debtBaseDays: 30, debtStepDays: 15, debtStepRate: 0.005, proposalBonus: 0.02, pocBonus: 0.02,
  },
  dealStageWeights: {
    new_tm: { lead: 0.3, opportunity: 0.2, clarification: 0.3, quotation: 0.1, negotiation: 0.1, close: 0.2, contract: 0.1 },
    new_dvdk: { lead: 0.3, opportunity: 0.2, clarification: 0.3, quotation: 0.05, negotiation: 0.1, close: 0.2, contract: 0.15 },
    tmdk: { lead: 0, opportunity: 0, clarification: 0, quotation: 0.1, negotiation: 0.1, close: 0.2, contract: 0.1 },
    dvdk: { lead: 0, opportunity: 0, clarification: 0, quotation: 0.05, negotiation: 0.1, close: 0.2, contract: 0.15 },
  },
  taskSlas: [
    { taskCode: 't11', name: 'Lập đơn hàng & gửi duyệt', role: 'am', slaDays: 1 },
    { taskCode: 't22', name: 'Duyệt giải pháp & chi phí kỹ thuật', role: 'tm', slaDays: 1 },
    { taskCode: 't23', name: 'Đề xuất giá mua & NCC', role: 'proc', slaDays: 1 },
    { taskCode: 't31', name: 'Phê duyệt đơn & phương án mua hàng', role: 'sd', slaDays: 1 },
    { taskCode: 't40', name: 'Dự thảo HĐ khách hàng', role: 'sa', slaDays: 2 },
    { taskCode: 't44', name: 'Dự thảo HĐ nhà cung cấp', role: 'proc', slaDays: 1 },
    { taskCode: 't42', name: 'Duyệt dự thảo hợp đồng', role: 'sd', slaDays: 1 },
    { taskCode: 't41', name: 'Ký HĐ khách hàng · bản chính thức', role: 'sa', slaDays: 3 },
    { taskCode: 't45', name: 'Ký HĐ nhà cung cấp · bản chính thức (SD ký = duyệt tạm ứng)', role: 'proc', slaDays: 2 },
    { taskCode: 't51', name: 'Xác nhận KH tạm ứng', role: 'acc', slaDays: 3 },
    { taskCode: 't53', name: 'Thanh toán tạm ứng NCC', role: 'acc', slaDays: 2 },
    { taskCode: 't61', name: 'Nhận hàng & giao cho KH', role: 'proc', slaDays: 7 },
    { taskCode: 't62', name: 'Triển khai & nghiệm thu', role: 'tm', slaDays: 7 },
    { taskCode: 't71', name: 'Kiểm tra biên bản, xuất hóa đơn & gửi hồ sơ thanh toán', role: 'acc', slaDays: 2 },
    { taskCode: 't72', name: 'Lưu trữ hồ sơ & cập nhật chi phí phát sinh', role: 'acc', slaDays: 1 },
  ],
};
