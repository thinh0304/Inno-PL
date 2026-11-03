// Order TM-1040 as entered in docs/source/TM-1040.xlsx (sheet PL): two TB lines at 8% VAT.
import type { PlOrderInput } from '../../../src/pl/types';

export const TM1040: PlOrderInput = {
  lines: [
    { id: 'seagate', itemTypeCode: 'TB', quantity: 12, months: 24, unitPrice: 21_000_000,
      discountPct: 0, vatRate: 0.08, unitCost: 19_000_000 },
    // The Excel holds QNAP's purchase price VAT-inclusive; the engine takes it before VAT.
    { id: 'qnap', itemTypeCode: 'TB', quantity: 1, months: 60, unitPrice: 168_000_000,
      discountPct: 0, vatRate: 0.08, unitCost: 150_920_000 / 1.08 },
  ],
  customerTier: 'potential', debtDays: 30, salesCost: 0, contractTypeOverride: null,
  deployStaff: null, consultStaff: null, proposal: false, poc: false,
  useProvisionFund: false, provisionFundBalance: 0,
  isNewOrder: true, isNewLogo: false, leadPerson: null,
  dealStages: [
    { stage: 'opportunity', person: 'ThuanNG' }, { stage: 'clarification', person: 'ThuanNG' },
    { stage: 'quotation', person: 'ThuanNG' }, { stage: 'negotiation', person: 'ThuanNG' },
    { stage: 'close', person: 'ThuanNG' }, { stage: 'contract', person: 'ThuDTH' },
  ],
};
