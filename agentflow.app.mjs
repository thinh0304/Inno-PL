import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as plSelftest from "./config/build/pl-selftest.mjs";
import * as computePl from "./config/build/compute-pl.mjs";
import * as requestPl from "./config/build/request-pl.mjs";
import * as flow from "./config/build/flow.mjs";

export default defineApp({
  sections: merge([plSelftest, computePl, requestPl, flow], ["pl_selftest", "compute_pl", "request_pl_on_proposal", "request_pl_on_proposal_update",
    "init_order_tasks", "advance_order", "close_lost_order", "sla_sweep"]),
});
