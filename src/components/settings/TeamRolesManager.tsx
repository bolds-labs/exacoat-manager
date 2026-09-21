import React, { useState, useEffect } from 'react';
import { AdminUser, ExacoatRole } from '../../types';
import { fetchAdminUsers, updateAdminUserRole, createAdminUser, verifyAdminUserEmail, deleteAdminUser } from '../../lib/teamManager';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Shield, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Key, 
  RefreshCw, 
  Crown, 
  UserCheck, 
  X, 
  AlertCircle, 
  ShoppingBag, 
  Trash2, 
  Eye 
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/Select';
import { clsx } from 'clsx';
import { formatDate } from '../../lib/formatters';
import { Modal } from '../ui/Modal';

interface TeamRolesManagerProps {}

export const TeamRolesManager: React.FC<TeamRolesManagerProps> = () => {
  const { showToast } = useToast();
  const { 
    user: currentUser, 
    simulatedRole, 
    setSimulatedRole, 
    canSimulateRoles 
  } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // New User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<ExacoatRole>('manager');
  const [autoVerify, setAutoVerify] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await fetchAdminUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users based on search
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchesEmail = u.email?.toLowerCase().includes(q);
    const matchesName = (u.full_name || (u as any).user_metadata?.full_name || '').toLowerCase().includes(q);
    const matchesRole = (u.role || (u as any).app_metadata?.role || '').toLowerCase().includes(q);
    return Boolean(matchesEmail || matchesName || matchesRole);
  });

  const handleRoleChange = async (userId: string, newRoleValue: ExacoatRole) => {
    setUpdatingUserId(userId);
    const res = await updateAdminUserRole(userId, newRoleValue);
    if (res.success) {
      showToast('success', 'Role Updated', `User role updated to ${newRoleValue}.`);
      loadUsers();
    } else {
      showToast('error', 'Update Failed', res.error || 'Could not update user role');
    }
    setUpdatingUserId(null);
  };

  const handleDeleteUser = (u: AdminUser) => {
    setDeletingUser(u);
  };

  const handleVerifyEmail = async (userId: string) => {
    setVerifyingUserId(userId);
    const res = await verifyAdminUserEmail(userId);
    if (res.success) {
      showToast('success', 'Email Verified', 'User email has been marked as verified. They can now log in immediately.');
      loadUsers();
    } else {
      showToast('error', 'Verification Failed', res.error || 'Could not verify user email');
    }
    setVerifyingUserId(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) {
      showToast('error', 'Missing Fields', 'Email and password are required.');
      return;
    }

    setIsCreating(true);
    const res = await createAdminUser(newEmail, newPassword, newFullName, newRole, autoVerify);
    if (res.success) {
      showToast('success', 'Team Member Created', `${newEmail} has been added as ${newRole}${autoVerify ? ' (Email Verified)' : ''}.`);
      setIsModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setAutoVerify(true);
      loadUsers();
    } else {
      showToast('error', 'Creation Failed', res.error || 'Could not create team user');
    }
    setIsCreating(false);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#f3aa18]" />
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">WordPress Staff & Team</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/[0.06] text-zinc-700 dark:text-[#f3aa18]">
              {users.length} Staff Member{users.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Manage WordPress administrators and shop managers with access to this platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsers}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Refresh Users from WordPress"
          >
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#f3aa18] text-zinc-950 text-xs font-bold hover:bg-[#f5b838] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-2xl w-fit">
          <div className="px-3 py-1.5 rounded-xl font-bold bg-[#f3aa18] text-zinc-950 shadow-sm">
            Active Accounts ({users.length})
          </div>
        </div>

        <input
          type="text"
          placeholder="Filter by name or email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#f3aa18] w-full sm:w-64"
        />
      </div>

      {/* Team Users Table */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] text-zinc-500 font-mono">
                <th className="py-3 px-4">Member / Account</th>
                <th className="py-3 px-4">Role Access</th>
                <th className="py-3 px-4">Email Status</th>
                <th className="py-3 px-4">Account Created</th>
                <th className="py-3 px-4">Last Sign-in</th>
                {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono">
                    Loading WordPress staff accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono">
                    No staff accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isCurrent = u.id === currentUser?.id || u.email === currentUser?.email;
                  const isVerified = Boolean(u.email_confirmed_at);

                  return (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200">
                            {(u.full_name || u.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900 dark:text-white">
                                {u.full_name || 'Staff User'}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-300">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isSuperAdmin && !isCurrent ? (
                          <div className="w-56">
                            <Select
                              value={u.role || 'manager'}
                              disabled={updatingUserId === u.id}
                              onValueChange={(val: any) => handleRoleChange(u.id, val)}
                            >
                              <SelectTrigger className="h-8 px-2.5 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-white/10 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white">
                                <SelectValue placeholder="Select Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="super_admin">WordPress Administrator</SelectItem>
                                <SelectItem value="shop_manager">WooCommerce Shop Manager</SelectItem>
                                <SelectItem value="manager">Operations Manager</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold',
                            u.role === 'super_admin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            u.role === 'manager' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                            'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          )}>
                            {u.role === 'super_admin' ? <Crown className="w-3 h-3" /> :
                             u.role === 'manager' ? <Shield className="w-3 h-3" /> :
                             <ShoppingBag className="w-3 h-3" />}
                            <span>
                              {u.role === 'super_admin'
                                ? 'WordPress Administrator'
                                : u.role === 'shop_manager'
                                ? 'WooCommerce Shop Manager'
                                : 'Operations Manager'}
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Verified
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                              <Clock className="w-3 h-3 text-amber-400" />
                              Unverified
                            </span>
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleVerifyEmail(u.id)}
                                disabled={verifyingUserId === u.id}
                                className="px-2 py-0.5 rounded bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 text-[10px] font-mono font-bold cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                                title="Mark email as verified to unlock immediate login"
                              >
                                {verifyingUserId === u.id ? (
                                  <>
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    <span>Verifying...</span>
                                  </>
                                ) : (
                                  <span>Mark Verified</span>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {formatDate(u.created_at)}
                      </td>

                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : 'Never'}
                      </td>

                      {isSuperAdmin && (
                        <td className="py-3 px-4 text-right">
                          {isCurrent || u.email === 'admin@exacoat.com' || u.email === 'shandy@exacoat.com' ? (
                            <span className="text-[11px] text-zinc-500 font-mono">
                              Protected
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title={`Delete account for ${u.email}`}
                                aria-label={`Delete account for ${u.email}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Definitions Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] space-y-1.5">
          <div className="flex items-center gap-2 text-amber-500">
            <Crown className="w-4 h-4" />
            <strong className="text-xs font-bold text-zinc-900 dark:text-white">WordPress Administrator</strong>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Full control across WordPress and Exacoat Manager, including system settings, credentials, team roles, and catalog configurations.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] flex flex-col justify-between space-y-1.5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-violet-400">
              <ShoppingBag className="w-4 h-4" />
              <strong className="text-xs font-bold text-zinc-900 dark:text-white">WooCommerce Shop Manager</strong>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Customer orders and fulfillment only. Restricted from catalog management, analytics, system settings, and team roles.
            </p>
          </div>
          {canSimulateRoles && (
            <button
              type="button"
              onClick={() => setSimulatedRole(simulatedRole === 'shop_manager' ? null : 'shop_manager')}
              className={clsx(
                "mt-3 w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border active:scale-98 shadow-xs",
                simulatedRole === 'shop_manager'
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/40 font-bold"
                  : "bg-white dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-white/[0.08]"
              )}
            >
              <Eye className="w-3.5 h-3.5 text-violet-400" />
              <span>{simulatedRole === 'shop_manager' ? 'Active Simulation' : 'Simulate View'}</span>
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] flex flex-col justify-between space-y-1.5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sky-400">
              <Shield className="w-4 h-4" />
              <strong className="text-xs font-bold text-zinc-900 dark:text-white">Operations Manager</strong>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Catalog products, reviews, order fulfillment, and reports. Restricted from API tokens and security credentials.
            </p>
          </div>
          {canSimulateRoles && (
            <button
              type="button"
              onClick={() => setSimulatedRole(simulatedRole === 'manager' ? null : 'manager')}
              className={clsx(
                "mt-3 w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border active:scale-98 shadow-xs",
                simulatedRole === 'manager'
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                  : "bg-white dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-white/[0.08]"
              )}
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>{simulatedRole === 'manager' ? 'Active Simulation' : 'Simulate View'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Add WordPress Staff Member</h2>
          </div>
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block font-mono">
              Full Name
            </label>
            <input
              type="text"
              required
              value={newFullName}
              onChange={e => setNewFullName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block font-mono">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block font-mono">
              Initial Password *
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block font-mono">
              Role Assignment
            </label>
            <Select value={newRole} onValueChange={(val: any) => setNewRole(val)}>
              <SelectTrigger className="w-full h-10 px-3.5 bg-zinc-900 border-white/10 rounded-xl text-xs font-semibold text-white">
                <SelectValue placeholder="Assign Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">WordPress Administrator (Full Access)</SelectItem>
                <SelectItem value="shop_manager">WooCommerce Shop Manager (Fulfillment Only)</SelectItem>
                <SelectItem value="manager">Operations Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto Verify Checkbox */}
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/[0.08] flex items-start gap-3">
            <input
              type="checkbox"
              id="auto-verify-email"
              checked={autoVerify}
              onChange={e => setAutoVerify(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded bg-zinc-950 border-white/20 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="auto-verify-email" className="text-xs text-zinc-300 leading-snug cursor-pointer select-none">
              <strong className="text-white block font-medium">Auto-verify email address</strong>
              <span className="text-[11px] text-zinc-500">Allows the new team member to log in immediately without waiting for or clicking an email verification link.</span>
            </label>
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-5 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#f5b838] text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete User Modal */}
      {deletingUser && (
        <Modal
          isOpen={Boolean(deletingUser)}
          onClose={() => setDeletingUser(null)}
          title="Delete Team Member"
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">
              Are you sure you want to delete <span className="text-white font-bold">{deletingUser.email}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await deleteAdminUser(deletingUser.id);
                  if (res.success) {
                    showToast('success', 'User Deleted', `${deletingUser.email} removed`);
                    setDeletingUser(null);
                    loadUsers();
                  } else {
                    showToast('error', 'Delete Failed', res.error || 'Could not delete user');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
