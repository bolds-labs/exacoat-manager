import { describe, it, expect } from 'vitest';
import { formatCompactMoney, formatAxisMoney } from './compactMoney';

describe('formatCompactMoney', () => {
  it('keeps amounts under 10 million in full', () => {
    expect(formatCompactMoney(225293, 'IDR')).toBe('Rp 225.293');
    expect(formatCompactMoney(9_999_999, 'IDR')).toBe('Rp 9.999.999');
  });
  it('shortens millions to jt with a decimal comma', () => {
    expect(formatCompactMoney(42_805_734, 'IDR')).toBe('Rp 42,8 jt');
    expect(formatCompactMoney(243_204_676, 'IDR')).toBe('Rp 243,2 jt');
  });
  it('shortens billions to M', () => {
    expect(formatCompactMoney(1_250_000_000, 'IDR')).toBe('Rp 1,25 M');
  });
  it('keeps the sign', () => {
    expect(formatCompactMoney(-25_631_389, 'IDR')).toBe('-Rp 25,6 jt');
  });
  it('falls back to the full format for other currencies', () => {
    expect(formatCompactMoney(1234.5, 'USD')).toBe('$1,234.50');
  });
});

describe('formatAxisMoney', () => {
  it('uses rb and jt on chart axes', () => {
    expect(formatAxisMoney(0, 'IDR')).toBe('0');
    expect(formatAxisMoney(500_000, 'IDR')).toBe('500 rb');
    expect(formatAxisMoney(2_500_000, 'IDR')).toBe('2,5 jt');
  });
});
