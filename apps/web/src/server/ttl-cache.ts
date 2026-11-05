import "server-only";

interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

export interface TtlCacheOptions {
  ttlMs: number;
  /** Oldest entries are evicted beyond this size. */
  maxEntries: number;
  now?: () => number;
}

/**
 * Per-process memoization of an async function with a time to live. Concurrent calls with the same
 * key share one promise; rejected promises are dropped so errors are never cached.
 */
export function ttlCache<Args extends (string | number | null)[], T>(
  fn: (...args: Args) => Promise<T>,
  { ttlMs, maxEntries, now = Date.now }: TtlCacheOptions,
): (...args: Args) => Promise<T> {
  const entries = new Map<string, Entry<T>>();

  return (...args) => {
    const key = JSON.stringify(args);
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now()) return hit.value;
    entries.delete(key);

    const value = fn(...args);
    entries.set(key, { value, expiresAt: now() + ttlMs });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    // Map keeps insertion order, so the first key is the oldest.
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    return value;
  };
}
