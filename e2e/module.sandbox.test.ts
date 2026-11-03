// The module as AgentFlow serves it (sandbox-testing.md, "Checking a module without a browser"): ready for the app's
// users, refused to someone outside the audience, and its objects live.
import { readSandbox } from '@reflexify/agentflow-sdk/testing';
import { describe, expect, it } from 'vitest';

const APP = 'inno-pl';

async function session(handle: string): Promise<string> {
  const sandbox = readSandbox();
  const response = await fetch(`${sandbox.url}/api/v1/auth/sandbox-session`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: sandbox.people[handle].token }),
  });
  expect(response.status).toBe(204);
  return (response.headers.get('set-cookie') ?? '').split(/,(?=\s*\w+=)/).map((c) => c.split(';')[0]).join('; ');
}

async function get(handle: string, path: string) {
  const cookie = await session(handle);
  const response = await fetch(`${readSandbox().url}/api/v1/apps/${APP}${path}`, { headers: { cookie } });
  return { status: response.status, body: response.ok ? await response.json() as Record<string, unknown> : null };
}

describe('the module in the sandbox', () => {
  it('is ready for an app user', async () => {
    const { body } = await get('am', '/module');
    expect(body?.state).toBe('ready');
  });

  it('is not assigned to someone outside the app', async () => {
    const { status, body } = await get('outsider', '/module');
    expect(status === 403 || body?.state === 'not_assigned', `status ${status}, state ${String(body?.state)}`).toBe(true);
  });

  it('lists the order objects live', async () => {
    const { body } = await get('am', '/objects');
    const objects = (body?.objects ?? []) as { logical_key: string; state: string }[];
    const state = (key: string) => objects.find((o) => o.logical_key === key)?.state;
    expect(state('entity:order')).toBe('live');
    expect(state('workflow:compute_pl')).toBe('live');
    expect(state('entity:case')).toBeUndefined();
  });
});
