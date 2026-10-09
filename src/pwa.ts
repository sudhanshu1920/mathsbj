// PWA registration for browser builds only.
// Capacitor Android packages the web assets directly, so a Service Worker is
// intentionally disabled on native to avoid interfering with native plugins.

import { Capacitor } from "@capacitor/core";
import { toast } from "@/hooks/use-toast";
import { PWA_UPDATE_DISCOVERED_EVENT } from "@/lib/appUpdateEvents";

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

export type UpdateResult = "available" | "current" | "unsupported" | "offline" | "error";
export type ApplyUpdateResult = "applying" | "unsupported" | "offline" | "error";

/** Check for a waiting service worker without activating it. */
export async function triggerUpdate(): Promise<UpdateResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (!swRegistration || !updateSWFn) return "unsupported";
  try {
    await swRegistration.update();
  } catch {
    return "error";
  }

  if (swRegistration.waiting) return "available";
  const installing = swRegistration.installing;
  if (installing) {
    const state = await new Promise<"available" | "current">((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        installing.removeEventListener("statechange", onStateChange);
        clearTimeout(timeoutId);
        resolve(swRegistration?.waiting ? "available" : "current");
      };
      const onStateChange = () => {
        if (["installed", "activated", "redundant"].includes(installing.state)) finish();
      };
      const timeoutId = setTimeout(finish, 6000);
      installing.addEventListener("statechange", onStateChange);
    });
    if (state === "available" || swRegistration.waiting) return "available";
  }
  return "current";
}

/** Activate the waiting worker only after explicit user confirmation. */
export async function applyPwaUpdate(): Promise<ApplyUpdateResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (!swRegistration || !updateSWFn) return "unsupported";
  const status = await triggerUpdate();
  if (status === "offline" || status === "unsupported" || status === "error") return status;

  if (swRegistration.waiting) {
    armControllerReload();
    updateSWFn(true).catch(() => {});
    return "applying";
  }

  // The user has confirmed this reload and the release manifest has already
  // confirmed the deployed build version. Do not claim installation success.
  window.location.reload();
  return "applying";
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
        // Keep the waiting worker until the app's Update Now action is confirmed.
        window.dispatchEvent(new Event(PWA_UPDATE_DISCOVERED_EVENT));
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
