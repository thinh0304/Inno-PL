import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { plRecordsFromResult } from '../../src/order/pl-records';
import { draftFromRecords, toPlOrderInput } from '../../src/order/records';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040_RECORDS } from './fixtures/tm1040-records';

type Node = { id: string; type?: string; nodeType?: string; parameters: Record<string, unknown> };
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const workflow = JSON.parse(read('package/objects/workflow/compute_pl.json'));
const node = (id: string) => (workflow.nodes as Node[]).find((n) => n.id === id)!;
const boundFields = (id: string) => ((node(id).parameters.body ?? []) as { field: string }[]).map((b) => b.field).sort();

const draft = draftFromRecords(TM1040_RECORDS);
const bodies = plRecordsFromResult(draft, computePl(toPlOrderInput(draft), DEFAULT_CONFIG), DEFAULT_CONFIG, [], 'now');

describe('workflow compute_pl', () => {
  it('runs_as_automation_principal', () => {
    expect(JSON.stringify(workflow.runAs)).toContain('automation_principal');
  });

  it('only a trigger starts it: when the order\'s pl_requested_at changes', () => {
    const manifest = JSON.parse(read('package/manifest.json'));
    expect(JSON.stringify(manifest.grants ?? {})).not.toContain('workflow:compute_pl');
    const trigger = JSON.parse(read('package/objects/trigger/compute_pl_on_request.json'));
    expect(JSON.stringify(trigger)).toContain('pl_requested_at');
    const order = JSON.parse(read('config/entities/order.json'));
    expect(order.fields.find((f: { key: string }) => f.key === 'pl_requested_at')?.type).toBe('datetime');
  });

  it('code_step_uses_committed_bundle', () => {
    expect(node('compute').parameters.source).toBe(read('config/code/compute_order_pl.js'));
  });

  it('every_pl_field_is_written', () => {
    for (const key of ['order_pl', 'order_pl_service', 'order_pl_goods'] as const) {
      expect(boundFields(`write_${key}`), key).toEqual(['order', ...Object.keys(bodies[key])].sort());
    }
    expect(boundFields('write_order')).toEqual(Object.keys(bodies.order).sort());
  });

  it('reads every record the code step declares', () => {
    const inputs = (node('compute').parameters.inputs as { name: string }[]).map((input) => input.name).sort();
    expect(inputs).toEqual(['cfg_contract_type_rate', 'cfg_deal_stage_weight', 'cfg_fin_cost_tier', 'cfg_item_type',
      'cfg_pl_setting', 'cfg_task_sla', 'cfg_vat_rate', 'existing', 'finance', 'goods_prices', 'lines', 'now', 'order',
      'proposals', 'service_prices']);
  });
});
