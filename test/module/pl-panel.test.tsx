// @vitest-environment jsdom
import './shims';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/domain/config';
import { computePl } from '../../src/domain/pl';
import { formatMoney, formatPercent } from '../../src/module/format';
import { PlPanel } from '../../src/module/screens/PlPanel';
import { ARTIFACT_ORDERS } from '../domain/fixtures/artifact-orders';

describe('PlPanel', () => {
  it('TM-1041: Không đạt, hiện tỷ suất, ngưỡng và LN thuần', () => {
    const result = computePl(ARTIFACT_ORDERS['TM-1041'], DEFAULT_CONFIG);
    render(<PlPanel result={result} lockedAt={null} lang="vi" />);
    expect(screen.getByText('Không đạt')).toBeTruthy();
    expect(screen.getByText(formatPercent(result.margin, 2))).toBeTruthy();
    expect(screen.getByText(formatPercent(result.threshold, 2))).toBeTruthy();
    expect(screen.getAllByText(formatMoney(30613333)).length).toBeGreaterThan(0);
  });

  it('số đã chốt ghi rõ thời điểm chốt', () => {
    const result = computePl(ARTIFACT_ORDERS['DV-0207'], DEFAULT_CONFIG);
    render(<PlPanel result={result} lockedAt="2026-11-04T10:30:00+07:00" lang="vi" />);
    expect(screen.getByText('Đạt')).toBeTruthy();
    expect(screen.getByText(/Số đã chốt lúc/)).toBeTruthy();
  });
});
