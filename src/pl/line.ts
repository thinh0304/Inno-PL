// One catalogue line's revenue, cost and VAT: Đặc tả 4.2 steps 1–2, BR-03–BR-06.
import type { ItemType, PlLineInput, PlSettings } from './types';

export interface PlLineResult { id: string; itemTypeCode: string; itemType: ItemType | null;
  revenue: number; cost: number; vatOut: number; vatIn: number; profit: number; }

const DEFAULT_VAT_RATE = 0.08;

// A number still being typed (null, undefined, NaN) counts as 0, so the screen can compute while the user types.
export function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// An unknown item type (itemType = null) is computed as a one-off line with no flags.
export function computeLine(line: PlLineInput, itemType: ItemType | null, settings: PlSettings): PlLineResult {
  const quantity = num(line.quantity);
  const periods = itemType?.monthly ? num(line.months) : 1;
  const vatRate = line.vatRate == null ? DEFAULT_VAT_RATE : num(line.vatRate);
  const revenue = quantity * num(line.unitPrice) * (1 - num(line.discountPct)) * periods;
  const cost = quantity * num(line.unitCost) * periods * (itemType?.foreign ? 1 + settings.foreignContractorTax : 1);
  return {
    id: line.id, itemTypeCode: line.itemTypeCode, itemType,
    revenue, cost,
    vatOut: itemType?.vatExemptSale ? 0 : revenue * vatRate,
    vatIn: itemType?.vatExemptPurchase ? 0 : cost * vatRate,
    profit: revenue - cost,
  };
}
