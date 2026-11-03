// @vitest-environment jsdom
import { cleanup, configure, render, screen } from '@testing-library/react';
import { afterEach, describe, it } from 'vitest';
import './shims.js';
import { testHost } from './test-host.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { App } = await import('../../src/module/App.js');

afterEach(cleanup);

describe('the app shell', () => {
  it('shows the order list at /', async () => {
    const host = testHost('/');
    render(<App host={host} api={createMemoryOrdersApi()} lang="vi" locale="vi" theme="light" />);
    await screen.findByRole('heading', { name: 'Danh sách đơn hàng' });
  });

  it('shows a new order at /orders/new', async () => {
    const host = testHost('/orders/new');
    render(<App host={host} api={createMemoryOrdersApi()} lang="vi" locale="vi" theme="light" />);
    await screen.findByRole('heading', { name: 'Tạo đơn hàng mới' });
  });
});
