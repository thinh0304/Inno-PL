// What the order screens need from AgentFlow. The module talks to AgentFlow through it (http-orders-api.ts), and the
// demo and the tests through a fake (memory-orders-api.ts).
import type { SigningField } from '../contract/rules';
import type { ContractRec, Party, Step } from '../contract/types';
import type { TaskRec } from '../flow/advance';
import type { TaskOutcome } from '../flow/tasks';
import type { FinanceFields, OrderDraft, OrderFields, OrderRecords, Rec } from '../order/types';
import type { ConfigRecords } from '../pl/config-records';
import type { CustomerTier, PlConfig } from '../pl/types';

/** One of an order's fifteen tasks, as the screens read it; claimedBy is whoever holds it (null: nobody yet). */
export interface OrderTask extends TaskRec { order: string; claimedBy: string | null; }
/** A line of the order's log (order_event): nobody edits or deletes one. */
export interface OrderEvent { id: string; order: string; task_code: string | null; at: string; actor: string | null; role: string | null;
  action: string; note: string; reason: string; warnings: { source: string; level: string; text: string }[]; }
/** A warning the person saw and went ahead anyway (FR-6.10): logged with the action. */
export interface IgnoredWarning { source: 'ai' | 'system'; level: 'info' | 'warning' | 'critical'; text: string; }
/** A task waiting for this person: held by them, or offered to a group they are in. */
export interface WorkItem { task: OrderTask; orderCode: string; customerName: string; mine: boolean; }

export interface OrderSummary { id: string; code: string; customerName: string; customerCode: string; am: string | null;
  sa: string | null; status: OrderFields['status']; stage: number; createdAt: string;
  /** null: this person may not see it. */
  revenue: number | null; passed: boolean | null; myLines: number | null; }

/** What this person may read, as AgentFlow answers it (a 403 or 404 means no). */
export interface Access { seesPl: boolean; seesGoodsPrices: boolean; seesServicePrices: boolean; seesProposals: boolean;
  seesPlService: boolean; seesPlGoods: boolean; /** Reads the order's contracts (everyone but TM, Thiết kế 7.2). */ seesContracts: boolean;
  canCreateOrder: boolean; isAdmin: boolean; }

export interface OfficialPl { order_pl: Rec | null; order_pl_service: Rec | null; order_pl_goods: Rec | null; }
export interface Person { id: string; name: string; }
export interface StaffMember { id: string; code: string; name: string; user: string | null; team: string; active: boolean; }
export interface CustomerHit { id: string; code: string; name: string; taxCode: string; address: string; tier: CustomerTier | null; record: Rec; }
export interface LoadedOrder { draft: OrderDraft; records: OrderRecords; official: OfficialPl; proposals: Rec[]; }
export interface PreviousOrder { id: string; code: string; finance: FinanceFields; pl: Rec | null; }
export interface ProposalFields { proposed_cost: number | null; proposed_supplier: string | null; note: string; }

export interface OrdersApi {
  me(): Person;
  access(): Promise<Access>;
  config(): Promise<ConfigRecords>;
  staff(): Promise<StaffMember[]>;
  suppliers(): Promise<Rec[]>;
  createSupplier(input: { name: string; contact_name?: string; phone?: string }): Promise<Rec>;
  list(): Promise<OrderSummary[]>;
  load(id: string): Promise<LoadedOrder>;
  /** At least 2 characters; at most 6 hits. */
  findCustomers(text: string): Promise<CustomerHit[]>;
  previousOrders(customerId: string, beforeId: string | null): Promise<PreviousOrder[]>;
  /** Writes what changed (savePlan), then asks for the official P&L (order.pl_requested_at), then reads the order again. */
  save(draft: OrderDraft, saved: OrderRecords | null, config: PlConfig): Promise<LoadedOrder>;
  saveProposal(lineId: string, orderId: string, fields: ProposalFields): Promise<Rec>;
  deleteOrder(id: string): Promise<void>;
  /** The order's fifteen tasks, in flow order. [] when the person may not read them. */
  tasks(orderId: string): Promise<OrderTask[]>;
  /** The order's log, oldest first. */
  events(orderId: string): Promise<OrderEvent[]>;
  /** Takes the task if nobody holds it, sets its outcome (with a reason where one is needed) and logs what the person did.
   *  When the task is done but its log line was refused it throws OrdersError('EVENT_NOT_LOGGED'): the outcome stands. */
  act(task: OrderTask, outcome: TaskOutcome, reason: string, warnings: IgnoredWarning[]): Promise<void>;
  /** Tasks held by this person, then tasks offered to them. */
  myWork(): Promise<WorkItem[]>;
  /** Which of this order's tasks this person may act on (held by them or offered to them): the work list, without reading every row. */
  actionable(orderId: string): Promise<ReadonlySet<string>>;
  /** One task, or null when the person may not read it (a 403 or 404). */
  task(id: string): Promise<OrderTask | null>;
  /** A line of the order's log that the screens themselves write (ignoring a suggestion, ...); people's outcomes go through act. */
  logEvent(orderId: string, event: { action: string; note?: string; reason?: string; warnings?: IgnoredWarning[] }): Promise<void>;
  /** Close-lost: needs a reason, and is refused once the customer's contract is signed (BR-4A). */
  closeLost(orderId: string, reason: string): Promise<void>;
  /** The order's contracts, every version, newest first, with their file names; [] for a person who may not read them. */
  contracts(orderId: string): Promise<ContractRec[]>;
  /**
   * Uploads the file, then records it as the next version of its party, supplier and step. A refused upload records nothing
   * (UPLOAD_FAILED, or UPLOAD_NOT_ALLOWED when AgentFlow does not let the app upload files, F-25).
   */
  uploadContract(orderId: string, input: ContractUpload): Promise<ContractRec>;
  /**
   * BR-45: SA writes the order's signing fields at t41, after submission (they lock once the contract is signed). Any other
   * field is refused here (NOT_SIGNING_FIELD).
   */
  saveSigning(orderId: string, fields: Partial<Pick<OrderFields, SigningField>>): Promise<void>;
  /** A link the browser opens to download the contract's file; null when it has none. */
  contractFileUrl(contract: ContractRec): string | null;
}

export interface ContractUpload { party: Party; supplier: string | null; step: Step; file: File; value: number | null; advance_percent: number | null; }

/**
 * A refused or failed call. `reason` is AgentFlow's own sentence when it gave one, shown to the person as it is.
 * `created` maps the temporary keys of records a failed save had already created to their ids, so Save again
 * continues instead of creating them twice.
 */
export class OrdersError extends Error {
  override name = 'OrdersError';
  constructor(readonly code: string, readonly reason: string | null, readonly created: Record<string, string> = {},
    readonly status?: number) {
    super(reason ? `${code}: ${reason}` : code);
  }
}
