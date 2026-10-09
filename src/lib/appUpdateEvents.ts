import type { ReleaseManifest } from "@/lib/updateFeed";

export const UPDATE_AVAILABLE_EVENT = "mathmaster:update-available";
export const PWA_UPDATE_DISCOVERED_EVENT = "mathmaster:pwa-update-discovered";

export function announceUpdateAvailable(update: ReleaseManifest, force = false): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT, { detail: { update, force } }));
}
