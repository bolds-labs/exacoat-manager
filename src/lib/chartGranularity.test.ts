import { describe, it, expect } from 'vitest';
import { resolveGranularity, MONTHLY_MIN_DAYS } from './chartGranularity';

describe('resolveGranularity', () => {
  it('keeps monthly while the range is long enough', () => {
    expect(resolveGranularity('monthly', MONTHLY_MIN_DAYS)).toBe('monthly');
  });
  it('falls back to daily when the Monthly tab disappears', () => {
    expect(resolveGranularity('monthly', 7)).toBe('daily');
  });
  it('keeps daily and weekly as they are', () => {
    expect(resolveGranularity('weekly', 7)).toBe('weekly');
    expect(resolveGranularity('daily', 1)).toBe('daily');
  });
});
