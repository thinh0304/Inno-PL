import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TASKS } from '../../src/flow/tasks';
import { entity, fieldKeys, grantOf, opsOf } from '../order/entities.test';

type Any = Record<string, any>;
const raw = (key: string) => entity(key) as unknown as Any;
const ruleKeys = (key: string) => (raw(key).rules as { key: string }[]).map((r) => r.key);

describe('order_task and order_event', () => {
  it('task_entity_has_work_and_no_form', () => {
    const task = raw('order_task');
    expect(task.create_form).toBeUndefined();
    expect(task.work.lifecycle.categories).toEqual({ blocked: 'none', open: 'active', done: 'done', skipped: 'done', not_applicable: 'done', cancelled: 'cancelled' });
    expect(task.work.assignable.rules).toHaveLength(6);
    expect(task.natural_key).toEqual([{ id: 'by_order_task', name: expect.any(String), fields: ['order', 'task_code'] }]);
    // The builder seeds done_at itself, so the entity's own finish time is finished_at.
    expect(fieldKeys('order_task')).toContain('finished_at');
    expect(fieldKeys('order_task')).not.toContain('done_at');
    expect(task.fields.find((f: Any) => f.key === 'task_code').enum_values.map((v: Any) => v.value)).toEqual(TASKS.map((t) => t.code));
  });

  it('only_automation_creates_tasks_and_holders_update', () => {
    expect(opsOf('order_task', 'automation_group')).toEqual(['create', 'list', 'read', 'update']);
    for (const role of ['am', 'sa', 'tm', 'sd', 'proc', 'acc']) {
      const update = grantOf('order_task', `${role}_group`)!.operations.find((op) => op.operation === 'update')!;
      expect(update.record_scopes, role).toEqual([{ kind: 'work' }]);
      expect(opsOf('order_task', `${role}_group`), role).toEqual(['list', 'read', 'update']);
    }
    expect(opsOf('order_task', 'admin_group')).toEqual(['list', 'read']);
  });

  it('nobody_updates_or_deletes_events', () => {
    for (const grant of raw('order_event').access.grants as Any[]) {
      const ops = grant.operations.map((op: Any) => op.operation);
      expect(ops, grant.principal.id).not.toContain('update');
      expect(ops, grant.principal.id).not.toContain('delete');
    }
    expect(opsOf('order_event', 'automation_group')).toEqual(['create', 'list', 'read']);
    expect(opsOf('order_event', 'sd_group')).toEqual(['create', 'list', 'read']);
  });

  it('holder_rules_exist', () => {
    expect(ruleKeys('order_task')).toEqual(['holder_changes_only_outcome', 'returned_only_t22_t31', 'revise_only_t42', 'submitted_only_t11',
      'not_applicable_only_t53', 'auto_approved_is_automatic', 't11_finishes_as_submitted', 'outcome_is_final_once_done', 'reason_for_return', 'only_am_finishes', 'only_sa_finishes', 'only_tm_finishes',
      'only_sd_finishes', 'only_proc_finishes', 'only_acc_finishes']);
  });

  it('only_automation_moves_tasks_except_finishing', () => {
    const moves = raw('order_task').stage_model.transitions as Any[];
    const humans = moves.filter((m) => m.movers.some((x: Any) => x.kind === 'is_holder')).map((m) => `${m.from}>${m.to}`);
    expect(humans).toEqual(['open>done', 'open>not_applicable']);
    expect(moves.find((m) => m.from === 'open' && m.to === 'done')!.required_fields).toEqual(['outcome']);
  });

  it('order_has_flow_fields', () => {
    for (const key of ['approved', 'approved_at', 'contract_signed', 'pending_roles', 'close_reason']) expect(fieldKeys('order'), key).toContain(key);
  });

  it('event_actions_cover_the_flow_events', () => {
    const actions = (raw('order_event').fields as Any[]).find((f) => f.key === 'action')!.enum_values.map((v: Any) => v.value);
    for (const a of ['auto_approved', 'reopened_missing_fields', 'returned_processed', 'revise_processed', 'approved', 'completed_order', 'close_lost',
      'ignored_warnings', 'ignored_suggestion']) expect(actions, a).toContain(a);
  });
});

import { ORDER_KEYS } from '../../src/module/save-plan';

const rule = (entityKey: string, key: string): Any => (raw(entityKey).rules as Any[]).find((r) => r.key === key)!;
const leaves = (r: Any): Any[] => r.condition.leaves;
const writeOps = (r: Any, op: string): Any[] => leaves(r).filter((l) => l.kind === 'write' && l.write.op === op).map((l) => l.write);
const notIn = (r: Any): string[] => leaves(r).filter((l) => l.kind === 'write' && l.write.op === 'actor' && l.write.negate).map((l) => l.write.test.group_id);

describe('locks after submit', () => {
  it('order_locked_after_submit_rule', () => {
    const r = rule('order', 'locked_after_submit');
    expect(writeOps(r, 'is_update')).toHaveLength(1);
    expect(writeOps(r, 'was')[0].rule).toEqual({ field: 'status', op: 'ne', value: 'draft' });
    expect(writeOps(r, 'changed_any')[0].fields).toEqual(expect.arrayContaining([...ORDER_KEYS, 'pl_requested_at']));
    expect(notIn(r).sort()).toEqual(['${param:admin_group}', '${param:automation_group}']);
  });

  it('flow_fields_are_automatic', () => {
    const r = rule('order', 'flow_fields_are_automatic');
    expect(writeOps(r, 'changed_any')[0].fields.sort()).toEqual(['approved', 'approved_at', 'contract_signed', 'has_goods', 'has_service', 'pending_roles', 'stage']);
    expect(notIn(r)).toHaveLength(2);
    for (const key of ['new_order_is_unapproved', 'new_order_is_draft']) {
      expect(writeOps(rule('order', key), 'is_new'), key).toHaveLength(1);
      expect(notIn(rule('order', key)), key).toHaveLength(2);
    }
  });

  it('children_locked_after_submit_rules', () => {
    for (const key of ['order_line', 'goods_line_price', 'service_line_price', 'order_finance']) {
      const r = rule(key, 'children_locked_after_submit');
      expect(r.field, key).toBe('order');
      expect(leaves(r).find((l) => l.kind === 'field')!.rule, key).toEqual({ field: 'order.status', op: 'ne', value: 'draft' });
      expect(notIn(r).sort(), key).toEqual(['${param:admin_group}', '${param:automation_group}']);
    }
    // Purchasing keeps writing proposals after submit (t23 comes after it): that entity is not locked.
    expect(ruleKeys('purchase_proposal')).not.toContain('children_locked_after_submit');
  });

  it('close_lost_movers_and_reason', () => {
    const model = raw('order').stage_model;
    expect(model.status_field).toBe('status');
    expect(model.initial_statuses).toEqual(['draft']);
    const move = (from: string, to: string) => model.transitions.find((m: Any) => m.from === from && m.to === to);
    for (const from of ['draft', 'in_progress']) {
      const lost = move(from, 'close_lost');
      expect(lost.required_fields).toEqual(['close_reason']);
      expect(lost.movers).toEqual(expect.arrayContaining([{ kind: 'in_field', field: 'am' }, { kind: 'in_field', field: 'sa' },
        { kind: 'in_group', group_id: '${param:admin_group}' }, { kind: 'in_group', group_id: '${param:automation_group}' }]));
    }
    for (const [from, to] of [['draft', 'in_progress'], ['in_progress', 'draft'], ['in_progress', 'done']]) {
      expect(move(from, to).movers, `${from}>${to}`).toEqual([{ kind: 'in_group', group_id: '${param:automation_group}' }]);
    }
    expect(model.transitions).toHaveLength(5);
    const r = rule('order', 'close_lost_before_contract');
    expect(writeOps(r, 'changed')[0].field).toBe('status');
    expect(leaves(r).filter((l) => l.kind === 'field').map((l) => l.rule)).toEqual([
      { field: 'status', op: 'eq', value: 'close_lost' }, { field: 'contract_signed', op: 'eq', value: true }]);
  });
});

describe('enum colours', () => {
  // The builder does not check them; the install refuses an unknown one (sandbox: "unknown option color: slate").
  it('option_colours_are_ones_the_platform_knows', () => {
    const allowed = new Set(['gray', 'sky', 'teal', 'amber', 'emerald', 'violet', 'indigo', 'rose', 'fuchsia']);
    const files = readdirSync(new URL('../../config/entities', import.meta.url)).filter((f) => f.endsWith('.json'));
    const bad: string[] = [];
    for (const file of files) {
      const entityFile = JSON.parse(readFileSync(new URL(`../../config/entities/${file}`, import.meta.url), 'utf8'));
      for (const f of entityFile.fields as Any[]) {
        for (const v of (f.enum_values ?? []) as Any[]) if (v.color && !allowed.has(v.color) && !/^#[0-9a-fA-F]{6}$/.test(v.color)) bad.push(`${file}:${f.key}:${v.color}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('final review rules', () => {
  it('t11_can_only_be_finished_as_submitted', () => {
    const r = rule('order_task', 't11_finishes_as_submitted');
    expect(leaves(r).filter((l) => l.kind === 'field').map((l) => l.rule)).toEqual([
      { field: 'task_code', op: 'eq', value: 't11' }, { field: 'status', op: 'eq', value: 'done' }, { field: 'outcome', op: 'ne', value: 'submitted' }]);
  });

  it('a_finished_tasks_outcome_cannot_be_changed_by_people', () => {
    const r = rule('order_task', 'outcome_is_final_once_done');
    expect(writeOps(r, 'is_update')).toHaveLength(1);
    expect(writeOps(r, 'was')[0].rule).toEqual({ field: 'status', op: 'ne', value: 'open' });
    expect(writeOps(r, 'changed_any')[0].fields.sort()).toEqual(['outcome', 'reason']);
    expect(notIn(r).sort()).toEqual(['${param:admin_group}', '${param:automation_group}']);
  });
});

describe('routing rules', () => {
  // The install refuses a `when` that is not one operator (WORK_ASSIGNMENT_RULE_INVALID), as a trigger filter is written.
  it('each_routing_rule_picks_its_role_with_one_operator', () => {
    const rules = raw('order_task').work.assignable.rules as Any[];
    expect(rules.map((r) => r.when)).toEqual(['am', 'sa', 'tm', 'sd', 'proc', 'acc'].map((role) => ({ '==': [{ var: 'role' }, role] })));
    for (const r of rules) expect(Object.keys(r.when)).toHaveLength(1);
  });
});

describe('order_event create form', () => {
  // The create through the API keeps only what the form binds: a log line the module writes must not lose any field
  // (the sandbox returned an ignored-warnings line with an empty list, FR-6.10).
  it('binds_every_field_the_module_writes', () => {
    const form = raw('order_event').create_form.schema.properties as Record<string, Any>;
    for (const key of ['order', 'task', 'task_code', 'at', 'actor', 'role', 'action', 'note', 'reason', 'warnings']) {
      expect(form[key], key).toBeDefined();
      expect(form[key]['x-entityField'], key).toBe(key);
    }
    expect(form.warnings.type).toBe('array');
  });
});
