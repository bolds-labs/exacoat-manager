import { describe, it, expect } from 'vitest';
import { prepareWordPressRequest } from './requestAuth';

const BASE = 'https://cms.exacoat.com';

describe('prepareWordPressRequest', () => {
  it('adds the staff bearer token to WordPress requests', () => {
    const r = prepareWordPressRequest(`${BASE}/wp-json/wc/v3/orders`, BASE, '7.abc');
    expect(r.authorization).toBe('Bearer 7.abc');
    expect(r.url).toBe(`${BASE}/wp-json/wc/v3/orders`);
  });

  it('strips consumer_key and consumer_secret from WordPress URLs', () => {
    const r = prepareWordPressRequest(
      `${BASE}/wp-json/exacoat-core/v1/reviews/sync-wc?consumer_key=ck_x&consumer_secret=cs_y&_t=1`,
      BASE,
      '7.abc'
    );
    expect(r.url).toBe(`${BASE}/wp-json/exacoat-core/v1/reviews/sync-wc?_t=1`);
    expect(r.url).not.toContain('consumer_');
  });

  it('strips keys even when there is no session token', () => {
    const r = prepareWordPressRequest(`${BASE}/wp-json/wc/v3/orders?consumer_key=ck_x&consumer_secret=cs_y`, BASE, null);
    expect(r.url).toBe(`${BASE}/wp-json/wc/v3/orders`);
    expect(r.authorization).toBeUndefined();
  });

  it('never sends the token to other hosts', () => {
    const r = prepareWordPressRequest('https://api.example.com/v1/thing?consumer_key=ck_x', BASE, '7.abc');
    expect(r.authorization).toBeUndefined();
    expect(r.url).toBe('https://api.example.com/v1/thing?consumer_key=ck_x');
  });

  it('asks for rupiah prices on product requests so the currency switcher does not convert them', () => {
    const r = prepareWordPressRequest(`${BASE}/wp-json/wc/v3/products?per_page=25`, BASE, '7.abc');
    expect(new URL(r.url).searchParams.get('aelia_cs_currency')).toBe('IDR');
    const v = prepareWordPressRequest(`${BASE}/wp-json/wc/v3/products/12/variations`, BASE, '7.abc');
    expect(new URL(v.url).searchParams.get('aelia_cs_currency')).toBe('IDR');
  });

  it('keeps an explicit currency and leaves order requests alone', () => {
    const r = prepareWordPressRequest(`${BASE}/wp-json/wc/v3/products?aelia_cs_currency=USD`, BASE, '7.abc');
    expect(new URL(r.url).searchParams.get('aelia_cs_currency')).toBe('USD');
    const o = prepareWordPressRequest(`${BASE}/wp-json/wc/v3/orders`, BASE, '7.abc');
    expect(o.url).toBe(`${BASE}/wp-json/wc/v3/orders`);
  });
});
