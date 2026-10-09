export const UPDATE_MANIFEST_URL = "https://sudhanshu1920.github.io/mathsbj/updates/update.json";
export const EXPECTED_PACKAGE_NAME = "com.sudhanshu.mathsbj";
export const EXPECTED_APK_URL = "https://sudhanshu1920.github.io/mathsbj/updates/MathMaster-release.apk";

export interface ReleaseManifest {
  packageName: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  releaseNotes?: string;
  publishedAt?: string;
}

const VERSION_NAME_PATTERN = /^v?\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/;
const SHA256_PATTERN = /^[a-f\d]{64}$/i;

export function validateReleaseManifest(value: unknown): ReleaseManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Update metadata is invalid.");
  const data = value as Record<string, unknown>;
  if (
    data.packageName !== EXPECTED_PACKAGE_NAME ||
    !Number.isSafeInteger(data.versionCode) || Number(data.versionCode) <= 0 ||
    typeof data.versionName !== "string" || !VERSION_NAME_PATTERN.test(data.versionName) ||
    typeof data.apkUrl !== "string" ||
    typeof data.sha256 !== "string" || !SHA256_PATTERN.test(data.sha256)
  ) throw new Error("Update metadata is invalid.");

  let apkUrl: URL;
  try { apkUrl = new URL(data.apkUrl); }
  catch { throw new Error("Update download URL is invalid."); }
  if (
    apkUrl.protocol !== "https:" ||
    apkUrl.hostname !== "sudhanshu1920.github.io" ||
    apkUrl.pathname !== "/mathsbj/updates/MathMaster-release.apk" ||
    apkUrl.username || apkUrl.password || apkUrl.search || apkUrl.hash
  ) throw new Error("Update download URL is not trusted.");

  if (data.releaseNotes !== undefined && (typeof data.releaseNotes !== "string" || data.releaseNotes.length > 4000)) {
    throw new Error("Update release notes are invalid.");
  }
  if (data.publishedAt !== undefined && typeof data.publishedAt !== "string") {
    throw new Error("Update publication date is invalid.");
  }
  return {
    packageName: EXPECTED_PACKAGE_NAME,
    versionCode: Number(data.versionCode),
    versionName: data.versionName,
    apkUrl: apkUrl.toString(),
    sha256: data.sha256.toLowerCase(),
    ...(typeof data.releaseNotes === "string" ? { releaseNotes: data.releaseNotes } : {}),
    ...(typeof data.publishedAt === "string" ? { publishedAt: data.publishedAt } : {}),
  };
}

let manifestRequest: Promise<ReleaseManifest> | null = null;

async function requestLatestRelease(): Promise<ReleaseManifest> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("OFFLINE");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, {
      method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 404 ? "UPDATE_METADATA_NOT_FOUND" : "UPDATE_CHECK_FAILED");
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new Error("Update metadata is invalid."); }
    return validateReleaseManifest(payload);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("UPDATE_TIMEOUT");
    throw error;
  } finally { clearTimeout(timeoutId); }
}

export function fetchLatestRelease(): Promise<ReleaseManifest> {
  if (!manifestRequest) manifestRequest = requestLatestRelease().finally(() => { manifestRequest = null; });
  return manifestRequest;
}
