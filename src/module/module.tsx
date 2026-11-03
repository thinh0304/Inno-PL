import type { AppHost } from '@reflexify/agentflow-sdk';
import { createHttpOrdersApi } from './http-orders-api.js';
import { mountApp } from './mount.js';

/** The P&L app as an app module: the entry of the package's `ui/`, which AgentFlow imports and calls. */
export function mount(root: ShadowRoot | Element, host: AppHost): () => void {
  return mountApp(root, host, createHttpOrdersApi(host));
}
