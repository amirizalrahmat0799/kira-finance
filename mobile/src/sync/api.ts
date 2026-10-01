import { loadSession, normaliseServerUrl, saveSession, type Session } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: { email: string; name: string };
}

const TIMEOUT_MS = 15_000;

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check the server address and your connection.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    // The API returns RFC 9457 problem details: { title, detail, status }
    const detail = (body as { detail?: string; title?: string } | null)?.detail ?? (body as { title?: string } | null)?.title;
    throw new ApiError(res.status, detail ?? `Request failed (${res.status})`);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function signIn(path: 'register' | 'login', serverUrl: string, body: Record<string, string>): Promise<Session> {
  const base = normaliseServerUrl(serverUrl);
  const res = await request<TokenResponse>(`${base}/api/v1/auth/${path}`, { method: 'POST', body: JSON.stringify(body) });
  const session: Session = {
    serverUrl: base,
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    email: res.user.email,
    name: res.user.name,
  };
  await saveSession(session);
  return session;
}

export const register = (serverUrl: string, name: string, email: string, password: string) =>
  signIn('register', serverUrl, { name, email, password });

export const login = (serverUrl: string, email: string, password: string) => signIn('login', serverUrl, { email, password });

export async function logout(): Promise<void> {
  const session = await loadSession();
  await saveSession(null);
  if (!session) return;
  // Best effort: revoke the refresh token on the server.
  await request(`${session.serverUrl}/api/v1/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  }).catch(() => undefined);
}

let refreshing: Promise<Session | null> | null = null;

/** Exchanges the refresh token for a new pair. Concurrent callers share one request (the old token is single-use). */
async function refresh(session: Session): Promise<Session | null> {
  refreshing ??= (async () => {
    try {
      const res = await request<TokenResponse>(`${session.serverUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      const next = { ...session, accessToken: res.accessToken, refreshToken: res.refreshToken };
      await saveSession(next);
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await saveSession(null); // refresh token expired or revoked: sign out
        return null;
      }
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Authenticated call; refreshes the access token once on 401. */
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let session = await loadSession();
  if (!session) throw new ApiError(401, 'Not signed in');

  const call = (s: Session) =>
    request<T>(`${s.serverUrl}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${s.accessToken}` } });

  try {
    return await call(session);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    session = await refresh(session);
    if (!session) throw new ApiError(401, 'Your session expired. Please sign in again.');
    return call(session);
  }
}
