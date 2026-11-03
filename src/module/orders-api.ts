// What the order screens need from AgentFlow. The module talks to AgentFlow through it (http-orders-api.ts), and the
// demo and the tests through a fake (memory-orders-api.ts).
import type { FinanceFields, OrderDraft, OrderFields, OrderRecords, Rec } from '../order/types';
import type { ConfigRecords } from '../pl/config-records';
import type { CustomerTier, PlConfig } from '../pl/types';

export interface OrderSummary { id: string; code: string; customerName: string; customerCode: string; am: string | null;
  sa: string | null; status: OrderFields['status']; stage: number; createdAt: string;
  /** null: this person may not see it. */
  revenue: number | null; passed: boolean | null; myLines: number | null; }

/** What this person may read, as AgentFlow answers it (a 403 or 404 means no). */
export interface Access { seesPl: boolean; seesGoodsPrices: boolean; seesServicePrices: boolean; seesProposals: boolean;
  seesPlService: boolean; seesPlGoods: boolean; canCreateOrder: boolean; isAdmin: boolean; }

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
}

/**
 * A refused or failed call. `reason` is AgentFlow's own sentence when it gave one, shown to the person as it is.
 * `created` maps the temporary keys of records a failed save had already created to their ids, so Save again
 * continues instead of creating them twice.
 */
export class OrdersError extends Error {
  override name = 'OrdersError';
  constructor(readonly code: string, readonly reason: string | null, readonly created: Record<string, string> = {}) {
    super(reason ? `${code}: ${reason}` : code);
  }
}
