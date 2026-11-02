import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as openCase from "./config/build/open-case.mjs";

export default defineApp({
  sections: merge([openCase], ["open_case"]),
  exposedSteps: { open_case: ["review"] },
});
