// The engine's result → the bodies compute_pl writes: order_pl (all of it), order_pl_service (what TM may read),
// order_pl_goods (what PROC may read, with the purchasing KPI of Thiết kế 13.4), and the order's code (BR-53).
import type { PlResult } from '../pl/compute';
import type { PlConfig } from '../pl/types';
import { fieldsOf, lineGroup, refId } from './records';
import type { OrderDraft, Rec } from './types';

export interface PlRecordBodies { order_pl: Rec; order_pl_service: Rec; order_pl_goods: Rec;
  order: { code: string; has_goods: boolean; has_service: boolean } }

const n = (value: number | null | undefined) => value ?? 0;

export function plRecordsFromResult(draft: OrderDraft, result: PlResult, config: PlConfig, proposals: Rec[],
  computedAt: string): PlRecordBodies {
  const groups = draft.lines.map((line) => lineGroup(line.item_type_code, config));
  const hasGoods = groups.includes('goods');
  const hasService = groups.includes('service');
  const resultLine = new Map(result.lines.map((line) => [line.id, line]));

  const order_pl: Rec = {
    revenue: result.revenue, cost: result.cost, gross_profit: result.grossProfit, vat_out: result.vatOut, vat_in: result.vatIn,
    sales_cost: result.salesCost, fin_cost: result.finCost, warranty: result.warranty, license_support: result.licenseSupport,
    tech_support: result.techSupport, deploy_bonus: result.deployBonus, provision: result.provision,
    consult_bonus: result.consultBonus, provision_fund_draw: result.provisionFundDraw, net_profit: result.netProfit,
    net_margin: result.netMargin, threshold: result.threshold, passed: result.passed,
    applied_contract_type: result.appliedContractType,
    detail: JSON.stringify({ lines: result.lines.map(({ itemType: _itemType, ...line }) => line), byType: result.byType,
      byStructure: result.byStructure, byPurchaseGroup: result.byPurchaseGroup, contractTypes: result.contractTypes,
      unknownItemTypes: result.unknownItemTypes,
      // A price in the other group's entity is readable by the wrong role (TM / PROC): the screens must move it.
      misplacedPrices: draft.lines.filter((line, i) => line.price.source && groups[i] && line.price.source !== groups[i]).map((line) => line.id), finCostRate: result.finCostRate, consultBonusRate: result.consultBonusRate,
      netProfitBeforeFund: result.netProfitBeforeFund, profitAfterSales: result.profitAfterSales, weightSet: result.weightSet }),
    kpi_split: JSON.stringify(result.kpiSplit),
    config_snapshot: JSON.stringify(config),
    computed_at: computedAt,
    source: 'computed',
  };

  // Service lines: one-off / recurring by revenue structure; internal (…-I, internal recurring) / outsourced (…-O).
  const service = { revenue: 0, cost: 0, one_time_revenue: 0, one_time_cost: 0, recurring_revenue: 0, recurring_cost: 0,
    internal_cost: 0, outsource_cost: 0 };
  const serviceByType: Record<string, { revenue: number; cost: number }> = {};
  for (const line of result.lines) {
    const type = line.itemType;
    if (type?.purchaseGroup !== 'service') continue;
    service.revenue += line.revenue; service.cost += line.cost;
    if (type.revenueStructure === 'recurring') { service.recurring_revenue += line.revenue; service.recurring_cost += line.cost; }
    else { service.one_time_revenue += line.revenue; service.one_time_cost += line.cost; }
    if (type.code.endsWith('-I') || type.techSupport === 'internal') service.internal_cost += line.cost;
    if (type.code.endsWith('-O')) service.outsource_cost += line.cost;
    const byType = (serviceByType[type.code] ??= { revenue: 0, cost: 0 });
    byType.revenue += line.revenue; byType.cost += line.cost;
  }
  const order_pl_service: Rec = { ...service, gross_profit: service.revenue - service.cost, detail: JSON.stringify(serviceByType) };

  // Goods lines: Sale's expected cost against PROC's proposal (t23) and the actual cost; saving = (Sale − PROC) × qty.
  const proposalByLine = new Map(proposals.map(fieldsOf).map((p) => [refId(p.order_line) ?? '', p]));
  const goods = { sale_cost_total: 0, proposed_cost_total: 0, actual_cost_total: 0, proc_saving: 0 };
  const goodsDetail: Rec[] = [];
  draft.lines.forEach((line, i) => {
    if (groups[i] !== 'goods') return;
    const quantity = n(line.quantity);
    const proposal = proposalByLine.get(line.id);
    const proposed = typeof proposal?.proposed_cost === 'number' ? proposal.proposed_cost : null;
    const actual = typeof proposal?.actual_cost === 'number' ? proposal.actual_cost : null;
    goods.sale_cost_total += n(line.price.unit_cost) * quantity;
    if (proposed !== null) {
      goods.proposed_cost_total += proposed * quantity;
      goods.proc_saving += (n(line.price.unit_cost) - proposed) * quantity;
    }
    if (actual !== null) goods.actual_cost_total += actual * quantity;
    goodsDetail.push({ line: line.id, item_type_code: line.item_type_code, quantity, sale_unit_cost: line.price.unit_cost,
      proposed_unit_cost: proposed, actual_unit_cost: actual, cost: resultLine.get(line.id)?.cost ?? 0 });
  });
  const order_pl_goods: Rec = { cost: result.byPurchaseGroup.goods.cost, ...goods, detail: JSON.stringify(goodsDetail) };

  const code = draft.lines.length === 0 ? '' : `${hasGoods ? 'TM-' : 'DV-'}${draft.order.number ?? ''}`;
  return { order_pl, order_pl_service, order_pl_goods, order: { code, has_goods: hasGoods, has_service: hasService } };
}
