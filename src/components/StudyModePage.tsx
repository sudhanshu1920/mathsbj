import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import {
  ArrowLeft, BatteryCharging, Bell, BookOpen, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, LockKeyhole, Search,
  ShieldAlert, ShieldCheck, Smartphone,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  chooseStudyModeTime,
  getInstalledStudyModeApps,
  getCachedInstalledStudyModeApps,
  getCachedStudyModeSettings,
  getStudyModeStatus,
  isStudyModeNative,
  openStudyModePermission,
  requestStudyModeNotificationPermission,
  refreshStudyMode,
  saveStudyModeConfig,
  setStudyModeReminderInterval,
  setStudyModeScreenTimeIsland,
  previewStudyModeScreenTimeIsland,
  setStudyModeEnabled,
  setStudyModeProEnabled,
  startStudyModeSession,
  endStudyModeSession,
  getStudyModeSessionHistory,
  type StudyModeApp,
  type StudyModeSession,
  type StudyModeStatus,
} from "@/lib/studyMode";
import { getStudyModePermissionReadiness } from "@/lib/studyModePermissions";
import StudyModePermissionSetup, { type StudyModePermissionKey } from "@/components/StudyModePermissionSetup";
import {
  DEFAULT_STUDY_MODE_CONFIG,
  validateStudyModeSchedule,
  type StudyModeConfig,
} from "@/lib/studyModeSchedule";
import { MOTION } from "@/lib/motion";
import {
  countStudyModeApps,
  filterStudyModeApps,
  sortStudyModeAppsSelectedFirst,
  type StudyModeAppFilter,
} from "@/lib/studyModeAppFilters";
import { m as motion } from "framer-motion";

interface StudyModePageProps {
  onBack: () => void;
  backLabel?: string;
  openStudyAppsPicker?: boolean;
  onStudyAppsPickerOpened?: () => void;
}

const DAY_LABELS = [
  { label: "M", name: "Monday", value: 1 },
  { label: "T", name: "Tuesday", value: 2 },
  { label: "W", name: "Wednesday", value: 3 },
  { label: "T", name: "Thursday", value: 4 },
  { label: "F", name: "Friday", value: 5 },
  { label: "S", name: "Saturday", value: 6 },
  { label: "S", name: "Sunday", value: 7 },
] as const;

type StudyModeSectionId = "focusProtection" | "focusSession" | "studySchedule" | "permissions" | "advancedSettings";
type StudyModeSectionExpansion = Record<StudyModeSectionId, boolean>;

const STUDY_MODE_SECTION_UI_STORAGE_KEY = "math-master.study-mode-section-ui.v1";

const readStudyModeSectionExpansion = (): StudyModeSectionExpansion => {
  const collapsed: StudyModeSectionExpansion = {
    focusProtection: false,
    focusSession: false,
    studySchedule: false,
    permissions: false,
    advancedSettings: false,
  };
  try {
    const raw = window.localStorage.getItem(STUDY_MODE_SECTION_UI_STORAGE_KEY);
    if (!raw) return collapsed;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return collapsed;
    const saved = parsed as Record<string, unknown>;
    return {
      focusProtection: saved.focusProtection === true,
      focusSession: saved.focusSession === true,
      studySchedule: saved.studySchedule === true,
      permissions: saved.permissions === true,
      advancedSettings: saved.advancedSettings === true,
    };
  } catch {
    return collapsed;
  }
};

const toTimeLabel = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
};

const configSnapshot = (config: StudyModeConfig) => JSON.stringify({
  ...config,
  selectedPackageNames: [...config.selectedPackageNames].sort(),
  selectedDays: [...config.selectedDays].sort((a, b) => a - b),
});

const formatSessionTime = (value: number) => {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

const SessionCountdown = memo(({
  session,
  onExpired,
}: {
  session: StudyModeSession;
  onExpired: (sessionId: string) => void;
}) => {
  const [tick, setTick] = useState(0);
  const expirationNotified = useRef(false);

  useEffect(() => {
    setTick(0);
    expirationNotified.current = false;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session.id, session.elapsedSeconds]);

  const elapsedSeconds = session.elapsedSeconds + tick;
  const remainingSeconds = session.durationSeconds > 0
    ? Math.max(0, session.durationSeconds - elapsedSeconds)
    : 0;

  useEffect(() => {
    if (session.durationSeconds <= 0 || remainingSeconds > 0 || expirationNotified.current) return;
    expirationNotified.current = true;
    onExpired(session.id);
  }, [session.id, session.durationSeconds, remainingSeconds, onExpired]);

  const circumference = 2 * Math.PI * 44;
  const progress = session.durationSeconds > 0
    ? Math.max(0, Math.min(1, elapsedSeconds / session.durationSeconds))
    : 0;

  return (
    <div className="study-mode-session-timer relative grid h-[94px] w-[94px] shrink-0 place-items-center rounded-full border border-border/60 bg-background/30 shadow-inner sm:h-[104px] sm:w-[104px]" aria-live="off">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
        <circle
          cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className="font-display text-[18px] font-bold tabular-nums tracking-tight text-foreground sm:text-[20px]">
          {formatSessionTime(session.durationSeconds > 0 ? remainingSeconds : elapsedSeconds)}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {session.durationSeconds > 0 ? "Remaining" : "Elapsed"}
        </span>
      </div>
    </div>
  );
});

const SessionDurationPreview = ({ durationSeconds }: { durationSeconds: number }) => {
  const label = durationSeconds <= 0
    ? "∞"
    : `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;

  return (
    <div role="img" className="study-mode-session-timer relative grid h-[94px] w-[94px] shrink-0 place-items-center rounded-full border border-border/60 bg-background/30 shadow-inner sm:h-[104px] sm:w-[104px]" aria-label={`Session duration ${durationSeconds} seconds`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.28" strokeWidth="3.5" strokeDasharray="4 7" />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className="font-display text-[18px] font-bold tabular-nums tracking-tight text-foreground sm:text-[19px]">{label}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ready</span>
      </div>
    </div>
  );
};

const StudyModeAppIcon = ({ app, size = 30 }: { app: StudyModeApp; size?: number }) => (
  app.iconDataUrl ? (
    <img
      src={app.iconDataUrl}
      alt=""
      loading="lazy" decoding="async"
      width={size}
      height={size}
      className="shrink-0 rounded-[0.7rem] object-contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[0.7rem] bg-secondary text-xs font-bold text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {app.label.slice(0, 1).toLocaleUpperCase()}
    </span>
  )
);


type StudyModeAppTileProps = {
  app: StudyModeApp;
  variant: "blocked" | "study";
  selected: boolean;
  disabled: boolean;
  blocked?: boolean;
  showEnforcementLabel?: boolean;
  enforcementLabel?: string;
  enforcementTone?: "success" | "warning";
  onToggle: (packageName: string, selectable: boolean) => void;
};

const StudyModeAppTile = memo(({
  app,
  variant,
  selected,
  disabled,
  blocked = false,
  showEnforcementLabel = false,
  enforcementLabel,
  enforcementTone = "warning",
  onToggle,
}: StudyModeAppTileProps) => {
  const blockedVariant = variant === "blocked";
  const selectedClass = blockedVariant
    ? "group relative flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border border-primary/35 bg-gradient-to-b from-primary/10 to-card/80 px-1.5 py-2 text-center shadow-sm ring-1 ring-primary/10 transition-[border-color,background-color,transform] duration-200 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    : "group relative flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border border-accent/35 bg-gradient-to-b from-accent/10 to-card/80 px-1.5 py-2 text-center shadow-sm ring-1 ring-accent/10 transition-[border-color,background-color,transform] duration-200 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
  const unselectedClass = blockedVariant
    ? "group relative flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border border-border/55 bg-gradient-to-b from-card/75 to-background/45 px-1.5 py-2 text-center transition-[border-color,background-color,transform] duration-200 hover:border-primary/30 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    : "group relative flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border border-border/55 bg-gradient-to-b from-card/75 to-background/45 px-1.5 py-2 text-center transition-[border-color,background-color,transform] duration-200 hover:border-accent/30 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

  return (
    <button
      type="button"
      onClick={() => onToggle(app.packageName, app.selectable)}
      disabled={!app.selectable || disabled}
      aria-pressed={selected}
      aria-disabled={!app.selectable}
      className={selected ? selectedClass : unselectedClass}
    >
      <span className="grid h-11 w-11 place-items-center rounded-[1rem] border border-border/45 bg-card/85 shadow-inner">
        <StudyModeAppIcon app={app} size={31} />
      </span>
      <span className="line-clamp-1 w-full text-[9px] font-semibold text-foreground">{app.label}</span>
      {blocked && !selected && <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[8px] font-semibold text-warning">Move</span>}
      {selected && showEnforcementLabel && enforcementLabel && (
        <span className={enforcementTone === "success"
          ? "rounded-full bg-success/10 px-1.5 py-0.5 text-[8px] font-semibold text-success"
          : "rounded-full bg-warning/10 px-1.5 py-0.5 text-[8px] font-semibold text-warning"}>
          {enforcementLabel}
        </span>
      )}
      {app.selectable ? (
        selected && (
          <span className={blockedVariant
            ? "absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground"}>
            <Check size={10} strokeWidth={3} />
          </span>
        )
      ) : (
        <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-muted-foreground" aria-label="Protected app">
          <LockKeyhole size={10} />
        </span>
      )}
    </button>
  );
});

const statusText = (status: StudyModeStatus | null) => {
  if (!isStudyModeNative()) return "Available in the Android app";
  if (!status) return "Reading saved Study Mode state…";
  if (status?.enforcementState === "policy_unavailable" || status?.enforcementState === "policy_failed") {
    return "Android could not confirm that every suspended app is available";
  }
  if (status?.activeSession?.active) {
    if (status.enforcementState === "permission_required") return "Focus session active · app blocking permission required";
    if (status.enforcementState === "monitoring_unavailable") return "Focus session active · grant Usage Access";
    if (status.enforcementState === "overlay_failed") return "Focus session active · blocking overlay unavailable";
    if (status.enforcementState === "service_start_blocked") return "Focus session saved · Android blocked the monitoring service";
    if (status.enforcementState === "service_stopped") return "Focus session active · monitoring service is stopped";
    const label = status.activeSession.sessionType.charAt(0).toUpperCase()
      + status.activeSession.sessionType.slice(1);
    return label + " focus session active · continues in background";
  }
  if (!status?.config.enabled) return "Study Mode is off";
  if (status.enforcementState === "permission_required") return "Allow Usage Access and enable the blocking overlay";
  if (status.enforcementState === "monitoring_unavailable") return "App monitoring unavailable · grant Usage Access";
  if (status.enforcementState === "exact_alarm_required") return "Exact alarm access is required for safe system-level scheduling";
  if (status.enforcementState === "focus_shield_starting") return "Starting Focus Shield…";
  if (status.enforcementState === "service_start_blocked") return "Android did not allow Focus Shield to start";
  if (status.enforcementState === "service_stopped") return "Android stopped Focus Shield — reopen Study Mode to retry";
  if (status.enforcementState === "overlay_failed") return "Android could not display the blocking overlay";
  if (status.enforcementState === "policy_failed") return "System suspension could not be applied";
  if (status.enforcementState === "partial_suspension") return "Some selected apps could not be suspended";
  if (status.enforcementMode === "profile_owner" && status.enforcementState === "system_suspension") return "System suspension is active in the managed profile";
  if (status.enforcementState === "focus_shield_running") return "Focus Shield only — actual suspension requires Device Owner";
  if (status.enforcementState === "system_suspension") return "Android system-level suspension is active";
  if (status.enforcementState === "waiting_for_schedule") return "Enabled — waiting for the next study session";
  if (!status.scheduleActive) return "Enabled — outside scheduled hours";
  return "Study Mode enabled";
};

const StudyModePage = ({ onBack, backLabel = "Back to Settings", openStudyAppsPicker = false, onStudyAppsPickerOpened }: StudyModePageProps) => {
  const [cachedSettings] = useState(() => getCachedStudyModeSettings());
  const [cachedApps] = useState(() => getCachedInstalledStudyModeApps());
  const initialConfig = cachedSettings?.config ?? DEFAULT_STUDY_MODE_CONFIG;
  const initialStudyApps = cachedSettings?.studyAppPackages ?? [];
  const [draft, setDraft] = useState<StudyModeConfig>(initialConfig);
  const [status, setStatus] = useState<StudyModeStatus | null>(null);
  const [apps, setApps] = useState<StudyModeApp[]>(cachedApps ?? []);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsLoadError, setAppsLoadError] = useState("");
  const [studyAppPackages, setStudyAppPackages] = useState<string[]>(initialStudyApps);
  const [reminderIntervalMinutes, setReminderIntervalMinutesState] = useState(2);
  const [reminderIntervalOpen, setReminderIntervalOpen] = useState(false);
  const [reminderIntervalSaving, setReminderIntervalSaving] = useState(false);
  const [screenTimeIslandEnabled, setScreenTimeIslandEnabled] = useState(cachedSettings?.screenTimeIslandEnabled ?? true);
  const [screenTimeIslandIntervalMinutes, setScreenTimeIslandIntervalMinutes] = useState(cachedSettings?.screenTimeIslandIntervalMinutes ?? 5);
  const [screenTimeIslandSaving, setScreenTimeIslandSaving] = useState(false);
  const [screenTimeIslandPreviewing, setScreenTimeIslandPreviewing] = useState(false);
  const [studyPickerOpen, setStudyPickerOpen] = useState(false);
  const [studySearch, setStudySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [permissionSetupOpen, setPermissionSetupOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState<StudyModeAppFilter>("all");
  const deferredSearch = useDeferredValue(search);
  const deferredStudySearch = useDeferredValue(studySearch);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [sessionType, setSessionType] = useState<"study" | "practice" | "work" | "custom">("study");
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(25 * 60);
  const [sessionEnforced, setSessionEnforced] = useState(false);
  const [sessionDnd, setSessionDnd] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<StudyModeSession[]>([]);
  const [expandedSections, setExpandedSections] = useState<StudyModeSectionExpansion>(readStudyModeSectionExpansion);
  const permissionsExpanded = expandedSections.permissions;
  const setPermissionsExpanded = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    setExpandedSections((current) => ({
      ...current,
      permissions: typeof next === "function" ? next(current.permissions) : next,
    }));
  }, []);
  const savedSnapshot = useRef(configSnapshot(initialConfig));
  const saveInFlightRef = useRef(false);
  const proAllowlistSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const proAllowlistSaveRevisionRef = useRef(0);
  const reminderIntervalSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reminderIntervalRequestRef = useRef(0);
  const screenTimeIslandSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const screenTimeIslandRequestRef = useRef(0);
  const savedStudyAppsSnapshot = useRef(JSON.stringify([...initialStudyApps].sort()));
  const recoveryAttemptRef = useRef(false);
  const isDirty = configSnapshot(draft) !== savedSnapshot.current;
  const studyAppsSnapshot = JSON.stringify([...studyAppPackages].sort());
  const isStudyAppsDirty = studyAppsSnapshot !== savedStudyAppsSnapshot.current;

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDY_MODE_SECTION_UI_STORAGE_KEY, JSON.stringify(expandedSections));
    } catch {
      // Display preferences are optional; Study Mode controls remain usable without storage.
    }
  }, [expandedSections]);

  const toggleSection = useCallback((section: StudyModeSectionId) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  }, []);
  const hasUnsavedChanges = isDirty || isStudyAppsDirty;
  const dirtyRef = useRef(hasUnsavedChanges);
  dirtyRef.current = hasUnsavedChanges;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const handleBack = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard unsaved Study Mode changes?")) return;
    onBackRef.current();
  }, []);

  const isMountedRef = useRef(true);
  const permissionSetupAutoOpenedRef = useRef(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const historyInFlightRef = useRef<Promise<void> | null>(null);
  const appCatalogRef = useRef<StudyModeApp[] | null>(cachedApps);
  const appCatalogLoadedRef = useRef(cachedApps !== null);
  const lifecycleRefreshInFlightRef = useRef(false);
  const appCatalogLoadInFlightRef = useRef<Promise<void> | null>(null);
  const statusRef = useRef<StudyModeStatus | null>(status);
  statusRef.current = status;
  const pickerOpenRef = useRef(pickerOpen);
  pickerOpenRef.current = pickerOpen;
  const studyPickerOpenRef = useRef(studyPickerOpen);
  studyPickerOpenRef.current = studyPickerOpen;

  // The app catalogue is not needed by the default collapsed screen. Fetch it
  // only when a picker is opened, and reuse the module-level cache on remount.
  const loadApps = useCallback((forceRefresh = false): Promise<void> => {
    if (!isStudyModeNative()) {
      setAppsLoadError("Installed apps are available only in the Android app.");
      return Promise.resolve();
    }
    if (!forceRefresh && appCatalogLoadedRef.current && getCachedInstalledStudyModeApps() !== null) {
      return Promise.resolve();
    }
    if (getCachedInstalledStudyModeApps() === null) {
      appCatalogLoadedRef.current = false;
      appCatalogRef.current = null;
    }
    if (appCatalogLoadInFlightRef.current) return appCatalogLoadInFlightRef.current;

    // A warm catalogue stays interactive while the native revision is checked.
    // Cold discovery still shows a loading state until the complete list is ready.
    const hasWarmCatalog = getCachedInstalledStudyModeApps() !== null;
    if (!hasWarmCatalog) setAppsLoading(true);
    setAppsLoadError("");
    const request = (async () => {
      try {
        const installedApps = await getInstalledStudyModeApps(forceRefresh);
        if (!isMountedRef.current) return;

        appCatalogRef.current = installedApps;
        appCatalogLoadedRef.current = true;
        setApps(installedApps);

        const latestStatus = statusRef.current;
        if (!dirtyRef.current && latestStatus) {
          const selectablePackages = new Set(
            installedApps.filter((app) => app.selectable).map((app) => app.packageName),
          );
          const normalized: StudyModeConfig = {
            ...DEFAULT_STUDY_MODE_CONFIG,
            ...latestStatus.config,
            selectedPackageNames: latestStatus.config.selectedPackageNames.filter((name) =>
              selectablePackages.has(name)),
            selectedDays: [...latestStatus.config.selectedDays],
          };
          const blockedNow = new Set(normalized.selectedPackageNames);
          const normalizedStudyApps = (latestStatus.studyAppPackages ?? []).filter((name) =>
            !blockedNow.has(name) && selectablePackages.has(name));
          setDraft(normalized);
          savedSnapshot.current = configSnapshot(normalized);
          setStudyAppPackages(normalizedStudyApps);
          savedStudyAppsSnapshot.current = JSON.stringify([...normalizedStudyApps].sort());
        }
      } catch (error) {
        if (isMountedRef.current) {
          setAppsLoadError(error instanceof Error && error.message
            ? error.message
            : "Could not load installed apps. Tap to retry.");
        }
      } finally {
        if (isMountedRef.current && !hasWarmCatalog) setAppsLoading(false);
      }
    })();

    appCatalogLoadInFlightRef.current = request;
    void request.finally(() => {
      if (appCatalogLoadInFlightRef.current === request) appCatalogLoadInFlightRef.current = null;
    });
    return request;
  }, []);

  const toggleBlockedPicker = () => {
    const nextOpen = !pickerOpen;
    setPickerOpen(nextOpen);
    if (nextOpen) void loadApps(true);
  };

  const handleReminderIntervalChange = (value: number) => {
    if (!Number.isInteger(value) || value < 1 || value > 10 || !isStudyModeNative()) return;
    setReminderIntervalMinutesState(value);
    setReminderIntervalOpen(false);
    setReminderIntervalSaving(true);
    const request = ++reminderIntervalRequestRef.current;
    const save = reminderIntervalSaveQueueRef.current
      .catch(() => undefined)
      .then(() => setStudyModeReminderInterval(value));
    reminderIntervalSaveQueueRef.current = save.then(() => undefined, () => undefined);
    void save.then((nextStatus) => {
      if (!isMountedRef.current || request !== reminderIntervalRequestRef.current) return;
      setReminderIntervalMinutesState(nextStatus.reminderIntervalMinutes ?? value);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setReminderIntervalSaving(false);
    }).catch((error) => {
      if (!isMountedRef.current || request !== reminderIntervalRequestRef.current) return;
      setReminderIntervalSaving(false);
      setMessage(error instanceof Error ? error.message : "Could not save the reminder interval.");
      void getStudyModeStatus().then((current) => {
        if (isMountedRef.current && request === reminderIntervalRequestRef.current) {
          setReminderIntervalMinutesState(current.reminderIntervalMinutes ?? 2);
          statusRef.current = current;
          setStatus(current);
        }
      }).catch(() => undefined);
    });
  };

  const handleScreenTimeIslandChange = (enabled: boolean, minutes = screenTimeIslandIntervalMinutes) => {
    if (!isStudyModeNative() || screenTimeIslandSaving) return;
    const request = ++screenTimeIslandRequestRef.current;
    setScreenTimeIslandEnabled(enabled);
    setScreenTimeIslandIntervalMinutes(minutes);
    setScreenTimeIslandSaving(true);
    const save = screenTimeIslandSaveQueueRef.current
      .catch(() => undefined)
      .then(() => setStudyModeScreenTimeIsland(enabled, minutes));
    screenTimeIslandSaveQueueRef.current = save.then(() => undefined, () => undefined);
    void save.then((nextStatus) => {
      if (!isMountedRef.current || request !== screenTimeIslandRequestRef.current) return;
      setScreenTimeIslandEnabled(nextStatus.screenTimeIslandEnabled !== false);
      setScreenTimeIslandIntervalMinutes(nextStatus.screenTimeIslandIntervalMinutes ?? minutes);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setScreenTimeIslandSaving(false);
      setMessage("");
    }).catch((error) => {
      if (!isMountedRef.current || request !== screenTimeIslandRequestRef.current) return;
      setScreenTimeIslandSaving(false);
      setMessage(error instanceof Error ? error.message : "Could not save Screen Time Island settings.");
      void getStudyModeStatus().then((current) => {
        if (!isMountedRef.current || request !== screenTimeIslandRequestRef.current) return;
        setScreenTimeIslandEnabled(current.screenTimeIslandEnabled !== false);
        setScreenTimeIslandIntervalMinutes(current.screenTimeIslandIntervalMinutes ?? 5);
        statusRef.current = current;
        setStatus(current);
      }).catch(() => undefined);
    });
  };

  const handleScreenTimeIslandPreview = async () => {
    if (screenTimeIslandPreviewing || !isStudyModeNative()) return;
    if (!status?.permissions.overlay) {
      setMessage("Allow Display over other apps before previewing the island.");
      setPermissionSetupOpen(true);
      return;
    }
    setScreenTimeIslandPreviewing(true);
    try {
      await previewStudyModeScreenTimeIsland();
      setMessage("Preview shown above your current app.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Screen Time Island preview could not be shown.");
    } finally {
      if (isMountedRef.current) setScreenTimeIslandPreviewing(false);
    }
  };

  useEffect(() => {
    if (!openStudyAppsPicker) return;
    setStudyPickerOpen(true);
    setStudySearch("");
    void loadApps(true);
    onStudyAppsPickerOpened?.();
  }, [openStudyAppsPicker, loadApps, onStudyAppsPickerOpened]);

  const toggleStudyPicker = () => {
    const nextOpen = !studyPickerOpen;
    setStudyPickerOpen(nextOpen);
    if (nextOpen) void loadApps(true);
  };

  const load = useCallback((reconcile = false): Promise<void> => {
    if (!isStudyModeNative()) {
      setLoading(false);
      setRefreshError("Study Mode controls require the installed Android app.");
      return Promise.resolve();
    }
    if (loadInFlightRef.current) return loadInFlightRef.current;

    const request = (async () => {
      try {
        const nextStatus = await (reconcile ? refreshStudyMode() : getStudyModeStatus());
        const installedApps = appCatalogRef.current;
        const selectablePackages = installedApps
          ? new Set(installedApps.filter((app) => app.selectable).map((app) => app.packageName))
          : null;
        const normalized: StudyModeConfig = {
          ...DEFAULT_STUDY_MODE_CONFIG,
          ...nextStatus.config,
          selectedPackageNames: selectablePackages
            ? nextStatus.config.selectedPackageNames.filter((name) => selectablePackages.has(name))
            : [...nextStatus.config.selectedPackageNames],
          selectedDays: [...nextStatus.config.selectedDays],
        };
        const blockedNow = new Set(normalized.selectedPackageNames);
        const normalizedStudyApps = (nextStatus.studyAppPackages ?? []).filter((name) =>
          !blockedNow.has(name) && (!selectablePackages || selectablePackages.has(name)));

        if (!isMountedRef.current) return;
        statusRef.current = nextStatus;
        setStatus(nextStatus);
        setReminderIntervalMinutesState(nextStatus.reminderIntervalMinutes ?? 2);
        setScreenTimeIslandEnabled(nextStatus.screenTimeIslandEnabled !== false);
        setScreenTimeIslandIntervalMinutes(nextStatus.screenTimeIslandIntervalMinutes ?? 5);
        if (!permissionSetupAutoOpenedRef.current) {
          permissionSetupAutoOpenedRef.current = true;
          if (!nextStatus.config.enabled && !nextStatus.activeSession?.active
            && !getStudyModePermissionReadiness(nextStatus).coreReady) {
            setPermissionSetupOpen(true);
          }
        }
        if (nextStatus.activeSession?.active) {
          setSessionType(nextStatus.activeSession.sessionType);
          setSessionDurationSeconds(nextStatus.activeSession.durationSeconds);
          setSessionEnforced(nextStatus.activeSession.isEnforced);
          setSessionDnd(nextStatus.activeSession.shouldEnableDnd);
        }
        // Returning from Android permission settings must refresh actual system
        // grants without silently discarding edits still in this page.
        if (!dirtyRef.current) {
          setDraft(normalized);
          savedSnapshot.current = configSnapshot(normalized);
          setStudyAppPackages(normalizedStudyApps);
          savedStudyAppsSnapshot.current = JSON.stringify([...normalizedStudyApps].sort());
        }
        setRefreshError("");

        // History is non-critical and must not delay first interaction.
        if (!historyInFlightRef.current) {
          const historyRequest = getStudyModeSessionHistory()
            .then((history) => {
              if (isMountedRef.current) setSessionHistory(history);
            })
            .catch(() => {
              // Keep core Study Mode controls usable when history is unavailable.
            })
            .finally(() => {
              if (historyInFlightRef.current === historyRequest) historyInFlightRef.current = null;
            });
          historyInFlightRef.current = historyRequest;
        }
      } catch (error) {
        if (isMountedRef.current) {
          setRefreshError(error instanceof Error && error.message
            ? error.message
            : "Could not read Android Study Mode status. Reopen this page to retry.");
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    })();

    loadInFlightRef.current = request;
    void request.finally(() => {
      if (loadInFlightRef.current === request) loadInFlightRef.current = null;
    });
    return request;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load(false);
    let disposed = false;
    let appResume: { remove: () => Promise<void> } | null = null;
    const refresh = () => {
      if (disposed || lifecycleRefreshInFlightRef.current) return;
      lifecycleRefreshInFlightRef.current = true;

      const refreshApps = pickerOpenRef.current || studyPickerOpenRef.current
        ? loadApps(true)
        : Promise.resolve();
      void Promise.all([load(true), refreshApps]).finally(() => {
        lifecycleRefreshInFlightRef.current = false;
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    void App.addListener("resume", refresh).then((listener) => {
      if (disposed) void listener.remove();
      else appResume = listener;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      if (appResume) void appResume.remove();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, loadApps]);

  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent("study-mode-page-state", { detail: { open: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("study-mode-page-state", { detail: { open: false } }));
    };
  }, []);

  useEffect(() => {
    const onBackRequest = () => handleBack();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      handleBack();
    };
    window.addEventListener("study-mode-back", onBackRequest);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("study-mode-back", onBackRequest);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [handleBack]);


  const activeSession = status?.activeSession?.active ? status.activeSession : null;
  const selectionReady = cachedSettings !== null || status !== null;
  const permissionReadiness = status ? getStudyModePermissionReadiness(status) : null;
  const corePermissionsReady = permissionReadiness?.coreReady === true;

  const handleSessionExpired = useCallback(async (_sessionId: string) => {
    try {
      const nextStatus = await refreshStudyMode();
      if (!isMountedRef.current) return;
      setStatus(nextStatus);
      const history = await getStudyModeSessionHistory();
      if (isMountedRef.current) setSessionHistory(history);
    } catch {
      if (isMountedRef.current) {
        setMessage("The session reached its timer boundary. Refresh Study Mode to verify completion.");
      }
    }
  }, []);

  const suspendedPackages = useMemo(() => new Set(status?.suspendedPackages ?? []), [status?.suspendedPackages]);
  const selectedCount = draft.selectedPackageNames.length;
  const appCounts = useMemo(() => countStudyModeApps(apps), [apps]);
  const selectedBlockedPackageSet = useMemo(
    () => new Set(draft.selectedPackageNames),
    [draft.selectedPackageNames],
  );
  const selectedStudyPackageSet = useMemo(
    () => new Set(studyAppPackages),
    [studyAppPackages],
  );
  const enforcedPackageSet = useMemo(
    () => new Set(status?.enforcedPackages ?? []),
    [status?.enforcedPackages],
  );
  const visibleApps = useMemo(
    () => sortStudyModeAppsSelectedFirst(
      filterStudyModeApps(apps, appFilter, deferredSearch),
      draft.selectedPackageNames,
    ),
    [apps, appFilter, deferredSearch, draft.selectedPackageNames],
  );
  const visibleStudyApps = useMemo(
    () => sortStudyModeAppsSelectedFirst(
      filterStudyModeApps(apps, "all", deferredStudySearch),
      studyAppPackages,
    ),
    [apps, deferredStudySearch, studyAppPackages],
  );
  const selectedBlockedApps = useMemo(
    () => apps.filter((app) => selectedBlockedPackageSet.has(app.packageName)),
    [apps, selectedBlockedPackageSet],
  );
  const selectedStudyApps = useMemo(
    () => apps.filter((app) => selectedStudyPackageSet.has(app.packageName)),
    [apps, selectedStudyPackageSet],
  );

  const updateDraft = (patch: Partial<StudyModeConfig>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage("");
  };

  const persistProAllowlist = (nextDraft: StudyModeConfig, nextStudyApps: string[]) => {
    const request = ++proAllowlistSaveRevisionRef.current;
    const save = proAllowlistSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const nextStatus = await saveStudyModeConfig(nextDraft, nextStudyApps);
        if (!isMountedRef.current || request !== proAllowlistSaveRevisionRef.current) return;
        const savedConfig = { ...nextStatus.config, selectedDays: [...nextStatus.config.selectedDays] };
        statusRef.current = nextStatus;
        setStatus(nextStatus);
        savedSnapshot.current = configSnapshot(savedConfig);
        savedStudyAppsSnapshot.current = JSON.stringify([...(nextStatus.studyAppPackages ?? nextStudyApps)].sort());
        setMessage("");
      })
      .catch(async (error: unknown) => {
        if (!isMountedRef.current || request !== proAllowlistSaveRevisionRef.current) return;
        setMessage(error instanceof Error && error.message
          ? error.message
          : "PRO allowlist could not be updated. The previous saved allowlist remains active.");
        try {
          const actualStatus = await getStudyModeStatus();
          if (!isMountedRef.current || request !== proAllowlistSaveRevisionRef.current) return;
          const actualConfig = { ...actualStatus.config, selectedDays: [...actualStatus.config.selectedDays] };
          statusRef.current = actualStatus;
          setStatus(actualStatus);
          setDraft(actualConfig);
          setStudyAppPackages(actualStatus.studyAppPackages ?? []);
          savedSnapshot.current = configSnapshot(actualConfig);
          savedStudyAppsSnapshot.current = JSON.stringify([...(actualStatus.studyAppPackages ?? [])].sort());
        } catch {
          // Preserve the visible error; native enforcement keeps the last committed lists.
        }
      });
    proAllowlistSaveQueueRef.current = save.then(() => undefined, () => undefined);
    return save;
  };

  const toggleApp = (packageName: string, selectable: boolean) => {
    if (!selectable || saving) return;
    const selected = draft.selectedPackageNames.includes(packageName);
    let nextStudyApps = studyAppPackages;
    if (!selected && studyAppPackages.includes(packageName)) {
      const appName = apps.find((app) => app.packageName === packageName)?.label ?? packageName;
      if (!window.confirm(
        appName + " is currently selected in Study Apps. Move it to Blocked Apps? It will be removed from Study Apps."
      )) return;
      nextStudyApps = studyAppPackages.filter((name) => name !== packageName);
      setStudyAppPackages(nextStudyApps);
    }
    const nextDraft = {
      ...draft,
      selectedPackageNames: selected
        ? draft.selectedPackageNames.filter((name) => name !== packageName)
        : [...draft.selectedPackageNames, packageName],
    };
    setDraft(nextDraft);
    setMessage("");
    if (statusRef.current?.proEnabled && statusRef.current.config.enabled) {
      void persistProAllowlist(nextDraft, nextStudyApps);
    }
  };

  const toggleStudyApp = (packageName: string, selectable: boolean) => {
    if (!selectable || saving) return;
    const selected = studyAppPackages.includes(packageName);
    let nextDraft = draft;
    if (!selected && (draft.selectedPackageNames.includes(packageName)
      || (status?.enforcedPackages ?? []).includes(packageName))) {
      const appName = apps.find((app) => app.packageName === packageName)?.label ?? packageName;
      if (!window.confirm(
        appName + " is currently blocked. Move it to Study Apps? It will be removed from Blocked Apps and the current session's blocked selection."
      )) return;
      nextDraft = {
        ...draft,
        selectedPackageNames: draft.selectedPackageNames.filter((name) => name !== packageName),
      };
      setDraft(nextDraft);
    }
    const nextStudyApps = selected
      ? studyAppPackages.filter((name) => name !== packageName)
      : [...studyAppPackages, packageName];
    setStudyAppPackages(nextStudyApps);
    setMessage("");
    if (statusRef.current?.proEnabled && statusRef.current.config.enabled) {
      void persistProAllowlist(nextDraft, nextStudyApps);
    }
  };

  const toggleAppRef = useRef(toggleApp);
  toggleAppRef.current = toggleApp;
  const toggleStudyAppRef = useRef(toggleStudyApp);
  toggleStudyAppRef.current = toggleStudyApp;
  const handleBlockedAppToggle = useCallback((packageName: string, selectable: boolean) => {
    toggleAppRef.current(packageName, selectable);
  }, []);
  const handleStudyAppToggle = useCallback((packageName: string, selectable: boolean) => {
    toggleStudyAppRef.current(packageName, selectable);
  }, []);

  const chooseTime = async (which: "start" | "end") => {
    const hour = which === "start" ? draft.startHour : draft.endHour;
    const minute = which === "start" ? draft.startMinute : draft.endMinute;
    try {
      const result = await chooseStudyModeTime(which === "start" ? "Start time" : "End time", hour, minute);
      if (!result.confirmed || result.hour === undefined || result.minute === undefined) return;
      updateDraft(which === "start"
        ? { startHour: result.hour, startMinute: result.minute }
        : { endHour: result.hour, endMinute: result.minute });
    } catch {
      setMessage("The Android time picker could not be opened.");
    }
  };

  const handleSave = async () => {
    if (saving || saveInFlightRef.current) return;
    const validation = validateStudyModeSchedule(draft);
    if (validation) {
      setMessage(validation);
      return;
    }
    if (draft.selectedPackageNames.length === 0) {
      setMessage("Select at least one app to protect from distractions.");
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      await proAllowlistSaveQueueRef.current;
      const nextStatus = await saveStudyModeConfig(draft, studyAppPackages);
      const savedConfig = { ...nextStatus.config, selectedDays: [...nextStatus.config.selectedDays] };
      const savedStudyApps = nextStatus.studyAppPackages ?? studyAppPackages.filter(
        (name) => !savedConfig.selectedPackageNames.includes(name));
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setDraft(savedConfig);
      setStudyAppPackages(savedStudyApps);
      savedSnapshot.current = configSnapshot(savedConfig);
      savedStudyAppsSnapshot.current = JSON.stringify([...savedStudyApps].sort());
      setMessage("Study Mode settings saved.");
    } catch (error) {
      setMessage(error instanceof Error && error.message
        ? error.message
        : "Settings could not be saved. Your previous configuration is unchanged.");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!status?.config.enabled && !status?.activeSession?.active) {
      recoveryAttemptRef.current = false;
      return;
    }
    if (status.enforcementState !== "service_stopped"
      || (!status.scheduleActive && !status.activeSession?.active)
      || recoveryAttemptRef.current) return;
    recoveryAttemptRef.current = true;
    let active = true;
    void refreshStudyMode().then((nextStatus) => {
      if (active) setStatus(nextStatus);
    }).catch(() => {
      if (active) setMessage("Focus Shield stopped. Reopen Study Mode to retry enforcement.");
    });
    return () => {
      active = false;
    };
  }, [status?.config.enabled, status?.activeSession?.active, status?.enforcementState, status?.scheduleActive]);

  useEffect(() => {
    if (status?.enforcementState !== "focus_shield_starting") return;
    let active = true;
    let attempts = 0;
    let timer = 0;
    const poll = async () => {
      try {
        const nextStatus = await getStudyModeStatus();
        if (!active) return;
        setStatus(nextStatus);
        if (nextStatus.enforcementState === "focus_shield_starting" && attempts < 8) {
          attempts += 1;
          timer = window.setTimeout(poll, 250);
        }
      } catch {
        // Keep the last truthful state visible if the native bridge is temporarily unavailable.
      }
    };
    timer = window.setTimeout(poll, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [status?.enforcementState]);

  const handleStartSession = async () => {
    if (saving || loading) return;
    if (sessionEnforced && !corePermissionsReady) {
      setPermissionSetupOpen(true);
      setMessage("Complete the required Android permissions before starting an enforced focus session.");
      return;
    }
    if (draft.selectedPackageNames.length === 0) {
      setMessage("Select at least one app before starting a focus session.");
      return;
    }
    if (sessionDnd && !status?.permissions.dndAccess) {
      setMessage("Allow Do Not Disturb access, then start the session again.");
      void openPermission("dnd");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      let configStatus = status;
      if (hasUnsavedChanges) {
        configStatus = await saveStudyModeConfig(draft, studyAppPackages);
        const savedConfig = { ...configStatus.config, selectedDays: [...configStatus.config.selectedDays] };
        const savedStudyApps = configStatus.studyAppPackages ?? studyAppPackages.filter(
          (name) => !savedConfig.selectedPackageNames.includes(name));
        setDraft(savedConfig);
        setStudyAppPackages(savedStudyApps);
        savedSnapshot.current = configSnapshot(savedConfig);
        savedStudyAppsSnapshot.current = JSON.stringify([...savedStudyApps].sort());
        setStatus(configStatus);
      }

      const nextStatus = await startStudyModeSession({
        sessionType,
        durationSeconds: sessionDurationSeconds,
        enforced: sessionEnforced,
        shouldEnableDnd: sessionDnd,
      });
      setStatus(nextStatus);
      setSessionHistory(await getStudyModeSessionHistory());
      if (nextStatus.enforcementState === "permission_required") {
        setMessage("Session is saved and running, but app blocking is unavailable until Usage Access and overlay permissions are granted.");
      } else if (nextStatus.enforcementState === "service_start_blocked") {
        setMessage("Session is saved. Android did not allow the monitoring service to start; check battery and service restrictions.");
      } else {
        setMessage("Focus session started. Leaving this page will not stop the session.");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "The focus session could not be started.");
    } finally {
      setSaving(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession || saving) return;
    if (activeSession.isEnforced && !window.confirm("End this enforced focus session?")) return;
    setSaving(true);
    setMessage("");
    try {
      const nextStatus = await endStudyModeSession(activeSession.id);
      setStatus(nextStatus);
      setSessionHistory(await getStudyModeSessionHistory());
      setMessage("Focus session ended. Your saved schedule and app selection remain unchanged.");
    } catch {
      setMessage("Android could not confirm that the focus session ended.");
    } finally {
      setSaving(false);
    }
  };

  const handleProToggle = async () => {
    const currentStatus = statusRef.current;
    if (saving || !currentStatus || !currentStatus.config.enabled) return;
    const enabled = currentStatus.proEnabled !== true;
    setSaving(true);
    setMessage("");
    try {
      await proAllowlistSaveQueueRef.current;
      if (enabled && hasUnsavedChanges) {
        const savedStatus = await saveStudyModeConfig(draft, studyAppPackages);
        const savedConfig = { ...savedStatus.config, selectedDays: [...savedStatus.config.selectedDays] };
        const savedStudyApps = savedStatus.studyAppPackages ?? studyAppPackages;
        statusRef.current = savedStatus;
        setStatus(savedStatus);
        setDraft(savedConfig);
        setStudyAppPackages(savedStudyApps);
        savedSnapshot.current = configSnapshot(savedConfig);
        savedStudyAppsSnapshot.current = JSON.stringify([...savedStudyApps].sort());
      }
      const nextStatus = await setStudyModeProEnabled(enabled);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setMessage(enabled
        ? "PRO enabled. Only apps in Study Apps are allowed during an active Study Mode session."
        : "PRO disabled. Your existing Blocked Apps rules are active again.");
    } catch (error) {
      setMessage(error instanceof Error && error.message
        ? error.message
        : "PRO could not be updated. Check the current Study Mode status.");
      try {
        const nextStatus = await getStudyModeStatus();
        statusRef.current = nextStatus;
        setStatus(nextStatus);
      } catch {
        // Keep the current native state visible as the last confirmed status.
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMasterToggle = async (enabled: boolean) => {
    if (saving) return;
    if (!enabled) {
      if (status?.activeSession?.isEnforced && !window.confirm("End this enforced focus session and turn Study Mode off?")) return;
      setSaving(true);
      try {
        const nextStatus = await setStudyModeEnabled(false);
        statusRef.current = nextStatus;
        setStatus(nextStatus);
        setDraft((previous) => ({ ...previous, enabled: false }));
        savedSnapshot.current = configSnapshot({ ...nextStatus.config, enabled: false });
        setMessage(nextStatus.enforcementState === "policy_failed" || nextStatus.enforcementState === "policy_unavailable"
          ? "Study Mode is off, but Android could not confirm release of every system-suspended app. Keep this device managed and retry."
          : "Study Mode is off. Saved schedule and app selection were kept.");
      } catch {
        setMessage("Android could not confirm that all restrictions were released. Check Study Mode status.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!corePermissionsReady) {
      setMessage("Study Mode cannot start app blocking until its required Android permissions are ready.");
      setPermissionSetupOpen(true);
      return;
    }

    const validation = validateStudyModeSchedule(draft);
    if (validation || draft.selectedPackageNames.length === 0) {
      setMessage(validation || "Select at least one app before enabling Study Mode.");
      return;
    }
    if (hasUnsavedChanges) {
      setMessage("Save your changed app lists and schedule before turning Study Mode on.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const nextStatus = await setStudyModeEnabled(true);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setDraft({ ...nextStatus.config, selectedDays: [...nextStatus.config.selectedDays] });
      savedSnapshot.current = configSnapshot(nextStatus.config);
      if (nextStatus.enforcementState === "permission_required") {
        setMessage("Study Mode is enabled, but blocking is not active yet. Grant the required permissions below.");
      } else if (nextStatus.enforcementState === "service_start_blocked") {
        setMessage("Android did not allow Focus Shield to start. Open the required settings and try again.");
      } else {
        setMessage("Study Mode enabled. Actual enforcement status is shown below.");
      }
    } catch {
      setMessage("Study Mode could not be enabled.");
    } finally {
      setSaving(false);
    }
  };

  const managedDevice = status?.permissions.deviceOwner === true || status?.permissions.profileOwner === true;
  const permissionItems = [
    {
      key: "usage" as const,
      title: "Usage Access",
      granted: status?.permissions.usageAccess === true || managedDevice,
      required: permissionReadiness
        ? !permissionReadiness.monitoringReady
        : true,
      helper: managedDevice
        ? "Not required for managed-device system suspension."
        : "Detects the foreground app for Study Mode protection.",
    },
    {
      key: "overlay" as const,
      title: "Display over other apps",
      granted: permissionReadiness?.overlayReady === true,
      required: permissionReadiness ? !permissionReadiness.overlayReady : true,
      helper: managedDevice ? "Not required for managed-device system suspension." : "Shows the Study Mode blocking screen.",
    },
    {
      key: "battery" as const,
      title: "Battery optimization",
      granted: status?.permissions.batteryOptimizationIgnored === true,
      required: false,
      helper: "Optional. Review Android battery settings; background execution is still subject to Android and OEM limits.",
    },
    ...(status?.exactAlarmFallback ? [{
      key: "exactAlarm" as const,
      title: "Exact alarms",
      granted: status?.permissions.exactAlarm === true,
      required: permissionReadiness?.exactAlarmRequired === true,
      helper: permissionReadiness?.exactAlarmRequired
        ? "Required for this managed-device schedule."
        : "Optional on personal devices. Android uses an inexact fallback when this access is unavailable.",
    }] : []),
    {
      key: "notifications" as const,
      title: "Notifications",
      granted: status?.permissions.notificationsEnabled === true,
      required: false,
      helper: "Optional. Controls whether Android can show Study Mode and reminder notifications.",
    },
    {
      key: "dnd" as const,
      title: "Do Not Disturb",
      granted: status?.permissions.dndAccess === true,
      required: sessionDnd && !status?.permissions.dndAccess,
      helper: "Optional. Saves the original DND filter and restores it only if it is still managed by this session.",
    },
  ];

  const openPermission = async (permission: StudyModePermissionKey | "dnd") => {
    if (permission === "notifications") {
      try {
        const enabled = await requestStudyModeNotificationPermission();
        if (!enabled) await openStudyModePermission("notifications");
        const latestStatus = await getStudyModeStatus();
        if (isMountedRef.current) setStatus(latestStatus);
      } catch {
        setMessage("Android notification permission or settings could not be opened.");
      }
      return;
    }
    try {
      await openStudyModePermission(permission);
    } catch {
      setMessage("Android settings could not be opened for this permission.");
    }
  };


  const requestNotifications = async (): Promise<boolean> => {
    await openPermission("notifications");
    const latestStatus = await getStudyModeStatus();
    if (isMountedRef.current) setStatus(latestStatus);
    return latestStatus.permissions.notificationsEnabled === true;
  };

  return (
    <div className="study-mode-page mx-auto w-full max-w-3xl min-w-0 space-y-3 pb-2">
      {permissionSetupOpen && status && !loading ? (
        <StudyModePermissionSetup
          status={status}
          onClose={() => setPermissionSetupOpen(false)}
          onComplete={() => {
            if (!corePermissionsReady) return;
            setPermissionSetupOpen(false);
            setMessage("Required permissions are ready. Study Mode remains off until you turn it on.");
          }}
          onOpenPermission={(permission) => { void openPermission(permission); }}
          onRequestNotifications={requestNotifications}
        />
      ) : (
        <>
          <header className="study-mode-header flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              aria-label={backLabel}
              className="motion-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/55 text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-bold leading-tight tracking-tight text-foreground">Study Mode</h2>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[1rem] border border-primary/15 bg-primary/10 text-primary shadow-inner">
              <ShieldCheck size={17} strokeWidth={1.8} />
            </span>
          </header>

<div className={`study-mode-primary-grid${activeSession ? " study-mode-primary-grid--active" : ""}`}>
          <section className={`study-mode-focus-card relative isolate overflow-hidden rounded-[1.4rem] border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-3 shadow-md sm:p-4${expandedSections.focusProtection ? " is-expanded" : ""}`}>
            <div className="pointer-events-none absolute inset-x-8 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="study-mode-focus-header study-mode-expandable-header flex items-center gap-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border border-primary/15 bg-primary/10 text-primary shadow-inner">
                <ShieldCheck size={21} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold tracking-tight text-foreground">Focus Protection</span>
                  <span className={(draft.enabled || Boolean(status?.activeSession?.active))
                    ? "rounded-full bg-success/10 px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-success"
                    : "rounded-full bg-secondary px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-muted-foreground"}>
                    {loading ? "…" : draft.enabled || status?.activeSession?.active ? "ON" : "OFF"}
                  </span>
                </div>

              </div>
              <div className="study-mode-focus-controls ml-auto flex shrink-0 items-center gap-1.5">
                {status ? (
                  <Switch
                    checked={draft.enabled || Boolean(status.activeSession?.active)}
                    disabled={loading || saving || !isStudyModeNative()}
                    onCheckedChange={(enabled) => { void handleMasterToggle(enabled); }}
                    aria-label="Study Mode master switch"
                  />
                ) : (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{loading ? "…" : "—"}</span>
                )}

                {!permissionSetupOpen && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: MOTION.scale.press }}
                    disabled={saving || loading || !isStudyModeNative() || !hasUnsavedChanges}
                    onClick={() => { void handleSave(); }}
                    aria-label={saving ? "Saving Study Mode settings" : hasUnsavedChanges ? "Save Study Mode settings" : "Study Mode settings saved"}
                    className="motion-press inline-flex min-h-9 min-w-[76px] shrink-0 items-center justify-center gap-1.5 rounded-lg gradient-primary px-2.5 text-[10px] font-bold text-primary-foreground shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-45 sm:px-3"
                  >
                    <Check size={13} /> {saving ? "Saving…" : hasUnsavedChanges ? "Save" : "Saved"}
                  </motion.button>
                )}
                <button
                  type="button"
                  onClick={() => toggleSection("focusProtection")}
                  aria-controls="study-mode-focus-protection-content"
                  aria-expanded={expandedSections.focusProtection}
                  aria-label={expandedSections.focusProtection ? "Collapse Focus Protection" : "Expand Focus Protection"}
                  title={expandedSections.focusProtection ? "Collapse Focus Protection" : "Expand Focus Protection"}
                  className="study-mode-expand-toggle motion-press"
                >
                  <ChevronDown size={15} className={expandedSections.focusProtection ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
                </button>
              </div>
            </div>

            <div
              id="study-mode-focus-protection-content"
              className={`study-mode-expandable${expandedSections.focusProtection ? " is-expanded" : ""}`}
              aria-hidden={!expandedSections.focusProtection}
            >
              <div className="study-mode-expandable__inner">
                                <p className="study-mode-status-copy mb-3 text-[10px] leading-snug text-muted-foreground" role="status">
                  {loading ? "Loading…" : statusText(status)}
                </p>
                <div className="study-mode-focus-pro-control mb-3 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-semibold text-muted-foreground">Strict app protection</span>
                  <motion.button
                  type="button"
                  whileTap={{ scale: MOTION.scale.press }}
                  disabled={loading || saving || !isStudyModeNative() || status?.config.enabled !== true}
                  onClick={() => { void handleProToggle(); }}
                  aria-pressed={status?.proEnabled === true}
                  aria-label={status?.proEnabled ? "Turn PRO strict Study Mode off" : "Turn PRO strict Study Mode on"}
                  className={status?.proEnabled
                    ? "motion-press inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-primary/45 bg-primary/12 px-2.5 text-[9px] font-bold tracking-wide text-primary shadow-sm transition-colors disabled:opacity-45"
                    : "motion-press inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-border/65 bg-background/60 px-2.5 text-[9px] font-bold tracking-wide text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground disabled:opacity-45"}
                >
                  <LockKeyhole size={11} strokeWidth={2.2} />
                  <span>PRO</span>
                  <span>{status?.proEnabled ? "ON" : "OFF"}</span>
                </motion.button>
                </div>
                <div className="study-mode-focus-summary mt-3 grid grid-cols-[94px_minmax(0,1fr)] sm:grid-cols-[104px_minmax(0,1fr)] items-center gap-3 border-t border-border/55 pt-3 sm:gap-4 sm:pt-4">
              {activeSession ? (
                <>
                  <SessionCountdown session={activeSession} onExpired={handleSessionExpired} />
                  <div className="min-w-0 space-y-2.5">
                    <div>
                      <p className="text-[14px] font-bold capitalize tracking-tight text-foreground">{activeSession.sessionType} session</p>
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                        {activeSession.selectedPackageNames.length} apps · {activeSession.isEnforced ? "Enforced" : "Standard"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void handleEndSession(); }}
                      disabled={saving}
                      className="motion-press inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[1rem] border border-destructive/25 bg-destructive/5 px-3 py-2 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {saving ? "Ending…" : "End session"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <SessionDurationPreview durationSeconds={sessionDurationSeconds} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold capitalize tracking-tight text-foreground">{sessionType} focus</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {sessionDurationSeconds > 0 ? "Session duration" : "No time limit"}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/45 px-2.5 py-1 text-[9px] font-semibold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {sessionEnforced ? "Enforced" : "Standard"}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="study-mode-focus-status mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/55 pt-3">
              {status?.enforcementMode === "device_owner" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[9px] font-semibold text-success">
                  <ShieldCheck size={11} /> System enforcement
                </span>
              ) : status?.enforcementMode === "profile_owner" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[9px] font-semibold text-success">
                  <ShieldCheck size={11} /> Managed profile
                </span>
              ) : status?.enforcementMode === "focus_shield" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[9px] font-semibold text-warning">
                  <ShieldAlert size={11} /> Focus Shield
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[9px] font-semibold text-muted-foreground">
                  <LockKeyhole size={11} /> Android protection
                </span>
              )}
              {status?.monitoringServiceRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-semibold text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> Monitoring
                </span>
              )}
              {status?.scheduleActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[9px] font-semibold text-muted-foreground">
                  <CalendarDays size={11} /> Schedule active
                </span>
              )}
            </div>
              </div>
            </div>
          </section>


          {!activeSession && (
            <section className={`study-mode-session-card study-mode-card overflow-hidden rounded-[1.25rem] border border-border/70 bg-gradient-to-br from-card via-card to-primary/5 p-3 shadow-sm sm:p-3.5${expandedSections.focusSession ? " is-expanded" : ""}`}>
              <div className="study-mode-section-header study-mode-expandable-header mb-0">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock3 size={15} /></span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold tracking-tight text-foreground">Focus Session</h3>
                    <p className="study-mode-compact-summary text-[9px] text-muted-foreground">
                      {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} · {sessionDurationSeconds > 0 ? `${Math.round(sessionDurationSeconds / 60)} min` : "Unlimited"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSection("focusSession")}
                  aria-controls="study-mode-focus-session-content"
                  aria-expanded={expandedSections.focusSession}
                  aria-label={expandedSections.focusSession ? "Collapse Focus Session" : "Expand Focus Session"}
                  title={expandedSections.focusSession ? "Collapse Focus Session" : "Expand Focus Session"}
                  className="study-mode-expand-toggle motion-press"
                >
                  <ChevronDown size={15} className={expandedSections.focusSession ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
                </button>
              </div>

              <div
                id="study-mode-focus-session-content"
                className={`study-mode-expandable${expandedSections.focusSession ? " is-expanded" : ""}`}
                aria-hidden={!expandedSections.focusSession}
              >
                <div className="study-mode-expandable__inner pt-3">
              <div className="study-mode-session-fields grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
                <label className="min-w-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Session
                  <select
                    value={sessionType}
                    onChange={(event) => setSessionType(event.target.value as typeof sessionType)}
                    disabled={saving || loading}
                    className="mt-1.5 h-10 w-full rounded-[1.05rem] border border-border/70 bg-background/65 px-3 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="study">Study</option>
                    <option value="practice">Practice</option>
                    <option value="work">Work</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="min-w-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Duration
                  <select
                    value={sessionDurationSeconds}
                    onChange={(event) => setSessionDurationSeconds(Number(event.target.value))}
                    disabled={saving || loading}
                    className="mt-1.5 h-10 w-full rounded-[1.05rem] border border-border/70 bg-background/65 px-3 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  >
                    <option value={15 * 60}>15 min</option>
                    <option value={25 * 60}>25 min</option>
                    <option value={45 * 60}>45 min</option>
                    <option value={60 * 60}>60 min</option>
                    <option value={90 * 60}>90 min</option>
                    <option value={0}>Unlimited</option>
                  </select>
                </label>
              </div>
              <div className="study-mode-session-toggles mt-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
                <div className="flex min-h-11 items-center justify-between gap-2 rounded-[1.05rem] border border-border/65 bg-background/45 px-3">
                  <span className="text-[10px] font-medium text-foreground">Enforced</span>
                  <Switch checked={sessionEnforced} onCheckedChange={setSessionEnforced} disabled={saving || loading} aria-label="Enforced focus session" />
                </div>
                <div className="flex min-h-11 items-center justify-between gap-2 rounded-[1.05rem] border border-border/65 bg-background/45 px-3">
                  <span className="text-[10px] font-medium text-foreground">Do Not Disturb</span>
                  <Switch checked={sessionDnd} onCheckedChange={setSessionDnd} disabled={saving || loading} aria-label="Enable Do Not Disturb for session" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => { void handleStartSession(); }}
                disabled={saving || loading || !isStudyModeNative()}
                className="motion-press gradient-primary mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[1.1rem] px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm disabled:opacity-50"
              >
                <Clock3 size={15} /> {saving ? "Starting…" : "Start focus session"}
              </button>

              {sessionHistory.length > 0 && (
                <div className="mt-3 border-t border-border/55 pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent sessions</p>
                    <span className="text-[9px] text-muted-foreground">{sessionHistory.length} total</span>
                  </div>
                  <div className="space-y-1">
                    {sessionHistory.slice(0, 3).map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/35 px-2.5 py-2 text-[10px]">
                        <span className="min-w-0 truncate capitalize text-foreground">{session.sessionType} · {new Date(session.startTimestamp).toLocaleDateString()}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatSessionTime(session.elapsedSeconds)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </div>
              </div>
            </section>
          )}
          </div>

          <section aria-label="Periodic reminder interval" className="study-mode-reminder-card study-mode-card rounded-[1.15rem] border border-accent/15 bg-gradient-to-br from-card via-card to-accent/5 px-3 py-2 shadow-sm">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Clock3 size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-foreground">Reminder Interval</p>
                  <p className="text-[9px] text-muted-foreground">Repeat during non-study app use</p>
                </div>
              </div>
              <button type="button"
                onClick={() => setReminderIntervalOpen((open) => !open)}
                aria-expanded={reminderIntervalOpen}
                aria-label={`Reminder interval: ${reminderIntervalMinutes} minutes`}
                disabled={loading || !isStudyModeNative()}
                className="motion-press inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-accent/25 bg-background/75 px-3 text-[11px] font-bold tabular-nums text-foreground shadow-sm transition-colors hover:border-accent/45 hover:bg-accent/5 disabled:opacity-50">
                {reminderIntervalMinutes} min
                <ChevronDown size={13} className={`text-muted-foreground transition-transform duration-150 ${reminderIntervalOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            {reminderIntervalOpen && (
              <div className="mt-2.5 grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5 border-t border-border/55 pt-2.5" role="group" aria-label="Choose reminder interval">
                {Array.from({ length: 10 }, (_, index) => index + 1).map((minutes) => {
                  const selected = reminderIntervalMinutes === minutes;
                  return (
                    <button key={minutes} type="button" aria-pressed={selected}
                      disabled={reminderIntervalSaving}
                      onClick={() => handleReminderIntervalChange(minutes)}
                      className={selected
                        ? "motion-press flex min-h-10 min-w-0 items-center justify-center rounded-lg border border-accent/45 bg-accent/12 px-1 text-[10px] font-bold tabular-nums text-accent ring-1 ring-accent/15"
                        : "motion-press flex min-h-10 min-w-0 items-center justify-center rounded-lg border border-border/65 bg-background/70 px-1 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-accent/30 hover:bg-accent/5 hover:text-foreground disabled:opacity-50"}>
                      {minutes} min
                    </button>
                  );
                })}
              </div>
            )}
            {reminderIntervalSaving && <p className="mt-1.5 text-right text-[9px] text-muted-foreground" role="status">Saving…</p>}
          </section>

          <section aria-label="Screen Time Island" className="study-mode-card rounded-[1.15rem] border border-accent/15 bg-gradient-to-br from-card via-card to-accent/5 px-3 py-2 shadow-sm">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Smartphone size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-foreground">Screen Time Island</p>
                  <p className="text-[9px] text-muted-foreground">Today&apos;s usage of non-study apps</p>
                </div>
              </div>
              <Switch
                checked={screenTimeIslandEnabled}
                disabled={loading || screenTimeIslandSaving || !isStudyModeNative()}
                onCheckedChange={(enabled) => handleScreenTimeIslandChange(enabled)}
                aria-label="Enable Screen Time Island"
              />
            </div>

            <div aria-hidden="true" className="study-mode-island-preview mt-2 flex min-h-[58px] items-center justify-center overflow-hidden rounded-xl px-3 py-2">
              <div className="study-mode-island-preview__capsule">
                <span className="study-mode-island-preview__body" />
                <span className="study-mode-island-preview__collapsed">
                  <span className="study-mode-island-preview__mini-icon" />
                  <span className="study-mode-island-preview__dot" />
                </span>
                <span className="study-mode-island-preview__content">
                  <span className="study-mode-island-preview__icon" />
                  <span className="study-mode-island-preview__name">App name</span>
                  <span className="study-mode-island-preview__caption">Screen Time · Today</span>
                  <span className="study-mode-island-preview__divider" />
                  <span className="study-mode-island-preview__time"><b>20</b>min</span>
                  <span className="study-mode-island-preview__bars"><i /><i /><i /><i /></span>
                  <span className="study-mode-island-preview__bubble" />
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[9px] text-muted-foreground">Show a compact live usage island every</p>
              <button
                type="button"
                onClick={() => { void handleScreenTimeIslandPreview(); }}
                disabled={loading || screenTimeIslandPreviewing || !isStudyModeNative()}
                className="motion-press inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-background/75 px-3 text-[10px] font-bold text-accent transition-colors hover:border-accent/45 hover:bg-accent/5 disabled:opacity-45"
              >
                {screenTimeIslandPreviewing ? "Showing…" : "Preview"}
              </button>
            </div>

            <div className="mt-2 grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5 border-t border-border/55 pt-2.5" role="group" aria-label="Screen Time Island interval">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((minutes) => {
                const selected = screenTimeIslandIntervalMinutes === minutes;
                return (
                  <button key={minutes} type="button" aria-pressed={selected}
                    disabled={loading || screenTimeIslandSaving || !screenTimeIslandEnabled || !isStudyModeNative()}
                    onClick={() => handleScreenTimeIslandChange(screenTimeIslandEnabled, minutes)}
                    className={selected
                      ? "motion-press flex min-h-10 min-w-0 items-center justify-center rounded-lg border border-accent/45 bg-accent/12 px-1 text-[10px] font-bold tabular-nums text-accent ring-1 ring-accent/15 disabled:opacity-50"
                      : "motion-press flex min-h-10 min-w-0 items-center justify-center rounded-lg border border-border/65 bg-background/70 px-1 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-accent/30 hover:bg-accent/5 hover:text-foreground disabled:opacity-45"}>
                    {minutes} min
                  </button>
                );
              })}
            </div>

            {(!status?.permissions.overlay || !status.permissions.usageAccess) && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-2.5 py-2">
                <ShieldAlert size={13} className="shrink-0 text-warning" />
                <p className="min-w-0 flex-1 text-[9px] leading-relaxed text-muted-foreground">
                  Overlay and Usage Access are needed while Study Mode is enforcing.
                </p>
                <button type="button" onClick={() => setPermissionSetupOpen(true)}
                  className="motion-press min-h-10 shrink-0 rounded-lg border border-warning/30 px-2.5 text-[9px] font-semibold text-warning">
                  Set up
                </button>
              </div>
            )}

            <div className="mt-1.5 flex min-h-4 items-center justify-between gap-2">
              <p className="text-[9px] text-muted-foreground" role="status" aria-live="polite">
                {screenTimeIslandSaving ? "Saving Screen Time Island…" : screenTimeIslandEnabled ? "Enabled · global non-study app cadence" : "Disabled"}
              </p>
              {screenTimeIslandEnabled && <p className="text-[9px] font-semibold tabular-nums text-muted-foreground">{screenTimeIslandIntervalMinutes} min</p>}
            </div>
          </section>

          {status && !corePermissionsReady && (
            <section role="alert" className="study-mode-permission-alert flex items-center gap-2 rounded-[1.15rem] border border-warning/25 bg-warning/5 px-3 py-2.5">
              <ShieldAlert size={16} className="shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground">Blocking needs attention</p>
                <p className="mt-0.5 line-clamp-2 text-[9px] text-muted-foreground">
                  {permissionReadiness?.missing.join(" · ") || "Review Android permissions."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermissionSetupOpen(true)}
                className="motion-press min-h-9 shrink-0 rounded-lg border border-warning/35 px-2.5 text-[10px] font-semibold text-warning transition-colors hover:bg-warning/10"
              >
                Review
              </button>
            </section>
          )}

          <section aria-label="App collections" className="study-mode-app-collections">
            <button
              type="button"
              onClick={toggleBlockedPicker}
              aria-expanded={pickerOpen}
              aria-label={`Blocked Apps, ${selectedCount} selected`}
              className="study-mode-app-card study-mode-app-card--blocked border border-primary/15 bg-gradient-to-br from-card via-card to-primary/5 text-left shadow-sm transition-[border-color,transform,background-color] duration-200 hover:border-primary/30 active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <span className="study-mode-app-card__header">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold tracking-tight text-foreground">Blocked Apps</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{selectedCount} selected</span>
                </span>
                <span className="study-mode-app-card__count inline-flex min-w-8 items-center justify-center rounded-full bg-primary/10 px-2 text-[10px] font-bold tabular-nums text-primary ring-1 ring-primary/10">
                  {selectedCount}
                </span>
              </span>
              <span className="study-mode-app-card__summary">
                <span className="study-mode-app-card__icons" aria-hidden="true">
                  {selectedBlockedApps.slice(0, 3).map((app) => (
                    <span key={app.packageName} className="study-mode-app-card__icon">
                      <StudyModeAppIcon app={app} size={23} />
                    </span>
                  ))}
                </span>
                <span className="study-mode-app-card__saved-label">
                  {selectedCount === 0
                    ? "Select apps"
                    : selectedBlockedApps.length === 0
                      ? `${selectedCount} saved apps`
                      : selectedCount > Math.min(3, selectedBlockedApps.length)
                        ? `+${selectedCount - Math.min(3, selectedBlockedApps.length)} saved`
                        : "Saved apps"}
                </span>
                <span className="study-mode-app-card__arrow bg-primary/10 text-primary" aria-hidden="true">
                  <ChevronRight size={15} />
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={toggleStudyPicker}
              aria-expanded={studyPickerOpen}
              aria-label={`Study Apps, ${studyAppPackages.length} selected`}
              className="study-mode-app-card study-mode-app-card--study border border-accent/15 bg-gradient-to-br from-card via-card to-accent/5 text-left shadow-sm transition-[border-color,transform,background-color] duration-200 hover:border-accent/30 active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <span className="study-mode-app-card__header">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold tracking-tight text-foreground">Study Apps</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{studyAppPackages.length} selected</span>
                </span>
                <span className="study-mode-app-card__count inline-flex min-w-8 items-center justify-center rounded-full bg-accent/10 px-2 text-[10px] font-bold tabular-nums text-accent ring-1 ring-accent/10">
                  {studyAppPackages.length}
                </span>
              </span>
              <span className="study-mode-app-card__summary">
                <span className="study-mode-app-card__icons" aria-hidden="true">
                  {selectedStudyApps.slice(0, 3).map((app) => (
                    <span key={app.packageName} className="study-mode-app-card__icon">
                      <StudyModeAppIcon app={app} size={23} />
                    </span>
                  ))}
                </span>
                <span className="study-mode-app-card__saved-label">
                  {studyAppPackages.length === 0
                    ? "Select apps"
                    : selectedStudyApps.length === 0
                      ? `${studyAppPackages.length} saved apps`
                      : studyAppPackages.length > Math.min(3, selectedStudyApps.length)
                        ? `+${studyAppPackages.length - Math.min(3, selectedStudyApps.length)} saved`
                        : "Saved apps"}
                </span>
                <span className="study-mode-app-card__arrow bg-accent/10 text-accent" aria-hidden="true">
                  <ChevronRight size={15} />
                </span>
              </span>
            </button>
          </section>

          {pickerOpen && (
            <section className="study-mode-picker study-mode-card overflow-hidden rounded-[1.25rem] border border-primary/15 bg-card/70 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
                <Smartphone size={15} className="text-primary" />
                <span className="flex-1 text-xs font-bold text-foreground">Blocked Apps</span>
                {!selectionReady && (
                  <span className="text-[9px] text-muted-foreground" role="status">
                    {loading ? "Restoring saved selections…" : "Saved selections are unavailable; reopen Study Mode to retry."}
                  </span>
                )}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold text-muted-foreground">{selectedCount} selected</span>
                {selectedCount > 0 && (
                  <button type="button" onClick={() => updateDraft({ selectedPackageNames: [] })} disabled={!selectionReady || saving} className="motion-press rounded-lg px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2 p-2.5">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search apps"
                    aria-label="Search blocked apps"
                    className="h-10 w-full rounded-[1.05rem] border border-border/70 bg-background/65 pl-9 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                {appsLoading && apps.length > 0 && (
                  <p className="text-[9px] text-muted-foreground" role="status">Refreshing installed apps… selection is paused</p>
                )}
                {appsLoadError && apps.length > 0 && (
                  <button type="button" onClick={() => { void loadApps(true); }} className="text-left text-[9px] text-warning" role="alert">
                    {appsLoadError} · Tap to retry
                  </button>
                )}
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Filter installed apps">
                  {([
                    { id: "all", label: "All", count: appCounts.all },
                    { id: "user", label: "User", count: appCounts.user },
                    { id: "system", label: "System", count: appCounts.system },
                  ] as const).map((filter) => {
                    const active = appFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setAppFilter(filter.id)}
                        aria-pressed={active}
                        className={active
                          ? "flex min-h-9 items-center justify-center gap-1 rounded-lg bg-primary px-2 text-[10px] font-semibold text-primary-foreground shadow-sm"
                          : "flex min-h-9 items-center justify-center gap-1 rounded-lg bg-secondary/70 px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary"}
                      >
                        <span>{filter.label}</span>
                        <span className="tabular-nums opacity-80">{filter.count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid max-h-[340px] grid-cols-4 gap-1.5 overflow-y-auto pr-0.5 min-[420px]:grid-cols-5 sm:grid-cols-6 lg:grid-cols-7" role="group" aria-label="Select blocked apps">
                  {appsLoading && apps.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-xs text-muted-foreground">Loading apps…</p>
                  ) : appsLoadError && apps.length === 0 ? (
                    <button type="button" onClick={() => { void loadApps(true); }} className="col-span-full rounded-xl bg-secondary/60 p-4 text-center text-xs text-warning">
                      {appsLoadError} · Retry
                    </button>
                  ) : visibleApps.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                      {apps.length === 0 ? "No launcher-visible apps." : "No matching apps."}
                    </p>
                  ) : visibleApps.map((app) => (
                  <StudyModeAppTile
                    key={app.packageName}
                    app={app}
                    variant="blocked"
                    selected={selectedBlockedPackageSet.has(app.packageName)}
                    disabled={!selectionReady || saving || appsLoading || Boolean(appsLoadError)}
                    showEnforcementLabel={Boolean(status) && status.enforcementMode !== "focus_shield"}
                    enforcementLabel={suspendedPackages.has(app.packageName)
                      ? "Frozen"
                      : status?.scheduleActive ? "Not frozen" : "Scheduled"}
                    enforcementTone={suspendedPackages.has(app.packageName) ? "success" : "warning"}
                    onToggle={handleBlockedAppToggle}
                  />
                ))}
                </div>
              </div>
            </section>
          )}

          {studyPickerOpen && (
            <section className="study-mode-picker study-mode-card overflow-hidden rounded-[1.25rem] border border-accent/15 bg-card/70 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
                <BookOpen size={15} className="text-accent" />
                <span className="flex-1 text-xs font-bold text-foreground">Study Apps</span>
                {!selectionReady && (
                  <span className="text-[9px] text-muted-foreground" role="status">
                    {loading ? "Restoring saved selections…" : "Saved selections are unavailable; reopen Study Mode to retry."}
                  </span>
                )}
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">{studyAppPackages.length} selected</span>
                {studyAppPackages.length > 0 && (
                  <button type="button" onClick={() => setStudyAppPackages([])} disabled={!selectionReady || saving} className="motion-press rounded-lg px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2 p-2.5">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={studySearch}
                    onChange={(event) => setStudySearch(event.target.value)}
                    placeholder="Search study apps"
                    aria-label="Search Study Apps"
                    className="h-10 w-full rounded-[1.05rem] border border-border/70 bg-background/65 pl-9 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                {appsLoading && apps.length > 0 && (
                  <p className="text-[9px] text-muted-foreground" role="status">Refreshing installed apps… selection is paused</p>
                )}
                {appsLoadError && apps.length > 0 && (
                  <button type="button" onClick={() => { void loadApps(true); }} className="text-left text-[9px] text-warning" role="alert">
                    {appsLoadError} · Tap to retry
                  </button>
                )}
                <div className="grid max-h-[340px] grid-cols-4 gap-1.5 overflow-y-auto pr-0.5 min-[420px]:grid-cols-5 sm:grid-cols-6 lg:grid-cols-7" role="group" aria-label="Select Study Apps">
                  {appsLoading && apps.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-xs text-muted-foreground">Loading apps…</p>
                  ) : appsLoadError && apps.length === 0 ? (
                    <button type="button" onClick={() => { void loadApps(true); }} className="col-span-full rounded-xl bg-secondary/60 p-4 text-center text-xs text-warning">
                      {appsLoadError} · Retry
                    </button>
                  ) : visibleStudyApps.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                      {apps.length === 0 ? "No launcher-visible apps." : "No matching apps."}
                    </p>
                  ) : visibleStudyApps.map((app) => (
                  <StudyModeAppTile
                    key={app.packageName}
                    app={app}
                    variant="study"
                    selected={selectedStudyPackageSet.has(app.packageName)}
                    blocked={selectedBlockedPackageSet.has(app.packageName) || enforcedPackageSet.has(app.packageName)}
                    disabled={!selectionReady || saving || appsLoading || Boolean(appsLoadError)}
                    onToggle={handleStudyAppToggle}
                  />
                ))}
                </div>
              </div>
            </section>
          )}



          <section className={`study-mode-schedule-card study-mode-card rounded-[1.25rem] border border-border/70 bg-gradient-to-br from-card via-card to-primary/5 p-3 shadow-sm sm:p-3.5${expandedSections.studySchedule ? " is-expanded" : ""}`}>
            <div className="study-mode-section-header study-mode-expandable-header mb-0">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays size={15} /></span>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground">Study Schedule</h3>
                  <p className="study-mode-compact-summary text-[9px] text-muted-foreground">
                    {draft.selectedDays.length === 0 ? "No repeat days" : draft.selectedDays.length === 7 ? "Every day" : draft.selectedDays.length === 5 && [1,2,3,4,5].every((day) => draft.selectedDays.includes(day)) ? "Weekdays" : "Custom days"}
                    {" · "}{toTimeLabel(draft.startHour, draft.startMinute)}–{toTimeLabel(draft.endHour, draft.endMinute)}
                  </p>
                </div>
                {status?.scheduleActive && <span className="shrink-0 rounded-full bg-success/10 px-2 py-1 text-[8px] font-bold text-success">ACTIVE</span>}
              </div>
              <button
                type="button"
                onClick={() => toggleSection("studySchedule")}
                aria-controls="study-mode-study-schedule-content"
                aria-expanded={expandedSections.studySchedule}
                aria-label={expandedSections.studySchedule ? "Collapse Study Schedule" : "Expand Study Schedule"}
                title={expandedSections.studySchedule ? "Collapse Study Schedule" : "Expand Study Schedule"}
                className="study-mode-expand-toggle motion-press"
              >
                <ChevronDown size={15} className={expandedSections.studySchedule ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
              </button>
            </div>
            <div
              id="study-mode-study-schedule-content"
              className={`study-mode-expandable${expandedSections.studySchedule ? " is-expanded" : ""}`}
              aria-hidden={!expandedSections.studySchedule}
            >
              <div className="study-mode-expandable__inner pt-3">
            <div className="study-mode-schedule-times grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
              <button
                type="button"
                onClick={() => { void chooseTime("start"); }}
                disabled={!isStudyModeNative() || loading}
                className="motion-press flex min-h-[62px] min-w-0 flex-col justify-center gap-1 rounded-[1.05rem] border border-primary/15 bg-gradient-to-br from-background/75 to-primary/5 px-3 py-2.5 text-left transition-colors hover:border-primary/35 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Start
                </span>
                <span className="truncate font-display text-[17px] font-bold tabular-nums tracking-tight text-foreground">{toTimeLabel(draft.startHour, draft.startMinute)}</span>
              </button>
              <button
                type="button"
                onClick={() => { void chooseTime("end"); }}
                disabled={!isStudyModeNative() || loading}
                className="motion-press flex min-h-[62px] min-w-0 flex-col justify-center gap-1 rounded-[1.05rem] border border-accent/15 bg-gradient-to-br from-background/75 to-accent/5 px-3 py-2.5 text-left transition-colors hover:border-accent/35 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> End
                </span>
                <span className="truncate font-display text-[17px] font-bold tabular-nums tracking-tight text-foreground">{toTimeLabel(draft.endHour, draft.endMinute)}</span>
              </button>
            </div>

            <div className="study-mode-weekdays mt-3 flex items-center justify-between gap-2">
              <span className="sr-only">Repeat days</span>
              <div className="study-mode-weekday-grid grid w-full grid-cols-7 gap-1">
                {DAY_LABELS.map((day) => {
                  const selected = draft.selectedDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => updateDraft({
                        selectedDays: selected
                          ? draft.selectedDays.filter((value) => value !== day.value)
                          : [...draft.selectedDays, day.value].sort((a, b) => a - b),
                      })}
                      aria-label={day.name}
                      aria-pressed={selected}
                      className={selected
                        ? "motion-press h-9 min-w-0 rounded-[0.95rem] border border-primary bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm transition-colors"
                        : "motion-press h-9 min-w-0 rounded-[0.95rem] border border-border bg-background/35 px-1 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary/50"}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="study-mode-schedule-actions mt-2 flex flex-wrap justify-end gap-1.5">
              <button type="button" onClick={() => updateDraft({ selectedDays: [1, 2, 3, 4, 5] })} className="motion-press rounded-lg px-2 py-1.5 text-[9px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">Weekdays</button>
              <button type="button" onClick={() => updateDraft({ selectedDays: [1, 2, 3, 4, 5, 6, 7] })} className="motion-press rounded-lg px-2 py-1.5 text-[9px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">Every day</button>
              <button type="button" onClick={() => updateDraft({ selectedDays: [] })} className="motion-press rounded-lg px-2 py-1.5 text-[9px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">Clear</button>
            </div>
              </div>
            </div>
          </section>

          <section className="study-mode-permissions-card study-mode-card overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/65 shadow-sm">
            <button
              type="button"
              onClick={() => setPermissionsExpanded((value) => !value)}
              aria-expanded={permissionsExpanded}
              aria-label={permissionsExpanded ? "Collapse Android permissions" : "Expand Android permissions"}
              className="motion-press flex min-h-12 w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/35"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-foreground">Android permissions</span>
                <span className="block text-[9px] text-muted-foreground">
                  {permissionItems.filter((item) => item.granted).length} of {permissionItems.length} enabled
                </span>
              </span>
              {!corePermissionsReady && <span className="rounded-full bg-warning/10 px-2 py-1 text-[9px] font-semibold text-warning">Needs attention</span>}
              <ChevronDown size={15} className={permissionsExpanded ? "rotate-180 text-muted-foreground transition-transform" : "text-muted-foreground transition-transform"} />
            </button>
            {permissionsExpanded && (
              <div className="grid grid-cols-1 gap-1.5 border-t border-border/55 p-2 sm:grid-cols-2">
                {permissionItems.map((item) => {
                  const stateLabel = item.granted ? "Enabled" : item.required ? "Required" : "Optional";
                  const stateClass = item.granted
                    ? "text-success"
                    : item.required
                      ? "text-warning"
                      : "text-muted-foreground";
                  const Icon = item.key === "usage" ? Smartphone
                    : item.key === "overlay" ? ShieldCheck
                      : item.key === "battery" ? BatteryCharging
                        : item.key === "exactAlarm" ? Clock3
                          : item.key === "notifications" ? Bell
                            : Bell;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { void openPermission(item.key); }}
                      aria-label={item.title + ": " + stateLabel + ". " + item.helper}
                      className="motion-press flex min-h-12 items-center gap-2.5 rounded-xl border border-border/55 bg-background/35 px-2.5 py-2 text-left transition-colors hover:border-primary/30 hover:bg-secondary/35"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Icon size={14} /></span>
                      <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-foreground">{item.title}</span>
                      <span className={"shrink-0 text-[9px] font-bold " + stateClass}>{stateLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>


          {(message || refreshError) && (
            <p role="status" className="study-mode-message rounded-xl border border-border/70 bg-secondary/60 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
              {message || refreshError}
            </p>
          )}
        </>
      )}


    </div>
  );
};

export default StudyModePage;
