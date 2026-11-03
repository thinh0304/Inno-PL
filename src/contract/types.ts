// One uploaded contract (Thiết kế 6.3, Đặc tả FR-7.1): field keys are the keys of config/entities/contract.json.
// A contract record is never edited: every upload is a new record, the next version of its party, supplier and step.

export type Party = 'customer' | 'supplier';
export type Step = 'draft' | 'final';
export type ContractSource = 'upload' | 'template' | 'ai';

export interface ContractRec { id: string; order: string; party: Party; supplier: string | null; step: Step;
  /** The attachment id of the file, or null when it has none. */ file: string | null;
  /** The file's name as uploaded, when the read gives it. */ file_name?: string | null;
  uploaded_by: string | null; uploaded_at: string; source: ContractSource; value: number | null;
  /** Fraction of the contract's value the supplier is paid in advance (0.3 = 30%). */ advance_percent: number | null;
  version: number; ai_check: unknown | null; skip_reason: string; }

/** One contract of the order: the customer's, or one supplier's, with its latest draft and final. */
export interface Slot { key: string; party: Party; supplier: string | null; expectedValue: number;
  /** The party is still on the order (a supplier on some line). */ present: boolean;
  draft: ContractRec | null; final: ContractRec | null; history: ContractRec[];
  /** A supplier no longer on any line of the order. */ orphan: boolean; }

export type GateCode = 'draft_missing' | 'final_missing' | 'draft_not_approved' | 'order_fields' | 'ai_blocking';
export interface GateIssue { code: GateCode; slot: string | null; message: string;
  /** The order field an 'order_fields' issue is about (order.signed_on). */ path?: string; }
export type ContractTask = 't40' | 't44' | 't41' | 't45';
