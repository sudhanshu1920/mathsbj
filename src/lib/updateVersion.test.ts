import { describe, expect, it } from "vitest";
import { compareVersions, isNewerRelease } from "./updateVersion";

describe("compareVersions", () => {
  it("compares numeric segments", () => {
    expect(compareVersions("1.0.9", "1.0.10")).toBeLessThan(0);
    expect(compareVersions("1.1.0", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
  it("orders prereleases before stable releases", () => {
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBeLessThan(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
  });
  it("uses Android versionCode as installability authority", () => {
    expect(isNewerRelease({ versionCode: 1010, versionName: "1.0" }, { versionCode: 1009, versionName: "1.0" })).toBe(true);
    expect(isNewerRelease({ versionCode: 1009, versionName: "9.0.0" }, { versionCode: 1010, versionName: "1.0.0" })).toBe(false);
  });
  it("does not treat a higher versionName as an update when versionCode is equal", () => {
    expect(isNewerRelease(
      { versionCode: 1010, versionName: "9.0.0" },
      { versionCode: 1010, versionName: "1.0.0" },
    )).toBe(false);
  });

  it("falls back to semantic comparison only when a build code is unavailable", () => {
    expect(isNewerRelease({ versionName: "1.0.10" }, { versionName: "1.0.9" })).toBe(true);
    expect(isNewerRelease({ versionName: "1.0.0-beta.2" }, { versionName: "1.0.0" })).toBe(false);
  });

  it("rejects malformed versions", () => {
    expect(() => compareVersions("latest", "1.0.0")).toThrow("Invalid version string");
  });
});
