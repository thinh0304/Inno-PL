import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

describe('a purchase proposal asks for the P&L again', () => {
  for (const [key, change] of [['request_pl_on_proposal', 'created'], ['request_pl_on_proposal_update', 'updated']] as const) {
    it(`${key} runs as the automation principal, only from its trigger on ${change}`, () => {
      const workflow = read(`package/objects/workflow/${key}.json`);
      expect(JSON.stringify(workflow.runAs)).toContain('automation_principal');
      const grants = read('package/manifest.json').grants as { workflow?: string }[];
      expect(grants.some((g) => g.workflow === `@obj:workflow:${key}`)).toBe(false);
      const step = (workflow.nodes as { id: string; parameters: Record<string, unknown> }[]).find((n) => n.id === 'request')!;
      expect(JSON.stringify(step.parameters)).toContain('subject.record.order');
      expect(JSON.stringify(step.parameters)).toContain('pl_requested_at');
      const trigger = read(`package/objects/trigger/${key}.json`);
      expect(JSON.stringify(trigger)).toContain(change);
    });
  }
});
