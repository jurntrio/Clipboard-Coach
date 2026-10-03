"use client";

import { useEffect, useState } from "react";

export function useScreenWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let disposed = false;
    let requesting = false;
    let lock: WakeLockSentinel | null = null;
    async function acquire() {
      if (disposed || requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed) { await next.release(); return; }
        lock = next;
        setActive(true);
        next.addEventListener("release", () => { if (!disposed) setActive(false); });
      } catch { if (!disposed) setActive(false); }
      finally { requesting = false; }
    }
    const retry = () => { void acquire(); };
    retry();
    document.addEventListener("visibilitychange", retry);
    document.addEventListener("pointerdown", retry);
    window.addEventListener("pageshow", retry);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", retry);
      document.removeEventListener("pointerdown", retry);
      window.removeEventListener("pageshow", retry);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
  return active;
}
