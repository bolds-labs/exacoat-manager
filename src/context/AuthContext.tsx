import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ExacoatRole, UserSession } from '../types';
import { getWordPressBaseUrl } from '../lib/env';
import { roleFromWpUser, isSessionUsable } from '../lib/authRoles';
import { SESSION_EXPIRED_EVENT } from '../lib/sessionEvents';

export interface LoginResult {
  success: boolean;
  requiresMfa?: boolean;
  factorId?: string;
  challengeId?: string;
  error?: string;
}

interface AuthContextType {
  user: UserSession | null;
  session: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  simulatedRole: ExacoatRole | null;
  setSimulatedRole: (role: ExacoatRole | null) => void;
  canSimulateRoles: boolean;
  isSimulatingRole: boolean;
  login: (email: string, pass: string) => Promise<LoginResult>;
  verifyMfa: (factorId: string, challengeId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithOAuth: (provider: 'google' | 'github') => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearPasswordRecovery: () => void;
  isPasswordRecovery: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_SESSION_KEY = 'exacoat_admin_session';
const STORAGE_SIM_ROLE_KEY = 'exacoat_simulated_role';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawUser, setRawUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  const [simulatedRole, setSimulatedRoleState] = useState<ExacoatRole | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_SIM_ROLE_KEY);
      if (stored === 'manager' || stored === 'shop_manager' || stored === 'super_admin') {
        return stored as ExacoatRole;
      }
    }
    return null;
  });

  const setSimulatedRole = useCallback((role: ExacoatRole | null) => {
    const target = role === 'super_admin' ? null : role;
    setSimulatedRoleState(target);
    if (typeof window !== 'undefined') {
      if (target) {
        sessionStorage.setItem(STORAGE_SIM_ROLE_KEY, target);
      } else {
        sessionStorage.removeItem(STORAGE_SIM_ROLE_KEY);
      }
    }
  }, []);

  const actualRole = rawUser?.actualRole || rawUser?.role || 'affiliate';
  const canSimulateRoles = actualRole === 'super_admin';
  const isSimulatingRole = Boolean(canSimulateRoles && simulatedRole && simulatedRole !== actualRole);

  const user = useMemo(() => {
    if (!rawUser) return null;
    if (canSimulateRoles && simulatedRole) {
      return {
        ...rawUser,
        actualRole,
        role: simulatedRole,
      };
    }
    return {
      ...rawUser,
      actualRole,
    };
  }, [rawUser, canSimulateRoles, simulatedRole, actualRole]);

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isSessionUsable(parsed)) {
            setRawUser(parsed);
          } else {
            // Drops sessions from the old offline fallback (no token) and expired tokens
            localStorage.removeItem(STORAGE_SESSION_KEY);
          }
        } catch {
          localStorage.removeItem(STORAGE_SESSION_KEY);
        }
      }
    }
    setIsLoading(false);
  }, []);

  // Sign out when WordPress rejects the session token
  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      sessionStorage.removeItem(STORAGE_SIM_ROLE_KEY);
      setRawUser(null);
      setSimulatedRoleState(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = async (email: string, pass: string): Promise<LoginResult> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Please provide both email and password.' };
    }

    try {
      const base = getWordPressBaseUrl();
      const res = await fetch(`${base}/wp-json/exacoat-core/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.token) {
        const wpUser = data.user || {};
        const role: ExacoatRole = roleFromWpUser(wpUser);

        const sessionUser: UserSession = {
          id: String(wpUser.id || `user-${Date.now()}`),
          email: wpUser.email || cleanEmail,
          name: wpUser.displayName || wpUser.firstName || cleanEmail.split('@')[0].toUpperCase(),
          role,
          actualRole: role,
          token: data.token,
          expiresAt: data.expiresAt,
          loginAt: new Date().toISOString(),
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
        }
        setRawUser(sessionUser);
        return { success: true };
      }

      return {
        success: false,
        error: data.message || (res.status === 401 ? 'The email or password is incorrect.' : `Sign in failed (HTTP ${res.status}).`),
      };
    } catch {
      return { success: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  const UNSUPPORTED = 'This sign-in method is not available. Use your WordPress email and password.';

  const verifyMfa = async (_factorId: string, _challengeId: string, _code: string) => {
    return { success: false, error: UNSUPPORTED };
  };

  const loginWithGoogle = async () => {
    return { success: false, error: UNSUPPORTED };
  };

  const loginWithOAuth = async (_provider: 'google' | 'github') => {
    return { success: false, error: UNSUPPORTED };
  };

  const resetPassword = async (email: string) => {
    try {
      const base = getWordPressBaseUrl();
      const res = await fetch(`${base}/wp-json/exacoat-core/v1/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: true, error: res.ok ? undefined : data?.message };
    } catch (err: any) {
      return { success: true, error: undefined };
    }
  };

  const resendConfirmationEmail = async (_email: string) => {
    return { success: false, error: UNSUPPORTED };
  };

  const verifyEmailOtp = async (_email: string, _token: string) => {
    return { success: false, error: UNSUPPORTED };
  };

  const verifyRecoveryOtp = async (_email: string, _token: string) => {
    return { success: false, error: UNSUPPORTED };
  };

  const updatePassword = async (_newPassword: string) => {
    return { success: false, error: UNSUPPORTED };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const logout = async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      sessionStorage.removeItem(STORAGE_SIM_ROLE_KEY);
    }
    setRawUser(null);
    setSimulatedRoleState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session: rawUser ? { user: rawUser } : null,
        isAuthenticated: !!user,
        isLoading,
        simulatedRole,
        setSimulatedRole,
        canSimulateRoles,
        isSimulatingRole,
        login,
        verifyMfa,
        loginWithGoogle,
        loginWithOAuth,
        resetPassword,
        resendConfirmationEmail,
        verifyEmailOtp,
        verifyRecoveryOtp,
        updatePassword,
        clearPasswordRecovery,
        isPasswordRecovery,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
