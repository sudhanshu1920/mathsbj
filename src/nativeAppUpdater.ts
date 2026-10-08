import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeUpdater = {
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(options: { url: string }): Promise<{ downloadId: number }>;
};

const AppUpdater = registerPlugin<NativeUpdater>("AppUpdater");

const DOWNLOAD_BASE_URL = "https://sudhanshu1920.github.io/mathsbj";
const VERSION_URL = `${DOWNLOAD_BASE_URL}/version.json`;

export type NativeUpdateResult =
  | { status: "updated"; versionCode: number }
  | { status: "current"; versionCode: number }
  | { status: "unsupported" }
  | { status: "offline" }
  | { status: "error"; message: string };

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function checkAndInstallAndroidUpdate(): Promise<NativeUpdateResult> {
  if (!isNativeAndroid()) return { status: "unsupported" };
  if (!navigator.onLine) return { status: "offline" };

  try {
    const current = await AppUpdater.getVersion();

    const response = await fetch(VERSION_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) return { status: "current", versionCode: current.versionCode };
      throw new Error(`Update server returned HTTP ${response.status}`);
    }

    const release = (await response.json()) as {
      versionName?: string;
      versionCode?: number;
      apk?: string;
      sha256?: string;
      sizeBytes?: number;
    };

    const remoteVersionCode = release.versionCode;

    if (
      !Number.isSafeInteger(remoteVersionCode) ||
      remoteVersionCode <= current.versionCode
    ) {
      return { status: "current", versionCode: current.versionCode };
    }

    if (release.apk !== "MathMaster-release.apk") {
      throw new Error("A signed update APK is not available.");
    }

    const url = new URL(`${DOWNLOAD_BASE_URL}/${release.apk}`);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "sudhanshu1920.github.io" ||
      url.pathname !== "/mathsbj/MathMaster-release.apk"
    ) {
      throw new Error("Update APK source is not trusted.");
    }

    await AppUpdater.downloadAndInstall({ url: url.toString() });
    return { status: "updated", versionCode: remoteVersionCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    if (message === "INSTALL_PERMISSION_REQUIRED") {
      return { status: "error", message };
    }
    return { status: "error", message };
  }
}

export function isAndroidNativeUpdaterAvailable() {
  return isNativeAndroid();
}
