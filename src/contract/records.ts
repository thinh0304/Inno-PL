// A contract record as the platform returns it (fields under `body`, references as ids or { id }, `file` as an array of
// attachment ids) -> ContractRec. The module and advance_order's Code step read records the same way.
import { fieldsOf, refId } from '../order/records';
import { parseNumber } from '../pl/config-records';
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
