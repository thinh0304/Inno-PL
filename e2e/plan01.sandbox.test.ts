// Plan 01 against a real AgentFlow: the seeds and how percent fields come back, who reads the config,
// and the compute_pl Code step running the bundled engine (workflow pl_selftest).
import { as, idsByKey, waitForRun } from '@reflexify/agentflow-sdk/testing';
import { describe, expect, it } from 'vitest';
import { configFromRecords, type ConfigRecords } from '../src/pl/config-records';
import { DEFAULT_CONFIG } from '../src/pl/defaults';
import type { LogicalKey } from '../src/generated/app';

const ids = idsByKey<LogicalKey>();
const CONFIG_ENTITIES = ['item_type', 'contract_type_rate', 'fin_cost_tier', 'vat_rate', 'pl_setting', 'task_sla',
  'deal_stage_weight'] as const;

type Client = ReturnType<typeof as>;

async function listAll(client: Client, entity: string): Promise<{ status: number; rows: Record<string, unknown>[] }> {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  for (;;) {
    const { data, response } = await client.GET('/entities/{entity_id}/records', {
      params: { path: { entity_id: ids[`entity:${entity}` as LogicalKey] }, query: { limit: 100, cursor } },
    });
    if (!data) return { status: response.status, rows };
    for (const item of data.items as unknown as Record<string, unknown>[]) {
      rows.push((item.body ?? item.fields ?? item.values ?? item) as Record<string, unknown>);
    }
    if (!data.next_cursor) return { status: response.status, rows };
    cursor = data.next_cursor;
  }
}

describe('plan 01 in the sandbox', () => {
  it('seeds arrive and rates come back as fractions', async () => {
    const { status, rows } = await listAll(as('am'), 'contract_type_rate');
    console.log('contract_type_rate as am:', status, JSON.stringify(rows.map((r) => [r.code, r.threshold, r.provision])));
    expect(status).toBe(200);
    expect(rows.find((r) => r.code === 'tm_once')?.threshold).toBe(0.08);
  });

  it('the engine reads the live config records as the defaults', async () => {
    const records = Object.fromEntries(await Promise.all(CONFIG_ENTITIES.map(async (key) =>
      [key, (await listAll(as('am'), key)).rows]))) as unknown as ConfigRecords;
    console.log('record counts:', JSON.stringify(Object.fromEntries(Object.entries(records).map(([k, v]) => [k, v.length]))));
    console.log('sample item_type:', JSON.stringify(records.item_type[0]));
    expect(configFromRecords(records)).toEqual(DEFAULT_CONFIG);
  });

  it('someone outside the app reads no config', async () => {
    const { status, rows } = await listAll(as('outsider'), 'pl_setting');
    console.log('pl_setting as outsider:', status, rows.length);
    expect(rows).toHaveLength(0);
  });

  it('pl_selftest runs the bundled engine: TM-1040 net profit 46,272,444.44, passed', async () => {
    const admin = as('pladmin');
    const { data, error, response } = await admin.POST('/workflows/{workflow_id}/instances', {
      params: { path: { workflow_id: ids['workflow:pl_selftest' as LogicalKey] } },
      body: { name: 'Tự kiểm bộ tính P&L (e2e)' },
    });
    console.log('start:', response.status, error ? JSON.stringify(error) : '');
    expect(data).toBeTruthy();
    const run = await waitForRun(admin, (data as { id: string }).id, { timeout: 120_000 });
    const failed = ((run.node_runs ?? []) as Record<string, unknown>[]).find((step) => step.status === 'failed');
    console.log('run:', run.status, JSON.stringify({ output: run.output_payload, withheld: run.withheld,
      error_code: failed?.error_code ?? run.error_code, meaning: failed?.error_meaning ?? run.error_meaning,
      message: run.error_message }));
    expect(run.status).toBe('completed');
    const output = run.output_payload as { net_profit?: number; passed?: boolean } | null;
    expect(output?.net_profit).toBeCloseTo(46_272_444.44, 2);
    expect(output?.passed).toBe(true);
  });
});
