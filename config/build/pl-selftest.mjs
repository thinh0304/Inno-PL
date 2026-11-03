import { INITIATOR, code, edges, end, graph, lit, ref, restricted, start, workflow } from "@reflexify/agentflow-app-builder/workflow";

// Order TM-1040 (docs/source/TM-1040.xlsx), the same input as test/pl/fixtures/tm1040.ts:
// the run should end with net profit 46,272,444.44 and passed = true.
const TM1040 = {
  lines: [
    { id: "seagate", itemTypeCode: "TB", quantity: 12, months: 24, unitPrice: 21000000, discountPct: 0, vatRate: 0.08,
      unitCost: 19000000 },
    { id: "qnap", itemTypeCode: "TB", quantity: 1, months: 60, unitPrice: 168000000, discountPct: 0, vatRate: 0.08,
      unitCost: 150920000 / 1.08 },
  ],
  customerTier: "potential", debtDays: 30, salesCost: 0, contractTypeOverride: null,
  deployStaff: null, consultStaff: null, proposal: false, poc: false,
  useProvisionFund: false, provisionFundBalance: 0,
  isNewOrder: true, isNewLogo: false, leadPerson: null,
  dealStages: [
    { stage: "opportunity", person: "ThuanNG" }, { stage: "clarification", person: "ThuanNG" },
    { stage: "quotation", person: "ThuanNG" }, { stage: "negotiation", person: "ThuanNG" },
    { stage: "close", person: "ThuanNG" }, { stage: "contract", person: "ThuDTH" },
  ],
};

// The members of the engine's result a workflow reads; the step returns the whole PlResult.
export const PL_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    revenue: { type: "number" }, cost: { type: "number" }, netProfit: { type: "number" },
    netMargin: { type: ["number", "null"] }, threshold: { type: "number" }, passed: { type: "boolean" },
  },
  required: ["revenue", "cost", "netProfit", "threshold", "passed"],
};

export const workflows = {
  pl_selftest: workflow(
    "pl_selftest",
    "Tự kiểm bộ tính P&L",
    "Chạy bộ tính P&L trên đơn mẫu TM-1040 với cấu hình mặc định, để kiểm Code step của deployment: kết quả đúng là LN thuần 46.272.444,44 và Đạt.",
    INITIATOR,
    restricted("admin_group"),
    graph(
      "Tự kiểm bộ tính P&L",
      [
        start({}),
        code("pl", "Tính P&L đơn TM-1040", "code/compute_pl.js",
          [["input", lit(TM1040)], ["config", lit(null)]], PL_OUTPUT_SCHEMA),
        end("done", "Xong", "Xong", {
          net_profit: { ...ref("nodes.pl.output.netProfit"), label: "LN thuần" },
          passed: { ...ref("nodes.pl.output.passed"), label: "Đạt ngưỡng" },
        }),
      ],
      edges(["e_start", "start", "pl"], ["e_done", "pl", "done"]),
    ),
  ),
};

export const triggers = {};
export const actions = {};
