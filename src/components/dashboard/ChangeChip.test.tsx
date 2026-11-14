// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChangeChip, formatChange } from './ChangeChip';
import { compareMetric } from '../../lib/periodComparison';

afterEach(cleanup);

describe('formatChange', () => {
  it('rounds to whole percent with a sign', () => {
    expect(formatChange(0.12)).toBe('+12%');
    expect(formatChange(-0.43)).toBe('-43%');
  });
  it('keeps one decimal under 10%', () => {
    expect(formatChange(0.056)).toBe('+5.6%');
  });
  it('groups large changes', () => {
    expect(formatChange(12.5)).toBe('+1,250%');
  });
});

describe('ChangeChip', () => {
  const label = 'previous 7 days';

  it('shows a rise in the done colour with the previous period on hover', () => {
    render(<ChangeChip comparison={compareMetric(112, 100, true)} periodLabel={label} />);
    const chip = screen.getByText('+12%').closest('span')!;
    expect(chip.className).toContain('text-st-done-fg');
    expect(chip.getAttribute('title')).toContain('vs previous 7 days');
  });

  it('shows a fall in the stop colour', () => {
    render(<ChangeChip comparison={compareMetric(96, 100, true)} periodLabel={label} />);
    expect(screen.getByText('-4%').closest('span')!.className).toContain('text-st-stop-fg');
  });

  it('shows no change for a flat period', () => {
    render(<ChangeChip comparison={compareMetric(1001, 1000, true)} periodLabel={label} />);
    expect(screen.getByText('No change')).toBeTruthy();
  });

  it('shows New when the previous period had nothing', () => {
    render(<ChangeChip comparison={compareMetric(5, 0, true)} periodLabel={label} />);
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('shows Not enough history instead of a percentage', () => {
    render(<ChangeChip comparison={compareMetric(112, 100, false)} periodLabel={label} />);
    expect(screen.getByText('Not enough history')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('can format the previous value for the hover text', () => {
    render(<ChangeChip comparison={compareMetric(112, 100, true)} periodLabel={label} formatValue={(v) => `Rp ${v}`} />);
    expect(screen.getByText('+12%').closest('span')!.getAttribute('title')).toBe('vs previous 7 days: Rp 100');
  });
});
