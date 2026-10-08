import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeUpdater = {
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(options: { url: string }): Promise<{ downloadId: number }>;
};

const AppUpdater = registerPlugin<NativeUpdater>("AppUpdater");

const RELEASE_API =
  "https://api.github.com/repos/sudhanshu1920/mathsbj/releases/tags/latest";

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

    const response = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) return { status: "current", versionCode: current.versionCode };
      throw new Error(`Update server returned HTTP ${response.status}`);
    }

    const release = (await response.json()) as {
      body?: string | null;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };

    const versionMatch = release.body?.match(/versionCode:\s*(\d+)/i);
    const remoteVersionCode = versionMatch ? Number(versionMatch[1]) : NaN;

    if (!Number.isSafeInteger(remoteVersionCode) || remoteVersionCode <= current.versionCode) {
      return { status: "current", versionCode: current.versionCode };
    }

    const asset = release.assets?.find(
      (item) =>
        item.name === "MathMaster-release.apk" &&
        typeof item.browser_download_url === "string",
    );

    if (!asset?.browser_download_url) {
      throw new Error("A signed update APK is not available.");
    }

    const url = new URL(asset.browser_download_url);
    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      throw new Error("Update APK source is not trusted.");
    }

    await AppUpdater.downloadAndInstall({ url: asset.browser_download_url });
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
