import { Capacitor, registerPlugin } from "@capacitor/core";

export type UsageRange = "today" | "7d" | "30d" | "custom";
export type UsageChartType = "column" | "pie" | "line" | "bar" | "area" | "column-line";
export type UsageAppFilter = "all" | "top" | string;

export interface UsageDailyPoint {
  date: string;
  usageMillis: number;
}

export interface UsageApp {
  packageName: string;
  label: string;
  usageMillis: number;
  lastUsedTimestamp: number;
  percent: number;
  iconDataUrl: string;
  dailyUsage: UsageDailyPoint[];
}

export interface UsageAnalyticsSnapshot {
  fromDate: string;
  toDate: string;
  totalUsageMillis: number;
  mostUsedPackage: string;
  mostUsedMillis: number;
  apps: UsageApp[];
  dailyUsage: UsageDailyPoint[];
  retentionDays: number;
  lastUpdatedAt: number;
  historyStartDate: string;
  permissionGranted: boolean;
  dataAvailable: boolean;
  status: "ok" | "permission_required" | "system_data_unavailable" | "native_unavailable";
  storage: "encrypted-local-only" | "unavailable";
}

export interface UsageRangeWindow {
  fromDate: string;
  toDate: string;
  startTimeMs: number;
  endTimeMs: number;
}

interface NativeAppUsagePlugin {
  getUsage(options: { startTimeMs: number; endTimeMs: number }): Promise<UsageAnalyticsSnapshot>;
  openUsageAccessSettings(): Promise<void>;
  clearHistory(): Promise<{ cleared: boolean }>;
  setRetention(options: { days: 30 | 90 | 180 }): Promise<{ retentionDays: number }>;
}

const NativeAppUsage = registerPlugin<NativeAppUsagePlugin>("AppUsageAnalytics");
const pad = (value: number) => String(value).padStart(2, "0");

export function localDateKey(date: Date): string {
  return String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function atLocalMidnight(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getUsageRangeWindow(
  range: UsageRange,
  customStart?: string,
  customEnd?: string,
  now = new Date(),
): UsageRangeWindow {
  const today = atLocalMidnight(now);
  let start = new Date(today);
  let end = new Date(today);
  end.setDate(end.getDate() + 1);

  if (range === "7d") start.setDate(start.getDate() - 6);
  else if (range === "30d") start.setDate(start.getDate() - 29);
  else if (range === "custom") {
    if (!customStart || !customEnd) throw new Error("Choose both dates for the custom range.");
    const parsedStart = new Date(customStart + "T00:00:00");
    const parsedEnd = new Date(customEnd + "T00:00:00");
    if (!Number.isFinite(parsedStart.getTime()) || !Number.isFinite(parsedEnd.getTime())
      || localDateKey(parsedStart) !== customStart || localDateKey(parsedEnd) !== customEnd
      || parsedStart > parsedEnd) {
      throw new Error("Choose a valid custom date range.");
    }
    const startUtc = Date.UTC(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate());
    const endUtc = Date.UTC(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate());
    const numberOfDays = Math.round((endUtc - startUtc) / 86_400_000) + 1;
    if (numberOfDays > 180) throw new Error("Custom ranges can be up to 180 days.");
    start = atLocalMidnight(parsedStart);
    end = atLocalMidnight(parsedEnd);
    end.setDate(end.getDate() + 1);
  }

  const inclusiveEnd = new Date(end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  return {
    fromDate: localDateKey(start),
    toDate: localDateKey(inclusiveEnd),
    startTimeMs: start.getTime(),
    endTimeMs: end.getTime(),
  };
}

const emptySnapshot = (): UsageAnalyticsSnapshot => ({
  fromDate: "",
  toDate: "",
  totalUsageMillis: 0,
  mostUsedPackage: "",
  mostUsedMillis: 0,
  apps: [],
  dailyUsage: [],
  retentionDays: 90,
  lastUpdatedAt: 0,
  historyStartDate: "",
  permissionGranted: false,
  dataAvailable: false,
  status: "native_unavailable",
  storage: "unavailable",
});

export async function getAppUsageAnalytics(window: UsageRangeWindow): Promise<UsageAnalyticsSnapshot> {
  if (!Capacitor.isNativePlatform()) return emptySnapshot();
  return NativeAppUsage.getUsage({ startTimeMs: window.startTimeMs, endTimeMs: window.endTimeMs });
}

export async function openAppUsageAccessSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error("Usage analytics is available in the Android app.");
  await NativeAppUsage.openUsageAccessSettings();
}

export async function clearLocalAppUsageHistory(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const result = await NativeAppUsage.clearHistory();
  if (!result.cleared) throw new Error("Android did not confirm that local history was cleared.");
}

export async function setAppUsageRetention(days: 30 | 90 | 180): Promise<number> {
  if (!Capacitor.isNativePlatform()) return days;
  const result = await NativeAppUsage.setRetention({ days });
  return result.retentionDays;
}

export function formatUsageDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor((Number.isFinite(milliseconds) ? milliseconds : 0) / 60_000));
  if (minutes < 1) return "0m";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return remainder + "m";
  return remainder ? hours + "h " + remainder + "m" : hours + "h";
}

export function formatUsageDate(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00");
  if (!Number.isFinite(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}
