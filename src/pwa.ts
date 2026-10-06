// PWA registration for browser builds only.
// Capacitor Android packages the web assets directly, so a Service Worker is
// intentionally disabled on native to avoid interfering with native plugins.

import { Capacitor } from "@capacitor/core";
import { toast } from "@/hooks/use-toast";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = typeof window !== "undefined" ? window.location.hostname : "";
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  (host.includes("lovable.app") === false && host.includes("lovable.dev"));

const isNativeApp = Capacitor.isNativePlatform();

const shouldRegister =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  !isNativeApp &&
  !isInIframe &&
  !isPreviewHost &&
  import.meta.env.PROD;

let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let reloadArmed = false;

function armControllerReload() {
  if (reloadArmed || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  reloadArmed = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
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

  const start = Date.now();
  while (Date.now() - start < 1500) {
    if (swRegistration.waiting || swRegistration.installing) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  if (swRegistration.waiting) {
    updateSWFn(true).catch(() => {});
    return "updated";
  }

  if (swRegistration.installing) {
    const installing = swRegistration.installing;
    const becameWaiting = await new Promise<boolean>((resolve) => {
      const done = () => resolve(!!swRegistration?.waiting);
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" ||
          installing.state === "activated" ||
          installing.state === "redundant"
        ) {
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
  if (typeof window !== "undefined" && "serviceWorker" in navigator && (isNativeApp || isInIframe || isPreviewHost)) {
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
        updateSW(true);
      },
      onOfflineReady() {
        toast({
          title: "Offline ready",
          description: "App is cached and works without internet.",
        });
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        swRegistration = registration;
        armControllerReload();
      },
    });

    updateSWFn = updateSW;
  } catch {
    // virtual module may be unavailable in development.
  }
}
