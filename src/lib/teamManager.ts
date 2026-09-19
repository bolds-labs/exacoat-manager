import { AdminUser, ExacoatRole, UserSession } from '../types';
import {
  fetchWordPressTeamDirect,
  updateWordPressUserRoleDirect,
  createWordPressStaffUserDirect,
  deleteWordPressStaffUserDirect,
} from './wordpressBridge';

const STORAGE_KEY = 'exacoat_team_members';
const STORAGE_SESSION_KEY = 'exacoat_admin_session';

/**
 * Filter out legacy mock accounts from previous local tests
 */
function sanitizeStoredMembers(members: AdminUser[]): AdminUser[] {
  return members.filter(
    m =>
      m.id !== 'user-admin-01' &&
      m.id !== 'user-manager-02' &&
      m.id !== 'user-shop-03' &&
      m.email !== 'manager@exacoat.com' &&
      m.email !== 'fulfillment@exacoat.com'
  );
}

function getStoredMembers(): AdminUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sanitized = sanitizeStoredMembers(parsed);
      if (sanitized.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    return [];
  } catch {
    return [];
  }
}

function saveMembers(members: AdminUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sanitizeStoredMembers(members);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[TEAM MANAGER] Storage write error:', err);
  }
}

/**
 * Get current active session user to ensure they are represented in the team list
 */
function getCurrentSessionUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const session: UserSession = JSON.parse(raw);
    if (!session || !session.email) return null;

    return {
      id: String(session.id || 'current-user'),
      email: session.email,
      full_name: session.name || session.fullName || session.email.split('@')[0],
      role: session.role || 'super_admin',
      avatar_url: session.avatarUrl || session.avatar_url,
      created_at: session.loginAt || new Date().toISOString(),
      last_sign_in_at: session.loginAt || new Date().toISOString(),
      email_confirmed_at: session.loginAt || new Date().toISOString(),
      wp_roles: session.role === 'super_admin' ? ['administrator'] : [session.role],
    };
  } catch {
    return null;
  }
}

/**
 * Fetch real WordPress administrator and shop manager team members.
 * Queries WordPress REST API with fallback to offline local cache.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  // 1. Attempt live fetch from WordPress
  try {
    const res = await fetchWordPressTeamDirect();
    if (res.success && Array.isArray(res.users) && res.users.length > 0) {
      const cleaned = sanitizeStoredMembers(res.users);
      saveMembers(cleaned);
      return cleaned;
    }
  } catch (err) {
    console.warn('[TEAM MANAGER] Live WordPress team fetch failed, falling back to cache:', err);
  }

  // 2. Fallback to cached real members
  const cached = getStoredMembers();
  if (cached.length > 0) {
    return cached;
  }

  // 3. Fallback to current authenticated user session if available
  const currentUser = getCurrentSessionUser();
  if (currentUser) {
    const fallbackList = [currentUser];
    saveMembers(fallbackList);
    return fallbackList;
  }

  return [];
}

/**
 * Create a new staff account in WordPress (administrator or shop manager)
 */
export async function createAdminUser(
  email: string,
  pass: string,
  fullName: string,
  role: ExacoatRole,
  autoVerify: boolean = true
): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const members = getStoredMembers();

  if (members.some(m => m.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'A WordPress account with this email address already exists.' };
  }

  // 1. Create in WordPress
  try {
    const wpRes = await createWordPressStaffUserDirect(cleanEmail, pass, fullName, role);
    if (wpRes.success && wpRes.user) {
      const updated = [wpRes.user, ...members.filter(m => m.id !== wpRes.user?.id)];
      saveMembers(updated);
      return { success: true, user: wpRes.user };
    }
    if (wpRes.error) {
      return { success: false, error: wpRes.error };
    }
  } catch (err: any) {
    console.warn('[TEAM MANAGER] Remote creation failed:', err);
  }

  // 2. Local fallback if WordPress is temporarily offline
  const newUser: AdminUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: cleanEmail,
    full_name: fullName.trim() || cleanEmail.split('@')[0],
    role,
    avatar_url: undefined,
    created_at: new Date().toISOString(),
    last_sign_in_at: undefined,
    email_confirmed_at: autoVerify ? new Date().toISOString() : undefined,
    wp_roles: role === 'super_admin' ? ['administrator'] : ['shop_manager'],
  };

  const updated = [newUser, ...members];
  saveMembers(updated);
  return { success: true, user: newUser };
}

/**
 * Update user role in WordPress (administrator or shop manager)
 */
export async function updateAdminUserRole(
  userId: string,
  newRole: ExacoatRole
): Promise<{ success: boolean; error?: string }> {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === userId);

  // 1. Update in WordPress
  try {
    const wpRes = await updateWordPressUserRoleDirect(userId, newRole);
    if (wpRes.success) {
      if (index !== -1) {
        members[index] = {
          ...members[index],
          role: newRole,
          wp_roles: newRole === 'super_admin' ? ['administrator'] : ['shop_manager'],
        };
        saveMembers(members);
      }
      return { success: true };
    }
    if (wpRes.error) {
      return { success: false, error: wpRes.error };
    }
  } catch (err: any) {
    console.warn('[TEAM MANAGER] Remote role update failed:', err);
  }

  // 2. Local cache fallback
  if (index === -1) {
    return { success: false, error: 'User account not found' };
  }

  members[index] = {
    ...members[index],
    role: newRole,
    wp_roles: newRole === 'super_admin' ? ['administrator'] : ['shop_manager'],
  };
  saveMembers(members);
  return { success: true };
}

export async function verifyAdminUserEmail(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === userId);
  if (index === -1) {
    return { success: false, error: 'User not found' };
  }

  members[index] = { ...members[index], email_confirmed_at: new Date().toISOString() };
  saveMembers(members);
  return { success: true };
}

/**
 * Delete a staff user in WordPress
 */
export async function deleteAdminUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const wpRes = await deleteWordPressStaffUserDirect(userId);
    if (!wpRes.success && wpRes.error) {
      return { success: false, error: wpRes.error };
    }
  } catch (err: any) {
    console.warn('[TEAM MANAGER] Remote deletion error:', err);
  }

  const members = getStoredMembers();
  const filtered = members.filter(m => m.id !== userId);
  saveMembers(filtered);
  return { success: true };
}
