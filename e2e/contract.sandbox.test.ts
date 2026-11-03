// Plan 04 against a real AgentFlow: the contract stage. advance_order reopens a contract task finished without its file or
// the signed contract's fields (BR-44, BR-45); SD's revision opens the drafts again and a new version is taken; the signing
// fields stay open after submission until the contract is signed; who reads contracts through the module's OrdersApi.
import { as } from '@reflexify/agentflow-sdk/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ContractUpload, OrdersApi } from '../src/module/orders-api';
import { ADMIN, create, eventsOf, finish, listAll, newOrder, orderOf, patch, taskIs, taskOf, TAG, userId, waitFor } from './flow-helpers';
import { moduleApi } from './module-helpers';

const pdf = (name: string) => new File([new TextEncoder().encode('%PDF-1.4\n%%EOF\n')], name, { type: 'application/pdf' });
const SIGNING = { address: '12 Lê Lợi, Bà Rịa', receiver_name: 'Nguyễn An', receiver_phone: '0901234567', delivery_address: '12 Lê Lợi, Bà Rịa',
  signed_on: '2026-11-05', payment_count: 2, customer_po_no: 'HD-2026-01' };

/** An order with SA set, sent and approved: t40 and t44 open. */
async function atDrafts(label: string, small = false): Promise<{ orderId: string; supplier: string }> {
  const orderId = await newOrder(label);
  expect((await patch(as('am'), 'order', orderId, { sa: userId('sa') })).status).toBeLessThan(300);
  if (small) {
    // One disk at 10 tr: below the 20 tr above which a file is required.
    const line = (await listAll(ADMIN(), 'order_line')).find((l) => l.order === orderId)!;
    expect((await patch(as('am'), 'order_line', line.id, { quantity: 1 })).status).toBeLessThan(300);
    const price = (await listAll(ADMIN(), 'goods_line_price')).find((p) => p.order === orderId)!;
    expect((await patch(as('am'), 'goods_line_price', price.id, { unit_price: 10_000_000, unit_cost: 9_000_000 })).status).toBeLessThan(300);
    expect((await patch(as('am'), 'order', orderId, { pl_requested_at: new Date().toISOString() })).status).toBeLessThan(300);
    await waitFor('the small P&L', async () => (await listAll(ADMIN(), 'order_pl')).find((pl) => pl.order === orderId && Number(pl.revenue) < 20_000_000));
  }
  const supplier = String((await listAll(ADMIN(), 'goods_line_price')).find((p) => p.order === orderId)!.supplier);
  // init_order_tasks can take a minute on the sandbox: sending t11 before all fifteen tasks exist races advance_order against
  // it (the run creates what it does not see yet, the creates collide, and t23 is never reopened). Wait for all fifteen.
  await waitFor('fifteen tasks', async () => (await listAll(ADMIN(), 'order_task')).filter((t) => t.order === orderId).length === 15);
  await finish(as('am'), await taskIs(orderId, 't11', 'open'), 'submitted');
  await finish(as('proc'), await taskIs(orderId, 't23', 'open'), 'completed');
  await finish(as('sd'), await taskIs(orderId, 't31', 'open'), 'approved');
  await taskIs(orderId, 't40', 'open');
  await taskIs(orderId, 't44', 'open');
  return { orderId, supplier };
}

const up = (api: OrdersApi, orderId: string, input: Partial<ContractUpload> & Pick<ContractUpload, 'file'>) =>
  api.uploadContract(orderId, { party: 'customer', supplier: null, step: 'draft', value: null, advance_percent: null, ...input });

let orderId = '';
let supplier = '';

describe('the contract stage in the sandbox', () => {
  beforeAll(async () => {
    ({ orderId, supplier } = await atDrafts(`${TAG}C`));
  });

  it('t40_without_the_required_draft_is_reopened', async () => {
    await finish(as('sa'), (await taskOf(orderId, 't40'))!, 'completed');
    const event = await waitFor('the reopen event', async () => (await eventsOf(orderId)).find((e) => e.action === 'reopened_missing_contract' && e.task_code === 't40'));
    expect(String(event.note)).toContain('Thiếu dự thảo hợp đồng khách hàng');
    await taskIs(orderId, 't40', 'open');
  });

  it('drafts_uploaded_through_the_module_api_let_t40_and_t44_finish', async () => {
    const draft = await up(moduleApi('sa'), orderId, { file: pdf('kh-v1.pdf') });
    expect(draft).toMatchObject({ version: 1, file_name: 'kh-v1.pdf', uploaded_by: userId('sa') });
    await up(moduleApi('proc'), orderId, { party: 'supplier', supplier, file: pdf('ncc-v1.pdf'), advance_percent: 0.3 });
    await finish(as('sa'), (await taskOf(orderId, 't40'))!, 'completed');
    await finish(as('proc'), (await taskOf(orderId, 't44'))!, 'completed');
    await taskIs(orderId, 't42', 'open');
    expect((await taskOf(orderId, 't40'))!.status).toBe('done');
  });

  it('revise_reopens_the_drafts_and_a_new_version_is_taken', async () => {
    await finish(as('sd'), (await taskOf(orderId, 't42'))!, 'revise', 'Sửa điều khoản thanh toán');
    await taskIs(orderId, 't40', 'open');
    await taskIs(orderId, 't44', 'open');
    expect((await up(moduleApi('sa'), orderId, { file: pdf('kh-v2.pdf') })).version).toBe(2);
    const all = await moduleApi('sa').contracts(orderId);
    expect(all.map((c) => [c.party, c.version, c.file_name])).toEqual(expect.arrayContaining([['customer', 2, 'kh-v2.pdf'], ['customer', 1, 'kh-v1.pdf']]));
    await finish(as('sa'), (await taskOf(orderId, 't40'))!, 'completed');
    await finish(as('proc'), (await taskOf(orderId, 't44'))!, 'completed');
    await finish(as('sd'), await taskIs(orderId, 't42', 'open'), 'agreed');
    await taskIs(orderId, 't41', 'open');
    await taskIs(orderId, 't45', 'open');
  });

  it('t41_needs_the_signing_fields_and_the_final', async () => {
    await finish(as('sa'), (await taskOf(orderId, 't41'))!, 'completed');
    const event = await waitFor('the t41 reopen', async () => (await eventsOf(orderId)).find((e) => e.action === 'reopened_missing_contract' && e.task_code === 't41'));
    expect(String(event.note)).toContain('order.signed_on');
    await taskIs(orderId, 't41', 'open');
    // After submission, the signing fields are still the SA's to fill (BR-45); the rest of the order stays locked.
    await moduleApi('sa').saveSigning(orderId, SIGNING);
    expect(await orderOf(orderId)).toMatchObject({ receiver_name: 'Nguyễn An', signed_on: '2026-11-05' });
    expect((await patch(as('sa'), 'order', orderId, { content: 'Đổi nội dung' })).status).toBe(422);
    await up(moduleApi('sa'), orderId, { step: 'final', file: pdf('kh-ky.pdf') });
    await finish(as('sa'), (await taskOf(orderId, 't41'))!, 'completed');
    await taskIs(orderId, 't51', 'open');
    await waitFor('the order signed', async () => (await orderOf(orderId)).contract_signed === true);
    // Signed is signed: the signing fields lock.
    expect((await patch(as('sa'), 'order', orderId, { receiver_name: 'Người khác' })).status).toBe(422);
  });

  it('t45_with_the_final_opens_t53', async () => {
    await up(moduleApi('proc'), orderId, { party: 'supplier', supplier, step: 'final', file: pdf('ncc-ky.pdf'), value: 228_000_000, advance_percent: 0.3 });
    await finish(as('proc'), (await taskOf(orderId, 't45'))!, 'completed');
    await taskIs(orderId, 't53', 'open');
  });

  it('permissions_hold_through_the_module_api', async () => {
    for (const handle of ['am', 'sd', 'acc', 'proc']) expect((await moduleApi(handle).contracts(orderId)).length, handle).toBeGreaterThanOrEqual(5);
    expect(await moduleApi('tm').contracts(orderId)).toEqual([]);
    // Another AM's order is not this AM's to read.
    expect(await moduleApi('am2').contracts(orderId)).toEqual([]);
  });

  it('a_small_order_needs_no_files', async () => {
    const small = await atDrafts(`${TAG}S`, true);
    await finish(as('sa'), (await taskOf(small.orderId, 't40'))!, 'completed');
    await finish(as('proc'), (await taskOf(small.orderId, 't44'))!, 'completed');
    await taskIs(small.orderId, 't42', 'open');
    expect((await eventsOf(small.orderId)).filter((e) => e.action === 'reopened_missing_contract')).toEqual([]);
  });

  it('a_contract_cannot_be_added_to_a_closed_order', async () => {
    const lost = await newOrder(`${TAG}L`);
    expect((await patch(as('am'), 'order', lost, { sa: userId('sa') })).status).toBeLessThan(300);
    await moduleApi('sa').closeLost(lost, 'Khách hủy');
    await waitFor('the order closed', async () => (await orderOf(lost)).status === 'close_lost');
    const refused = await create(as('proc'), 'contract', { order: lost, party: 'supplier', supplier, step: 'draft', version: 1 }).catch((e: Error) => e);
    expect(String(refused)).toContain('422');
  });
});
