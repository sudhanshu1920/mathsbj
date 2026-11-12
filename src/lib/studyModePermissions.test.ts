import { describe, expect, it } from "vitest";
import { getStudyModePermissionReadiness } from "./studyModePermissions";
import type { StudyModeStatus } from "./studyMode";

const makeStatus = (overrides: Partial<StudyModeStatus> = {}): StudyModeStatus => ({
  config: {
    enabled: false,
    selectedPackageNames: [],
    startHour: 9,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
    selectedDays: [1, 2, 3, 4, 5],
  },
  permissions: {
    usageAccess: false,
    overlay: false,
    exactAlarm: true,
    deviceOwner: false,
    profileOwner: false,
    dndAccess: false,
    accessibilityAvailable: false,
    accessibilityEnabled: false,
    accessibilityConsent: false,
    accessibilitySnapshotReady: false,
  },
  scheduleActive: false,
  sessionActive: false,
  activeSession: null,
  enforcedPackages: [],
  monitoringServiceRunning: false,
  enforcementMode: "unavailable",
  enforcementState: "disabled",
  appliedPackages: [],
  suspendedPackages: [],
  exactAlarmFallback: false,
  ...overrides,
});

describe("getStudyModePermissionReadiness", () => {
  it("requires Usage Access and overlay on a personal device", () => {
    const readiness = getStudyModePermissionReadiness(makeStatus());
    expect(readiness.coreReady).toBe(false);
    expect(readiness.missing).toEqual([
      "Enable Usage Access",
      "Allow Display over other apps",
    ]);
  });

  it("allows optional Advanced detection only after a fresh complete snapshot", () => {
    const status = makeStatus({
      permissions: {
        usageAccess: true,
        overlay: true,
        exactAlarm: true,
        deviceOwner: false,
        profileOwner: false,
        dndAccess: false,
        accessibilityAvailable: true,
        accessibilityEnabled: true,
        accessibilityConsent: true,
        accessibilitySnapshotReady: false,
      },
    });
    const pending = getStudyModePermissionReadiness(status);
    expect(pending.coreReady).toBe(false);
    expect(pending.missing[0]).toContain("first scan");

    const ready = getStudyModePermissionReadiness({
      ...status,
      permissions: { ...status.permissions, accessibilitySnapshotReady: true },
    });
    expect(ready.coreReady).toBe(true);
    expect(ready.advancedMonitoringRequested).toBe(true);
  });

  it("accepts Usage Access and overlay as the standard personal-device path", () => {
    const status = makeStatus({
      permissions: { ...makeStatus().permissions, usageAccess: true, overlay: true },
      enforcementMode: "focus_shield",
    });
    expect(getStudyModePermissionReadiness(status).coreReady).toBe(true);
  });

  it("does not require Usage Access or overlay for a managed-device policy owner", () => {
    const status = makeStatus({
      permissions: { ...makeStatus().permissions, deviceOwner: true },
      enforcementMode: "device_owner",
    });
    const readiness = getStudyModePermissionReadiness(status);
    expect(readiness.coreReady).toBe(true);
    expect(readiness.monitoringReady).toBe(true);
    expect(readiness.overlayReady).toBe(true);
  });

  it("requires Exact Alarms for managed schedules but keeps the personal-device fallback optional", () => {
    const managed = makeStatus({
      permissions: { ...makeStatus().permissions, deviceOwner: true, exactAlarm: false },
      enforcementMode: "device_owner",
      exactAlarmFallback: true,
    });
    expect(getStudyModePermissionReadiness(managed).coreReady).toBe(false);
    expect(getStudyModePermissionReadiness(managed).missing).toContain(
      "Allow Exact Alarms for managed scheduling",
    );

    const personal = makeStatus({
      permissions: { ...makeStatus().permissions, usageAccess: true, overlay: true, exactAlarm: false },
      enforcementMode: "focus_shield",
      exactAlarmFallback: true,
    });
    expect(getStudyModePermissionReadiness(personal).coreReady).toBe(true);
    expect(getStudyModePermissionReadiness(personal).exactAlarmRequired).toBe(false);
  });
});
