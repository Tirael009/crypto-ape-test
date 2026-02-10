type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = 60_000): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 60_000
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;

  const value = await fn();
  setCached(key, value, ttlMs);
  return value;
}

export function clearCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
