import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, Clock3, LockKeyhole,
  Search, ShieldAlert, ShieldCheck, Smartphone, BookOpen,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  chooseStudyModeTime,
  getInstalledStudyModeApps,
  getStudyModeStatus,
  isStudyModeNative,
  openStudyModePermission,
  refreshStudyMode,
  saveStudyModeConfig,
  setStudyModeEnabled,
  startStudyModeSession,
  endStudyModeSession,
  getStudyModeSessionHistory,
  type StudyModeApp,
  type StudyModeSession,
  type StudyModeStatus,
} from "@/lib/studyMode";
import {
  DEFAULT_STUDY_MODE_CONFIG,
  validateStudyModeSchedule,
  type StudyModeConfig,
} from "@/lib/studyModeSchedule";
import { MOTION } from "@/lib/motion";
import {
  countStudyModeApps,
  filterStudyModeApps,
  type StudyModeAppFilter,
} from "@/lib/studyModeAppFilters";
import { m as motion } from "framer-motion";

interface StudyModePageProps {
  onBack: () => void;
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

  return <>{formatSessionTime(session.durationSeconds > 0 ? remainingSeconds : elapsedSeconds)}</>;
});

const statusText = (status: StudyModeStatus | null) => {
  if (!isStudyModeNative()) return "Available in the Android app";
  if (!status) return "Reading saved Study Mode state…";
  if (status?.enforcementState === "policy_unavailable" || status?.enforcementState === "policy_failed") {
    return "Android could not confirm that every suspended app is available";
  }
  if (status?.activeSession?.active) {
    if (status.enforcementState === "permission_required") return "Focus session active · app blocking permission required";
    if (status.enforcementState === "service_start_blocked") return "Focus session saved · Android blocked the monitoring service";
    if (status.enforcementState === "service_stopped") return "Focus session active · monitoring service is stopped";
    const label = status.activeSession.sessionType.charAt(0).toUpperCase()
      + status.activeSession.sessionType.slice(1);
    return label + " focus session active · continues in background";
  }
  if (!status?.config.enabled) return "Study Mode is off";
  if (status.enforcementState === "permission_required") return "Enable Usage Access and allow the blocking overlay";
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

const StudyModePage = ({ onBack }: StudyModePageProps) => {
  const [draft, setDraft] = useState<StudyModeConfig>(DEFAULT_STUDY_MODE_CONFIG);
  const [status, setStatus] = useState<StudyModeStatus | null>(null);
  const [apps, setApps] = useState<StudyModeApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsLoadError, setAppsLoadError] = useState("");
  const [studyAppPackages, setStudyAppPackages] = useState<string[]>([]);
  const [studyPickerOpen, setStudyPickerOpen] = useState(false);
  const [studySearch, setStudySearch] = useState("");
  const [loading, setLoading] = useState(true);
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
  const savedSnapshot = useRef(configSnapshot(DEFAULT_STUDY_MODE_CONFIG));
  const savedStudyAppsSnapshot = useRef("[]");
  const recoveryAttemptRef = useRef(false);
  const isDirty = configSnapshot(draft) !== savedSnapshot.current;
  const studyAppsSnapshot = JSON.stringify([...studyAppPackages].sort());
  const isStudyAppsDirty = studyAppsSnapshot !== savedStudyAppsSnapshot.current;
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
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const historyInFlightRef = useRef<Promise<void> | null>(null);
  const appCatalogRef = useRef<StudyModeApp[] | null>(null);
  const appCatalogLoadedRef = useRef(false);
  const appCatalogLoadInFlightRef = useRef<Promise<void> | null>(null);
  const statusRef = useRef<StudyModeStatus | null>(status);
  statusRef.current = status;

  // The app catalogue is not needed by the default collapsed screen. Fetch it
  // only when a picker is opened, and reuse the module-level cache on remount.
  const loadApps = useCallback((): Promise<void> => {
    if (!isStudyModeNative()) {
      setAppsLoadError("Installed apps are available only in the Android app.");
      return Promise.resolve();
    }
    if (appCatalogLoadedRef.current) return Promise.resolve();
    if (appCatalogLoadInFlightRef.current) return appCatalogLoadInFlightRef.current;

    setAppsLoading(true);
    setAppsLoadError("");
    const request = (async () => {
      try {
        const installedApps = await getInstalledStudyModeApps();
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
        if (isMountedRef.current) setAppsLoading(false);
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
    if (nextOpen) void loadApps();
  };

  const toggleStudyPicker = () => {
    const nextOpen = !studyPickerOpen;
    setStudyPickerOpen(nextOpen);
    if (nextOpen) void loadApps();
  };

  const load = useCallback((reconcile = true): Promise<void> => {
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
    void load(true);
    let disposed = false;
    let appResume: { remove: () => Promise<void> } | null = null;
    const refresh = () => { if (!disposed) void load(true); };
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
  }, [load]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("study-mode-page-state", { detail: { open: true } }));
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
      window.dispatchEvent(new CustomEvent("study-mode-page-state", { detail: { open: false } }));
      window.removeEventListener("study-mode-back", onBackRequest);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [handleBack]);


  const activeSession = status?.activeSession?.active ? status.activeSession : null;

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
  const visibleApps = useMemo(
    () => filterStudyModeApps(apps, appFilter, deferredSearch),
    [apps, appFilter, deferredSearch],
  );
  const visibleStudyApps = useMemo(
    () => filterStudyModeApps(apps, "all", deferredStudySearch),
    [apps, deferredStudySearch],
  );

  const updateDraft = (patch: Partial<StudyModeConfig>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage("");
  };

  const toggleApp = (packageName: string, selectable: boolean) => {
    if (!selectable || saving) return;
    const selected = draft.selectedPackageNames.includes(packageName);
    if (!selected && studyAppPackages.includes(packageName)) {
      const appName = apps.find((app) => app.packageName === packageName)?.label ?? packageName;
      if (!window.confirm(
        appName + " is currently selected in Study Apps. Move it to Blocked Apps? It will be removed from Study Apps."
      )) return;
      setStudyAppPackages((previous) => previous.filter((name) => name !== packageName));
    }
    updateDraft({
      selectedPackageNames: selected
        ? draft.selectedPackageNames.filter((name) => name !== packageName)
        : [...draft.selectedPackageNames, packageName],
    });
  };

  const toggleStudyApp = (packageName: string, selectable: boolean) => {
    if (!selectable || saving) return;
    const selected = studyAppPackages.includes(packageName);
    if (!selected && (draft.selectedPackageNames.includes(packageName)
      || (status?.enforcedPackages ?? []).includes(packageName))) {
      const appName = apps.find((app) => app.packageName === packageName)?.label ?? packageName;
      if (!window.confirm(
        appName + " is currently blocked. Move it to Study Apps? It will be removed from Blocked Apps and the current session's blocked selection."
      )) return;
      updateDraft({
        selectedPackageNames: draft.selectedPackageNames.filter((name) => name !== packageName),
      });
    }
    setStudyAppPackages((previous) => selected
      ? previous.filter((name) => name !== packageName)
      : [...previous, packageName]);
    setMessage("");
  };

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
    const validation = validateStudyModeSchedule(draft);
    if (validation) {
      setMessage(validation);
      return;
    }
    if (draft.selectedPackageNames.length === 0) {
      setMessage("Select at least one app to protect from distractions.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const nextStatus = await saveStudyModeConfig(draft, studyAppPackages);
      const savedConfig = { ...nextStatus.config, selectedDays: [...nextStatus.config.selectedDays] };
      const savedStudyApps = nextStatus.studyAppPackages ?? studyAppPackages.filter(
        (name) => !savedConfig.selectedPackageNames.includes(name));
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

  const handleMasterToggle = async (enabled: boolean) => {
    if (saving) return;
    if (!enabled) {
      if (status?.activeSession?.isEnforced && !window.confirm("End this enforced focus session and turn Study Mode off?")) return;
      setSaving(true);
      try {
        const nextStatus = await setStudyModeEnabled(false);
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

  const permissionItems = [
    {
      key: "usage" as const,
      title: "Usage Access",
      granted: status?.permissions.usageAccess === true,
      required: status?.enforcementMode !== "device_owner" && status?.enforcementMode !== "profile_owner",
      helper: "Monitors which app is in the foreground on a personal device. Android does not share screen text or window content.",
    },
    {
      key: "overlay" as const,
      title: "Display over other apps",
      granted: status?.permissions.overlay === true,
      required: !status?.permissions.deviceOwner && !status?.permissions.profileOwner,
      helper: "Shows the Study Mode shield over a selected app.",
    },
    {
      key: "exactAlarm" as const,
      title: "Exact alarms",
      granted: status?.permissions.exactAlarm === true,
      required: (status?.enforcementMode === "device_owner" || status?.enforcementMode === "profile_owner")
        && (draft.enabled || Boolean(status?.activeSession?.active)),
      helper: status?.enforcementMode === "device_owner" || status?.enforcementMode === "profile_owner"
        ? "Required for safely timed system-level app suspension and release."
        : "Without this, Android may deliver schedule changes late.",
    },
    {
      key: "dnd" as const,
      title: "Do Not Disturb",
      granted: status?.permissions.dndAccess === true,
      required: sessionDnd && !status?.permissions.dndAccess,
      helper: "Optional. Saves the original DND filter and restores it only if it is still managed by this session.",
    },
  ];

  const openPermission = async (permission: "usage" | "overlay" | "exactAlarm" | "dnd") => {
    try {
      await openStudyModePermission(permission);
    } catch {
      setMessage("Android settings could not be opened for this permission.");
    }
  };

  return (
    <div className="study-mode-page min-w-0 space-y-2.5 pb-2">
      <header className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to Settings"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/45 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft size={17} />
        </button>
        <h2 className="min-w-0 flex-1 font-display text-base font-bold text-foreground">Study Mode</h2>
        <LockKeyhole size={16} className="shrink-0 text-primary" />
      </header>

      <section className="rounded-xl border border-primary/25 bg-card/55 p-3 shadow-sm backdrop-blur-sm">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Study Mode</p>
            <p className="truncate text-[10px] text-muted-foreground" role="status">
              {loading ? "Loading…" : statusText(status)}
            </p>
          </div>
          {status ? (
            <Switch
              checked={draft.enabled || Boolean(status.activeSession?.active)}
              disabled={loading || saving || !isStudyModeNative()}
              onCheckedChange={(enabled) => { void handleMasterToggle(enabled); }}
              aria-label="Study Mode master switch"
            />
          ) : (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {loading ? "Loading…" : "Unavailable"}
            </span>
          )}
        </div>
        {status?.enforcementMode === "device_owner" && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-success">
            <ShieldCheck size={12} /> System-level enforcement
          </div>
        )}
        {status?.enforcementMode === "focus_shield" && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-warning">
            <ShieldAlert size={12} /> Best-effort app blocking
          </div>
        )}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/35">
          <button
            type="button"
            onClick={toggleBlockedPicker}
            aria-expanded={pickerOpen}
            className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/45"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Smartphone size={15} className="shrink-0 text-muted-foreground" />
              <span className="truncate text-xs font-semibold text-foreground">Blocked Apps</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {selectedCount}
              </span>
            </span>
            <ChevronDown size={16} className={pickerOpen ? "rotate-180 text-muted-foreground transition-transform" : "text-muted-foreground transition-transform"} />
          </button>
          {pickerOpen && (
            <div className="border-t border-border/60">
              <div className="relative p-2">
                <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search apps"
                  aria-label="Search blocked apps"
                  className="h-9 w-full rounded-lg border border-border/70 bg-background/75 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </div>
              <div className="grid grid-cols-3 gap-1 px-2 pb-2" role="group" aria-label="Filter installed apps">
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
                        ? "flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-lg bg-primary px-2 text-[10px] font-semibold text-primary-foreground"
                        : "flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-lg bg-secondary/65 px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary"}
                    >
                      <span>{filter.label}</span>
                      <span className="tabular-nums opacity-80">{filter.count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto border-t border-border/50 p-1.5 min-[480px]:grid-cols-2">
                {appsLoading ? (
                  <p className="col-span-full p-3 text-center text-xs text-muted-foreground">Loading apps…</p>
                ) : appsLoadError ? (
                  <button type="button" onClick={() => { void loadApps(); }} className="col-span-full p-3 text-center text-xs text-warning">
                    {appsLoadError} · Retry
                  </button>
                ) : visibleApps.length === 0 ? (
                  <p className="col-span-full p-3 text-center text-xs text-muted-foreground">
                    {apps.length === 0 ? "No launcher-visible apps." : "No matching apps."}
                  </p>
                ) : visibleApps.map((app) => {
                  const selected = draft.selectedPackageNames.includes(app.packageName);
                  return (
                    <button
                      key={app.packageName}
                      type="button"
                      onClick={() => toggleApp(app.packageName, app.selectable)}
                      disabled={!app.selectable || saving}
                      aria-pressed={selected}
                      aria-disabled={!app.selectable}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/65 disabled:cursor-not-allowed disabled:opacity-60 [content-visibility:auto] [contain-intrinsic-size:44px]"
                    >
                      {app.iconDataUrl ? (
                        <img src={app.iconDataUrl} alt="" loading="lazy" decoding="async" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                      ) : (
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                          {app.label.slice(0, 1).toLocaleUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{app.label}</span>
                      {selected && status?.enforcementMode !== "focus_shield" && (
                        <span className={suspendedPackages.has(app.packageName)
                          ? "shrink-0 rounded-md bg-success/10 px-1 py-0.5 text-[8px] font-semibold text-success"
                          : "shrink-0 rounded-md bg-warning/10 px-1 py-0.5 text-[8px] font-semibold text-warning"}>
                          {suspendedPackages.has(app.packageName) ? "Frozen" : status?.scheduleActive ? "Not frozen" : "Scheduled"}
                        </span>
                      )}
                      {selected && status?.enforcementMode === "focus_shield" && (
                        <span className="shrink-0 rounded-md bg-warning/10 px-1 py-0.5 text-[8px] font-semibold text-warning">Shield</span>
                      )}
                      {app.selectable ? (
                        <span className={selected
                          ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
                          : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent"}>
                          <Check size={11} />
                        </span>
                      ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground" aria-label="Protected app">
                          <LockKeyhole size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/50 px-3 py-1.5 text-[9px] text-muted-foreground">
                {apps.length} apps · Locked apps cannot be selected
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/35">
          <button
            type="button"
            onClick={toggleStudyPicker}
            aria-expanded={studyPickerOpen}
            className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/45"
          >
            <span className="flex min-w-0 items-center gap-2">
              <BookOpen size={15} className="shrink-0 text-primary" />
              <span className="truncate text-xs font-semibold text-foreground">Study Apps</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                {studyAppPackages.length}
              </span>
            </span>
            <ChevronDown size={16} className={studyPickerOpen ? "rotate-180 text-muted-foreground transition-transform" : "text-muted-foreground transition-transform"} />
          </button>
          {studyPickerOpen && (
            <div className="border-t border-border/60">
              <div className="relative p-2">
                <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={studySearch}
                  onChange={(event) => setStudySearch(event.target.value)}
                  placeholder="Search apps"
                  aria-label="Search Study Apps"
                  className="h-9 w-full rounded-lg border border-border/70 bg-background/75 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </div>
              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto p-1.5 min-[480px]:grid-cols-2">
                {appsLoading ? (
                  <p className="col-span-full p-3 text-center text-xs text-muted-foreground">Loading apps…</p>
                ) : appsLoadError ? (
                  <button type="button" onClick={() => { void loadApps(); }} className="col-span-full p-3 text-center text-xs text-warning">
                    {appsLoadError} · Retry
                  </button>
                ) : visibleStudyApps.length === 0 ? (
                  <p className="col-span-full p-3 text-center text-xs text-muted-foreground">
                    {apps.length === 0 ? "No launcher-visible apps." : "No matching apps."}
                  </p>
                ) : visibleStudyApps.map((app) => {
                  const selected = studyAppPackages.includes(app.packageName);
                  const blocked = draft.selectedPackageNames.includes(app.packageName)
                    || (status?.enforcedPackages ?? []).includes(app.packageName);
                  return (
                    <button
                      key={app.packageName}
                      type="button"
                      onClick={() => toggleStudyApp(app.packageName, app.selectable)}
                      disabled={!app.selectable || saving}
                      aria-pressed={selected}
                      aria-disabled={!app.selectable}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/65 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {app.iconDataUrl ? (
                        <img src={app.iconDataUrl} alt="" loading="lazy" decoding="async" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                      ) : (
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                          {app.label.slice(0, 1).toLocaleUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{app.label}</span>
                      {blocked && !selected && (
                        <span className="shrink-0 text-[9px] font-semibold text-warning">Move</span>
                      )}
                      {app.selectable ? (
                        <span className={selected
                          ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
                          : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent"}>
                          <Check size={11} />
                        </span>
                      ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground" aria-label="Protected app">
                          <LockKeyhole size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/50 px-3 py-1.5 text-[9px] text-muted-foreground">
                {studyAppPackages.length} selected
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="space-y-2 rounded-xl border border-border/70 bg-card/45 p-3 shadow-sm backdrop-blur-sm">
        <div className="flex min-h-7 items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Clock3 size={14} className="text-muted-foreground" /> Focus session
          </p>
          {activeSession && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success">ACTIVE</span>
          )}
        </div>

        {activeSession ? (
          <>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  <SessionCountdown session={activeSession} onExpired={handleSessionExpired} />
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeSession.durationSeconds > 0 ? "Remaining" : "Elapsed"} · {activeSession.sessionType}
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-secondary/75 px-2.5 py-1.5 text-[10px] font-medium text-foreground">
                {activeSession.selectedPackageNames.length} apps
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground">
              Started {new Date(activeSession.startTimestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {activeSession.isEnforced ? " · Enforced stop" : " · Standard"}
            </p>
            <button
              type="button"
              onClick={() => { void handleEndSession(); }}
              disabled={saving}
              className="min-h-10 w-full rounded-lg border border-destructive/35 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {saving ? "Ending…" : "End Session"}
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0 text-[10px] font-medium text-muted-foreground">
                Session
                <select
                  value={sessionType}
                  onChange={(event) => setSessionType(event.target.value as typeof sessionType)}
                  disabled={saving || loading}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="study">Study</option>
                  <option value="practice">Practice</option>
                  <option value="work">Work</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-medium text-muted-foreground">
                Duration
                <select
                  value={sessionDurationSeconds}
                  onChange={(event) => setSessionDurationSeconds(Number(event.target.value))}
                  disabled={saving || loading}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value={15 * 60}>15 minutes</option>
                  <option value={25 * 60}>25 minutes</option>
                  <option value={45 * 60}>45 minutes</option>
                  <option value={60 * 60}>60 minutes</option>
                  <option value={90 * 60}>90 minutes</option>
                  <option value={0}>Unlimited</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5">
                <span className="text-[10px] font-medium text-foreground">Enforced</span>
                <Switch checked={sessionEnforced} onCheckedChange={setSessionEnforced} disabled={saving || loading} aria-label="Enforced focus session" />
              </div>
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5">
                <span className="text-[10px] font-medium text-foreground">Do Not Disturb</span>
                <Switch checked={sessionDnd} onCheckedChange={setSessionDnd} disabled={saving || loading} aria-label="Enable Do Not Disturb for session" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { void handleStartSession(); }}
              disabled={saving || loading || !isStudyModeNative()}
              className="min-h-11 w-full rounded-lg gradient-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Starting…" : "Start Focus Session"}
            </button>
          </>
        )}
        {sessionHistory.length > 0 && !activeSession && (
          <div className="border-t border-border/60 pt-2">
            <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">Recent sessions</p>
            <div className="space-y-1">
              {sessionHistory.slice(0, 3).map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="min-w-0 truncate capitalize text-foreground">{session.sessionType} · {new Date(session.startTimestamp).toLocaleDateString()}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatSessionTime(session.elapsedSeconds)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border/70 bg-card/35 p-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <CalendarDays size={14} className="text-muted-foreground" /> Study schedule
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { void chooseTime("start"); }}
            disabled={!isStudyModeNative() || loading}
            className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/35 px-3 py-2 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            <span className="text-[10px] text-muted-foreground">Start</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{toTimeLabel(draft.startHour, draft.startMinute)}</span>
          </button>
          <button
            type="button"
            onClick={() => { void chooseTime("end"); }}
            disabled={!isStudyModeNative() || loading}
            className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/35 px-3 py-2 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            <span className="text-[10px] text-muted-foreground">End</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{toTimeLabel(draft.endHour, draft.endMinute)}</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-muted-foreground">Repeat</span>
          <div className="flex flex-wrap items-center justify-end gap-1">
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
                    ? "h-10 w-10 shrink-0 rounded-full border border-primary bg-primary text-[11px] font-bold text-primary-foreground transition-colors"
                    : "h-10 w-10 shrink-0 rounded-full border border-border bg-transparent text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50"}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-4 text-[10px]">
          <button type="button" onClick={() => updateDraft({ selectedDays: [1, 2, 3, 4, 5] })} className="min-h-9 text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Weekdays</button>
          <button type="button" onClick={() => updateDraft({ selectedDays: [1, 2, 3, 4, 5, 6, 7] })} className="min-h-9 text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Every day</button>
          <button type="button" onClick={() => updateDraft({ selectedDays: [] })} className="min-h-9 text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Clear</button>
        </div>
      </section>

      <section className="space-y-1.5 rounded-xl border border-border/70 bg-card/35 p-3">
        <p className="text-xs font-semibold text-foreground">Android permissions</p>
        {permissionItems.map((item) => {
          const stateLabel = item.granted ? "Granted" : item.required ? "Required" : "Optional";
          const stateClass = item.granted
            ? "shrink-0 text-[10px] font-semibold text-success"
            : item.required
              ? "shrink-0 text-[10px] font-semibold text-warning"
              : "shrink-0 text-[10px] font-semibold text-muted-foreground";
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => { void openPermission(item.key); }}
              aria-label={item.title + ": " + stateLabel + ". " + item.helper}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border/55 px-2.5 py-1.5 text-left transition-colors hover:border-primary/35"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-foreground">{item.title}</span>
                <span className="block truncate text-[9px] text-muted-foreground">{item.helper}</span>
              </span>
              <span className={stateClass}>{stateLabel}</span>
            </button>
          );
        })}
        {status?.enforcementMode === "device_owner" && (
          <p className="pt-1 text-[9px] text-success">Managed device enforcement is available.</p>
        )}
        {status?.exactAlarmFallback && (
          <p className="pt-1 text-[9px] text-warning">Schedule boundaries may be delayed by Android.</p>
        )}
      </section>

      {(message || refreshError) && (
        <p role="status" className="rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-[10px] text-muted-foreground">
          {message || refreshError}
        </p>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: MOTION.scale.press }}
        disabled={saving || loading || !isStudyModeNative() || !hasUnsavedChanges}
        onClick={() => { void handleSave(); }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Check size={14} /> {saving ? "Applying…" : hasUnsavedChanges ? "Save & Apply" : "Saved"}
      </motion.button>
    </div>
  );
};

export default StudyModePage;
