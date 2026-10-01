// SecureStore isn't available on the web build; fall back to localStorage there (development/preview only).
function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const secureStorage = {
  get: async (key: string) => ls()?.getItem(key) ?? null,
  set: async (key: string, value: string) => {
    ls()?.setItem(key, value);
  },
  remove: async (key: string) => {
    ls()?.removeItem(key);
  },
};
