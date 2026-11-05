import { describe, expect, it } from "vitest";
import { countStudyModeApps, filterStudyModeApps } from "./studyModeAppFilters";
import type { StudyModeApp } from "./studyMode";

const apps: StudyModeApp[] = [
  { packageName: "com.example.browser", label: "Browser", iconDataUrl: "", systemApp: false, selectable: true },
  { packageName: "com.android.camera", label: "Camera", iconDataUrl: "", systemApp: true, selectable: true },
  { packageName: "com.example.notes", label: "Notes", iconDataUrl: "", systemApp: false, selectable: true },
  { packageName: "com.oem.launcher", label: "OEM Launcher", iconDataUrl: "", systemApp: true, selectable: true },
  { packageName: "com.android.settings", label: "Settings", iconDataUrl: "", systemApp: true, selectable: false },
];

describe("Study Mode installed-app filters", () => {
  it("shows user and pre-installed system apps together in All", () => {
    expect(filterStudyModeApps(apps, "all", "")).toHaveLength(5);
  });

  it("separates user and system apps without changing the source dataset", () => {
    expect(filterStudyModeApps(apps, "user", "").map((app) => app.packageName))
      .toEqual(["com.example.browser", "com.example.notes"]);
    expect(filterStudyModeApps(apps, "system", "").map((app) => app.packageName))
      .toEqual(["com.android.camera", "com.oem.launcher", "com.android.settings"]);
    expect(apps).toHaveLength(5);
    expect(filterStudyModeApps(apps, "system", "settings")[0].selectable).toBe(false);
  });

  it("searches app names and package names inside each category", () => {
    expect(filterStudyModeApps(apps, "all", "camera").map((app) => app.packageName))
      .toEqual(["com.android.camera"]);
    expect(filterStudyModeApps(apps, "system", "oem").map((app) => app.packageName))
      .toEqual(["com.oem.launcher"]);
    expect(filterStudyModeApps(apps, "user", "com.example.notes")).toHaveLength(1);
  });

  it("counts all categories from the same discovered dataset", () => {
    expect(countStudyModeApps(apps)).toEqual({ all: 5, user: 2, system: 3 });
  });
});
