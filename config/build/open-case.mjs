import {
  INITIATOR, bind, create, edges, end, graph, lit, node, ref, restricted, start, tpl, update, workflow,
} from "@reflexify/agentflow-app-builder/workflow";

const CASE = "${entity:case}";
const THE_CASE = "nodes.case.output.record.id";

const review = node("review", "Review case", "human", {
  assignment: {
    candidates: [{
      kind: "dynamic",
      source: { type: "initiator" },
      relation: { type: "direct" },
      fallback: [{ kind: "group", id: "${param:app_users}" }],
    }],
  },
  actions: [
    { id: "approve", label: "Approve", edgeIds: ["e_approve"], tone: "primary" },
    { id: "reject", label: "Reject", edgeIds: ["e_reject"] },
  ],
});

export const workflows = {
  open_case: workflow(
    "open_case",
    "Open a case",
    "Opens a case from a summary and an amount, then asks whoever opened it to approve or reject it.",
    INITIATOR,
    restricted("app_users"),
    graph(
      "Open a case",
      [
        start({ params: true }),
        create("case", "Create the case", CASE, [
          bind("title", ref("input.summary")),
          bind("summary", ref("input.summary")),
          bind("amount", ref("input.amount")),
          bind("opened_on", tpl("{{ today() }}")),
          bind("opened_by", ref("workflow.requester.id")),
        ]),
        review,
        update("approved", "Mark approved", CASE, THE_CASE, [bind("status", lit("approved"))]),
        update("rejected", "Mark rejected", CASE, THE_CASE, [bind("status", lit("rejected"))]),
        end("done_approved", "Approved", "approved"),
        end("done_rejected", "Rejected", "rejected"),
      ],
      edges(
        ["e_start", "start", "case"], ["e_created", "case", "review"],
        ["e_approve", "review", "approved"], ["e_reject", "review", "rejected"],
        ["e_approved", "approved", "done_approved"], ["e_rejected", "rejected", "done_rejected"],
      ),
    ),
    {
      type: "object",
      properties: { summary: { type: "string", title: "Summary" }, amount: { type: "number", title: "Amount" } },
      required: ["summary"],
    },
  ),
};

export const triggers = {};
export const actions = {};
