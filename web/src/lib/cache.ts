/**
 * Lightweight stale-while-revalidate cache for API calls.
 * - Stores data in memory (instant) + sessionStorage (survives soft nav).
 * - Returns stale data immediately, then fetches fresh in background.
 * - TTL: how long before a background refresh is triggered (default 60s).
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// In-memory store (fastest, cleared on hard refresh)
const memCache = new Map<string, CacheEntry<unknown>>();

function ssKey(key: string) { return `tlc:${key}`; }

function readSS<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(ssKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch { return null; }
}

function writeSS<T>(key: string, entry: CacheEntry<T>) {
  try { sessionStorage.setItem(ssKey(key), JSON.stringify(entry)); } catch { /* quota */ }
}

/**
 * Stale-while-revalidate fetch.
 * @param key      Cache key
 * @param fetcher  Async function that returns fresh data
 * @param ttlMs    How old data can be before a background refresh fires (default 60s)
 * @param onUpdate Called with fresh data when background refresh completes
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
  onUpdate?: (fresh: T) => void,
): Promise<T> {
  const now = Date.now();

  // 1. Check memory cache first (fastest)
  const mem = memCache.get(key) as CacheEntry<T> | undefined;
  if (mem) {
    const age = now - mem.fetchedAt;
    if (age < ttlMs) return mem.data; // fresh — return immediately
    // Stale — return immediately and refresh in background
    void fetcher().then((fresh) => {
      const entry = { data: fresh, fetchedAt: Date.now() };
      memCache.set(key, entry);
      writeSS(key, entry);
      onUpdate?.(fresh);
    }).catch(() => { /* background refresh failed — keep stale */ });
    return mem.data;
  }

  // 2. Check sessionStorage (survives client-side navigation)
  const ss = readSS<T>(key);
  if (ss) {
    // Populate memory cache
    memCache.set(key, ss);
    const age = now - ss.fetchedAt;
    if (age < ttlMs) return ss.data;
    // Stale — return immediately and refresh in background
    void fetcher().then((fresh) => {
      const entry = { data: fresh, fetchedAt: Date.now() };
      memCache.set(key, entry);
      writeSS(key, entry);
      onUpdate?.(fresh);
    }).catch(() => {});
    return ss.data;
  }

  // 3. No cache — fetch fresh and block
  const fresh = await fetcher();
  const entry = { data: fresh, fetchedAt: Date.now() };
  memCache.set(key, entry);
  writeSS(key, entry);
  return fresh;
}

/** Invalidate a cache key (e.g. after a mutation). */
export function invalidateCache(key: string) {
  memCache.delete(key);
  try { sessionStorage.removeItem(ssKey(key)); } catch { /* ignore */ }
}

/** Invalidate all keys matching a prefix. */
export function invalidateCachePrefix(prefix: string) {
  for (const k of [...memCache.keys()]) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(`tlc:${prefix}`)) sessionStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
