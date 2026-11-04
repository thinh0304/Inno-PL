// Loại dòng hàng và cách tính một dòng (spec §4.1–4.3).
import type { PlConfig } from './config';

export const LINE_TYPES = [
  'TB', 'LIC', 'LIC-DK', 'LIC-NTNN', 'DVTK-I', 'DVTK-O', 'DVDK-I', 'DVDK-O', 'DVDK-NTNN',
  'Cloud Server', 'Colocation', 'Veeam', 'Manage Service', 'Other Services',
] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const CONTRACT_KINDS = ['Thương Mại', 'License/Runrate', 'Dịch vụ Loại I', 'Dịch vụ Loại II', 'Fulfillment'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export interface Line { type: LineType; qty: number; sell: number; discountPct: number; buy: number; months: number }

const GOODS: readonly LineType[] = ['TB', 'LIC', 'LIC-DK', 'LIC-NTNN'];
const MONTHLY: readonly LineType[] = ['DVDK-I', 'DVDK-O', 'DVDK-NTNN', 'Cloud Server', 'Colocation', 'Veeam', 'Manage Service', 'Other Services'];
const PERIODIC: readonly LineType[] = ['LIC-DK', 'LIC-NTNN'];
const FOREIGN: readonly LineType[] = ['LIC-NTNN', 'DVDK-NTNN'];

/** Hàng hóa (thiết bị/license): có mua hàng, HĐ NCC. LIC-NTNN là license (spec §4.1). */
export const isGoods = (t: LineType): boolean => GOODS.includes(t);
export const isService = (t: LineType): boolean => !isGoods(t);
/** Giá là giá tháng, nhân số tháng. */
export const isMonthly = (t: LineType): boolean => MONTHLY.includes(t);
export const isPeriodic = (t: LineType): boolean => PERIODIC.includes(t);
export const isForeign = (t: LineType): boolean => FOREIGN.includes(t);

const monthFactor = (l: Line): number => (isMonthly(l.type) ? l.months || 1 : 1);

export function lineSell(l: Line): number {
  return l.qty * l.sell * (1 - (l.discountPct || 0) / 100) * monthFactor(l);
}

export function lineBuy(l: Line, cfg: PlConfig): number {
  return l.qty * l.buy * monthFactor(l) * (isForeign(l.type) ? 1 + cfg.foreignFactor : 1);
}

/** Loại HĐ của một dòng (spec §4.3). Không bao giờ là Fulfillment: người lập chọn tay. */
export function contractKindOf(t: LineType): ContractKind {
  if (isMonthly(t)) return 'Dịch vụ Loại II';
  if (isPeriodic(t)) return 'License/Runrate';
  if (isService(t)) return 'Dịch vụ Loại I';
  return 'Thương Mại';
}

/** Các loại HĐ có trong đơn, kèm doanh thu của từng loại, theo thứ tự xuất hiện. */
export function detectContractKinds(lines: Line[]): { kind: ContractKind; revenue: number }[] {
  const out: { kind: ContractKind; revenue: number }[] = [];
  for (const l of lines) {
    const kind = contractKindOf(l.type);
    const hit = out.find((x) => x.kind === kind);
    if (hit) hit.revenue += lineSell(l);
    else out.push({ kind, revenue: lineSell(l) });
  }
  return out;
}
