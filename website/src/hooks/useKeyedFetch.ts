"use client";

import { useCallback, useRef } from "react";

const CACHE_TTL_MS = 3 * 60 * 1000;
const sessionCache = new Map<string, { value: unknown; storedAt: number }>();

/**
 * Per-key fetch cache with AbortController-based cancellation, so switching
 * keys quickly (e.g. team switching) discards in-flight requests instead of
 * racing them against a boolean "cancelled" flag.
 */
export function useKeyedFetch<T>(namespace = "default") {
  const controllers = useRef(new Map<string, AbortController>());
  const namespacedKey = useCallback((key: string) => `${namespace}:${key}`, [namespace]);

  const readCached = useCallback((key: string): T | undefined => {
    const cacheKey = namespacedKey(key);
    const entry = sessionCache.get(cacheKey);
    if (!entry) return undefined;
    if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
      sessionCache.delete(cacheKey);
      return undefined;
    }
    return entry.value as T;
  }, [namespacedKey]);

  const fetchKeyed = useCallback(async (key: string, url: string, parse: (body: any) => T): Promise<T | undefined> => {
    const cached = readCached(key);
    if (cached !== undefined) return cached;
    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return undefined;
      const value = parse(await response.json());
      sessionCache.set(namespacedKey(key), { value, storedAt: Date.now() });
      return value;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return undefined;
      throw error;
    } finally {
      controllers.current.delete(key);
    }
  }, [namespacedKey, readCached]);

  const getCached = readCached;
  const setCached = useCallback((key: string, value: T) => { sessionCache.set(namespacedKey(key), { value, storedAt: Date.now() }); }, [namespacedKey]);
  const has = useCallback((key: string) => readCached(key) !== undefined, [readCached]);
  const invalidate = useCallback((key?: string) => {
    if (key) return void sessionCache.delete(namespacedKey(key));
    const prefix = `${namespace}:`;
    for (const cacheKey of sessionCache.keys()) if (cacheKey.startsWith(prefix)) sessionCache.delete(cacheKey);
  }, [namespace, namespacedKey]);

  return { fetchKeyed, getCached, setCached, has, invalidate };
}
