import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, Clock3, LockKeyhole,
  Search, ShieldAlert, Smartphone,
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

const statusText = (status: StudyModeStatus | null) => {
  if (!isStudyModeNative()) return "Available in the Android app";
  if (!status) return "Reading saved Study Mode state…";
  if (status.activeSession?.active) {
    if (status.enforcementState === "permission_required") return "Session saved · grant Accessibility or Usage Access and overlay access";
    if (status.enforcementState === "accessibility_disconnected") return "Session active · reconnect Accessibility or grant Usage Access";
    if (status.enforcementState === "service_start_blocked") return "Session saved · Android blocked Focus Shield startup";
    if (status.enforcementState === "service_stopped") return "Session active · monitoring service is stopped";
    if (status.enforcementState === "overlay_failed") return "Session active · Android could not display the restriction screen";
    if (status.enforcementState === "focus_shield_running") return "Session active · best-effort Focus Shield";
    const label = status.activeSession.sessionType.charAt(0).toUpperCase()
      + status.activeSession.sessionType.slice(1);
    return label + " focus session active · continues in background";
  }
  if (!status.config.enabled) return "Study Mode is off";
  if (status.enforcementState === "permission_required") return "Enable Accessibility or Usage Access and allow the blocking overlay";
  if (status.enforcementState === "accessibility_disconnected") return "Accessibility is not connected · grant Usage Access as fallback";
  if (status.enforcementState === "focus_shield_starting") return "Starting Focus Shield…";
  if (status.enforcementState === "service_start_blocked") return "Android did not allow Focus Shield to start";
  if (status.enforcementState === "service_stopped") return "Monitoring service stopped · reopen Study Mode to retry";
  if (status.enforcementState === "overlay_failed") return "Android could not display the blocking overlay";
  if (status.enforcementState === "focus_shield_running") return "Focus Shield active · best-effort app restriction";
  if (status.enforcementState === "waiting_for_schedule") return "Enabled · waiting for the next study session";
  if (!status.scheduleActive) return "Enabled · outside scheduled hours";
  return "Study Mode enabled";
};

const StudyModePage = ({ onBack }: StudyModePageProps) => {
  const [draft, setDraft] = useState<StudyModeConfig>(DEFAULT_STUDY_MODE_CONFIG);
  const [status, setStatus] = useState<StudyModeStatus | null>(null);
  const [apps, setApps] = useState<StudyModeApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState<StudyModeAppFilter>("all");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [sessionType, setSessionType] = useState<"study" | "practice" | "work" | "custom">("study");
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(25 * 60);
  const [sessionEnforced, setSessionEnforced] = useState(false);
  const [sessionDnd, setSessionDnd] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<StudyModeSession[]>([]);
  const [sessionTick, setSessionTick] = useState(0);
  const savedSnapshot = useRef(configSnapshot(DEFAULT_STUDY_MODE_CONFIG));
  const recoveryAttemptRef = useRef(false);
  const isDirty = configSnapshot(draft) !== savedSnapshot.current;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const handleBack = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard unsaved Study Mode changes?")) return;
    onBackRef.current();
  }, []);

  const load = useCallback(async (reconcile = true) => {
    if (!isStudyModeNative()) {
      setLoading(false);
      setRefreshError("Study Mode controls require the installed Android app.");
      return;
    }
    try {
      const [nextStatus, installedApps, history] = await Promise.all([
        reconcile ? refreshStudyMode() : getStudyModeStatus(),
        getInstalledStudyModeApps(),
        getStudyModeSessionHistory(),
      ]);
      const available = new Set(installedApps.map((app) => app.packageName));
      const normalized: StudyModeConfig = {
        ...DEFAULT_STUDY_MODE_CONFIG,
        ...nextStatus.config,
        selectedPackageNames: nextStatus.config.selectedPackageNames.filter((name) => available.has(name)
          && installedApps.some((app) => app.packageName === name && app.selectable)),
        selectedDays: [...nextStatus.config.selectedDays],
      };
      setApps(installedApps);
      setStatus(nextStatus);
      setSessionHistory(history);
      setSessionTick(0);
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
      }
      setRefreshError("");
    } catch (error) {
      setRefreshError(error instanceof Error && error.message
        ? error.message
        : "Could not read Android Study Mode status. Reopen this page to retry.");
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    if (!status?.activeSession?.active) {
      setSessionTick(0);
      return;
    }
    const timer = window.setInterval(() => setSessionTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status?.activeSession?.id, status?.activeSession?.active, status?.activeSession?.elapsedSeconds]);



  const formatSessionTime = (value: number) => {
    const total = Math.max(0, Math.floor(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  };

  const activeSession = status?.activeSession?.active ? status.activeSession : null;
  const sessionElapsedSeconds = (activeSession?.elapsedSeconds ?? 0) + sessionTick;
  const sessionRemainingSeconds = activeSession && activeSession.durationSeconds > 0
    ? Math.max(0, activeSession.durationSeconds - sessionElapsedSeconds)
    : 0;

  useEffect(() => {
    if (!activeSession || activeSession.durationSeconds <= 0 || sessionRemainingSeconds > 0) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void refreshStudyMode().then(async (nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
        const history = await getStudyModeSessionHistory();
        if (active) setSessionHistory(history);
      }).catch(() => {
        if (active) setMessage("The session reached its timer boundary. Refresh Study Mode to verify completion.");
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeSession?.id, activeSession?.durationSeconds, sessionRemainingSeconds]);

  const selectedCount = draft.selectedPackageNames.length;
  const selectedNames = useMemo(() => {
    const names = new Map(apps.map((app) => [app.packageName, app.label]));
    return draft.selectedPackageNames.slice(0, 2).map((pkg) => names.get(pkg) ?? pkg);
  }, [apps, draft.selectedPackageNames]);
  const appCounts = useMemo(() => countStudyModeApps(apps), [apps]);
  const visibleApps = useMemo(
    () => filterStudyModeApps(apps, appFilter, search),
    [apps, appFilter, search],
  );

  const updateDraft = (patch: Partial<StudyModeConfig>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage("");
  };

  const toggleApp = (packageName: string, selectable: boolean) => {
    if (!selectable || saving) return;
    const selected = draft.selectedPackageNames.includes(packageName);
    updateDraft({
      selectedPackageNames: selected
        ? draft.selectedPackageNames.filter((name) => name !== packageName)
        : [...draft.selectedPackageNames, packageName],
    });
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
      const nextStatus = await saveStudyModeConfig(draft);
      const savedConfig = { ...nextStatus.config, selectedDays: [...nextStatus.config.selectedDays] };
      setStatus(nextStatus);
      setDraft(savedConfig);
      savedSnapshot.current = configSnapshot(savedConfig);
      setMessage("Study Mode settings saved.");
    } catch {
      setMessage("Settings could not be saved. Your previous configuration is unchanged.");
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
      if (isDirty) {
        configStatus = await saveStudyModeConfig(draft);
        const savedConfig = { ...configStatus.config, selectedDays: [...configStatus.config.selectedDays] };
        setDraft(savedConfig);
        savedSnapshot.current = configSnapshot(savedConfig);
        setStatus(configStatus);
      }

      const nextStatus = await startStudyModeSession({
        sessionType,
        durationSeconds: sessionDurationSeconds,
        enforced: sessionEnforced,
        shouldEnableDnd: sessionDnd,
      });
      setStatus(nextStatus);
      setSessionTick(0);
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
      setSessionTick(0);
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
    if (isDirty) {
      setMessage("Save your changed apps and schedule before turning Study Mode on.");
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
      key: "accessibility" as const,
      title: "Accessibility tracking",
      granted: status?.permissions.accessibility === true,
      required: false,
      helper: status?.permissions.accessibilityConnected
        ? "Connected · detects foreground package transitions only; never reads screen text or window content."
        : "Optional primary detector. Enable manually in Android Accessibility settings; detects only package names.",
    },
    {
      key: "usage" as const,
      title: "Usage Access",
      granted: status?.permissions.usageAccess === true,
      required: !status?.permissions.accessibility,
      helper: status?.permissions.accessibility
        ? "Fallback if Accessibility disconnects. Detection may be delayed."
        : "Fallback foreground event history if Accessibility is not enabled.",
    },
    {
      key: "overlay" as const,
      title: "Display over other apps",
      granted: status?.permissions.overlay === true,
      required: true,
      helper: "Required to show the restriction screen over a selected app.",
    },
    {
      key: "exactAlarm" as const,
      title: "Exact alarms",
      granted: status?.permissions.exactAlarm === true,
      required: false,
      helper: "Optional. Without this, Android may deliver scheduled boundaries late.",
    },
    {
      key: "notifications" as const,
      title: "Notifications",
      granted: status?.permissions.notifications === true,
      required: false,
      helper: "Optional. The ongoing Focus Shield notification may be hidden when denied.",
    },
    {
      key: "battery" as const,
      title: "Battery background access",
      granted: status?.permissions.batteryOptimizationExempt === true,
      required: false,
      helper: "Optional manufacturer guidance. Change only if Android or the device repeatedly stops monitoring.",
    },
    {
      key: "dnd" as const,
      title: "Do Not Disturb",
      granted: status?.permissions.dndAccess === true,
      required: sessionDnd && !status?.permissions.dndAccess,
      helper: "Optional. Saves the previous DND filter and restores it only if this session still owns the change.",
    },
  ];

  const openPermission = async (permission: "accessibility" | "usage" | "overlay" | "exactAlarm" | "notifications" | "battery" | "dnd") => {
    try {
      await openStudyModePermission(permission);
    } catch {
      setMessage("Android settings could not be opened for this permission.");
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to Settings"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-foreground">Study Mode</h2>
          <p className="text-[11px] text-muted-foreground">Scheduled focus for selected apps</p>
        </div>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LockKeyhole size={17} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/35 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {selectedCount} {selectedCount === 1 ? "app selected" : "apps selected"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {selectedNames.length ? selectedNames.join(", ") + (selectedCount > 2 ? " +" + (selectedCount - 2) : "") : "No apps selected"}
          </p>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Smartphone size={15} />
        </span>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.055] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Study Mode</p>
            <p className="text-[11px] text-muted-foreground">{statusText(status)}</p>
          </div>
          {status ? (
            <Switch
              checked={draft.enabled || Boolean(status.activeSession?.active)}
              disabled={loading || saving || !isStudyModeNative()}
              onCheckedChange={(enabled) => { void handleMasterToggle(enabled); }}
              aria-label="Study Mode master switch"
            />
          ) : (
            <span role="status" className="shrink-0 text-[10px] text-muted-foreground">
              {loading ? "Loading…" : "State unavailable"}
            </span>
          )}
        </div>
        {status?.enforcementMode === "focus_shield" && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ShieldAlert size={13} className="mt-0.5 shrink-0 text-warning" />
            Focus Shield is best-effort. The selected app may appear briefly before the shield.
          </div>
        )}
      </div>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-left transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone size={15} className="text-muted-foreground" /> Multiple Apps
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{selectedCount}</span>
          </span>
          <ChevronDown size={16} className={pickerOpen ? "rotate-180 text-muted-foreground transition-transform" : "text-muted-foreground transition-transform"} />
        </button>
        {pickerOpen && (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/30">
            <div className="relative border-b border-border/60 p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search installed apps"
                aria-label="Search installed apps"
                className="h-9 w-full rounded-lg border border-border/70 bg-background/70 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="grid grid-cols-3 gap-1 border-b border-border/60 p-2" role="group" aria-label="Filter installed apps">
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
                      ? "flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground"
                      : "flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-secondary/60 px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary"}
                  >
                    <span>{filter.label}</span>
                    <span className="tabular-nums opacity-80">{filter.count}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid max-h-64 grid-cols-1 gap-x-1 overflow-y-auto p-1.5 sm:grid-cols-2">
              {loading ? (
                <p className="p-3 text-center text-xs text-muted-foreground">Loading installed apps…</p>
              ) : visibleApps.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  {apps.length === 0 ? "No launcher-visible apps were returned by Android." : "No matching apps found in this category."}
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
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {app.iconDataUrl ? (
                      <img src={app.iconDataUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                    ) : (
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                        {app.label.slice(0, 1).toLocaleUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{app.label}</span>
                    <span className="shrink-0 rounded-md bg-secondary/70 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      {app.systemApp ? "System" : "User"}
                    </span>
                    {selected && (
                      <span className="shrink-0 rounded-md bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning">Shield only</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
              Showing {apps.length} launchable apps visible to Android. Pre-installed apps are included; protected device apps stay visible but cannot be selected.
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-primary/25 bg-primary/[0.035] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Clock3 size={14} className="text-muted-foreground" /> Focus session
          </p>
          {activeSession && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-semibold text-success">ACTIVE</span>
          )}
        </div>

        {activeSession ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                  {formatSessionTime(activeSession.durationSeconds > 0 ? sessionRemainingSeconds : sessionElapsedSeconds)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeSession.durationSeconds > 0 ? "Remaining" : "Elapsed"} · started {new Date(activeSession.startTimestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-semibold capitalize text-foreground">{activeSession.sessionType}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>{activeSession.selectedPackageNames.length} apps in this session</span>
              <span>{activeSession.isEnforced ? "Confirm before ending" : "Normal session"}</span>
            </div>
            <button
              type="button"
              onClick={() => { void handleEndSession(); }}
              disabled={saving}
              className="min-h-10 w-full rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {saving ? "Ending…" : "End Session"}
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-muted-foreground">
                Session type
                <select
                  value={sessionType}
                  onChange={(event) => setSessionType(event.target.value as typeof sessionType)}
                  disabled={saving || loading}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="study">Study</option>
                  <option value="practice">Practice</option>
                  <option value="work">Work</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="text-[10px] text-muted-foreground">
                Duration
                <select
                  value={sessionDurationSeconds}
                  onChange={(event) => setSessionDurationSeconds(Number(event.target.value))}
                  disabled={saving || loading}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-foreground">Confirm before ending</span>
              <Switch checked={sessionEnforced} onCheckedChange={setSessionEnforced} disabled={saving || loading} aria-label="Enforced focus session" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-foreground">Do Not Disturb</span>
              <Switch checked={sessionDnd} onCheckedChange={setSessionDnd} disabled={saving || loading} aria-label="Enable Do Not Disturb for session" />
            </div>
            <p className="text-[9px] text-muted-foreground">The timer uses the saved start time and continues when this page or Math Master closes.</p>
            <button
              type="button"
              onClick={() => { void handleStartSession(); }}
              disabled={saving || loading || !isStudyModeNative()}
              className="min-h-10 w-full rounded-lg gradient-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
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

      <section className="space-y-1.5">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Clock3 size={14} className="text-muted-foreground" /> Study schedule
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { void chooseTime("start"); }}
            disabled={!isStudyModeNative() || loading}
            className="flex min-w-0 items-center justify-between gap-1 rounded-xl border border-border/70 px-3 py-2.5 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            <span className="text-[10px] text-muted-foreground">Start</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{toTimeLabel(draft.startHour, draft.startMinute)}</span>
          </button>
          <button
            type="button"
            onClick={() => { void chooseTime("end"); }}
            disabled={!isStudyModeNative() || loading}
            className="flex min-w-0 items-center justify-between gap-1 rounded-xl border border-border/70 px-3 py-2.5 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            <span className="text-[10px] text-muted-foreground">End</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{toTimeLabel(draft.endHour, draft.endMinute)}</span>
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Overnight schedules continue into the following day.</p>
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <CalendarDays size={14} className="text-muted-foreground" /> Repeat days
        </p>
        <div className="flex items-center justify-between gap-1">
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
                className={selected ? "h-9 w-9 shrink-0 rounded-full border border-primary bg-primary text-xs font-bold text-primary-foreground transition-colors" : "h-9 w-9 shrink-0 rounded-full border border-border bg-transparent text-xs font-bold text-muted-foreground transition-colors hover:border-primary/50"}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-3 text-[10px]">
          <button type="button" onClick={() => updateDraft({ selectedDays: [1, 2, 3, 4, 5] })} className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Weekdays</button>
          <button type="button" onClick={() => updateDraft({ selectedDays: [1, 2, 3, 4, 5, 6, 7] })} className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Every day</button>
          <button type="button" onClick={() => updateDraft({ selectedDays: [] })} className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Clear</button>
        </div>
      </section>

      <section className="space-y-1.5">
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
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-2.5 py-1.5 text-left transition-colors hover:border-primary/35"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-foreground">{item.title}{item.required ? " · required" : ""}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{item.helper}</span>
              </span>
              <span className={stateClass}>{stateLabel}</span>
            </button>
          );
        })}
        {status?.exactAlarmFallback && (
          <p className="pt-1 text-[10px] text-warning">Exact alarm access is unavailable. Schedule boundaries may be delayed by Android.</p>
        )}
      </section>

      {(message || refreshError) && (
        <p role="status" className="rounded-lg bg-secondary/70 px-3 py-2 text-[11px] text-muted-foreground">
          {message || refreshError}
        </p>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: MOTION.scale.press }}
        disabled={saving || loading || !isStudyModeNative() || !isDirty}
        onClick={() => { void handleSave(); }}
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Check size={15} /> {saving ? "Applying…" : isDirty ? "Save & Apply" : "Saved"}
      </motion.button>
    </div>
  );
};

export default StudyModePage;
