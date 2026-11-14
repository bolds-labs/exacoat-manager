import { describe, it, expect } from 'vitest';
import { roleFromWpUser, isSessionUsable, hasAdminRights } from './authRoles';

describe('roleFromWpUser', () => {
  it('maps administrators to super_admin', () => {
    expect(roleFromWpUser({ roles: ['administrator'] })).toBe('super_admin');
  });

  it('maps shop managers to shop_manager', () => {
    expect(roleFromWpUser({ roles: ['shop_manager'] })).toBe('shop_manager');
  });

  it('maps the custom manager role to manager', () => {
    expect(roleFromWpUser({ roles: ['manager'], canManage: true })).toBe('manager');
  });

  it('treats any other role that can manage WooCommerce as shop_manager', () => {
    expect(roleFromWpUser({ roles: ['fulfillment'], canManage: true })).toBe('shop_manager');
  });

  it('sends customers and unknown roles to the affiliate portal', () => {
    expect(roleFromWpUser({ roles: ['customer'] })).toBe('affiliate');
    expect(roleFromWpUser({ roles: [] })).toBe('affiliate');
    expect(roleFromWpUser({})).toBe('affiliate');
  });

  it('never grants a staff role from the email address', () => {
    expect(roleFromWpUser({ roles: ['customer'], email: 'admin@exacoat.com' })).toBe('affiliate');
  });
});

describe('isSessionUsable', () => {
  const now = 1_800_000_000_000;

  it('rejects sessions without a server token (old fake logins)', () => {
    expect(isSessionUsable({ email: 'a@b.c' }, now)).toBe(false);
  });

  it('rejects expired sessions (expiresAt is in seconds)', () => {
    expect(isSessionUsable({ email: 'a@b.c', token: '1.abc', expiresAt: now / 1000 - 1 }, now)).toBe(false);
  });

  it('accepts a token that has not expired', () => {
    expect(isSessionUsable({ email: 'a@b.c', token: '1.abc', expiresAt: now / 1000 + 60 }, now)).toBe(true);
  });

  it('rejects null and malformed input', () => {
    expect(isSessionUsable(null, now)).toBe(false);
    expect(isSessionUsable({ token: 'not-a-wp-token', email: 'a@b.c' }, now)).toBe(false);
  });
});

describe('hasAdminRights', () => {
  it('never grants admin rights from an email address', () => {
    expect(hasAdminRights({ role: 'shop_manager', email: 'admin@exacoat.com' } as any)).toBe(false);
    expect(hasAdminRights({ role: 'affiliate', email: 'superadmin@example.com' } as any)).toBe(false);
  });

  it('grants admin rights to super admins and WordPress administrators', () => {
    expect(hasAdminRights({ role: 'super_admin' })).toBe(true);
    expect(hasAdminRights({ role: 'shop_manager', roles: ['administrator'] })).toBe(true);
  });

  it('keeps admin rights for a super admin previewing another role', () => {
    expect(hasAdminRights({ role: 'shop_manager', actualRole: 'super_admin' }, 'shop_manager')).toBe(true);
  });

  it('denies other staff roles and signed-out users', () => {
    expect(hasAdminRights({ role: 'manager' })).toBe(false);
    expect(hasAdminRights(null)).toBe(false);
  });
});
