import { Capacitor, registerPlugin } from "@capacitor/core";
import { createAsyncCache } from "@/lib/studyModeAppCatalogCache";
import { getTheme, getMode } from "@/lib/theme";
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
    usageAccess: boolean;
    overlay: boolean;
    exactAlarm: boolean;
    deviceOwner: boolean;
    profileOwner: boolean;
    dndAccess: boolean;
    accessibilityAvailable?: boolean;
    accessibilityEnabled?: boolean;
    accessibilityConsent?: boolean;
  };
  scheduleActive: boolean;
  sessionActive: boolean;
  activeSession: StudyModeSession | null;
  enforcedPackages: string[];
  monitoringServiceRunning: boolean;
  enforcementMode: "device_owner" | "profile_owner" | "focus_shield" | "unavailable";
  enforcementState: string;
  appliedPackages: string[];
  suspendedPackages: string[];
  exactAlarmFallback: boolean;
  studyAppPackages?: string[];
}

interface NativeStudyModePlugin {
  getStatus(): Promise<StudyModeStatus>;
  refresh(): Promise<StudyModeStatus>;
  listApps(): Promise<{ apps: StudyModeApp[] }>;
  saveConfig(options: StudyModeConfig & { studyAppPackageNames: string[] }): Promise<StudyModeStatus>;
  setPopupAppearance(options: { theme: string; mode: "dark" | "light" }): Promise<void>;
  setEnabled(options: { enabled: boolean }): Promise<StudyModeStatus>;
  startSession(options: StudyModeSessionOptions): Promise<StudyModeStatus>;
  endSession(options: { sessionId?: string }): Promise<StudyModeStatus>;
  getSessionHistory(): Promise<{ sessions: StudyModeSession[] }>;
  acceptAccessibilityDisclosure(): Promise<void>;
  openPermissionSettings(options: {
    permission: "usage" | "overlay" | "exactAlarm" | "dnd" | "accessibility";
  }): Promise<void>;
  showTimePicker(options: {
    title: string;
    hour: number;
    minute: number;
  }): Promise<{ confirmed: boolean; hour?: number; minute?: number }>;
}

const NativeStudyMode = registerPlugin<NativeStudyModePlugin>("StudyMode");

// App discovery/icon decoding is expensive on Android. Keep the complete catalogue
// for one minute across screen mounts and de-duplicate simultaneous refreshes.
const installedAppsCache = createAsyncCache<StudyModeApp[]>(async () => {
  const result = await NativeStudyMode.listApps();
  return Array.isArray(result.apps) ? result.apps : [];
}, 60_000);

export const isStudyModeNative = (): boolean => Capacitor.isNativePlatform();

export async function syncStudyModePopupAppearance(): Promise<void> {
  if (!isStudyModeNative()) return;
  try {
    await NativeStudyMode.setPopupAppearance({ theme: getTheme(), mode: getMode() });
  } catch {
    // Keep the native popup's last saved appearance when the bridge is unavailable.
  }
}

let popupAppearanceListenerInstalled = false;

/** Reconcile a saved schedule and mirror appearance preferences to the native overlay. */
export function initializeStudyMode(): void {
  if (!isStudyModeNative()) return;
  void syncStudyModePopupAppearance();
  if (typeof window !== "undefined" && !popupAppearanceListenerInstalled) {
    popupAppearanceListenerInstalled = true;
    window.addEventListener("theme-updated", () => { void syncStudyModePopupAppearance(); });
  }
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
        usageAccess: false, overlay: false,
        exactAlarm: false, deviceOwner: false, profileOwner: false, dndAccess: false,
        accessibilityAvailable: false, accessibilityEnabled: false, accessibilityConsent: false,
      },
      scheduleActive: false,
      sessionActive: false,
      activeSession: null,
      enforcedPackages: [],
      monitoringServiceRunning: false,
      enforcementMode: "unavailable",
      enforcementState: "native_only",
      appliedPackages: [],
      suspendedPackages: [],
      exactAlarmFallback: false,
      studyAppPackages: [],
    };
  }
  return NativeStudyMode.getStatus();
}

export async function refreshStudyMode(): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) return getStudyModeStatus();
  return NativeStudyMode.refresh();
}

export async function getInstalledStudyModeApps(forceRefresh = false): Promise<StudyModeApp[]> {
  if (!isStudyModeNative()) return [];
  return installedAppsCache.get(forceRefresh);
}

/** Explicit invalidation hook for package-catalogue lifecycle changes. */
export function invalidateStudyModeAppCatalogCache(): void {
  installedAppsCache.clear();
}

export async function saveStudyModeConfig(config: StudyModeConfig, studyAppPackageNames: string[] = []): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Study Mode requires the Android app.");
  return NativeStudyMode.saveConfig({
    ...config,
    studyAppPackageNames: [...new Set(studyAppPackageNames)],
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

export async function acceptStudyModeAccessibilityDisclosure(): Promise<void> {
  if (!isStudyModeNative()) throw new Error("Advanced multi-window detection requires the Android app.");
  await NativeStudyMode.acceptAccessibilityDisclosure();
}

export async function openStudyModePermission(
  permission: "usage" | "overlay" | "exactAlarm" | "dnd" | "accessibility",
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
