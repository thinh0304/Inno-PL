// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './shims.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';

configure({ asyncUtilTimeout: 5000 });
const { OrderPage } = await import('../../src/module/OrderPage.js');

afterEach(() => {
  cleanup();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe('the tab row on a narrow screen', () => {
  it('selected_tab_is_scrolled_into_view', async () => {
    const scrolled = vi.fn((_options?: unknown) => {});
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrolled;
    const navigate = vi.fn();
    const api = createMemoryOrdersApi();
    const { rerender } = render(<OrderPage api={api} id="o1" tab="history" lang="vi" locale="vi" theme="light" navigate={navigate} />);
    // With six tabs the last ones sit beyond the edge of a 360 px row: the one the person asked for must be brought into view.
    await screen.findByRole('tab', { name: 'Lịch sử' });
    await waitFor(() => expect(scrolled).toHaveBeenCalled());
    expect(scrolled.mock.contexts.map((c) => (c as Element).id)).toContain('tab-history');
    expect(scrolled.mock.calls[0][0]).toEqual({ block: 'nearest', inline: 'nearest' });
    // Moving to another tab brings that one in; a plain re-render does not scroll again.
    scrolled.mockClear();
    rerender(<OrderPage api={api} id="o1" tab="flow" lang="vi" locale="vi" theme="light" navigate={navigate} />);
    await waitFor(() => expect(scrolled.mock.contexts.map((c) => (c as Element).id)).toContain('tab-flow'));
    const count = scrolled.mock.calls.length;
    fireEvent.change(await screen.findByDisplayValue('Trung tâm CNTT Bà Rịa'), { target: { value: 'Tên mới' } });
    expect(scrolled.mock.calls.length).toBe(count);
  });
});
