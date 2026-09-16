import { AdminUser, ExacoatRole } from '../types';

const STORAGE_KEY = 'exacoat_team_members';

const DEFAULT_TEAM_MEMBERS: AdminUser[] = [
  {
    id: 'user-admin-01',
    email: 'admin@exacoat.com',
    full_name: 'Exacoat Administrator',
    role: 'super_admin',
    avatar_url: undefined,
    created_at: new Date('2024-01-01').toISOString(),
    last_sign_in_at: new Date().toISOString(),
    email_confirmed_at: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'user-manager-02',
    email: 'manager@exacoat.com',
    full_name: 'Operations Manager',
    role: 'manager',
    avatar_url: undefined,
    created_at: new Date('2024-02-01').toISOString(),
    last_sign_in_at: new Date().toISOString(),
    email_confirmed_at: new Date('2024-02-01').toISOString(),
  },
  {
    id: 'user-shop-03',
    email: 'fulfillment@exacoat.com',
    full_name: 'Fulfillment Lead',
    role: 'shop_manager',
    avatar_url: undefined,
    created_at: new Date('2024-03-01').toISOString(),
    last_sign_in_at: new Date().toISOString(),
    email_confirmed_at: new Date('2024-03-01').toISOString(),
  },
];

function getStoredMembers(): AdminUser[] {
  if (typeof window === 'undefined') return DEFAULT_TEAM_MEMBERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEAM_MEMBERS));
      return DEFAULT_TEAM_MEMBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEAM_MEMBERS;
  } catch {
    return DEFAULT_TEAM_MEMBERS;
  }
}

function saveMembers(members: AdminUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch (err) {
    console.warn('[TEAM MANAGER] Storage write error:', err);
  }
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return getStoredMembers();
}

export async function createAdminUser(
  email: string,
  _pass: string,
  fullName: string,
  role: ExacoatRole,
  autoVerify: boolean = true
): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const members = getStoredMembers();

  if (members.some(m => m.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'A user with this email address already exists.' };
  }

  const newUser: AdminUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: cleanEmail,
    full_name: fullName.trim() || cleanEmail.split('@')[0],
    role,
    avatar_url: undefined,
    created_at: new Date().toISOString(),
    last_sign_in_at: undefined,
    email_confirmed_at: autoVerify ? new Date().toISOString() : undefined,
  };

  const updated = [newUser, ...members];
  saveMembers(updated);
  return { success: true, user: newUser };
}

export async function updateAdminUserRole(
  userId: string,
  newRole: ExacoatRole
): Promise<{ success: boolean; error?: string }> {
  const members = getStoredMembers();
  const index = members.findIndex(m => m.id === userId);
  if (index === -1) {
    return { success: false, error: 'User not found' };
  }

  members[index] = { ...members[index], role: newRole };
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

export async function deleteAdminUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const members = getStoredMembers();
  const filtered = members.filter(m => m.id !== userId);
  saveMembers(filtered);
  return { success: true };
}
