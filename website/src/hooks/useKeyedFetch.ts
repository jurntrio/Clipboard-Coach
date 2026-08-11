"use client";

import { useCallback, useRef } from "react";

/**
 * Per-key fetch cache with AbortController-based cancellation, so switching
 * keys quickly (e.g. team switching) discards in-flight requests instead of
 * racing them against a boolean "cancelled" flag.
 */
export function useKeyedFetch<T>() {
  const cache = useRef(new Map<string, T>());
  const controllers = useRef(new Map<string, AbortController>());

  const fetchKeyed = useCallback(async (key: string, url: string, parse: (body: any) => T): Promise<T | undefined> => {
    const cached = cache.current.get(key);
    if (cached !== undefined) return cached;
    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return undefined;
      const value = parse(await response.json());
      cache.current.set(key, value);
      return value;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return undefined;
      throw error;
    } finally {
      controllers.current.delete(key);
    }
  }, []);

  const getCached = useCallback((key: string) => cache.current.get(key), []);
  const setCached = useCallback((key: string, value: T) => { cache.current.set(key, value); }, []);
  const has = useCallback((key: string) => cache.current.has(key), []);

  return { fetchKeyed, getCached, setCached, has };
}
