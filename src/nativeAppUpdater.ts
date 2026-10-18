import { Capacitor, registerPlugin } from "@capacitor/core";
import { validateReleaseManifest, type ReleaseManifest } from "@/lib/updateFeed";

export interface AndroidUpdateDownloadEvent {
  downloadId: number;
  state: "downloading" | "paused" | "verifying" | "installer_opened" | "saved_to_downloads" | "failed";
  progress: number;
  /** Byte counts sampled from Android DownloadManager, not estimated from time. */
  downloadedBytes?: number;
  totalBytes?: number;
  /** Bytes per second calculated from successive native byte-count samples. */
  bytesPerSecond?: number;
  elapsedMs?: number;
  fileName?: string;
  message?: string;
}

export interface AndroidUpdateListenerHandle {
  remove(): Promise<void>;
}

type NativeUpdater = {
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(options: {
    url: string; sha256: string; versionCode: number; versionName: string;
  }): Promise<{ downloadId: number }>;
  downloadToDownloads(options: {
    url: string; sha256: string; versionCode: number; versionName: string;
  }): Promise<{ downloadId: number }>;
  addListener(
    eventName: "downloadState",
    listenerFunc: (event: AndroidUpdateDownloadEvent) => void,
  ): Promise<AndroidUpdateListenerHandle>;
};

const AppUpdater = registerPlugin<NativeUpdater>("AppUpdater");

export interface InstalledAppVersion { versionCode: number; versionName: string; }
export type NativeInstallResult =
  | { status: "started"; downloadId: number }
  | { status: "offline" }
  | { status: "unsupported" };

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isAndroidNativeUpdaterAvailable() {
  return isNativeAndroid();
}

export async function addAndroidUpdateDownloadListener(
  listener: (event: AndroidUpdateDownloadEvent) => void,
): Promise<AndroidUpdateListenerHandle | null> {
  if (!isNativeAndroid()) return null;
  return AppUpdater.addListener("downloadState", listener);
}

export async function getInstalledAndroidVersion(): Promise<InstalledAppVersion> {
  if (!isNativeAndroid()) throw new Error("Android updater is not available.");
  const version = await AppUpdater.getVersion();
  if (
    !Number.isSafeInteger(version.versionCode) || version.versionCode <= 0 ||
    typeof version.versionName !== "string" ||
    !/^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version.versionName)
  ) throw new Error("Installed app version is invalid.");
  return { versionCode: version.versionCode, versionName: version.versionName };
}

export async function startAndroidUpdate(candidate: ReleaseManifest): Promise<NativeInstallResult> {
  if (!isNativeAndroid()) return { status: "unsupported" };
  if (!navigator.onLine) return { status: "offline" };
  const update = validateReleaseManifest(candidate);
  const result = await AppUpdater.downloadAndInstall({
    url: update.apkUrl,
    sha256: update.sha256,
    versionCode: update.versionCode,
    versionName: update.versionName,
  });
  if (!Number.isSafeInteger(result.downloadId) || result.downloadId <= 0) {
    throw new Error("The update download could not be started.");
  }
  return { status: "started", downloadId: result.downloadId };
}

export async function saveAndroidUpdateToDownloads(candidate: ReleaseManifest): Promise<NativeInstallResult> {
  if (!isNativeAndroid()) return { status: "unsupported" };
  if (!navigator.onLine) return { status: "offline" };
  const update = validateReleaseManifest(candidate);
  const result = await AppUpdater.downloadToDownloads({
    url: update.apkUrl,
    sha256: update.sha256,
    versionCode: update.versionCode,
    versionName: update.versionName,
  });
  if (!Number.isSafeInteger(result.downloadId) || result.downloadId <= 0) {
    throw new Error("The APK download could not be started.");
  }
  return { status: "started", downloadId: result.downloadId };
}
