// What a person sees, decided by what AgentFlow lets them read: a probe per entity, never a guess from a group name.
import type { OrderFields } from '../order/types';
import type { Access, Person, StaffMember } from './orders-api.js';
import type { TabKey } from './routes.js';

export interface AccessSource { canRead(entity: string): Promise<boolean>; staff(): Promise<StaffMember[]>; me(): Person }

export async function probeAccess(source: AccessSource): Promise<Access> {
  const [seesPl, seesGoodsPrices, seesServicePrices, seesProposals, seesPlService, seesPlGoods, staff] = await Promise.all([
    source.canRead('order_pl'), source.canRead('goods_line_price'), source.canRead('service_line_price'),
    source.canRead('purchase_proposal'), source.canRead('order_pl_service'), source.canRead('order_pl_goods'),
    source.staff().catch(() => [] as StaffMember[]),
  ]);
  const me = source.me().id;
  // Only Sales and Sales Admin start orders (FR-1.5); staff records say who is which.
  const canCreateOrder = staff.some((s) => s.user === me && s.active && (s.team === 'sales' || s.team === 'sa'));
  // Reads all P&L, no purchase proposals, not a salesperson: the app's admin. Only shows the Delete button;
  // AgentFlow still decides the delete.
  const isAdmin = seesPl && !seesProposals && !canCreateOrder;
  return { seesPl, seesGoodsPrices, seesServicePrices, seesProposals, seesPlService, seesPlGoods, canCreateOrder, isAdmin };
}

/**
 * The order page's tabs, in the mockup's order for each role (ROLETABS), then the flow and the history for every saved
 * order (a new order has neither yet).
 */
export function tabsFor(access: Access, editor: boolean, saved = true): TabKey[] {
  const flow: TabKey[] = saved ? ['flow', 'history'] : [];
  if (editor) return ['form', 'lines', 'suppliers', 'pl', ...flow];
  if (access.seesPl && access.seesProposals) return ['pl', 'lines', 'purchase', 'suppliers', 'form', ...flow];
  if (access.seesPl) return ['pl', 'lines', 'suppliers', 'form', ...flow];
  if (access.seesProposals || access.seesGoodsPrices || access.seesServicePrices) return ['purchase', ...flow];
  return ['form', ...flow];
}

/** The AM or SA of a draft order edits it; locking at later stages is plan 03's. */
export function isEditor(order: OrderFields, me: Person): boolean {
  return order.status === 'draft' && (order.am === me.id || order.sa === me.id);
}
