import { NOBODY, NOW, bind, edges, end, graph, servicePrincipal, start, update, workflow } from "@reflexify/agentflow-app-builder/workflow";

// Mua hàng cannot change an order, so it cannot ask for the P&L itself. When it records or changes a purchase
// proposal, one of these workflows sets the order's pl_requested_at, and compute_pl's own trigger runs. A workflow has
// at most one trigger, so "created" and "updated" are two workflows made by one function.

const PROPOSAL = "${entity:purchase_proposal}";

function requestPl(key, name) {
  return workflow(
    key,
    name,
    "Đặt pl_requested_at của đơn có đề xuất mua vừa ghi, để compute_pl tính lại P&L và KPI Mua hàng.",
    servicePrincipal("automation_principal"),
    NOBODY,
    graph(name, [
      start({ subject: PROPOSAL }),
      update("request", "Yêu cầu tính P&L", "${entity:order}", "subject.record.order", [bind("pl_requested_at", NOW)]),
      end("done", "Đã yêu cầu", "Đã yêu cầu"),
    ], edges(["e_start", "start", "request"], ["e_done", "request", "done"])),
  );
}

export const workflows = {
  request_pl_on_proposal: requestPl("request_pl_on_proposal", "Tính lại P&L khi có đề xuất mua"),
  request_pl_on_proposal_update: requestPl("request_pl_on_proposal_update", "Tính lại P&L khi đề xuất mua đổi giá"),
};

export const triggers = {
  request_pl_on_proposal: {
    workflow: "request_pl_on_proposal",
    kind: "entity_record",
    config: { entity_id: PROPOSAL, change_kind: "created", input_mappings: [], filter: { "!!": [{ var: "order" }] } },
  },
  request_pl_on_proposal_update: {
    workflow: "request_pl_on_proposal_update",
    kind: "entity_record",
    config: {
      entity_id: PROPOSAL, change_kind: "updated", input_mappings: [],
      filter: { or: [{ in: ["proposed_cost", { var: "event.changed" }] }, { in: ["actual_cost", { var: "event.changed" }] }] },
    },
  },
};

export const actions = {};
