import {
  NOBODY, NOW, bind, code, create, decision, edges, end, flt, getById, graph, lit, node, otherwise, ref, search,
  servicePrincipal, start, update, updateMany, when, workflow,
} from "@reflexify/agentflow-app-builder/workflow";

// The 15-task flow (design 6.3, plan 03). People only set a task's outcome; these four workflows, all run as the
// automation principal by a trigger, do the rest:
//   init_order_tasks  an order is created: its fifteen tasks, t11 open.
//   advance_order     a task changes status: src/flow/advance.ts decides what opens, resets, approves and logs.
//   close_lost_order  an order becomes Close-lost: its open and blocked tasks are cancelled.
//   sla_sweep         hourly on working days: due soon / overdue on each open task.
// A workflow has at most one trigger, so each of the four has its own.

const ORDER = "${entity:order}";
const TASK = "${entity:order_task}";
const EVENT = "${entity:order_event}";
const CONFIG = ["item_type", "contract_type_rate", "fin_cost_tier", "vat_rate", "pl_setting", "task_sla", "deal_stage_weight"];

const array = { type: "array", items: { type: "object" } };
const ADVANCE_SCHEMA = {
  type: "object",
  properties: { order_fields: { type: "object" }, order_changed: { type: "boolean" }, status_changed: { type: "boolean" }, order_status: { type: "string" },
    create_list: array, update_list: array, event_list: array },
  required: ["order_changed", "status_changed", "create_list", "update_list", "event_list"],
};
const adv = (path) => ref(`nodes.advance.output.${path}`);
const item = (field) => ref(`input.item.${field}`);

// The fields of order_task a run writes (src/flow/code-entry.ts: create_list and update_list).
const TASK_VALUES = ["status", "outcome", "reason", "opened_at", "due_at", "finished_at", "due_state", "late_days"];
const TASK_CREATE = ["order", "task_code", "stage", "role", "am_user", "sla_days", ...TASK_VALUES];
const ORDER_FIELDS = ["stage", "approved", "approved_at", "contract_signed", "pending_roles", "pl_requested_at"];

// A For Each over a list the code step returns; the body is a graph of its own, the item is `input.item`.
function each(id, name, listPath, step) {
  return node(id, name, "for_each", {
    listSource: listPath, itemAlias: "item", mode: "sequential", continueOnItemFailure: true, failOnItemFailure: false,
    body: { schemaVersion: "1.0", start: "bs", end: ["be"],
      nodes: [node("bs", "Mục", "start", {}), step, node("be", "Xong", "end", {})],
      edges: edges(["be0", "bs", step.id], ["be1", step.id, "be"]) },
  });
}

const chain = (ids) => ids.slice(1).map((to, i) => [`e_${ids[i]}_${to}`, ids[i], to]);

// start → read the order, its tasks and everything validateOrder needs → advance → create tasks → update tasks →
// update the order when it changed → log the events.
function flowGraph(title, subjectEntity, orderIdPath) {
  const OF_ORDER = [flt("order", "eq", ref("nodes.order.output.record.id"))];
  const reads = [
    getById("order", "Đọc đơn", ORDER, orderIdPath),
    search("tasks", "Đọc task của đơn", TASK, OF_ORDER, { limit: 50 }),
    search("pl", "Đọc P&L chính thức", "${entity:order_pl}", OF_ORDER, { limit: 1 }),
    search("lines", "Đọc dòng danh mục", "${entity:order_line}", OF_ORDER, { limit: 500 }),
    search("goods_prices", "Đọc giá hàng hóa", "${entity:goods_line_price}", OF_ORDER, { limit: 500 }),
    search("service_prices", "Đọc giá dịch vụ", "${entity:service_line_price}", OF_ORDER, { limit: 500 }),
    search("finance", "Đọc tài chính đơn", "${entity:order_finance}", OF_ORDER, { limit: 1 }),
    search("contracts", "Đọc hợp đồng của đơn", "${entity:contract}", OF_ORDER, { limit: 200 }),
    search("proposals", "Đọc đề xuất mua của đơn", "${entity:purchase_proposal}", OF_ORDER, { limit: 500 }),
    ...CONFIG.map((key) => search(`cfg_${key}`, `Đọc cấu hình ${key}`, `\${entity:${key}}`, [], { limit: 500 })),
  ];
  const advance = code("advance", "Điều phối quy trình", "code/advance_order.js", [
    ["order", ref("nodes.order.output.record")],
    ...["tasks", "pl", "lines", "goods_prices", "service_prices", "finance", "contracts", "proposals"].map((id) => [id, ref(`nodes.${id}.output.records`)]),
    ...CONFIG.map((key) => [`cfg_${key}`, ref(`nodes.cfg_${key}.output.records`)]),
    ["now", NOW],
  ], ADVANCE_SCHEMA);
  const steps = [
    each("each_create", "Tạo task", "nodes.advance.output.create_list",
      create("create_task", "Tạo task", TASK, TASK_CREATE.map((field) => bind(field, item(field))))),
    each("each_update", "Cập nhật task", "nodes.advance.output.update_list",
      update("update_task", "Cập nhật task", TASK, "input.item.id", TASK_VALUES.map((field) => bind(field, item(field))),
        // Two runs that saw the same task cannot both write it: the second finds the status moved and skips.
        { expect: { fields: { status: "{{ input.item.expect_status }}" } } })),
  ];
  const writeOrder = update("write_order", "Ghi giai đoạn đơn", ORDER, "nodes.order.output.record.id",
    ORDER_FIELDS.map((field) => bind(field, adv(`order_fields.${field}`))));
  // The status goes in its own write, only when it changed (the stage model refuses a write of a status that is no valid start).
  const writeStatus = update("write_status", "Ghi trạng thái đơn", ORDER, "nodes.order.output.record.id", [bind("status", adv("order_status"))]);
  const events = each("each_event", "Ghi nhật ký", "nodes.advance.output.event_list",
    create("log_event", "Ghi nhật ký", EVENT, ["order", "task", "task_code", "role", "action", "note", "at"].map((field) => bind(field, item(field === "task" ? "task_id" : field)))));
  // The order and the log go first: the task updates start the next runs, which must read the order as this run left it.
  const ids = ["start", ...reads.map((n) => n.id), "advance", "each_create", "is_changed"];
  return graph(
    title,
    [
      start({ subject: subjectEntity }),
      ...reads,
      advance,
      steps[0],
      steps[1],
      decision("is_changed", "Đơn có đổi?", [
        when("e_changed", { "==": [{ var: "nodes.advance.output.order_changed" }, true] }),
        otherwise("e_unchanged"),
      ]),
      writeOrder,
      decision("is_status_changed", "Trạng thái đơn có đổi?", [
        when("e_status", { "==": [{ var: "nodes.advance.output.status_changed" }, true] }),
        otherwise("e_same_status"),
      ]),
      writeStatus,
      events,
      end("done", "Đã điều phối", "Đã điều phối"),
    ],
    edges(
      ...chain(ids),
      ["e_changed", "is_changed", "write_order"],
      ["e_unchanged", "is_changed", "is_status_changed"],
      ["e_write_order", "write_order", "is_status_changed"],
      ["e_status", "is_status_changed", "write_status"],
      ["e_same_status", "is_status_changed", "each_event"],
      ["e_write_status", "write_status", "each_event"],
      ["e_each_event", "each_event", "each_update"],
      ["e_each_update", "each_update", "done"],
    ),
  );
}

export const workflows = {
  init_order_tasks: workflow(
    "init_order_tasks",
    "Tạo 15 task của đơn",
    "Đơn vừa tạo: tạo đủ 15 task (t11 mở cho AM, task không áp dụng đánh dấu không áp dụng) và ghi việc đang chờ lên đơn.",
    servicePrincipal("automation_principal"), NOBODY,
    flowGraph("Tạo 15 task của đơn", ORDER, "subject.record_id"),
  ),
  advance_order: workflow(
    "advance_order",
    "Điều phối quy trình đơn",
    "Một task đổi trạng thái: mở task tới lượt, xử lý trả lại / yêu cầu sửa / tự duyệt, đặt giai đoạn, phê duyệt, việc đang chờ và ghi nhật ký. Chạy lại không đổi gì.",
    servicePrincipal("automation_principal"), NOBODY,
    flowGraph("Điều phối quy trình đơn", TASK, "subject.record.order"),
  ),
  close_lost_order: workflow(
    "close_lost_order",
    "Hủy task khi đơn Close-lost",
    "Đơn chuyển Close-lost: hủy các task đang chờ làm và chưa tới lượt, ghi nhật ký với lý do.",
    servicePrincipal("automation_principal"), NOBODY,
    graph(
      "Hủy task khi đơn Close-lost",
      [
        start({ subject: ORDER }),
        updateMany("cancel_open", "Hủy task đang chờ", TASK,
          [flt("order", "eq", ref("subject.record_id")), flt("status", "eq", lit("open"))], [bind("status", lit("cancelled"))]),
        updateMany("cancel_blocked", "Hủy task chưa tới lượt", TASK,
          [flt("order", "eq", ref("subject.record_id")), flt("status", "eq", lit("blocked"))], [bind("status", lit("cancelled"))]),
        create("log", "Ghi nhật ký", EVENT, [
          bind("order", ref("subject.record_id")), bind("action", lit("close_lost_processed")), bind("reason", ref("subject.record.close_reason")), bind("at", NOW),
        ]),
        end("done", "Đã hủy", "Đã hủy"),
      ],
      edges(["e_start", "start", "cancel_open"], ["e_open", "cancel_open", "cancel_blocked"], ["e_blocked", "cancel_blocked", "log"], ["e_log", "log", "done"]),
    ),
  ),
  sla_sweep: workflow(
    "sla_sweep",
    "Quét hạn SLA",
    "Mỗi giờ trong ngày làm việc: đặt tình trạng hạn (sắp đến hạn, quá hạn, số ngày trễ) cho các task đang chờ làm.",
    servicePrincipal("automation_principal"), NOBODY,
    graph(
      "Quét hạn SLA",
      [
        start(),
        search("tasks", "Đọc task đang chờ làm", TASK, [flt("status", "eq", lit("open"))], { limit: 500 }),
        code("sweep", "Tính tình trạng hạn", "code/sla_sweep.js", [["tasks", ref("nodes.tasks.output.records")], ["now", NOW]],
          { type: "object", properties: { update_list: array }, required: ["update_list"] }),
        each("each_sweep", "Cập nhật hạn", "nodes.sweep.output.update_list",
          update("mark", "Đặt tình trạng hạn", TASK, "input.item.id", ["due_state", "late_days"].map((field) => bind(field, item(field))))),
        end("done", "Đã quét", "Đã quét"),
      ],
      edges(["e_start", "start", "tasks"], ["e_tasks", "tasks", "sweep"], ["e_sweep", "sweep", "each_sweep"], ["e_each", "each_sweep", "done"]),
    ),
  ),
};

export const triggers = {
  init_order_tasks_on_create: {
    workflow: "init_order_tasks",
    kind: "entity_record",
    config: { entity_id: ORDER, change_kind: "created", input_mappings: [], filter: { "!!": [{ var: "status" }] } },
  },
  advance_order_on_task: {
    workflow: "advance_order",
    kind: "entity_record",
    config: { entity_id: TASK, change_kind: "updated", input_mappings: [], filter: { in: ["status", { var: "event.changed" }] } },
  },
  close_lost_order_on_status: {
    workflow: "close_lost_order",
    kind: "entity_record",
    config: {
      entity_id: ORDER, change_kind: "updated", input_mappings: [],
      filter: { and: [{ in: ["status", { var: "event.changed" }] }, { "==": [{ var: "status" }, "close_lost"] }] },
    },
  },
  sla_sweep_hourly: {
    workflow: "sla_sweep",
    kind: "schedule",
    config: { cron: "0 * * * 1-5", timezone: "Asia/Ho_Chi_Minh", input_template: {} },
  },
};
export const actions = {};
