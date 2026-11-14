import { describe, it, expect } from 'vitest';
import { paymentConfirmedFallback } from './countsFallback';

describe('paymentConfirmedFallback', () => {
  it('shows no number while counts load or when they loaded', () => {
    expect(paymentConfirmedFallback(false, false, 3)).toBeUndefined();
    expect(paymentConfirmedFallback(true, true, 3)).toBeUndefined();
  });
  it('uses the processing count when counts are unavailable and it loaded', () => {
    expect(paymentConfirmedFallback(true, false, 3)).toBe(3);
    expect(paymentConfirmedFallback(true, false, 0)).toBe(0);
  });
  it('shows no number, not 0, when the fallback also failed', () => {
    expect(paymentConfirmedFallback(true, false, null)).toBeUndefined();
  });
});
