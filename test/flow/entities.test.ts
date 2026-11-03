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
      'not_applicable_only_t53', 'auto_approved_is_automatic', 'reason_for_return', 'only_am_finishes', 'only_sa_finishes', 'only_tm_finishes',
      'only_sd_finishes', 'only_proc_finishes', 'only_acc_finishes']);
  });

  it('only_automation_moves_tasks_except_finishing', () => {
    const moves = raw('order_task').stage_model.transitions as Any[];
    const humans = moves.filter((m) => m.movers.some((x: Any) => x.kind === 'is_holder')).map((m) => `${m.from}>${m.to}`);
    expect(humans).toEqual(['open>done', 'open>not_applicable']);
    expect(moves.find((m) => m.from === 'open' && m.to === 'done').required_fields).toEqual(['outcome']);
  });

  it('order_has_flow_fields', () => {
    for (const key of ['approved', 'approved_at', 'contract_signed', 'pending_roles', 'close_reason']) expect(fieldKeys('order'), key).toContain(key);
  });

  it('event_actions_cover_the_flow_events', () => {
    const actions = (raw('order_event').fields as Any[]).find((f) => f.key === 'action').enum_values.map((v: Any) => v.value);
    for (const a of ['auto_approved', 'reopened_missing_fields', 'returned_processed', 'revise_processed', 'approved', 'completed_order', 'close_lost',
      'ignored_warnings', 'ignored_suggestion']) expect(actions, a).toContain(a);
  });
});
