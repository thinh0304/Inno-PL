import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as plSelftest from "./config/build/pl-selftest.mjs";
import * as computePl from "./config/build/compute-pl.mjs";

export default defineApp({
  sections: merge([plSelftest, computePl], ["pl_selftest", "compute_pl"]),
});
