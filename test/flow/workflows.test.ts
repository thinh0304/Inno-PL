import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runAdvance } from '../../src/flow/code-entry';
import { TM1040_RECORDS } from '../order/fixtures/tm1040-records';

type Node = { id: string; nodeType?: string; type?: string; parameters: Record<string, any> };
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const load = (key: string) => JSON.parse(read(`package/objects/workflow/${key}.json`));
const KEYS = ['init_order_tasks', 'advance_order', 'close_lost_order', 'sla_sweep'];
const nodes = (key: string): Node[] => load(key).nodes ?? load(key).graph?.nodes;
const node = (key: string, id: string) => nodes(key).find((n) => n.id === id)!;
const body = (n: Node): { field: string }[] => n.parameters.body ?? [];
const fields = (n: Node) => body(n).map((b) => b.field).sort();

describe('flow workflows', () => {
  it('four_workflows_run_as_automation_without_start_grant', () => {
    const manifest = JSON.parse(read('package/manifest.json'));
    for (const key of KEYS) {
      expect(JSON.stringify(load(key).runAs), key).toContain('automation_principal');
      expect(JSON.stringify(manifest.grants ?? {}), key).not.toContain(`workflow:${key}`);
    }
  });

  it('each_has_its_trigger', () => {
    const trigger = (key: string) => JSON.parse(read(`package/objects/trigger/${key}.json`));
    const cases: [string, string, string][] = [['init_order_tasks_on_create', 'init_order_tasks', 'created'],
      ['advance_order_on_task', 'advance_order', 'updated'], ['close_lost_order_on_status', 'close_lost_order', 'updated']];
    for (const [file, workflow, change] of cases) {
      const t = trigger(file);
      expect(JSON.stringify(t), file).toContain(workflow);
      expect(JSON.stringify(t), file).toContain(`"${change}"`);
    }
    expect(JSON.stringify(trigger('advance_order_on_task'))).toContain('"in":["status"');
    expect(JSON.stringify(trigger('close_lost_order_on_status'))).toContain('close_lost');
    const sweep = trigger('sla_sweep_hourly');
    expect(JSON.stringify(sweep)).toContain('"cron":"0 * * * 1-5"');
    expect(JSON.stringify(sweep)).toContain('Asia/Ho_Chi_Minh');
  });

  it('advance_code_reads_its_bundle', () => {
    expect(node('advance_order', 'advance').parameters.source).toBe(read('config/code/advance_order.js'));
    expect(node('init_order_tasks', 'advance').parameters.source).toBe(read('config/code/advance_order.js'));
    expect(node('sla_sweep', 'sweep').parameters.source).toBe(read('config/code/sla_sweep.js'));
    const inputs = (key: string, id: string) => (node(key, id).parameters.inputs as { name: string }[]).map((i) => i.name).sort();
    expect(inputs('advance_order', 'advance')).toEqual(['cfg_contract_type_rate', 'cfg_deal_stage_weight', 'cfg_fin_cost_tier', 'cfg_item_type',
      'cfg_pl_setting', 'cfg_task_sla', 'cfg_vat_rate', 'contracts', 'finance', 'goods_prices', 'lines', 'now', 'order', 'pl', 'service_prices', 'tasks']);
    expect(node('advance_order', 'contracts').parameters).toMatchObject({ limit: 200 });
    expect(inputs('sla_sweep', 'sweep')).toEqual(['now', 'tasks']);
  });

  it('task_updates_expect_the_status_read', () => {
    const each = node('advance_order', 'each_update');
    const update = (each.parameters.body.nodes as Node[]).find((n) => n.parameters.operation === 'update')!;
    expect(JSON.stringify(update.parameters.expect)).toContain('expect_status');
    expect(fields(update)).toEqual(['due_at', 'due_state', 'finished_at', 'late_days', 'opened_at', 'outcome', 'reason', 'status']);
  });

  it('status_is_written_on_its_own_and_only_when_it_changes', () => {
    for (const key of ['advance_order', 'init_order_tasks']) {
      expect(fields(node(key, 'write_order')), key).toEqual(['approved', 'approved_at', 'contract_signed', 'pending_roles', 'pl_requested_at', 'stage']);
      expect(fields(node(key, 'write_status')), key).toEqual(['status']);
      const gate = JSON.stringify(node(key, 'is_status_changed').parameters);
      expect(gate, key).toContain('status_changed');
    }
  });

  it('the_order_and_the_log_are_written_before_the_tasks_that_start_new_runs', () => {
    for (const key of ['advance_order', 'init_order_tasks']) {
      const edges = load(key).edges as { from: string; to: string }[];
      const after = (from: string) => edges.filter((e) => e.from === from).map((e) => e.to);
      expect(after('each_create'), key).toEqual(['is_changed']);
      expect(after('each_event'), key).toEqual(['each_update']);
      expect(after('each_update'), key).toEqual(['done']);
    }
  });

  it('writes_every_field_the_code_returns', () => {
    const { create_list, event_list } = runAdvance({ ...TM1040_RECORDS, tasks: [], pl: [], config: null, now: '2026-11-03T10:00:00Z' } as any);
    const created = (node('init_order_tasks', 'each_create').parameters.body.nodes as Node[]).find((n) => n.parameters.operation === 'create')!;
    expect(fields(created)).toEqual(Object.keys(create_list[0]).sort());
    const logged = (node('advance_order', 'each_event').parameters.body.nodes as Node[]).find((n) => n.parameters.operation === 'create')!;
    expect(fields(logged)).toEqual(['action', 'at', 'note', 'order', 'role', 'task', 'task_code']);
    expect(event_list).toEqual([]);
  });

  it('close_lost_cancels_the_orders_open_and_blocked_tasks', () => {
    const cancels = nodes('close_lost_order').filter((n) => n.parameters.operation === 'update_many');
    expect(cancels.map((n) => JSON.stringify(n.parameters.filters)).join('|')).toMatch(/open[\s\S]*blocked/);
    for (const n of cancels) expect(fields(n)).toEqual(['status']);
    expect(existsSync(new URL('../../package/objects/workflow/close_lost_order.json', import.meta.url))).toBe(true);
  });
});
