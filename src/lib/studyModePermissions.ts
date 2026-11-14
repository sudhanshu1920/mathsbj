import type { StudyModeStatus } from "@/lib/studyMode";

export interface StudyModePermissionReadiness {
  advancedMonitoringRequested: boolean;
  monitoringReady: boolean;
  overlayReady: boolean;
  exactAlarmRequired: boolean;
  coreReady: boolean;
  missing: string[];
}

/**
 * Keep the onboarding gate aligned with StudyModeManager.getStatus().
 * Managed-device policy suspension does not rely on Usage Access or overlays.
 * On personal devices, opting into Advanced window detection requires its
 * first complete snapshot; a stale/incomplete scan is never treated as ready.
 */
export function getStudyModePermissionReadiness(
  status: StudyModeStatus,
): StudyModePermissionReadiness {
  const permissions = status.permissions;
  const managedEnforcement = permissions.deviceOwner || permissions.profileOwner;
  const advancedMonitoringRequested = permissions.accessibilityEnabled === true
    && permissions.accessibilityConsent === true;
  const monitoringReady = managedEnforcement || (advancedMonitoringRequested
    ? permissions.accessibilitySnapshotReady === true
    : permissions.usageAccess === true);
  const overlayReady = managedEnforcement || permissions.overlay === true;
  const exactAlarmRequired = status.enforcementState === "exact_alarm_required"
    || (managedEnforcement && status.exactAlarmFallback && permissions.exactAlarm !== true)
    || (advancedMonitoringRequested && status.exactAlarmFallback && permissions.exactAlarm !== true);
  const missing: string[] = [];

  if (!monitoringReady) {
    missing.push(advancedMonitoringRequested
      ? "Wait for Advanced window detection to complete its first scan"
      : "Enable Usage Access");
  }
  if (!overlayReady) missing.push("Allow Display over other apps");
  if (exactAlarmRequired) missing.push("Allow Exact Alarms for managed scheduling");

  return {
    advancedMonitoringRequested,
    monitoringReady,
    overlayReady,
    exactAlarmRequired,
    coreReady: monitoringReady && overlayReady && !exactAlarmRequired,
    missing,
  };
}
