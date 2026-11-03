import { describe, expect, it } from 'vitest';
import type { ContractRec } from '../../src/contract/types';
import { entity, fieldKeys, grantOf, opsOf } from '../order/entities.test';

type Any = Record<string, any>;
const raw = () => entity('contract') as unknown as Any;
const rule = (key: string): Any => (raw().rules as Any[]).find((r) => r.key === key)!;
const ALLOWED_COLOURS = ['gray', 'sky', 'teal', 'amber', 'emerald', 'violet', 'indigo', 'rose', 'fuchsia'];

// Every key of ContractRec except what the module derives (file_name comes with the attachment, not a field).
const REC_KEYS: (keyof ContractRec)[] = ['order', 'party', 'supplier', 'step', 'file', 'uploaded_by', 'uploaded_at', 'source', 'value',
  'advance_percent', 'version', 'ai_check', 'skip_reason'];

describe('contract entity', () => {
  it('contract_has_the_spec_fields', () => {
    expect(fieldKeys('contract')).toEqual(['order', 'party', 'supplier', 'step', 'file', 'uploaded_by', 'uploaded_at', 'source', 'value',
      'advance_percent', 'version', 'ai_check', 'clause_review', 'extracted', 'skip_reason']);
    const f = (key: string): Any => (raw().fields as Any[]).find((x) => x.key === key)!;
    expect(f('file').type).toBe('file');
    expect(f('order')).toMatchObject({ type: 'reference', target_entity_id: '${entity:order}', required: true });
    expect(f('supplier')).toMatchObject({ type: 'reference', target_entity_id: '${entity:supplier}' });
    expect(f('party').enum_values.map((v: Any) => v.value)).toEqual(['customer', 'supplier']);
    expect(f('step').enum_values.map((v: Any) => v.value)).toEqual(['draft', 'final']);
    expect(f('source').enum_values.map((v: Any) => v.value)).toEqual(['upload', 'template', 'ai']);
    expect(f('advance_percent').constraints).toEqual({ minimum: 0, maximum: 1 });
    for (const key of ['party', 'step', 'version']) expect(f(key).required, key).toBe(true);
  });

  it('every_field_key_matches_ContractRec', () => {
    for (const key of REC_KEYS) expect(fieldKeys('contract'), key).toContain(key);
  });

  it('grants_follow_7_2', () => {
    expect(opsOf('contract', 'sa_group')).toEqual(['create', 'list', 'read']);
    expect(opsOf('contract', 'proc_group')).toEqual(['create', 'list', 'read']);
    for (const g of ['am_group', 'sd_group', 'acc_group', 'admin_group']) expect(opsOf('contract', g), g).toEqual(['list', 'read']);
    expect(grantOf('contract', 'tm_group')).toBeUndefined();
    expect(opsOf('contract', 'automation_group')).toEqual(['create', 'list', 'read', 'update']);
    // AM and SA see the contracts of their own orders only.
    expect(grantOf('contract', 'am_group')!.operations[0].record_scopes).toEqual([{ kind: 'parent_field', field: 'order', parent_field: 'am' }]);
    expect(grantOf('contract', 'sa_group')!.operations.map((op: Any) => op.record_scopes))
      .toEqual(Array(3).fill([{ kind: 'parent_field', field: 'order', parent_field: 'sa' }]));
    for (const grant of raw().access.grants as Any[]) expect(grant.operations.map((op: Any) => op.operation)).not.toContain('delete');
  });

  it('automation_changes_only_the_ai_fields', () => {
    const r = rule('only_ai_fields_change');
    expect(r.condition.leaves[0]).toEqual({ kind: 'write', write: { op: 'is_update' } });
    expect(r.condition.leaves[1].write.fields).toEqual(['order', 'party', 'supplier', 'step', 'file', 'uploaded_by', 'uploaded_at', 'source',
      'value', 'advance_percent', 'version']);
  });

  it('wrong_party_is_refused', () => {
    const party = (key: string) => rule(key).condition.leaves;
    expect(party('customer_by_sa')).toEqual([
      { kind: 'field', rule: { field: 'party', op: 'eq', value: 'customer' } },
      { kind: 'write', write: { op: 'actor', negate: true, test: { kind: 'in_group', group_id: '${param:sa_group}' } } },
      { kind: 'write', write: { op: 'actor', negate: true, test: { kind: 'in_group', group_id: '${param:automation_group}' } } }]);
    expect(party('supplier_by_proc')[0]).toEqual({ kind: 'field', rule: { field: 'party', op: 'eq', value: 'supplier' } });
    expect(party('supplier_by_proc')[1].write.test.group_id).toBe('${param:proc_group}');
    expect(rule('supplier_needs_supplier').condition.leaves).toEqual([
      { kind: 'field', rule: { field: 'party', op: 'eq', value: 'supplier' } },
      { kind: 'field', rule: { field: 'supplier', op: 'is_empty' } }]);
  });

  it('closed_order_takes_no_contract', () => {
    expect(rule('closed_order_takes_no_contract').condition.leaves).toEqual([
      { kind: 'write', write: { op: 'is_new' } },
      { kind: 'field', rule: { field: 'order.status', op: 'in', value: ['done', 'close_lost'] } },
      { kind: 'write', write: { op: 'actor', negate: true, test: { kind: 'in_group', group_id: '${param:automation_group}' } } }]);
  });

  it('create_form_binds_every_field_the_module_writes', () => {
    const props = raw().create_form.schema.properties as Any;
    for (const key of ['order', 'party', 'supplier', 'step', 'file', 'uploaded_by', 'uploaded_at', 'source', 'value', 'advance_percent', 'version']) {
      expect(props[key]?.['x-entityField'], key).toBe(key);
    }
  });

  it('enum_colours_are_allowed', () => {
    for (const f of raw().fields as Any[]) for (const v of f.enum_values ?? []) if (v.color) expect(ALLOWED_COLOURS, `${f.key}.${v.value}`).toContain(v.color);
  });
});
