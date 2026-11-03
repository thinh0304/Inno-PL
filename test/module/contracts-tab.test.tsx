// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import type { TaskRole } from '../../src/flow/tasks';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import type { ContractUpload, OrdersApi, OrderTask } from '../../src/module/orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { FlowTab } = await import('../../src/module/tabs/FlowTab.js');
const { ContractsTab } = await import('../../src/module/tabs/ContractsTab.js');

afterEach(cleanup);

const SA = { id: 'u-sa', name: 'Trần Sa' };
const M = 1_000_000;
const pdf = (name = 'du-thao.pdf') => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });
const memory = (roles: TaskRole[], me = SA) => createMemoryOrdersApi({ me, roles });
const taskOf = async (api: OrdersApi, code: string, id = 'o1'): Promise<OrderTask> => (await api.tasks(id)).find((t) => t.task_code === code)!;
const act = async (api: OrdersApi, code: string, outcome: Parameters<OrdersApi['act']>[1] = 'completed', id = 'o1') =>
  api.act(await taskOf(api, code, id), outcome, '', []);
const upload = (api: OrdersApi, over: Partial<ContractUpload> = {}, id = 'o1') =>
  api.uploadContract(id, { party: 'customer', supplier: null, step: 'draft', file: pdf(), value: null, advance_percent: null, ...over });
const SIGNING = { address: '12 Lê Lợi, Bà Rịa', receiver_name: 'Nguyễn An', receiver_phone: '0901234567', delivery_address: '12 Lê Lợi, Bà Rịa',
  signed_on: '2026-11-05', payment_count: 2, customer_po_no: 'HD-2026-01' };

/** o1 (goods from s1, about 420 tr) sent, checked by Purchasing and approved: t40 and t44 are open. */
async function atDrafts(api: OrdersApi) {
  await act(api, 't11', 'submitted');
  await act(api, 't23');
  await act(api, 't31', 'approved');
  return api;
}
/** On to t41 / t45: both drafts uploaded and done, SD agreed. */
async function atSigning(api: OrdersApi) {
  await atDrafts(api);
  await upload(api);
  await upload(api, { party: 'supplier', supplier: 's1', value: 100 * M, advance_percent: 0.3 });
  await act(api, 't40');
  await act(api, 't44');
  await act(api, 't42', 'agreed');
  return api;
}

function show(api: OrdersApi, tab: 'contracts' | 'flow' = 'contracts', id = 'o1') {
  render(<OrderPage api={api} id={id} tab={tab} lang="vi" locale="vi" theme="light" navigate={vi.fn()} tabs={{ flow: FlowTab, contracts: ContractsTab }} />);
}
const region = (name: string | RegExp) => screen.findByRole('region', { name });
const customer = () => region('Hợp đồng khách hàng');
const supplier = () => region(/^Hợp đồng nhà cung cấp · Công ty Phân phối Sao Việt/);
const choose = (within_: HTMLElement, label: RegExp, file: File) => fireEvent.change(within(within_).getByLabelText(label), { target: { files: [file] } });

describe('the contracts tab', () => {
  it('tab_lists_a_slot_for_the_customer_and_each_supplier', async () => {
    show(memory(['sa']));
    expect(await customer()).toBeTruthy();
    expect(await supplier()).toBeTruthy();
    expect(screen.getAllByRole('region', { name: /^Hợp đồng/ })).toHaveLength(2);
  });

  it('upload_button_only_for_the_right_role_and_an_open_task', async () => {
    show(memory(['sa']));
    await customer();
    // A draft order: nothing to upload yet.
    expect(screen.queryByRole('button', { name: /^Tải lên/ })).toBeNull();
    cleanup();

    show(await atDrafts(memory(['sa'])));
    expect(within(await customer()).getByRole('button', { name: 'Tải lên dự thảo' })).toBeTruthy();
    expect(within(await supplier()).queryByRole('button', { name: /^Tải lên/ })).toBeNull();
    cleanup();

    show(await atDrafts(memory(['proc'], { id: 'u-proc', name: 'Lê Mua' })));
    expect(within(await supplier()).getByRole('button', { name: 'Tải lên dự thảo' })).toBeTruthy();
    expect(within(await supplier()).getByLabelText(/Tỷ lệ tạm ứng/)).toBeTruthy();
    expect(within(await customer()).queryByRole('button', { name: /^Tải lên/ })).toBeNull();
    cleanup();

    show(await atDrafts(memory(['am'], { id: 'u-am', name: 'Nguyễn Thuận' })));
    await customer();
    expect(screen.queryByRole('button', { name: /^Tải lên/ })).toBeNull();
  });

  it('upload_shows_the_file_who_and_when_and_numbers_the_version', async () => {
    const api = await atDrafts(memory(['sa']));
    show(api);
    let box = await customer();
    choose(box, /Chọn file dự thảo/, pdf('a.pdf'));
    fireEvent.change(within(box).getByLabelText(/Giá trị hợp đồng/), { target: { value: '450000000' } });
    fireEvent.click(within(box).getByRole('button', { name: 'Tải lên dự thảo' }));
    expect(await within(box).findByRole('link', { name: 'a.pdf' })).toBeTruthy();
    expect(within(box).getByText(/v1 · Đỗ Thu · \d{2}\/\d{2}\/2026/)).toBeTruthy();
    choose(box, /Chọn file dự thảo/, pdf('b.pdf'));
    fireEvent.click(within(box).getByRole('button', { name: 'Tải lên dự thảo' }));
    box = await customer();
    expect(await within(box).findByRole('link', { name: 'b.pdf' })).toBeTruthy();
    expect(within(box).getByText(/^v2 ·/)).toBeTruthy();
    // The older version stays readable in the history.
    expect(within(within(box).getByRole('group', { name: 'Các phiên bản' })).getByText(/a\.pdf/)).toBeTruthy();
    expect((await api.contracts('o1')).map((c) => [c.version, c.value])).toEqual([[2, null], [1, 450 * M]]);
  });

  it('double_upload_press_creates_one_record', async () => {
    const api = await atDrafts(memory(['sa']));
    show(api);
    const box = await customer();
    choose(box, /Chọn file dự thảo/, pdf());
    const button = within(box).getByRole('button', { name: 'Tải lên dự thảo' });
    fireEvent.click(button);
    fireEvent.click(button);
    await within(box).findByRole('link', { name: 'du-thao.pdf' });
    expect(await api.contracts('o1')).toHaveLength(1);
  });

  it('upload_without_a_file_is_refused_on_the_spot', async () => {
    const api = await atDrafts(memory(['sa']));
    show(api);
    const box = await customer();
    fireEvent.click(within(box).getByRole('button', { name: 'Tải lên dự thảo' }));
    expect(await within(box).findByText('Chọn một file để tải lên')).toBeTruthy();
    expect(await api.contracts('o1')).toEqual([]);
  });

  it('upload_refused_by_the_platform_says_why', async () => {
    const api = await atDrafts(createMemoryOrdersApi({ me: SA, roles: ['sa'], refuseUploads: true }));
    show(api);
    const box = await customer();
    choose(box, /Chọn file dự thảo/, pdf());
    fireEvent.click(within(box).getByRole('button', { name: 'Tải lên dự thảo' }));
    expect(await within(box).findByText(/AgentFlow chưa cho ứng dụng tải file lên/)).toBeTruthy();
  });

  it('small_contract_says_no_file_needed', async () => {
    // o1 is about 420 tr: a file is required.
    show(memory(['sa']));
    expect(within(await customer()).getByText('Bắt buộc file (> 20.000.000 đ)')).toBeTruthy();
    cleanup();
    // The contract's own value, entered with an upload, decides: exactly 20 tr needs no file (BR-44: above 20 tr).
    const api = await atDrafts(memory(['sa']));
    await api.uploadContract('o1', { party: 'customer', supplier: null, step: 'draft', file: pdf(), value: 20 * M, advance_percent: null });
    show(api);
    expect(within(await customer()).getByText('Chưa bắt buộc file (≤ 20.000.000 đ)')).toBeTruthy();
  });

  it('an_orphan_supplier_is_labelled_and_does_not_gate', async () => {
    const api = await atDrafts(memory(['proc'], { id: 'u-proc', name: 'Lê Mua' }));
    await upload(api, { party: 'supplier', supplier: 's2' });
    show(api);
    const orphan = await region(/^Hợp đồng nhà cung cấp · Viettel IDC/);
    expect(within(orphan).getByText('NCC không còn trong đơn')).toBeTruthy();
    expect(within(orphan).queryByRole('button', { name: /^Tải lên/ })).toBeNull();
  });

  it('closed_order_cannot_take_uploads', async () => {
    const api = await atDrafts(memory(['sa']));
    await api.closeLost('o1', 'Khách hủy');
    show(api);
    await customer();
    expect(screen.queryByRole('button', { name: /^Tải lên/ })).toBeNull();
  });
});

describe('the contract gate on the flow tab', () => {
  const doneButton = async () => within(await screen.findByRole('region', { name: 'Việc của bạn' })).findByRole('button', { name: 'Hoàn thành' });

  it('complete_t40_is_locked_with_the_reason_until_the_draft_is_uploaded', async () => {
    const api = await atDrafts(memory(['sa']));
    show(api, 'flow');
    const button = await doneButton();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(button.getAttribute('aria-describedby')!)!.textContent).toContain('Thiếu dự thảo hợp đồng khách hàng');
    fireEvent.click(button);
    expect((await taskOf(api, 't40')).status).toBe('open');
    cleanup();

    await upload(api);
    show(api, 'flow');
    expect((await doneButton()).getAttribute('aria-disabled')).toBe('false');
  });

  it('t41_lists_the_missing_order_fields', async () => {
    const api = await atSigning(memory(['sa']));
    show(api, 'flow');
    const button = await doneButton();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    const why = document.getElementById(button.getAttribute('aria-describedby')!)!.textContent!;
    expect(why).toContain('Ngày ký');
    expect(why).toContain('Người nhận hàng');
    expect(why).toContain('Thiếu bản chính thức hợp đồng khách hàng');
  });

  it('sa_fills_the_signing_fields_at_t41', async () => {
    const api = await atSigning(memory(['sa']));
    show(api);
    const card = await region('Thông tin ký hợp đồng');
    fireEvent.change(within(card).getByLabelText('Ngày ký'), { target: { value: SIGNING.signed_on } });
    fireEvent.change(within(card).getByLabelText('Người nhận hàng'), { target: { value: SIGNING.receiver_name } });
    fireEvent.click(within(card).getByRole('button', { name: 'Lưu thông tin ký' }));
    await waitFor(async () => expect((await api.load('o1')).draft.order).toMatchObject({ signed_on: '2026-11-05', receiver_name: 'Nguyễn An' }));
  });

  it('signing_card_is_only_for_the_t41_holder', async () => {
    show(await atSigning(memory(['proc'], { id: 'u-proc', name: 'Lê Mua' })));
    await customer();
    expect(screen.queryByRole('region', { name: 'Thông tin ký hợp đồng' })).toBeNull();
  });

  it('t41_opens_once_the_final_and_the_fields_are_in', async () => {
    const api = await atSigning(memory(['sa']));
    await api.saveSigning('o1', SIGNING);
    await upload(api, { step: 'final' });
    show(api, 'flow');
    expect((await doneButton()).getAttribute('aria-disabled')).toBe('false');
  });

  it('sd_sees_the_latest_drafts_at_t42', async () => {
    const api = await atDrafts(memory(['sd'], { id: 'u-sd', name: 'Phạm Duyệt' }));
    await upload(api, { file: pdf('kh-v1.pdf') });
    await upload(api, { file: pdf('kh-v2.pdf') });
    await upload(api, { party: 'supplier', supplier: 's1', file: pdf('ncc.pdf') });
    await act(api, 't40');
    await act(api, 't44');
    show(api, 'flow');
    const panel = await screen.findByRole('region', { name: 'Việc của bạn' });
    const drafts = await within(panel).findByRole('list', { name: 'Dự thảo chờ duyệt' });
    expect(within(drafts).getAllByRole('link').map((a) => a.textContent)).toEqual(['kh-v2.pdf', 'ncc.pdf']);
    expect(within(panel).getByRole('button', { name: 'Đồng ý trình ký' }).getAttribute('aria-disabled')).toBe('false');
  });

  it('t53_shows_the_prepay_amount_by_contract', async () => {
    const api = await atSigning(memory(['acc'], { id: 'u-acc', name: 'Võ Kế' }));
    await api.saveSigning('o1', SIGNING);
    await upload(api, { step: 'final' });
    await upload(api, { party: 'supplier', supplier: 's1', step: 'final', value: 100 * M, advance_percent: 0.3 });
    await act(api, 't41');
    await act(api, 't45');
    show(api, 'flow');
    const panel = await screen.findByRole('region', { name: 'Việc của bạn' });
    expect(await within(panel).findByText('Tạm ứng NCC theo hợp đồng: 30.000.000 đ')).toBeTruthy();
  });
});
