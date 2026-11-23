import type { StudyModeStatus } from "@/lib/studyMode";

export interface StudyModePermissionReadiness {
  monitoringReady: boolean;
  overlayReady: boolean;
  exactAlarmRequired: boolean;
  coreReady: boolean;
  missing: string[];
}

/**
 * Keep the onboarding gate aligned with StudyModeManager.getStatus().
 * Managed-device policy suspension does not rely on Usage Access or overlays.
 * Personal-device Focus Shield uses Usage Access as its foreground source.
 */
export function getStudyModePermissionReadiness(
  status: StudyModeStatus,
): StudyModePermissionReadiness {
  const permissions = status.permissions;
  const managedEnforcement = permissions.deviceOwner || permissions.profileOwner;
  const monitoringReady = managedEnforcement || permissions.usageAccess === true;
  const overlayReady = managedEnforcement || permissions.overlay === true;
  const exactAlarmRequired = status.enforcementState === "exact_alarm_required"
    || (managedEnforcement && status.exactAlarmFallback && permissions.exactAlarm !== true)
;
  const missing: string[] = [];

  if (!monitoringReady) {
    missing.push("Enable Usage Access");
  }
  if (!overlayReady) missing.push("Allow Display over other apps");
  if (exactAlarmRequired) missing.push("Allow Exact Alarms for background recovery and managed scheduling");

  return {
    monitoringReady,
    overlayReady,
    exactAlarmRequired,
    coreReady: monitoringReady && overlayReady && !exactAlarmRequired,
    missing,
  };
}
