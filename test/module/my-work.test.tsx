// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi, type MemoryOptions } from '../../src/module/memory-orders-api.js';
import { OrdersError, type OrdersApi } from '../../src/module/orders-api.js';
import { parseRoute, routePath } from '../../src/module/routes.js';
import { testHost } from './test-host.js';

configure({ asyncUtilTimeout: 5000 });
const { App } = await import('../../src/module/App.js');

afterEach(cleanup);

function app(path: string, api: OrdersApi = createMemoryOrdersApi({ roles: ['am'] })) {
  const host = testHost(path);
  render(<App host={host} api={api} lang="vi" locale="vi" theme="light" />);
  return { host, api };
}
const memory = (options: MemoryOptions = {}) => createMemoryOrdersApi(options);

describe('the routes of My work', () => {
  it('parse_and_build_the_work_and_task_routes', () => {
    expect(parseRoute('/tasks')).toEqual({ name: 'work' });
    expect(parseRoute('/tasks/abc%20d')).toEqual({ name: 'task', id: 'abc d' });
    expect(routePath({ name: 'work' })).toBe('/tasks');
    expect(routePath({ name: 'task', id: 'abc d' })).toBe('/tasks/abc%20d');
    for (const path of ['/tasks', '/tasks/t-1']) expect(routePath(parseRoute(path))).toBe(path);
  });
});

describe('My work (FR-6.4)', () => {
  it('my_work_groups_held_and_offered_tasks', async () => {
    const base = memory({ roles: ['am'] });
    // One task already held by this person, the other offered to their role.
    const api: OrdersApi = { ...base, myWork: async () => (await base.myWork()).map((w, i) => (i === 0 ? { ...w, mine: true } : w)) };
    app('/tasks', api);
    const mine = await screen.findByRole('region', { name: 'Của bạn' });
    const offered = screen.getByRole('region', { name: 'Chờ bạn nhận' });
    expect(within(mine).getAllByRole('listitem')).toHaveLength(1);
    expect(within(offered).getAllByRole('listitem')).toHaveLength(1);
    const row = within(mine).getByRole('listitem');
    expect(row.textContent).toContain('T11');
    expect(row.textContent).toContain('Lập đơn hàng & gửi duyệt');
    expect(row.textContent).toContain('GĐ 1');
    expect(row.textContent).toMatch(/Hạn \d{2}\/\d{2}\/\d{4}/);
  });

  it('my_work_row_opens_the_orders_flow_tab', async () => {
    const { host } = app('/tasks');
    const buttons = await screen.findAllByRole('button', { name: /^Mở / });
    fireEvent.click(buttons[0]);
    expect(host.paths.at(-1)).toMatch(/^\/orders\/o\d\?tab=flow$/);
  });

  it('my_work_empty_and_error_states', async () => {
    app('/tasks', memory({ roles: ['tm'] }));
    expect(await screen.findByText('Không có việc nào đang chờ.')).toBeTruthy();
    cleanup();
    let down = true;
    const base = memory({ roles: ['am'] });
    app('/tasks', { ...base, myWork: async () => { if (down) throw new Error('boom'); return base.myWork(); } });
    expect(await screen.findByText('Không tải được danh sách việc.')).toBeTruthy();
    down = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect((await screen.findAllByRole('button', { name: /^Mở / })).length).toBeGreaterThan(0);
  });

  it('list_shows_the_my_work_button_with_a_count', async () => {
    const { host } = app('/');
    const button = await screen.findByRole('button', { name: 'Việc của tôi (2)' });
    fireEvent.click(button);
    expect(host.paths.at(-1)).toBe('/tasks');
  });

  it('list_hides_the_count_when_nothing_waits_or_it_cannot_be_read', async () => {
    app('/', memory({ roles: ['tm'] }));
    expect(await screen.findByRole('button', { name: 'Việc của tôi' })).toBeTruthy();
    cleanup();
    const base = memory({ roles: ['am'] });
    app('/', { ...base, myWork: async () => { throw new OrdersError('FORBIDDEN', null, {}, 403); } });
    expect(await screen.findByRole('button', { name: 'Việc của tôi' })).toBeTruthy();
  });

  it('demo_roles_set_who_acts', async () => {
    const api = memory({ roles: ['proc'] });
    const [t11] = await api.tasks('o1');
    await api.act(t11, 'submitted', '', []);
    expect((await api.myWork()).map((w) => w.task.task_code)).toEqual(['t23']);
  });
});
