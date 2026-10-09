import { isAndroidNativeUpdaterAvailable, getInstalledAndroidVersion, startAndroidUpdate } from "@/nativeAppUpdater";
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
  | { status: "offline" | "unsupported" | "error" };

let checkRequest: Promise<AppUpdateCheckResult> | null = null;

async function runCheck(): Promise<AppUpdateCheckResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
  try {
    const isAndroid = isAndroidNativeUpdaterAvailable();
    const current = isAndroid
      ? await getInstalledAndroidVersion()
      : { versionCode: APP_VERSION_CODE, versionName: APP_VERSION_NAME };
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
  const update = validateReleaseManifest(candidate);
  if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "offline" };
  if (isAndroidNativeUpdaterAvailable()) {
    const result = await startAndroidUpdate(update);
    if (result.status !== "started") return result;
    return { status: "started", platform: "android", downloadId: result.downloadId };
  }
  const result = await applyPwaUpdate();
  if (result === "applying") return { status: "applying", platform: "web" };
  if (result === "offline" || result === "unsupported" || result === "error") return { status: result };
  return { status: "error" };
}
