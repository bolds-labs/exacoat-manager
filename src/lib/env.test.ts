import { describe, it, expect } from 'vitest';
import { isTrustedWordPressUrl, getWcCredentials } from './env';

describe('isTrustedWordPressUrl', () => {
  it('accepts exacoat.com hosts over https', () => {
    expect(isTrustedWordPressUrl('https://cms.exacoat.com')).toBe(true);
    expect(isTrustedWordPressUrl('https://staging.exacoat.com/')).toBe(true);
    expect(isTrustedWordPressUrl('https://exacoat.com')).toBe(true);
  });

  it('accepts local development', () => {
    expect(isTrustedWordPressUrl('http://localhost:8080')).toBe(true);
  });

  it('rejects other hosts and look-alikes', () => {
    expect(isTrustedWordPressUrl('https://evil.com')).toBe(false);
    expect(isTrustedWordPressUrl('https://exacoat.com.evil.com')).toBe(false);
    expect(isTrustedWordPressUrl('https://notexacoat.com')).toBe(false);
    expect(isTrustedWordPressUrl('http://cms.exacoat.com')).toBe(false);
    expect(isTrustedWordPressUrl('not a url')).toBe(false);
  });
});

describe('getWcCredentials', () => {
  it('never returns a key', () => {
    expect(getWcCredentials()).toEqual({ key: '', secret: '' });
  });
});
