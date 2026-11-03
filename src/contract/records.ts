// A contract record as the platform returns it (fields under `body`, references as ids or { id }, `file` as an array of
// attachment ids) -> ContractRec. The module and advance_order's Code step read records the same way.
import { fieldsOf, refId } from '../order/records';
import type { Rec } from '../order/types';
import { parseNumber } from '../pl/config-records';
import type { ProposalTerms } from './rules';
import type { ContractRec, ContractSource, Party, Step } from './types';

const str = (value: unknown) => (value == null ? '' : String(value));

export function contractFromRecord(record: unknown): ContractRec {
  const r = fieldsOf(record);
  const files = Array.isArray(r.file) ? r.file : r.file ? [r.file] : [];
  const first = files.map((f) => (f && typeof f === 'object' ? (f as { id?: unknown }).id : f)).find((f) => f != null && f !== '');
  return { id: str(r.id), order: refId(r.order) ?? '', party: str(r.party) as Party, supplier: refId(r.supplier), step: str(r.step) as Step,
    file: first == null ? null : String(first), uploaded_by: refId(r.uploaded_by), uploaded_at: str(r.uploaded_at ?? r.created_at),
    source: (str(r.source) || 'upload') as ContractSource, value: parseNumber(r.value) ?? null, advance_percent: parseNumber(r.advance_percent) ?? null,
    version: parseNumber(r.version) ?? 1, ai_check: r.ai_check ?? null, skip_reason: str(r.skip_reason) };
}

/** Purchasing's proposals as the platform returns them -> the terms contractSlots reads. */
export function proposalTerms(records: unknown[]): ProposalTerms[] {
  return (records ?? []).map(fieldsOf).map((p) => ({ order_line: refId(p.order_line), proposed_supplier: refId(p.proposed_supplier),
    proposed_cost: parseNumber(p.proposed_cost) ?? null }));
}

/** The next version of a party's (and supplier's) contract at a step: one more than the highest recorded. */
export function nextVersion(list: ContractRec[], party: Party, supplier: string | null, step: Step): number {
  const same = list.filter((c) => c.party === party && c.step === step && (party === 'customer' || c.supplier === supplier));
  return same.reduce((max, c) => Math.max(max, c.version), 0) + 1;
}

/** What the create form of `contract` receives for an upload. */
export function contractBody(orderId: string, input: { party: Party; supplier: string | null; step: Step; value: number | null;
  advance_percent: number | null }, fileId: string, by: string, at: string, version: number): Rec {
  // An empty number is left out: the create form refuses null for a number field.
  return { order: orderId, party: input.party, ...(input.party === 'supplier' ? { supplier: input.supplier } : {}), step: input.step,
    file: [fileId], version, uploaded_by: by, uploaded_at: at, source: 'upload', ...(input.value !== null ? { value: input.value } : {}),
    ...(input.party === 'supplier' && input.advance_percent !== null ? { advance_percent: input.advance_percent } : {}) };
}

/** Newest first: by version, then by the time it was uploaded. */
export const byNewest = (a: ContractRec, b: ContractRec) => b.version - a.version || (a.uploaded_at < b.uploaded_at ? 1 : -1);
