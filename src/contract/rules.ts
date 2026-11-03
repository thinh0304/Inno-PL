// The contract stage's rules (Đặc tả FR-7.1, FR-7.8, BR-44, BR-45, BR-46, BR-48), pure: the screens lock the
// buttons with them and advance_order reopens a task with them, so the API cannot get around them.
import type { TaskStatus } from '../flow/tasks';
import type { OrderDraft } from '../order/types';
import { validateOrder } from '../order/validate';
import type { PlConfig } from '../pl/types';
import type { ContractRec, ContractTask, GateIssue, Party, Slot, Step } from './types';

export type { ContractRec, ContractTask, GateIssue, Party, Slot, Step } from './types';

export const slotKey = (party: Party, supplier: string | null): string => (party === 'customer' ? 'customer' : `supplier:${supplier}`);

const ofSlot = (list: ContractRec[], party: Party, supplier: string | null) =>
  list.filter((c) => c.party === party && (party === 'customer' || c.supplier === supplier));

/** The contract in force for a slot and step: the highest version that has a file. */
export function latest(list: ContractRec[], party: Party, supplier: string | null, step: Step): ContractRec | null {
  let best: ContractRec | null = null;
  for (const c of ofSlot(list, party, supplier)) if (c.step === step && c.file && (!best || c.version > best.version)) best = c;
  return best;
}

/** The newest version of a step, with or without a file: the value a person entered is read from it. */
function newest(list: ContractRec[], party: Party, supplier: string | null, step: Step): ContractRec | null {
  let best: ContractRec | null = null;
  for (const c of ofSlot(list, party, supplier)) if (c.step === step && (!best || c.version > best.version)) best = c;
  return best;
}

/** BR-44: a contract above the limit must have a file; at the limit it need not. */
export const needsFile = (value: number, limit: number): boolean => value > limit;

/** The customer's contract, then one per supplier in the order of the lines, then suppliers no longer on any line. */
export function contractSlots(draft: OrderDraft, revenue: number, contracts: ContractRec[]): Slot[] {
  const costs = new Map<string, number>();
  for (const line of draft.lines) {
    const supplier = line.price.supplier;
    if (!supplier) continue;
    costs.set(supplier, (costs.get(supplier) ?? 0) + (line.price.unit_cost ?? 0) * (line.quantity ?? 0));
  }
  const slot = (party: Party, supplier: string | null, expectedValue: number, present: boolean): Slot => {
    const history = [...ofSlot(contracts, party, supplier)].sort((a, b) => b.version - a.version || (a.step < b.step ? -1 : 1));
    return { key: slotKey(party, supplier), party, supplier, expectedValue, present, history,
      draft: latest(contracts, party, supplier, 'draft'), final: latest(contracts, party, supplier, 'final'), orphan: !present };
  };
  const slots = [slot('customer', null, revenue, true), ...[...costs].map(([s, cost]) => slot('supplier', s, cost, true))];
  const orphans = new Set(contracts.filter((c) => c.party === 'supplier' && c.supplier && !costs.has(c.supplier)).map((c) => c.supplier!));
  for (const s of orphans) slots.push(slot('supplier', s, 0, false));
  return slots;
}

const STEP_OF: Record<ContractTask, Step> = { t40: 'draft', t44: 'draft', t41: 'final', t45: 'final' };
const PARTY_OF: Record<ContractTask, Party> = { t40: 'customer', t41: 'customer', t44: 'supplier', t45: 'supplier' };

const label = (slot: Slot) => (slot.party === 'customer' ? 'hợp đồng khách hàng' : `hợp đồng nhà cung cấp ${slot.supplier}`);

export interface GateContext { slots: Slot[]; draft: OrderDraft; config: PlConfig;
  t42: { status: TaskStatus; outcome: string | null };
  /** Findings of the AI check that block the slot (plan 05), by slot key. */ blockingFindings?: Record<string, number>; }

/** What still stops the task from being completed; [] when it may be. */
export function contractGate(task: ContractTask, ctx: GateContext): GateIssue[] {
  const issues: GateIssue[] = [];
  const step = STEP_OF[task];
  if (step === 'final' && !(ctx.t42.status === 'done' && ctx.t42.outcome === 'agreed')) {
    issues.push({ code: 'draft_not_approved', slot: null, message: 'SD chưa đồng ý trình ký dự thảo (t42)' });
  }
  if (task === 't41') {
    for (const issue of validateOrder(ctx.draft, ctx.config, 'customer_contract').issues) {
      if (issue.severity === 'error') issues.push({ code: 'order_fields', slot: null, message: `${issue.path}: ${issue.message}` });
    }
  }
  for (const slot of ctx.slots) {
    if (slot.party !== PARTY_OF[task] || slot.orphan) continue;
    const entered = newest(slot.history, slot.party, slot.supplier, step)?.value;
    const value = entered ?? slot.expectedValue;
    if (needsFile(value, ctx.config.settings.contractFileLimit) && !(step === 'draft' ? slot.draft : slot.final)) {
      issues.push({ code: step === 'draft' ? 'draft_missing' : 'final_missing', slot: slot.key,
        message: `Thiếu ${step === 'draft' ? 'dự thảo' : 'bản chính thức'} ${label(slot)}` });
    }
    if ((ctx.blockingFindings?.[slot.key] ?? 0) > 0) {
      issues.push({ code: 'ai_blocking', slot: slot.key, message: `Kiểm tra AI còn lỗi nghiêm trọng ở ${label(slot)}` });
    }
  }
  return issues;
}

/** BR-48: what is paid to a supplier in advance, in whole VND. */
export function prepayAmount(cost: number, percent: number | null): number {
  return percent === null ? 0 : Math.round(cost * percent);
}
