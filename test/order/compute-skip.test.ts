import { describe, expect, it } from 'vitest';
import { runComputeOrderPl } from '../../src/order/code-entry';
import { TM1040_RECORDS } from './fixtures/tm1040-records';

const NOW = '2026-11-03T10:00:00Z';
const withOrder = (over: Record<string, unknown>) => ({ ...TM1040_RECORDS, order: { ...(TM1040_RECORDS.order as Record<string, unknown>), ...over } });
const run = (order: Record<string, unknown>, existing: Record<string, unknown>[]) =>
  runComputeOrderPl({ records: withOrder(order), proposals: [], existing, config: null, now: NOW });

describe('the P&L is fixed once the order is approved', () => {
  it('approved_order_is_computed_once', () => {
    const approved = { approved: true, approved_at: '2026-11-03T09:00:00Z' };
    // Approval asked for one more computation: the stored P&L is older than the approval.
    expect(run(approved, [{ id: 'p', computed_at: '2026-11-03T08:00:00Z' }]).skip).toBe(false);
    expect(run(approved, []).skip).toBe(false);
    // That computation has run: nothing changes the figures afterwards.
    expect(run(approved, [{ id: 'p', computed_at: '2026-11-03T09:00:05Z' }]).skip).toBe(true);
    expect(run(approved, [{ id: 'p', computed_at: '2026-11-03T09:00:00Z' }]).skip).toBe(true);
  });

  it('unapproved_orders_are_always_computed', () => {
    expect(run({ approved: false, approved_at: null }, [{ id: 'p', computed_at: '2026-11-03T09:00:05Z' }]).skip).toBe(false);
    expect(run({}, [{ id: 'p', computed_at: '2026-11-03T09:00:05Z' }]).skip).toBe(false);
  });

  it('approved_without_a_time_is_computed', () => {
    expect(run({ approved: true }, [{ id: 'p', computed_at: '2026-11-03T09:00:05Z' }]).skip).toBe(false);
  });
});

describe('the platform\'s own time format', () => {
  it('skips_with_nine_digit_fractions_and_an_offset', () => {
    const approved = { approved: true, approved_at: '2026-11-03T18:54:40.100000000+07:00' };
    expect(run(approved, [{ id: 'p', computed_at: '2026-11-03T18:54:44.945958101+07:00' }]).skip).toBe(true);
    expect(run(approved, [{ id: 'p', computed_at: '2026-11-03T18:54:39.999999999+07:00' }]).skip).toBe(false);
  });
});
