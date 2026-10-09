import { describe, expect, it } from "vitest";
import { EXPECTED_APK_URL, EXPECTED_PACKAGE_NAME, validateReleaseManifest } from "./updateFeed";

const validManifest = {
  packageName: EXPECTED_PACKAGE_NAME,
  versionCode: 1010,
  versionName: "1.0",
  apkUrl: EXPECTED_APK_URL,
  sha256: "a".repeat(64),
};

describe("validateReleaseManifest", () => {
  it("accepts release metadata with a numeric version and trusted HTTPS artifact", () => {
    expect(validateReleaseManifest(validManifest).versionCode).toBe(1010);
  });
  it("rejects malformed version data and incorrect package IDs", () => {
    expect(() => validateReleaseManifest({ ...validManifest, versionCode: "1010" })).toThrow();
    expect(() => validateReleaseManifest({ ...validManifest, packageName: "other.package" })).toThrow();
    expect(() => validateReleaseManifest({ ...validManifest, versionName: "latest" })).toThrow();
  });
  it("rejects untrusted or malformed artifact URLs and checksums", () => {
    expect(() => validateReleaseManifest({ ...validManifest, apkUrl: "http://sudhanshu1920.github.io/mathsbj/updates/MathMaster-release.apk" })).toThrow();
    expect(() => validateReleaseManifest({ ...validManifest, apkUrl: "https://evil.example/MathMaster-release.apk" })).toThrow();
    expect(() => validateReleaseManifest({ ...validManifest, sha256: "not-a-checksum" })).toThrow();
  });
  it("rejects null, arrays, and non-object release responses", () => {
    expect(() => validateReleaseManifest(null)).toThrow();
    expect(() => validateReleaseManifest([])).toThrow();
    expect(() => validateReleaseManifest("version 1.0")).toThrow();
  });
});
