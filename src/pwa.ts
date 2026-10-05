// PWA registration with safe guards for Lovable preview iframes.
// - Only registers in production builds.
// - Never registers inside an iframe or on Lovable preview hosts.
// - Auto-updates: when a new version is detected, applies it and reloads.
// - Shows a tiny "Updating…" toast while a new version installs.

import { toast } from "@/hooks/use-toast";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = typeof window !== "undefined" ? window.location.hostname : "";
// Capacitor Android uses localhost as its embedded WebView origin. The native
// package already contains every web asset, so PWA service workers are neither
// required nor desirable there; keeping them can retain stale web caches.
const isCapacitorNative = import.meta.env.PROD && host === "localhost";
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app") === false && host.includes("lovable.dev");

const shouldRegister =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  !isInIframe &&
  !isPreviewHost &&
  !isCapacitorNative &&
  import.meta.env.PROD;

// Module-level handles used by triggerUpdate() from the Settings button.
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let reloadArmed = false;

function armControllerReload() {
  if (reloadArmed || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  reloadArmed = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // The new SW has taken control — reload once so the fresh HTML/JS loads.
    window.location.reload();
  });
}

export function isPWARegistered(): boolean {
  return !!swRegistration && !!updateSWFn;
}

export type UpdateResult = "updated" | "current" | "unsupported" | "offline";

export async function triggerUpdate(): Promise<UpdateResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (!swRegistration || !updateSWFn) return "unsupported";
  armControllerReload();
  try {
    await swRegistration.update();
  } catch {
    return "current";
  }
  // Give the browser a moment to surface a waiting worker after update().
  const start = Date.now();
  while (Date.now() - start < 1500) {
    if (swRegistration.waiting || swRegistration.installing) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  if (swRegistration.waiting) {
    // Activate the new SW and reload once it takes over.
    updateSWFn(true).catch(() => {});
    return "updated";
  }
  if (swRegistration.installing) {
    // Wait for installation to finish, then activate if it becomes waiting.
    const installing = swRegistration.installing;
    const becameWaiting = await new Promise<boolean>((resolve) => {
      const done = () => resolve(!!swRegistration?.waiting);
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" || installing.state === "activated" || installing.state === "redundant") {
          done();
        }
      });
      setTimeout(done, 6000);
    });
    if (becameWaiting && swRegistration.waiting) {
      updateSWFn(true).catch(() => {});
      return "updated";
    }
  }
  return "current";
}

export async function setupPWA() {
  // Native Capacitor builds do not need a service worker: all assets are
  // embedded in the APK. Remove any stale registration/cache left by an older
  // PWA-enabled build so the native shell cannot boot from old web assets.
  if (isCapacitorNative) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch {
      // ignore native cache cleanup failures
    }
    return;
  }

  // Always clean up stale SWs in iframe / preview contexts.
  if (typeof window !== "undefined" && "serviceWorker" in navigator && (isInIframe || isPreviewHost)) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
    } catch {
      // ignore
    }
    return;
  }

  if (!shouldRegister) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast({
          title: "Updating…",
          description: "A new version is being installed.",
        });
        // Apply update immediately, then reload.
        updateSW(true);
      },
      onOfflineReady() {
        toast({
          title: "Offline ready",
          description: "App is cached and works without internet.",
        });
      },
      onRegisteredSW(_swUrl, registration) {
        // No background update polling: normal usage must never wait on the
        // network. Updates happen only via Settings → Check for updates.
        if (!registration) return;
        swRegistration = registration;
        armControllerReload();
      },
    });
    updateSWFn = updateSW;
  } catch {
    // virtual module unavailable in dev — safe to ignore
  }
}
