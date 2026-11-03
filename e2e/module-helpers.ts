// The module's own OrdersApi as a sandbox person. The host is that person's sandbox client; /app/objects only answers the
// app's own caller (F-22), so the object ids come from the sandbox ids instead.
import { as } from '@reflexify/agentflow-sdk/testing';
import type { AppHost } from '@reflexify/agentflow-sdk';
import { createHttpOrdersApi } from '../src/module/http-orders-api';
import type { OrdersApi } from '../src/module/orders-api';
import { ids, userId } from './flow-helpers';

const objects = Object.entries(ids).filter(([key]) => key.startsWith('entity:')).map(([logical_key, id]) => ({
  id, key: logical_key.slice('entity:'.length), kind: 'entity', logical_key, state: 'live', source: 'own', parent: null, feature: null,
  contract: null, contract_version: null, customized: false }));

export function moduleApi(handle: string): OrdersApi {
  const client = as(handle);
  const api = new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'GET') {
        return (path: string, init?: unknown) => (path === '/app/objects'
          ? Promise.resolve({ data: { revision: 1, objects }, response: new Response(null, { status: 200 }) })
          : (target.GET as (p: string, i?: unknown) => unknown)(path, init));
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return createHttpOrdersApi({ api, context: { person: { id: userId(handle), name: handle, email: null }, org: { id: 'sandbox', name: 'Sandbox' },
    locale: 'vi', theme: { mode: 'light', brand: 'agentflow' } } } as unknown as Pick<AppHost, 'api' | 'context'>);
}

