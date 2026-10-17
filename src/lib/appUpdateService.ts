import { Capacitor } from "@capacitor/core";
import {
  isAndroidNativeUpdaterAvailable,
  getInstalledAndroidVersion,
  startAndroidUpdate,
  saveAndroidUpdateToDownloads,
} from "@/nativeAppUpdater";
import { APP_VERSION_CODE, APP_VERSION_NAME } from "@/lib/appVersion";
import { fetchLatestRelease, validateReleaseManifest, type ReleaseManifest } from "@/lib/updateFeed";
import { isNewerRelease } from "@/lib/updateVersion";
import { applyPwaUpdate, triggerUpdate } from "@/pwa";

export type AppUpdateCheckResult =
  | { status: "available"; update: ReleaseManifest; latest: ReleaseManifest; currentVersionCode: number; currentVersionName: string; platform: "android" | "web" }
  | { status: "current"; latest: ReleaseManifest; currentVersionCode: number; currentVersionName: string; platform: "android" | "web" }
  | { status: "offline" }
  | { status: "error"; message: string };

export type AppUpdateInstallResult =
  | { status: "started"; platform: "android"; downloadId: number }
  | { status: "applying"; platform: "web" }
  | { status: "current" | "offline" | "unsupported" | "error" };

export type AppUpdateDownloadResult =
  | { status: "started"; platform: "android"; downloadId: number; update: ReleaseManifest }
  | { status: "offline" | "unsupported" | "current" | "error" };

let checkRequest: Promise<AppUpdateCheckResult> | null = null;

async function getCurrentVersion() {
  return isAndroidNativeUpdaterAvailable()
    ? getInstalledAndroidVersion()
    : { versionCode: APP_VERSION_CODE, versionName: APP_VERSION_NAME };
}

async function getFreshInstallableRelease(candidate: ReleaseManifest) {
  // A dialog can remain open while the public manifest changes or the app is
  // updated elsewhere. Re-fetch and revalidate at the point of user action.
  validateReleaseManifest(candidate);
  const [latestRaw, current] = await Promise.all([fetchLatestRelease(), getCurrentVersion()]);
  const latest = validateReleaseManifest(latestRaw);
  return { latest, current, newer: isNewerRelease(latest, current) };
}

async function runCheck(): Promise<AppUpdateCheckResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
  try {
    const isAndroid = isAndroidNativeUpdaterAvailable();
    const current = await getCurrentVersion();
    const latest = await fetchLatestRelease();

    let available = isNewerRelease(latest, current);
    if (!isAndroid) {
      const pwaStatus = await triggerUpdate();
      if (pwaStatus === "available") available = true;
      if (pwaStatus === "error" && !available) {
        return { status: "error", message: "Unable to check for updates." };
      }
    }
    if (available) return {
      status: "available", update: latest, latest,
      currentVersionCode: current.versionCode, currentVersionName: current.versionName,
      platform: isAndroid ? "android" : "web",
    };
    return {
      status: "current", latest, currentVersionCode: current.versionCode,
      currentVersionName: current.versionName, platform: isAndroid ? "android" : "web",
    };
  } catch (error) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
    if (error instanceof Error && error.message === "OFFLINE") return { status: "offline" };
    return { status: "error", message: "Unable to check for updates." };
  }
}

/** Shares an active request between startup, foreground, and manual checks. */
export function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (!checkRequest) checkRequest = runCheck().finally(() => { checkRequest = null; });
  return checkRequest;
}

export async function installAppUpdate(candidate: ReleaseManifest): Promise<AppUpdateInstallResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
  try {
    const { latest, newer } = await getFreshInstallableRelease(candidate);
    if (!newer && isAndroidNativeUpdaterAvailable()) return { status: "current" };
    if (isAndroidNativeUpdaterAvailable()) {
      const result = await startAndroidUpdate(latest);
      if (result.status !== "started") return result;
      return { status: "started", platform: "android", downloadId: result.downloadId };
    }

    const result = await applyPwaUpdate();
    if (result === "applying") return { status: "applying", platform: "web" };

    // A browser-only PWA may not have a service worker. Reload is safe here;
    // native Android always takes the signed APK installer route above.
    if (result === "unsupported" && !Capacitor.isNativePlatform()) {
      if (typeof window === "undefined") return { status: "unsupported" };
      window.location.reload();
      return { status: "applying", platform: "web" };
    }

    if (result === "offline" || result === "unsupported" || result === "error") return { status: result };
    return { status: "error" };
  } catch (error) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
    return { status: "error" };
  }
}

/** Saves the latest verified Android release into the public Downloads folder. */
export async function downloadAppUpdate(candidate: ReleaseManifest): Promise<AppUpdateDownloadResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
  if (!isAndroidNativeUpdaterAvailable()) return { status: "unsupported" };
  try {
    const { latest, newer } = await getFreshInstallableRelease(candidate);
    if (!newer) return { status: "current" };
    const result = await saveAndroidUpdateToDownloads(latest);
    if (result.status !== "started") return result;
    return { status: "started", platform: "android", downloadId: result.downloadId, update: latest };
  } catch (error) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
    return { status: "error" };
  }
}
