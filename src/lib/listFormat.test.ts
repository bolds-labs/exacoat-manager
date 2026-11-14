import { describe, it, expect } from 'vitest';
import { joinList } from './listFormat';

describe('joinList', () => {
  it('joins three names with commas and "and"', () => {
    expect(joinList(['Webstore', 'Shopee', 'TikTok Shop'])).toBe('Webstore, Shopee and TikTok Shop');
  });
  it('joins two names with "and"', () => {
    expect(joinList(['Shopee', 'TikTok Shop'])).toBe('Shopee and TikTok Shop');
  });
  it('returns a single name or nothing', () => {
    expect(joinList(['Shopee'])).toBe('Shopee');
    expect(joinList([])).toBe('');
  });
});
