// A fake AgentFlow behind host.api for the HTTP client's tests: objects by logical key, records as
// { id, body, updated_at }, queries filtered by field_filters, and refusals in AgentFlow's problem shape.
import type { AppHost } from '@reflexify/agentflow-sdk';
import { vi } from 'vitest';

type Row = { id: string; body: Record<string, unknown>; updated_at: string };
export type Refuse = (method: string, entity: string, id?: string) => { status: number; type: string; detail?: string } | null;

export const ENTITY_KEYS = ['order', 'order_line', 'goods_line_price', 'service_line_price', 'order_finance', 'purchase_proposal',
  'order_pl', 'order_pl_service', 'order_pl_goods', 'order_task', 'order_event', 'customer', 'supplier', 'staff', 'item_type', 'contract_type_rate',
  'fin_cost_tier', 'vat_rate', 'pl_setting', 'task_sla', 'deal_stage_weight'];

export function fakeBackend(refuse: Refuse = () => null) {
  const rows = new Map<string, Map<string, Row>>(ENTITY_KEYS.map((k) => [`e-${k}`, new Map()]));
  let n = 0;
  let clock = 0;
  const stamp = () => `2026-11-03T00:00:${String(++clock).padStart(2, '0')}Z`;
  const answer = (data: unknown, status = 200) => ({ data, response: new Response(null, { status }) });
  const fail = (status: number, type: string, detail?: string) =>
    ({ error: { type, status, detail }, response: new Response(null, { status }) });
  const entityOf = (entityId: string) => entityId.slice(2);

  const GET = vi.fn(async (path: string, init?: { params?: { path?: Record<string, string> } }) => {
    if (path === '/app/objects') {
      return answer({ revision: 1, objects: ENTITY_KEYS.map((key) => ({ id: `e-${key}`, key, kind: 'entity', logical_key: `entity:${key}`,
        state: 'live', source: 'own', parent: null, feature: null, contract: null, contract_version: null, customized: false })) });
    }
    if (path === '/work') {
      // The work list: open tasks, held by this person ("mine") or by nobody ("claimable").
      const view = (init as unknown as { params: { query: { view: string } } }).params.query.view;
      const open = [...rows.get('e-order_task')!.values()].filter((row) => row.body.status === 'open'
        && (view === 'mine' ? row.body.claimed_by === 'u-am' : !row.body.claimed_by));
      return answer({ items: open.map((row) => ({ entity_id: 'e-order_task', id: row.id })) });
    }
    const { entity_id, record_id } = init!.params!.path!;
    const refused = refuse('GET', entityOf(entity_id), record_id);
    if (refused) return fail(refused.status, refused.type, refused.detail);
    const row = rows.get(entity_id)?.get(record_id);
    return row ? answer(row) : fail(404, 'ENTITY_RECORD_NOT_FOUND');
  });

  const POST = vi.fn(async (path: string, init: { params: { path: Record<string, string> }; body: Record<string, any> }) => {
    const { entity_id } = init.params.path;
    const refused = refuse(path.endsWith('/query') ? 'QUERY' : 'POST', entityOf(entity_id));
    if (refused) return fail(refused.status, refused.type, refused.detail);
    const table = rows.get(entity_id)!;
    if (path.endsWith('/work/claim')) {
      const row = table.get(init.params.path.record_id);
      if (!row) return fail(404, 'ENTITY_RECORD_NOT_FOUND');
      if (row.body.claimed_by && row.body.claimed_by !== 'u-am') return fail(409, 'WORK_ALREADY_CLAIMED');
      row.body.claimed_by = 'u-am';
      row.updated_at = stamp();
      return answer(row);
    }
    if (path.endsWith('/query')) {
      const filters: { field: string; value: unknown }[] = init.body.filter?.field_filters ?? [];
      const items = [...table.values()].filter((row) => filters.every((f) => row.body[f.field] === f.value));
      return answer({ items: items.slice(0, init.body.limit ?? 200), next_cursor: null });
    }
    const id = `${entityOf(entity_id)}-${++n}`;
    const row = { id, body: { ...init.body.form_payload }, updated_at: stamp() };
    table.set(id, row);
    return answer(row, 201);
  });

  const PATCH = vi.fn(async (_path: string, init: { params: { path: Record<string, string> }; body: { changes: Record<string, unknown>; expected_updated_at: string } }) => {
    const { entity_id, record_id } = init.params.path;
    const refused = refuse('PATCH', entityOf(entity_id), record_id);
    if (refused) return fail(refused.status, refused.type, refused.detail);
    const row = rows.get(entity_id)!.get(record_id);
    if (!row) return fail(404, 'ENTITY_RECORD_NOT_FOUND');
    if (init.body.expected_updated_at !== row.updated_at) return fail(409, 'STALE_VERSION', 'STALE_VERSION: the record changed');
    Object.assign(row.body, init.body.changes);
    row.updated_at = stamp();
    return answer(row);
  });

  const DELETE = vi.fn(async (_path: string, init: { params: { path: Record<string, string> } }) => {
    const { entity_id, record_id } = init.params.path;
    rows.get(entity_id)!.delete(record_id);
    return answer(null, 204);
  });

  /** Puts a record straight into the store, as another writer (a workflow) would. */
  const seed = (entity: string, body: Record<string, unknown>, id = `${entity}-${++n}`) => {
    const row = { id, body: { ...body }, updated_at: stamp() };
    rows.get(`e-${entity}`)!.set(id, row);
    return row;
  };
  const touch = (entity: string, id: string, changes: Record<string, unknown>) => {
    const row = rows.get(`e-${entity}`)!.get(id)!;
    Object.assign(row.body, changes);
    row.updated_at = stamp();
  };
  const all = (entity: string) => [...rows.get(`e-${entity}`)!.values()];

  const host = {
    api: { GET, POST, PATCH, DELETE } as unknown as AppHost['api'],
    context: { person: { id: 'u-am', name: 'Nguyễn Thuận', email: null }, org: { id: 'org', name: 'TeraBox' }, locale: 'vi',
      theme: { mode: 'light', brand: 'agentflow' } },
  } as Pick<AppHost, 'api' | 'context'>;
  return { host, GET, POST, PATCH, DELETE, seed, touch, all };
}
