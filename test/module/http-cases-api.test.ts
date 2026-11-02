import { describe, expect, it, vi } from 'vitest';
import type { AppHost } from '@reflexify/agentflow-sdk';
import { CasesError } from '../../src/module/cases-api.js';
import { createHttpCasesApi } from '../../src/module/http-cases-api.js';

const ENTITY = '11111111-1111-4111-8111-111111111111';

const object = (over: Record<string, unknown>) => ({
  contract: null, contract_version: null, customized: false, feature: null, id: ENTITY, key: 'case',
  kind: 'entity', logical_key: 'entity:case', parent: null, source: 'own', state: 'live', ...over,
});

const answer = (objects: unknown[]) => ({ data: { revision: 1, objects }, response: new Response() });
const emptyPage = { data: { items: [], next_cursor: null }, response: new Response() };

function host(objects: () => Promise<unknown>) {
  const GET = vi.fn(objects);
  const POST = vi.fn(async () => emptyPage);
  return { api: { GET, POST } as unknown as AppHost['api'], GET, POST };
}

describe('the cases over the published operations', () => {
  it('finds the case entity by its logical key and queries its records', async () => {
    const h = host(async () => answer([object({})]));
    await expect(createHttpCasesApi(h).list()).resolves.toEqual([]);
    expect(h.POST).toHaveBeenCalledWith('/entities/{entity_id}/records/query', expect.objectContaining({ params: { path: { entity_id: ENTITY } } }));
  });

  it('reads the objects once for several calls', async () => {
    const h = host(async () => answer([object({})]));
    const api = createHttpCasesApi(h);
    await api.list();
    await api.list();
    expect(h.GET).toHaveBeenCalledTimes(1);
  });

  it('says NOT_INSTALLED when the package has no case entity', async () => {
    const h = host(async () => answer([object({ state: 'off', id: null })]));
    await expect(createHttpCasesApi(h).list()).rejects.toMatchObject({ code: 'NOT_INSTALLED' });
  });

  it('asks again after a failed load, so Try again recovers', async () => {
    let calls = 0;
    const h = host(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('offline');
      return answer([object({})]);
    });
    const api = createHttpCasesApi(h);
    const first = await api.list().catch((e: unknown) => e);
    expect(first).toBeInstanceOf(CasesError);
    await expect(api.list()).resolves.toEqual([]);
    expect(h.GET).toHaveBeenCalledTimes(2);
  });
});
