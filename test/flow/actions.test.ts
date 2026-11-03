import { describe, expect, it } from 'vitest';
import { actionsFor, needsReason, statusFor } from '../../src/flow/actions';

const task = (over = {}) => ({ status: 'open' as const, task_code: 't31' as const, role: 'sd' as const, claimedBy: null, ...over });

describe('task actions', () => {
  it('only_the_role_sees_buttons', () => {
    expect(actionsFor(task(), 'u1', ['sd'])).toEqual(['approved', 'returned']);
    expect(actionsFor(task(), 'u1', ['tm', 'am'])).toEqual([]);
    expect(actionsFor(task({ status: 'blocked' }), 'u1', ['sd'])).toEqual([]);
    expect(actionsFor(task({ status: 'done' }), 'u1', ['sd'])).toEqual([]);
    expect(actionsFor(task({ claimedBy: 'u2' }), 'u1', ['sd'])).toEqual([]);
    expect(actionsFor(task({ claimedBy: 'u1' }), 'u1', ['sd'])).toEqual(['approved', 'returned']);
    expect(actionsFor(task({ task_code: 't53', role: 'acc' }), 'u1', ['acc'])).toEqual(['completed', 'not_applicable']);
  });

  it('reason_needed_for_return_and_revise', () => {
    expect([needsReason('returned'), needsReason('revise')]).toEqual([true, true]);
    expect(['approved', 'agreed', 'completed', 'submitted', 'not_applicable'].some((o) => needsReason(o as never))).toBe(false);
  });

  it('not_applicable_is_its_own_status', () => {
    expect(statusFor('not_applicable')).toBe('not_applicable');
    expect(statusFor('approved')).toBe('done');
  });
});
