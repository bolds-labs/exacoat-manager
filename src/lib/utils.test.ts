import { describe, expect, it } from 'vitest';
import { cleanAddressObject } from './utils';

describe('cleanAddressObject', () => {
  it('preserves contact emails while formatting company names', () => {
    expect(cleanAddressObject({
      email: 'sales&returns@example.com',
      company: 'Sales&amp;Returns',
    })).toEqual({
      email: 'sales&returns@example.com',
      company: 'Sales & Returns',
    });
  });
});
