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
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app") === false && host.includes("lovable.dev");

const shouldRegister =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  !isInIframe &&
  !isPreviewHost &&
  import.meta.env.PROD;

export async function setupPWA() {
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
        // Periodically check for updates when online.
        if (!registration) return;
        const check = () => {
          if (navigator.onLine) registration.update().catch(() => {});
        };
        // Check on focus, on network restore, and every 60 minutes.
        window.addEventListener("focus", check);
        window.addEventListener("online", () => {
          toast({ title: "Back online", description: "Checking for updates…" });
          check();
        });
        setInterval(check, 60 * 60 * 1000);
      },
    });
  } catch {
    // virtual module unavailable in dev — safe to ignore
  }
}
