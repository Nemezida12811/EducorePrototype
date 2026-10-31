/**
 * Single entry point for talking to the EduCore API.
 * - Same-origin by default (VITE_API_URL empty => "/api/v1"), so no CORS in production or in `npm run dev` (Vite proxies /api).
 * - The access token lives in memory only; the refresh token in sessionStorage (trade-off: survives reload, readable by XSS).
 * - Concurrent 401s share ONE refresh call (refresh tokens rotate, so two parallel refreshes would trip reuse detection).
 */
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;
const RT_KEY = 'educore.rt';

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
/** Called when the session can no longer be refreshed (UI should show the login screen). */
export const onSignedOut = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export interface AuthUser {
  id: string; email: string; firstName: string; lastName: string;
  role: 'student' | 'teacher' | 'admin' | 'super_admin'; twoFactorEnabled: boolean;
  phone?: string | null; departmentId?: string | null; studyProgramId?: string | null;
  notificationChannels?: { email: boolean; inApp: boolean; push: boolean };
  [k: string]: unknown;
}
export type LoginResult =
  | { twoFactorRequired: true; challengeToken: string }
  | { twoFactorRequired?: false; user: AuthUser };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

const rt = {
  get: () => sessionStorage.getItem(RT_KEY),
  set: (v: string | null) => (v ? sessionStorage.setItem(RT_KEY, v) : sessionStorage.removeItem(RT_KEY)),
};

function applyTokens(t: { accessToken: string; refreshToken: string }) { accessToken = t.accessToken; rt.set(t.refreshToken); }

function signOutLocally() { accessToken = null; rt.set(null); listeners.forEach((fn) => fn()); }

async function refresh(): Promise<boolean> {
  const token = rt.get();
  if (!token) return false;
  refreshInFlight ??= (async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
      if (!r.ok) return false;
      applyTokens(await r.json());
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshInFlight = null; }, 0); }
  })();
  const ok = await refreshInFlight;
  if (!ok) signOutLocally();
  return ok;
}

async function raw(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const r = await fetch(BASE + path, { ...init, headers });
  if (r.status === 401 && retry && !path.startsWith('/auth/') && (await refresh())) return raw(path, init, false);
  return r;
}

async function fail(r: Response): Promise<never> {
  const b = await r.json().catch(() => ({}));
  throw new ApiError(r.status, b.error ?? 'error', b.message ?? r.statusText, b.details);
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const r = await raw(path, json === undefined ? rest : { ...rest, body: JSON.stringify(json) }, true);
  if (!r.ok) return fail(r);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** Authenticated download (PDF transcript, .ics, CSV/XLSX, files): the Authorization header can't be sent by a plain <a href>. */
export async function download(path: string, init: RequestInit = {}, fallbackName = 'download') {
  const r = await raw(path, init, true);
  if (!r.ok) return fail(r);
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(r.headers.get('content-disposition') ?? '');
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: m ? decodeURIComponent(m[1]!) : fallbackName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const upload = <T>(path: string, file: File) => { const f = new FormData(); f.append('file', file); return api<T>(path, { method: 'POST', body: f }); };

// ---- session ----
export async function login(email: string, password: string): Promise<LoginResult> {
  const t = await api<any>('/auth/login', { method: 'POST', json: { email, password } });
  if (t.twoFactorRequired) return { twoFactorRequired: true, challengeToken: t.challengeToken };
  applyTokens(t); return { user: t.user };
}
export async function verifyTwoFactor(challengeToken: string, code: string): Promise<AuthUser> {
  const t = await api<any>('/auth/2fa/verify', { method: 'POST', json: { challengeToken, code } });
  applyTokens(t); return t.user;
}
/** On app start: turn a stored refresh token into a session. Resolves to the user or null. */
export async function restoreSession(): Promise<AuthUser | null> {
  if (!(await refresh())) return null;
  return api<AuthUser>('/users/me');
}
export async function logout() {
  const token = rt.get();
  try { if (token) await api('/auth/logout', { method: 'POST', json: { refreshToken: token } }); } finally { signOutLocally(); }
}
