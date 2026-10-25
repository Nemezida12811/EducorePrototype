import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, onSignedOut, restoreSession, verifyTwoFactor, type AuthUser } from '../lib/api';

type Role = AuthUser['role'];
interface AuthState {
  user: AuthUser | null;
  loading: boolean;                       // true while a stored session is being restored on first paint
  /** Resolves to 'ok' or, when 2FA is on, to a challenge you pass to verifyCode(). */
  signIn(email: string, password: string): Promise<'ok' | { challengeToken: string }>;
  verifyCode(challengeToken: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  /** super_admin counts as admin, mirroring the backend. */
  hasRole(...roles: Role[]): boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    restoreSession().then((u) => alive && setUser(u)).finally(() => alive && setLoading(false));
    const off = onSignedOut(() => setUser(null)); // refresh failed anywhere => back to the login screen
    return () => { alive = false; off(); };
  }, []);

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    const r = await apiLogin(email, password);
    if (r.twoFactorRequired) return { challengeToken: r.challengeToken };
    setUser(r.user);
    return 'ok';
  }, []);
  const verifyCode = useCallback<AuthState['verifyCode']>(async (c, code) => { setUser(await verifyTwoFactor(c, code)); }, []);
  const signOut = useCallback(async () => { await apiLogout(); setUser(null); }, []);

  const value = useMemo<AuthState>(() => ({
    user, loading, signIn, verifyCode, signOut,
    hasRole: (...roles) => !!user && (roles.includes(user.role) || (user.role === 'super_admin' && roles.includes('admin'))),
  }), [user, loading, signIn, verifyCode, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

/** Route guard: renders children only for allowed roles; otherwise the fallback (e.g. <Navigate to="/login" />). */
export function RequireRole({ roles, fallback = null, children }: { roles?: Role[]; fallback?: ReactNode; children: ReactNode }) {
  const { user, loading, hasRole } = useAuth();
  if (loading) return null;
  if (!user || (roles && !hasRole(...roles))) return <>{fallback}</>;
  return <>{children}</>;
}
