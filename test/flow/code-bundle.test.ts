import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bundle } from '../../scripts/build-code.mjs';
import { runAdvance, runSlaSweep } from '../../src/flow/code-entry';
import { TM1040_RECORDS } from '../order/fixtures/tm1040-records';

const read = (name: string) => readFileSync(new URL(`../../config/code/${name}.js`, import.meta.url), 'utf8');
const load = (text: string) => new Function(`${text}; return main;`)() as (inputs: Record<string, unknown>) => any;
const NOW = '2026-11-03T10:00:00Z';
const cfgNull = { cfg_item_type: null, cfg_contract_type_rate: null, cfg_fin_cost_tier: null, cfg_vat_rate: null, cfg_pl_setting: null,
  cfg_task_sla: null, cfg_deal_stage_weight: null };

describe('config/code/advance_order.js and sla_sweep.js', () => {
  it('bundles_are_fresh', async () => {
    expect(await bundle('advance_order')).toBe(read('advance_order'));
    expect(await bundle('sla_sweep')).toBe(read('sla_sweep'));
  });

  it('advance_bundle_matches_library', () => {
    const { order, lines, goods_prices, service_prices, finance } = TM1040_RECORDS;
    const args = { order, lines, goods_prices, service_prices, finance, tasks: [], pl: [], now: NOW };
    const out = load(read('advance_order'))({ ...args, ...cfgNull });
    expect(out).toEqual(runAdvance({ ...args, config: null }));
    // A new order: fifteen tasks to create, t11 open.
    expect(out.create_list).toHaveLength(15);
    expect(out.create_list.find((t: any) => t.task_code === 't11')).toMatchObject({ status: 'open', stage: 1, role: 'am' });
    expect(out.update_list).toEqual([]);
    expect(out.order_fields).toMatchObject({ pending_roles: ['am'] });
  });

  it('sla_bundle_matches_library', () => {
    const tasks = [{ id: 'a', task_code: 't11', status: 'open', due_at: '2026-11-03T12:00:00Z' }];
    expect(load(read('sla_sweep'))({ tasks, now: NOW })).toEqual(runSlaSweep({ tasks, now: NOW }));
    expect(runSlaSweep({ tasks, now: NOW }).update_list).toEqual([{ id: 'a', due_state: 'due_soon', late_days: 0 }]);
  });

  it('bundles_read_only_declared_inputs', () => {
    const names = (text: string) => [...new Set([...text.matchAll(/\binputs\s*(?:\.\s*(\w+)|\[)/g)].map((m) => m[1] ?? '['))].sort();
    expect(names(read('advance_order'))).toEqual(['cfg_contract_type_rate', 'cfg_deal_stage_weight', 'cfg_fin_cost_tier', 'cfg_item_type',
      'cfg_pl_setting', 'cfg_task_sla', 'cfg_vat_rate', 'contracts', 'finance', 'goods_prices', 'lines', 'now', 'order', 'pl', 'proposals', 'service_prices', 'tasks']);
    expect(names(read('sla_sweep'))).toEqual(['now', 'tasks']);
  });

  it('run_advance_gates_contract_tasks_on_the_contracts_read', () => {
    const { order, lines, goods_prices, service_prices, finance } = TM1040_RECORDS;
    const approved: Record<string, unknown> = { ...(order as Record<string, unknown>), status: 'in_progress', stage: 4, approved: true };
    const done = (code: string, outcome = 'completed') => ({ id: `id-${code}`, task_code: code, status: 'done', outcome, opened_at: NOW, finished_at: NOW });
    const tasks = ['t11', 't23', 't31'].map((c) => done(c, c === 't11' ? 'submitted' : c === 't31' ? 'approved' : 'completed'))
      .concat([{ ...done('t40'), finished_at: null } as never, { id: 'id-t44', task_code: 't44', status: 'open', outcome: null, opened_at: NOW, finished_at: null } as never]);
    const args = { order: approved, lines, goods_prices, service_prices, finance, tasks, pl: [{ revenue: 50_000_000, passed: true }], now: NOW };
    const gated = runAdvance({ ...args, contracts: [], config: null });
    expect(gated.update_list.find((u) => u.task_code === 't40')).toMatchObject({ status: 'open' });
    expect(gated.event_list.map((e) => e.action)).toContain('reopened_missing_contract');
    // The same order with the customer's draft uploaded: t40 stays done.
    const draft = { id: 'c1', order: approved.id, party: 'customer', step: 'draft', file: ['a1'], version: 1 };
    const ok = runAdvance({ ...args, contracts: [draft], config: null });
    // Just finished and gated through: it stays done (the run only stamps its finish time).
    expect(ok.update_list.find((u) => u.task_code === 't40')).toMatchObject({ status: 'done' });
    expect(ok.event_list.map((e) => e.action)).not.toContain('reopened_missing_contract');
    expect(load(read('advance_order'))({ ...args, contracts: [draft], ...cfgNull })).toEqual(ok);
  });
});
