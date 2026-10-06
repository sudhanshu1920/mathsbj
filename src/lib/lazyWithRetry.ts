import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-at";

/**
 * Lazy import that survives stale build chunks (old cached HTML pointing at
 * hashed files that no longer exist after a deploy). Retries once, then
 * force-reloads the page a single time to pick up the new build.
 */
// React's ComponentType constraint uses any in its public type signature; keep the boundary explicit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      // Second attempt — transient network blips.
      try {
        return await load();
      } catch (err2) {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          try {
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.update().catch(() => {})));
            }
            if ("caches" in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          } catch {
            /* ignore */
          }
          window.location.reload();
          // Never resolves; page is reloading.
          return await new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
