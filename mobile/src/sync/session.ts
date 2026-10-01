import { secureStorage } from './storage';

export interface Session {
  serverUrl: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  name: string;
}

const KEY = 'kira.session';

/** Default API address; override with EXPO_PUBLIC_API_URL or on the sign-in screen (use your computer's LAN IP on a phone). */
export const DEFAULT_SERVER_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

let cached: Session | null | undefined;
const listeners = new Set<(s: Session | null) => void>();

export async function loadSession(): Promise<Session | null> {
  if (cached !== undefined) return cached;
  const raw = await secureStorage.get(KEY);
  try {
    cached = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveSession(session: Session | null): Promise<void> {
  cached = session;
  if (session) await secureStorage.set(KEY, JSON.stringify(session));
  else await secureStorage.remove(KEY);
  listeners.forEach((l) => l(session));
}

export function onSessionChange(listener: (s: Session | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function normaliseServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
