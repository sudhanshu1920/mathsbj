import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  DEFAULT_STUDY_MODE_CONFIG,
  type StudyModeConfig,
} from "@/lib/studyModeSchedule";

export interface StudyModeApp {
  packageName: string;
  label: string;
  iconDataUrl: string;
  systemApp: boolean;
  selectable: boolean;
}

export interface StudyModeSession {
  id: string;
  sessionType: "study" | "practice" | "work" | "custom";
  startTimestamp: number;
  durationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  selectedPackageNames: string[];
  isEnforced: boolean;
  shouldEnableDnd: boolean;
  dndApplied: boolean;
  status: string;
  active: boolean;
  endTimestamp: number;
}

export interface StudyModeSessionOptions {
  sessionType: StudyModeSession["sessionType"];
  durationSeconds: number;
  enforced: boolean;
  shouldEnableDnd: boolean;
}

export interface StudyModeStatus {
  config: StudyModeConfig;
  permissions: {
    accessibility: boolean;
    accessibilityConnected: boolean;
    usageAccess: boolean;
    overlay: boolean;
    exactAlarm: boolean;
    notifications: boolean;
    batteryOptimizationExempt: boolean;
    dndAccess: boolean;
  };
  scheduleActive: boolean;
  sessionActive: boolean;
  activeSession: StudyModeSession | null;
  enforcedPackages: string[];
  monitoringServiceRunning: boolean;
  enforcementMode: "focus_shield" | "unavailable";
  enforcementState: string;
  exactAlarmFallback: boolean;
}

interface NativeStudyModePlugin {
  getStatus(): Promise<StudyModeStatus>;
  refresh(): Promise<StudyModeStatus>;
  listApps(): Promise<{ apps: StudyModeApp[] }>;
  saveConfig(options: StudyModeConfig): Promise<StudyModeStatus>;
  setEnabled(options: { enabled: boolean }): Promise<StudyModeStatus>;
  startSession(options: StudyModeSessionOptions): Promise<StudyModeStatus>;
  endSession(options: { sessionId?: string }): Promise<StudyModeStatus>;
  getSessionHistory(): Promise<{ sessions: StudyModeSession[] }>;
  openPermissionSettings(options: {
    permission: "accessibility" | "usage" | "overlay" | "exactAlarm" | "notifications" | "battery" | "dnd";
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
        accessibility: false, accessibilityConnected: false, usageAccess: false, overlay: false,
        exactAlarm: false, notifications: false, batteryOptimizationExempt: false, dndAccess: false,
      },
      scheduleActive: false,
      sessionActive: false,
      activeSession: null,
      enforcedPackages: [],
      monitoringServiceRunning: false,
      enforcementMode: "unavailable",
      enforcementState: "native_only",
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

export async function startStudyModeSession(options: StudyModeSessionOptions): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Focus sessions require the Android app.");
  return NativeStudyMode.startSession(options);
}

export async function endStudyModeSession(sessionId?: string): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Focus sessions require the Android app.");
  return NativeStudyMode.endSession({ sessionId });
}

export async function getStudyModeSessionHistory(): Promise<StudyModeSession[]> {
  if (!isStudyModeNative()) return [];
  const result = await NativeStudyMode.getSessionHistory();
  return Array.isArray(result.sessions) ? result.sessions : [];
}

export async function openStudyModePermission(
  permission: "accessibility" | "usage" | "overlay" | "exactAlarm" | "notifications" | "battery" | "dnd",
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
