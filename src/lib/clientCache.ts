// Relative Path: src/lib/clientCache.ts

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const DEFAULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Retrieve cached data from sessionStorage if not expired
 */
export function getCachedData<T>(key: string, ttlMs: number = DEFAULT_CACHE_TTL): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(`cse_cache_${key}`);
    if (!raw) return null;

    const parsed: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();

    if (now - parsed.timestamp < ttlMs) {
      return parsed.data;
    }

    // Expired
    sessionStorage.removeItem(`cse_cache_${key}`);
    return null;
  } catch (err) {
    console.warn(`[ClientCache] Error reading key "${key}":`, err);
    return null;
  }
}

/**
 * Save data to sessionStorage with current timestamp
 */
export function setCachedData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry<T> = {
      timestamp: Date.now(),
      data,
    };
    sessionStorage.setItem(`cse_cache_${key}`, JSON.stringify(entry));
  } catch (err) {
    console.warn(`[ClientCache] Error writing key "${key}":`, err);
  }
}

/**
 * Remove a specific key from cache
 */
export function clearCachedData(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`cse_cache_${key}`);
  } catch (err) {
    console.warn(`[ClientCache] Error removing key "${key}":`, err);
  }
}

/**
 * Fetch with client-side cache and stale-while-revalidate pattern
 */
export async function fetchWithClientCache<T>(
  url: string,
  ttlMs: number = DEFAULT_CACHE_TTL,
  init?: RequestInit
): Promise<T> {
  const cacheKey = url;
  const cached = getCachedData<T>(cacheKey, ttlMs);

  if (cached) {
    // Return cached immediately, then revalidate in background if online
    if (typeof window !== "undefined" && navigator.onLine) {
      fetch(url, init)
        .then((res) => (res.ok ? res.json() : null))
        .then((fresh) => {
          if (fresh) {
            setCachedData(cacheKey, fresh);
          }
        })
        .catch(() => {});
    }
    return cached;
  }

  // No valid cache, fetch fresh
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${url} (status: ${response.status})`);
  }

  const data: T = await response.json();
  setCachedData(cacheKey, data);
  return data;
}
