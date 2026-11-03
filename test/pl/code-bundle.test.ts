import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bundle } from '../../scripts/build-code.mjs';
import { computePl } from '../../src/pl/compute';
import { DEFAULT_CONFIG } from '../../src/pl/defaults';
import { TM1040 } from './fixtures/tm1040';

const committed = readFileSync(new URL('../../config/code/compute_pl.js', import.meta.url), 'utf8');
type Main = (inputs: { input: unknown; config: unknown }) => ReturnType<typeof computePl>;
const main = new Function(`${committed}; return main;`)() as Main;

describe('config/code/compute_pl.js', () => {
  it('bundle_is_fresh', async () => {
    expect(await bundle()).toBe(committed);
  });

  it('bundle_main_matches_engine', () => {
    const result = main({ input: TM1040, config: null });
    expect(result.netProfit).toBeCloseTo(46_272_444.44, 2);
    expect(result).toEqual(computePl(TM1040, DEFAULT_CONFIG));
  });

  it('bundle reads config records when given', () => {
    const records = { item_type: [], contract_type_rate: [], fin_cost_tier: [], vat_rate: [], pl_setting: [],
      task_sla: [], deal_stage_weight: [] };
    const result = main({ input: TM1040, config: records });
    expect(result.unknownItemTypes).toEqual(['TB']);
  });

  it('pl_selftest runs the bundle on TM-1040 with the default config', () => {
    const workflow = JSON.parse(readFileSync(new URL('../../package/objects/workflow/pl_selftest.json', import.meta.url), 'utf8'));
    const step = workflow.nodes.find((node: { id: string }) => node.id === 'pl');
    const inputs = Object.fromEntries(step.parameters.inputs.map((input: { name: string }) => [input.name, input]));
    expect(step.parameters.source).toBe(committed);
    expect(inputs.input.valueJson).toEqual(TM1040);
    expect(inputs.config.valueJson).toBeNull();
  });

  it('bundle_reads_only_declared_inputs', () => {
    const names = new Set([...committed.matchAll(/\binputs\s*(?:\.\s*(\w+)|\[)/g)].map((match) => match[1] ?? '['));
    expect([...names].sort()).toEqual(['config', 'input']);
  });
});
