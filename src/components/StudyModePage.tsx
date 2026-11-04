import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, Clock3, LockKeyhole,
  Search, ShieldAlert, ShieldCheck, Smartphone, Bell,
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
  type StudyModeApp,
  type StudyModeStatus,
} from "@/lib/studyMode";
import {
  DEFAULT_STUDY_MODE_CONFIG,
  validateStudyModeSchedule,
  type StudyModeConfig,
} from "@/lib/studyModeSchedule";
import { MOTION } from "@/lib/motion";
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
  if (status?.enforcementState === "policy_unavailable" || status?.enforcementState === "policy_failed") {
    return "Android could not confirm that every suspended app is available";
  }
  if (!status?.config.enabled) return "Study Mode is off";
  if (status.enforcementState === "permission_required") return "Permission required — blocking is not active";
  if (status.enforcementState === "exact_alarm_required") return "Exact alarm access is required for safe system-level scheduling";
  if (status.enforcementState === "service_start_blocked") return "Android did not allow Focus Shield to start";
  if (status.enforcementState === "service_stopped") return "Android stopped Focus Shield — reopen Study Mode to retry";
  if (status.enforcementState === "overlay_failed") return "Android could not display the blocking overlay";
  if (status.enforcementState === "policy_failed") return "System suspension could not be applied";
  if (status.enforcementState === "partial_suspension") return "Some selected apps could not be suspended";
  if (status.enforcementState === "focus_shield_running") return "Focus Shield monitoring is active";
  if (status.enforcementState === "system_suspension") return "Android system-level suspension is active";
  if (status.enforcementState === "waiting_for_schedule") return "Enabled — waiting for the next study session";
  if (!status.scheduleActive) return "Enabled — outside scheduled hours";
  return "Study Mode enabled";
};

const StudyModePage = ({ onBack }: StudyModePageProps) => {
  const [draft, setDraft] = useState<StudyModeConfig>(DEFAULT_STUDY_MODE_CONFIG);
  const [status, setStatus] = useState<StudyModeStatus | null>(null);
  const [apps, setApps] = useState<StudyModeApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const savedSnapshot = useRef(configSnapshot(DEFAULT_STUDY_MODE_CONFIG));
  const isDirty = configSnapshot(draft) !== savedSnapshot.current;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const handleBack = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard unsaved Study Mode changes?")) return;
    onBackRef.current();
  }, []);

  const load = useCallback(async (reconcile = false) => {
    if (!isStudyModeNative()) {
      setLoading(false);
      setRefreshError("Study Mode controls require the installed Android app.");
      return;
    }
    try {
      const [nextStatus, installedApps] = await Promise.all([
        reconcile ? refreshStudyMode() : getStudyModeStatus(),
        getInstalledStudyModeApps(),
      ]);
      const available = new Set(installedApps.map((app) => app.packageName));
      const normalized: StudyModeConfig = {
        ...DEFAULT_STUDY_MODE_CONFIG,
        ...nextStatus.config,
        selectedPackageNames: nextStatus.config.selectedPackageNames.filter((name) => available.has(name)),
        selectedDays: [...nextStatus.config.selectedDays],
      };
      setApps(installedApps);
      setStatus(nextStatus);
      // Returning from Android permission settings must refresh actual system
      // grants without silently discarding edits still in this page.
      if (!dirtyRef.current) {
        setDraft(normalized);
        savedSnapshot.current = configSnapshot(normalized);
      }
      setRefreshError("");
    } catch {
      setRefreshError("Could not read Android Study Mode status. Reopen this page to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
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

  const selectedCount = draft.selectedPackageNames.length;
  const selectedNames = useMemo(() => {
    const names = new Map(apps.map((app) => [app.packageName, app.label]));
    return draft.selectedPackageNames.slice(0, 2).map((pkg) => names.get(pkg) ?? pkg);
  }, [apps, draft.selectedPackageNames]);
  const visibleApps = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return apps;
    return apps.filter((app) =>
      app.label.toLocaleLowerCase().includes(query)
      || app.packageName.toLocaleLowerCase().includes(query),
    );
  }, [apps, search]);

  const updateDraft = (patch: Partial<StudyModeConfig>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage("");
  };

  const toggleApp = (packageName: string) => {
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

  const handleMasterToggle = async (enabled: boolean) => {
    if (saving) return;
    if (!enabled) {
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
      key: "usage" as const,
      title: "Usage Access",
      granted: status?.permissions.usageAccess === true,
      required: status?.enforcementMode !== "device_owner",
      helper: "Detects which app is currently in the foreground.",
    },
    {
      key: "overlay" as const,
      title: "Display over other apps",
      granted: status?.permissions.overlay === true,
      required: !status?.permissions.deviceOwner && !status?.permissions.profileOwner,
      helper: "Shows the Study Mode shield over a selected app.",
    },
    {
      key: "notifications" as const,
      title: "Notification access",
      granted: status?.permissions.notificationAccess === true,
      required: draft.notificationBlockingEnabled,
      helper: "Dismisses clearable notifications from selected apps only.",
    },
    {
      key: "exactAlarm" as const,
      title: "Exact alarms",
      granted: status?.permissions.exactAlarm === true,
      required: false,
      helper: "Without this, Android may deliver schedule changes late.",
    },
  ];

  const openPermission = async (permission: "usage" | "overlay" | "notifications" | "exactAlarm") => {
    try {
      await openStudyModePermission(permission);
    } catch {
      setMessage("Android settings could not be opened for this permission.");
    }
  };

  return (
    <div className="space-y-4 min-w-0">
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

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/35 px-3 py-2.5">
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

      <div className="rounded-2xl border border-primary/25 bg-primary/[0.055] px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Study Mode</p>
            <p className="text-[11px] text-muted-foreground">{statusText(status)}</p>
          </div>
          <Switch
            checked={draft.enabled}
            disabled={loading || saving || !isStudyModeNative()}
            onCheckedChange={(enabled) => { void handleMasterToggle(enabled); }}
            aria-label="Study Mode master switch"
          />
        </div>
        {status?.enforcementMode === "device_owner" && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-success">
            <ShieldCheck size={13} /> Device Owner system-level enforcement
          </div>
        )}
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
            <div className="max-h-56 overflow-y-auto p-1.5">
              {loading ? (
                <p className="p-3 text-center text-xs text-muted-foreground">Loading installed apps…</p>
              ) : visibleApps.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">No matching apps found.</p>
              ) : visibleApps.map((app) => {
                const selected = draft.selectedPackageNames.includes(app.packageName);
                return (
                  <button
                    key={app.packageName}
                    type="button"
                    onClick={() => toggleApp(app.packageName)}
                    aria-pressed={selected}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/70"
                  >
                    <img src={app.iconDataUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{app.label}</span>
                    <span className={selected ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground" : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent"}>
                      <Check size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
              Only launchable user apps are listed. Math Master and critical system apps are excluded.
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
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

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Bell size={14} className="text-muted-foreground" /> Notification control
          </p>
          {status?.enforcementMode === "device_owner" ? (
            <span className="text-[10px] font-semibold text-success">System-managed</span>
          ) : (
            <Switch
              checked={draft.notificationBlockingEnabled}
              onCheckedChange={(enabled) => updateDraft({ notificationBlockingEnabled: enabled })}
              aria-label="Block notifications from selected apps"
            />
          )}
        </div>
        <div className="rounded-xl border border-border/70 bg-card/25 px-3 py-2 text-[10px] text-muted-foreground">
          {status?.enforcementMode === "device_owner"
            ? "Android hides notifications automatically while a selected app is system-suspended."
            : "Only clearable notifications from selected apps are dismissed. Dismissed notifications are not restored."}
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Android permissions</p>
        {permissionItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => { void openPermission(item.key); }}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-2.5 py-2 text-left transition-colors hover:border-primary/35"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-foreground">{item.title}{item.required ? " · required" : ""}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{item.helper}</span>
            </span>
            <span className={item.granted ? "shrink-0 text-[10px] font-semibold text-success" : item.required ? "shrink-0 text-[10px] font-semibold text-warning" : "shrink-0 text-[10px] font-semibold text-muted-foreground"}>
              {item.granted ? "Granted" : item.required ? "Required" : "Optional"}
            </span>
          </button>
        ))}
        {status?.enforcementMode === "device_owner" && (
          <p className="pt-1 text-[10px] text-success">This device is managed by an eligible Device Owner or Profile Owner.</p>
        )}
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
