import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as dieuPhoi from "./config/build/dieu-phoi.mjs";

// The workflow modules (config/build/*.mjs) and the order their workflows are published in, as the app gets them:
// merge([a, b], ["workflow_a", "workflow_b"]).
export default defineApp({
  sections: merge([dieuPhoi], ["dieu_phoi"]),
});
