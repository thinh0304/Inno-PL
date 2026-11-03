import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as openCase from "./config/build/open-case.mjs";
import * as plSelftest from "./config/build/pl-selftest.mjs";

export default defineApp({
  sections: merge([openCase, plSelftest], ["open_case", "pl_selftest"]),
  exposedSteps: { open_case: ["review"] },
});
