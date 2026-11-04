import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  DEFAULT_STUDY_MODE_CONFIG,
  type StudyModeConfig,
} from "@/lib/studyModeSchedule";

export interface StudyModeApp {
  packageName: string;
  label: string;
  iconDataUrl: string;
}

export interface StudyModeStatus {
  config: StudyModeConfig;
  permissions: {
    usageAccess: boolean;
    overlay: boolean;
    notificationAccess: boolean;
    notificationListenerConnected: boolean;
    exactAlarm: boolean;
    deviceOwner: boolean;
    profileOwner: boolean;
  };
  scheduleActive: boolean;
  monitoringServiceRunning: boolean;
  enforcementMode: "device_owner" | "focus_shield" | "unavailable";
  enforcementState: string;
  appliedPackages: string[];
  exactAlarmFallback: boolean;
}

interface NativeStudyModePlugin {
  getStatus(): Promise<StudyModeStatus>;
  refresh(): Promise<StudyModeStatus>;
  listApps(): Promise<{ apps: StudyModeApp[] }>;
  saveConfig(options: StudyModeConfig): Promise<StudyModeStatus>;
  setEnabled(options: { enabled: boolean }): Promise<StudyModeStatus>;
  openPermissionSettings(options: {
    permission: "usage" | "overlay" | "notifications" | "exactAlarm";
  }): Promise<void>;
  showTimePicker(options: {
    title: string;
    hour: number;
    minute: number;
  }): Promise<{ confirmed: boolean; hour?: number; minute?: number }>;
}

const NativeStudyMode = registerPlugin<NativeStudyModePlugin>("StudyMode");

export const isStudyModeNative = (): boolean => Capacitor.isNativePlatform();

/** Reconcile a saved schedule on every native app process start. */
export function initializeStudyMode(): void {
  if (!isStudyModeNative()) return;
  void NativeStudyMode.refresh().catch(() => {
    // The feature remains opt-in; permission or service failures are surfaced
    // on the Study Mode page from the next native status read.
  });
}

export async function getStudyModeStatus(): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) {
    return {
      config: DEFAULT_STUDY_MODE_CONFIG,
      permissions: {
        usageAccess: false, overlay: false, notificationAccess: false,
        notificationListenerConnected: false, exactAlarm: false, deviceOwner: false, profileOwner: false,
      },
      scheduleActive: false,
      monitoringServiceRunning: false,
      enforcementMode: "unavailable",
      enforcementState: "native_only",
      appliedPackages: [],
      exactAlarmFallback: false,
    };
  }
  return NativeStudyMode.getStatus();
}

export async function refreshStudyMode(): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) return getStudyModeStatus();
  return NativeStudyMode.refresh();
}

export async function getInstalledStudyModeApps(): Promise<StudyModeApp[]> {
  if (!isStudyModeNative()) return [];
  const result = await NativeStudyMode.listApps();
  return Array.isArray(result.apps) ? result.apps : [];
}

export async function saveStudyModeConfig(config: StudyModeConfig): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Study Mode requires the Android app.");
  return NativeStudyMode.saveConfig({
    ...config,
    selectedPackageNames: [...new Set(config.selectedPackageNames)],
    selectedDays: [...new Set(config.selectedDays)],
  });
}

export async function setStudyModeEnabled(enabled: boolean): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Study Mode requires the Android app.");
  return NativeStudyMode.setEnabled({ enabled });
}

export async function openStudyModePermission(
  permission: "usage" | "overlay" | "notifications" | "exactAlarm",
): Promise<void> {
  if (!isStudyModeNative()) return;
  await NativeStudyMode.openPermissionSettings({ permission });
}

export async function chooseStudyModeTime(
  title: string,
  hour: number,
  minute: number,
): Promise<{ confirmed: boolean; hour?: number; minute?: number }> {
  if (!isStudyModeNative()) return { confirmed: false };
  return NativeStudyMode.showTimePicker({ title, hour, minute });
}
