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
    batteryOptimizationIgnored?: boolean;
    notificationsEnabled?: boolean;
    xiaomiDevice?: boolean;
    accessibilityAvailable?: boolean;
    accessibilityEnabled?: boolean;
    accessibilityConsent?: boolean;
    accessibilitySnapshotReady?: boolean;
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
  proEnabled?: boolean;
  reminderIntervalMinutes?: number;
  screenTimeIslandEnabled?: boolean;
  screenTimeIslandIntervalMinutes?: number;
}

interface NativeStudyModePlugin {
  getStatus(): Promise<StudyModeStatus>;
  refresh(): Promise<StudyModeStatus>;
  listApps(): Promise<{ apps: StudyModeApp[]; catalogRevision?: number }>;
  getAppCatalogRevision(): Promise<{ revision: number }>;
  saveConfig(options: StudyModeConfig & { studyAppPackageNames: string[] }): Promise<StudyModeStatus>;
  setPopupAppearance(options: { theme: string; mode: "dark" | "light" }): Promise<void>;
  setReminderIntervalMinutes(options: { minutes: number }): Promise<StudyModeStatus>;
  setScreenTimeIsland(options: { enabled: boolean; minutes: number }): Promise<StudyModeStatus>;
  previewScreenTimeIsland(): Promise<void>;
  consumeOpenStudyAppsPickerRequest(): Promise<{ open: boolean }>;
  setEnabled(options: { enabled: boolean }): Promise<StudyModeStatus>;
  setProEnabled(options: { enabled: boolean }): Promise<StudyModeStatus>;
  startSession(options: StudyModeSessionOptions): Promise<StudyModeStatus>;
  endSession(options: { sessionId?: string }): Promise<StudyModeStatus>;
  getSessionHistory(): Promise<{ sessions: StudyModeSession[] }>;
  acceptAccessibilityDisclosure(): Promise<void>;
  requestNotificationPermission(): Promise<{ enabled: boolean }>;
  openPermissionSettings(options: {
    permission: "usage" | "overlay" | "exactAlarm" | "dnd" | "accessibility" | "battery" | "notifications" | "oemBackground";
  }): Promise<void>;
  showTimePicker(options: {
    title: string;
    hour: number;
    minute: number;
  }): Promise<{ confirmed: boolean; hour?: number; minute?: number }>;
}

const NativeStudyMode = registerPlugin<NativeStudyModePlugin>("StudyMode");

// App discovery/icon decoding is expensive on Android. Keep the complete catalogue
// for five minutes across screen mounts and de-duplicate simultaneous refreshes.
let installedAppsCacheRevision: number | null = null;

const installedAppsCache = createAsyncCache<StudyModeApp[]>(async () => {
  const result = await NativeStudyMode.listApps();
  installedAppsCacheRevision = Number.isSafeInteger(result.catalogRevision)
    ? result.catalogRevision ?? null
    : null;
  return Array.isArray(result.apps) ? result.apps : [];
}, 5 * 60_000);

export interface CachedStudyModeSettings {
  config: StudyModeConfig;
  studyAppPackages: string[];
  screenTimeIslandEnabled: boolean;
  screenTimeIslandIntervalMinutes: number;
}

let cachedStudyModeSettings: CachedStudyModeSettings | null = null;

function rememberStudyModeSettings(status: StudyModeStatus): StudyModeStatus {
  cachedStudyModeSettings = {
    config: {
      ...status.config,
      selectedPackageNames: [...status.config.selectedPackageNames],
      selectedDays: [...status.config.selectedDays],
    },
    studyAppPackages: [...(status.studyAppPackages ?? [])],
    screenTimeIslandEnabled: status.screenTimeIslandEnabled !== false,
    screenTimeIslandIntervalMinutes: Number.isInteger(status.screenTimeIslandIntervalMinutes)
      && (status.screenTimeIslandIntervalMinutes ?? 0) >= 1
      && (status.screenTimeIslandIntervalMinutes ?? 0) <= 10
      ? status.screenTimeIslandIntervalMinutes ?? 5
      : 5,
  };
  return status;
}

/** Saved selections may seed the UI; permissions and enforcement always come from a live native read. */
export function getCachedStudyModeSettings(): CachedStudyModeSettings | null {
  if (!cachedStudyModeSettings) return null;
  return {
    config: {
      ...cachedStudyModeSettings.config,
      selectedPackageNames: [...cachedStudyModeSettings.config.selectedPackageNames],
      selectedDays: [...cachedStudyModeSettings.config.selectedDays],
    },
    studyAppPackages: [...cachedStudyModeSettings.studyAppPackages],
    screenTimeIslandEnabled: cachedStudyModeSettings.screenTimeIslandEnabled,
    screenTimeIslandIntervalMinutes: cachedStudyModeSettings.screenTimeIslandIntervalMinutes,
  };
}

/** Read a still-valid app catalogue without awaiting the native bridge. */
export function getCachedInstalledStudyModeApps(): StudyModeApp[] | null {
  return installedAppsCache.peek() ?? null;
}

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
  void NativeStudyMode.refresh().then(rememberStudyModeSettings).catch(() => {
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
        accessibilityAvailable: false, accessibilityEnabled: false,
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
      proEnabled: false,
      reminderIntervalMinutes: 2,
      screenTimeIslandEnabled: true,
      screenTimeIslandIntervalMinutes: 5,
    };
  }
  return rememberStudyModeSettings(await NativeStudyMode.getStatus());
}

export async function consumeStudyAppsPickerRequest(): Promise<boolean> {
  if (!isStudyModeNative()) return false;
  try {
    const result = await NativeStudyMode.consumeOpenStudyAppsPickerRequest();
    return result.open === true;
  } catch {
    return false;
  }
}

export async function refreshStudyMode(): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) return getStudyModeStatus();
  return rememberStudyModeSettings(await NativeStudyMode.refresh());
}

export async function getInstalledStudyModeApps(forceRefresh = false): Promise<StudyModeApp[]> {
  if (!isStudyModeNative()) return [];
  if (forceRefresh) {
    const cached = installedAppsCache.peek();
    try {
      const { revision } = await NativeStudyMode.getAppCatalogRevision();
      if (cached && Number.isSafeInteger(revision) && revision === installedAppsCacheRevision) {
        return cached;
      }
      if (revision !== installedAppsCacheRevision) installedAppsCache.clear();
    } catch {
      // Older native builds may not expose revisions; fall back to a real refresh.
      return installedAppsCache.get(true);
    }
  }
  return installedAppsCache.get();
}

/** Explicit invalidation hook for package-catalogue lifecycle changes. */
export function invalidateStudyModeAppCatalogCache(): void {
  installedAppsCacheRevision = null;
  installedAppsCache.clear();
}

export async function saveStudyModeConfig(config: StudyModeConfig, studyAppPackageNames: string[] = []): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Study Mode requires the Android app.");
  return rememberStudyModeSettings(await NativeStudyMode.saveConfig({
    ...config,
    studyAppPackageNames: [...new Set(studyAppPackageNames)],
    selectedPackageNames: [...new Set(config.selectedPackageNames)],
    selectedDays: [...new Set(config.selectedDays)],
  }));
}

export async function setStudyModeReminderInterval(minutes: number): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Reminder intervals require the Android app.");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10) {
    throw new Error("Reminder interval must be an integer from 1 to 10 minutes.");
  }
  return rememberStudyModeSettings(await NativeStudyMode.setReminderIntervalMinutes({ minutes }));
}

export async function setStudyModeScreenTimeIsland(enabled: boolean, minutes: number): Promise<StudyModeStatus> {
  if (typeof enabled !== "boolean") throw new Error("Screen Time Island enabled state must be a boolean.");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10) {
    throw new Error("Screen Time Island interval must be an integer from 1 to 10 minutes.");
  }
  if (!isStudyModeNative()) throw new Error("Screen Time Island requires the Android app.");
  return rememberStudyModeSettings(await NativeStudyMode.setScreenTimeIsland({ enabled, minutes }));
}

export async function previewStudyModeScreenTimeIsland(): Promise<void> {
  if (!isStudyModeNative()) throw new Error("Screen Time Island preview requires the Android app.");
  await NativeStudyMode.previewScreenTimeIsland();
}
export async function setStudyModeEnabled(enabled: boolean): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Study Mode requires the Android app.");
  return rememberStudyModeSettings(await NativeStudyMode.setEnabled({ enabled }));
}

export async function setStudyModeProEnabled(enabled: boolean): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("PRO strict Study Mode requires the Android app.");
  return rememberStudyModeSettings(await NativeStudyMode.setProEnabled({ enabled }));
}

export async function startStudyModeSession(options: StudyModeSessionOptions): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Focus sessions require the Android app.");
  return rememberStudyModeSettings(await NativeStudyMode.startSession(options));
}

export async function endStudyModeSession(sessionId?: string): Promise<StudyModeStatus> {
  if (!isStudyModeNative()) throw new Error("Focus sessions require the Android app.");
  return rememberStudyModeSettings(await NativeStudyMode.endSession({ sessionId }));
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

export async function requestStudyModeNotificationPermission(): Promise<boolean> {
  if (!isStudyModeNative()) return false;
  const result = await NativeStudyMode.requestNotificationPermission();
  return result.enabled === true;
}

export async function openStudyModePermission(
  permission: "usage" | "overlay" | "exactAlarm" | "dnd" | "accessibility" | "battery" | "notifications" | "oemBackground",
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
