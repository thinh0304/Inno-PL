import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as openCase from "./config/build/open-case.mjs";
import * as plSelftest from "./config/build/pl-selftest.mjs";
import * as computePl from "./config/build/compute-pl.mjs";

export default defineApp({
  sections: merge([openCase, plSelftest, computePl], ["open_case", "pl_selftest", "compute_pl"]),
  exposedSteps: { open_case: ["review"] },
});
