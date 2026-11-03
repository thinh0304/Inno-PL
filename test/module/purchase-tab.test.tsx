// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');
const { PurchaseTab } = await import('../../src/module/tabs/PurchaseTab.js');
const { PlTab } = await import('../../src/module/tabs/PlTab.js');

afterEach(cleanup);

const PROC: MemoryOptions = { me: { id: 'u-proc', name: 'Mua hàng' }, access: { seesPl: false, seesServicePrices: false, seesPlService: false,
  seesProposals: true, canCreateOrder: false } };
const TM: MemoryOptions = { me: { id: 'u-tm', name: 'Kỹ thuật' }, access: { seesPl: false, seesGoodsPrices: false, seesPlGoods: false,
  seesProposals: false, canCreateOrder: false } };
const SD: MemoryOptions = { me: { id: 'u-sd', name: 'SD' }, access: { seesProposals: true, canCreateOrder: false } };

async function open(options: MemoryOptions, id = 'o1') {
  render(<OrderPage api={createMemoryOrdersApi(options)} id={id} tab="purchase" lang="vi" locale="vi" theme="light" navigate={vi.fn()}
    tabs={{ purchase: PurchaseTab, pl: PlTab }} />);
  await screen.findByRole('tab', { name: 'Đơn mua hàng' });
}

describe('the purchase tab', () => {
  it('procurement_edits_proposals_and_sees_saving', async () => {
    await open(PROC);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Đơn mua hàng', 'Quy trình', 'Lịch sử']);
    const cost = await screen.findByLabelText('Đơn giá mua đề xuất — Mua hàng dòng 1');
    fireEvent.change(cost, { target: { value: '18.000.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đề xuất dòng 1' }));
    await waitFor(() => expect(screen.getByText('KPI mua hàng').closest('section')!.textContent).toMatch(/12\.000\.000/));
    // Reading the order again keeps the tab on screen: the notice stays until AgentFlow has recomputed.
    expect(screen.getByText('KPI mua hàng đang được tính lại…')).toBeTruthy();
    expect(screen.getByText('Phần đề xuất chỉ Mua hàng, SD, Kế toán xem.')).toBeTruthy();
  });

  it('tm_sees_services_without_full_pl', async () => {
    await open(TM, 'o2');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Đơn mua hàng', 'Quy trình', 'Lịch sử']);
    const services = (await screen.findByText('Đơn mua hàng — Dịch vụ & hạng mục khác')).closest('section')!;
    expect(services.textContent).toMatch(/4\.200\.000/);
    expect(screen.queryByText(/6\.500\.000/)).toBeNull();
    cleanup();
    await open(TM, 'o1');
    const specs = (await screen.findByText('Thiết bị & License — Thông số kỹ thuật')).closest('section')!;
    expect(specs.textContent).toMatch(/Ổ cứng Seagate 18TB/);
    expect(document.body.textContent).not.toMatch(/19\.000\.000|46\.272\.444|21\.000\.000/);
  });

  it('director_reads_proposals_without_editing', async () => {
    await open(SD);
    await screen.findByText('Đơn giá mua đề xuất — Mua hàng');
    expect(screen.queryByLabelText('Đơn giá mua đề xuất — Mua hàng dòng 1')).toBeNull();
    expect(screen.queryByRole('button', { name: /Lưu đề xuất/ })).toBeNull();
  });
});
