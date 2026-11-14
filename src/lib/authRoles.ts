import type { ExacoatRole } from '../types';

export interface WpLoginUser {
  roles?: string[];
  role?: string;
  email?: string;
  /** Server-computed: user can manage_woocommerce or manage_options. */
  canManage?: boolean;
}

/**
 * Maps a WordPress account to a manager role. Only WordPress roles and
 * capabilities count; the email address never grants anything. Accounts
 * without staff rights land in the affiliate portal, whose endpoints run
 * their own affiliate check.
 */
export function roleFromWpUser(wpUser: WpLoginUser): ExacoatRole {
  const roles = Array.isArray(wpUser.roles) ? wpUser.roles : [];
  if (roles.includes('administrator')) return 'super_admin';
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('shop_manager') || wpUser.canManage === true) return 'shop_manager';
  return 'affiliate';
}

const WP_SESSION_TOKEN = /^\d+\.[A-Za-z0-9_-]+$/;

/** A stored session is usable only if it carries a real, unexpired WordPress session token. */
export function isSessionUsable(
  session: { email?: string; token?: string; expiresAt?: number } | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!session || !session.email || !session.token || !WP_SESSION_TOKEN.test(session.token)) return false;
  if (typeof session.expiresAt === 'number' && session.expiresAt * 1000 <= nowMs) return false;
  return true;
}

/**
 * Whether the signed-in staff member holds administrator rights. Reads only
 * the role resolved by roleFromWpUser (and the real role while an admin
 * previews another role) plus WordPress roles; never the email address.
 */
export function hasAdminRights(
  user: { role?: ExacoatRole; actualRole?: ExacoatRole; roles?: unknown } | null | undefined,
  simulatedRole?: ExacoatRole | null
): boolean {
  if (!user) return false;
  const effectiveRole = simulatedRole || user.role;
  if (effectiveRole === 'super_admin' || user.actualRole === 'super_admin') return true;
  return Array.isArray(user.roles) && user.roles.includes('administrator');
}
