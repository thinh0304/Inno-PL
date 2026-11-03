import type { PlLineInput, PlOrderInput } from '../../src/pl/types';

let nextId = 0;

// A line of the given item type with only the numbers a test names; the rest blank, VAT 8%.
export function line(itemTypeCode: string, fields: Partial<PlLineInput> = {}): PlLineInput {
  nextId += 1;
  return { id: `l${nextId}`, itemTypeCode, quantity: 1, months: null, unitPrice: null,
    discountPct: null, vatRate: 0.08, unitCost: null, ...fields };
}

// The tests' default order: tier potential, 30 days' debt, no sales cost, no staff, no fund, a new order.
export function order(lines: PlLineInput[], fields: Partial<PlOrderInput> = {}): PlOrderInput {
  return { lines, customerTier: 'potential', debtDays: 30, salesCost: 0, contractTypeOverride: null,
    deployStaff: null, consultStaff: null, proposal: false, poc: false,
    useProvisionFund: false, provisionFundBalance: 0,
    isNewOrder: true, isNewLogo: false, leadPerson: null, dealStages: [], ...fields };
}
