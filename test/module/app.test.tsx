// @vitest-environment jsdom
import './shims';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/module/App';
import { testHost } from './test-host';

describe('the module', () => {
  it('shows the placeholder in the host language', () => {
    render(<App host={testHost()} lang="vi" locale="vi" theme="light" />);
    expect(screen.getByRole('heading', { name: 'Hiệu quả đơn hàng' })).toBeTruthy();
  });
});
