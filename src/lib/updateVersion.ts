interface ParsedVersion { core: number[]; prerelease: Array<number | string> | null; }

function parseVersion(version: string): ParsedVersion {
  const match = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim());
  if (!match) throw new Error("Invalid version string.");
  const core = match[1].split(".").map(Number);
  if (core.some((part) => !Number.isSafeInteger(part) || part < 0)) throw new Error("Invalid version string.");
  const prerelease = match[2] ? match[2].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : null;
  if (prerelease?.some((part) => typeof part === "number" && !Number.isSafeInteger(part))) throw new Error("Invalid version string.");
  return { core, prerelease };
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0, count = Math.max(a.core.length, b.core.length); i < count; i++) {
    const av = a.core[i] ?? 0, bv = b.core[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  for (let i = 0, count = Math.max(a.prerelease.length, b.prerelease.length); i < count; i++) {
    const av = a.prerelease[i], bv = b.prerelease[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av === bv) continue;
    if (typeof av === "number" && typeof bv === "number") return av > bv ? 1 : -1;
    if (typeof av === "number") return -1;
    if (typeof bv === "number") return 1;
    return av > bv ? 1 : -1;
  }
  return 0;
}

export interface VersionIdentity { versionCode?: number; versionName: string; }

export function isNewerRelease(latest: VersionIdentity, current: VersionIdentity): boolean {
  // Android versionCode is authoritative whenever both builds expose one.
  // Do not let mismatched versionName text override an equal/lower build code.
  const latestCodeValid = Number.isSafeInteger(latest.versionCode) && (latest.versionCode ?? 0) > 0;
  const currentCodeValid = Number.isSafeInteger(current.versionCode) && (current.versionCode ?? 0) > 0;
  if (latestCodeValid && currentCodeValid) return latest.versionCode! > current.versionCode!;

  // Semantic comparison is a compatibility fallback only for environments
  // where one side genuinely has no usable numeric build code.
  try { return compareVersions(latest.versionName, current.versionName) > 0; }
  catch { return false; }
}
