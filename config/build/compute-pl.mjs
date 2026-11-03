import {
  NOBODY, NOW, bind, code, decision, edges, end, flt, graph, lit, otherwise, ref, search, servicePrincipal, start,
  update, upsert, when, workflow,
} from "@reflexify/agentflow-app-builder/workflow";

// compute_pl: the order's official P&L (Thiết kế 5, 13.6). It runs as the automation principal, so AM / SA may only
// read the P&L entities; a workflow people start must run as them, so nobody starts it by hand: the screens (plan 02b)
// set order.pl_requested_at after each save, and the trigger below starts it on that change.

const ORDER = "${entity:order}";
const OF_ORDER = [flt("order", "eq", ref("subject.record_id"))];
const CONFIG = ["item_type", "contract_type_rate", "fin_cost_tier", "vat_rate", "pl_setting", "task_sla", "deal_stage_weight"];

// The fields compute_order_pl.js returns for each body (src/order/pl-records.ts; test/order/compute-workflow.test.ts).
const PL_FIELDS = {
  order_pl: ["revenue", "cost", "gross_profit", "vat_out", "vat_in", "sales_cost", "fin_cost", "warranty", "license_support",
    "tech_support", "deploy_bonus", "provision", "consult_bonus", "provision_fund_draw", "net_profit", "net_margin",
    "threshold", "passed", "applied_contract_type", "detail", "kpi_split", "config_snapshot", "computed_at", "source"],
  order_pl_service: ["revenue", "cost", "gross_profit", "one_time_revenue", "one_time_cost", "recurring_revenue",
    "recurring_cost", "internal_cost", "outsource_cost", "detail"],
  order_pl_goods: ["cost", "sale_cost_total", "proposed_cost_total", "actual_cost_total", "proc_saving", "detail"],
};
const ORDER_FIELDS = ["code", "has_goods", "has_service"];

const out = (path) => ref(`nodes.compute.output.${path}`);
const body = { type: "object" };
const OUTPUT_SCHEMA = {
  type: "object",
  properties: { skip: { type: "boolean" }, order_pl: body, order_pl_service: body, order_pl_goods: body, order: body },
  required: ["skip"],
};

const reads = [
  search("lines", "Đọc dòng danh mục", "${entity:order_line}", OF_ORDER, { limit: 500 }),
  search("goods_prices", "Đọc giá hàng hóa", "${entity:goods_line_price}", OF_ORDER, { limit: 500 }),
  search("service_prices", "Đọc giá dịch vụ", "${entity:service_line_price}", OF_ORDER, { limit: 500 }),
  search("finance", "Đọc tài chính đơn", "${entity:order_finance}", OF_ORDER, { limit: 1 }),
  search("proposals", "Đọc đề xuất mua", "${entity:purchase_proposal}", OF_ORDER, { limit: 500 }),
  search("existing", "Đọc P&L hiện có", "${entity:order_pl}", OF_ORDER, { limit: 1 }),
  ...CONFIG.map((key) => search(`cfg_${key}`, `Đọc cấu hình ${key}`, `\${entity:${key}}`, [], { limit: 500 })),
];

const compute = code("compute", "Tính P&L", "code/compute_order_pl.js", [
  ["order", ref("subject.record")],
  ...["lines", "goods_prices", "service_prices", "finance", "proposals", "existing"].map((id) => [id, ref(`nodes.${id}.output.records`)]),
  ...CONFIG.map((key) => [`cfg_${key}`, ref(`nodes.cfg_${key}.output.records`)]),
  ["now", NOW],
], OUTPUT_SCHEMA);

const writes = [
  ...Object.entries(PL_FIELDS).map(([entity, fields]) => upsert(`write_${entity}`, `Ghi ${entity}`, `\${entity:${entity}}`, "by_order", [
    bind("order", ref("subject.record_id")), ...fields.map((field) => bind(field, out(`${entity}.${field}`))),
  ])),
  update("write_order", "Ghi mã đơn", ORDER, "subject.record_id", ORDER_FIELDS.map((field) => bind(field, out(`order.${field}`)))),
];

const chain = ["start", ...reads.map((n) => n.id), "compute"];
const writeChain = ["write_order_pl", "write_order_pl_service", "write_order_pl_goods", "write_order", "done"];

export const workflows = {
  compute_pl: workflow(
    "compute_pl",
    "Tính P&L đơn hàng",
    "Đọc dòng, giá, tài chính, đề xuất mua của đơn và cấu hình hiện hành, tính P&L, rồi ghi P&L đơn, phần dịch vụ, phần hàng hóa và mã đơn. Đơn đã chốt số liệu thì không tính lại.",
    servicePrincipal("automation_principal"),
    NOBODY,
    graph(
      "Tính P&L đơn hàng",
      [
        start({ subject: ORDER }),
        ...reads,
        compute,
        decision("is_locked", "Đã chốt số liệu?", [
          when("e_locked", { "==": [{ var: "nodes.compute.output.skip" }, true] }),
          otherwise("e_compute"),
        ]),
        ...writes,
        end("done", "Đã tính", "Đã tính", {
          net_profit: { ...out("order_pl.net_profit"), label: "LN thuần" },
          passed: { ...out("order_pl.passed"), label: "Đạt ngưỡng" },
        }),
        end("locked", "Đã chốt số liệu", "Đã chốt số liệu", { skipped: lit(true) }),
      ],
      edges(
        ...chain.slice(1).map((to, i) => [`e_${chain[i]}_${to}`, chain[i], to]),
        ["e_compute_check", "compute", "is_locked"],
        ["e_locked", "is_locked", "locked"],
        ["e_compute", "is_locked", writeChain[0]],
        ...writeChain.slice(1).map((to, i) => [`e_${writeChain[i]}_${to}`, writeChain[i], to]),
      ),
    ),
  ),
};

export const triggers = {
  compute_pl_on_request: {
    workflow: "compute_pl",
    kind: "entity_record",
    config: {
      entity_id: ORDER, change_kind: "updated", input_mappings: [],
      filter: { in: ["pl_requested_at", { var: "event.changed" }] },
    },
  },
};
export const actions = {};
