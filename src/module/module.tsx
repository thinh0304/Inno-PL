import type { AppHost } from '@reflexify/agentflow-sdk';
import { createHttpCasesApi } from './http-cases-api.js';
import { mountCases } from './mount.js';

/** The pl as an app module: the entry of the package's `ui/`, which AgentFlow imports and calls. */
export function mount(root: ShadowRoot | Element, host: AppHost): () => void {
  return mountCases(root, host, createHttpCasesApi(host));
}
