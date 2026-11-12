import {
  BatteryCharging,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Smartphone,
  X,
  type LucideIcon,
} from "lucide-react";
import type { StudyModeStatus } from "@/lib/studyMode";
import { getStudyModePermissionReadiness } from "@/lib/studyModePermissions";

export type StudyModePermissionKey =
  | "usage"
  | "overlay"
  | "battery"
  | "exactAlarm"
  | "accessibility"
  | "notifications";

interface StudyModePermissionSetupProps {
  status: StudyModeStatus;
  onClose: () => void;
  onComplete: () => void;
  onOpenPermission: (permission: StudyModePermissionKey) => void;
  onRequestNotifications: () => Promise<boolean>;
}

interface PermissionCardItem {
  key: StudyModePermissionKey;
  title: string;
  description: string;
  granted: boolean;
  required: boolean;
  icon: LucideIcon;
  statusText?: string;
}

const StudyModePermissionSetup = ({
  status,
  onClose,
  onComplete,
  onOpenPermission,
  onRequestNotifications,
}: StudyModePermissionSetupProps) => {
  const permissions = status.permissions;
  const readiness = getStudyModePermissionReadiness(status);
  const advancedReady = readiness.advancedMonitoringRequested
    && permissions.accessibilitySnapshotReady === true;
  const managed = permissions.deviceOwner || permissions.profileOwner;
  const cards: PermissionCardItem[] = [
    {
      key: "usage",
      title: "Enable Usage Access",
      description: advancedReady && !permissions.usageAccess
        ? "Advanced window detection is active. Usage Access remains a useful fallback."
        : "Let Math Master detect which app is currently being used.",
      granted: permissions.usageAccess === true || managed,
      required: !readiness.monitoringReady && !readiness.advancedMonitoringRequested,
      icon: Smartphone,
      statusText: managed ? "Not required" : advancedReady && !permissions.usageAccess ? "Alternative active" : undefined,
    },
    {
      key: "overlay",
      title: "Allow Floating Window",
      description: "Allow Math Master to display the Study Mode blocking screen.",
      granted: readiness.overlayReady,
      required: !readiness.overlayReady,
      icon: ShieldCheck,
      statusText: managed ? "Not required" : undefined,
    },
    {
      key: "battery",
      title: "Allow Background Operation",
      description: "Optional. Review battery settings to reduce background restrictions. Android and device makers may still limit background work.",
      granted: permissions.batteryOptimizationIgnored === true,
      required: false,
      icon: BatteryCharging,
    },
    ...(permissions.accessibilityAvailable ? [{
      key: "accessibility" as const,
      title: "Enable Accessibility Service",
      description: advancedReady
        ? "Advanced multi-window detection is active."
        : "Optional Advanced feature for supported split-screen and pop-up windows. Requires an in-app privacy explanation and your agreement.",
      granted: advancedReady,
      required: readiness.advancedMonitoringRequested && !advancedReady,
      icon: ShieldCheck,
      statusText: readiness.advancedMonitoringRequested && !advancedReady ? "Checking windows…" : undefined,
    }] : []),
    ...(status.exactAlarmFallback ? [{
      key: "exactAlarm" as const,
      title: "Allow Exact Alarms",
      description: readiness.exactAlarmRequired
        ? "Required for this managed-device schedule. Open Android settings to allow precise scheduling."
        : "Optional on personal devices. Math Master uses an inexact fallback when Android does not grant this access.",
      granted: permissions.exactAlarm === true,
      required: readiness.exactAlarmRequired,
      icon: Clock3,
    }] : []),
    {
      key: "notifications",
      title: "Allow Notifications",
      description: "Optional. Show Study Mode and reminder notifications. Blocking can still run without this permission.",
      granted: permissions.notificationsEnabled === true,
      required: false,
      icon: Bell,
    },
  ];

  const requiredComplete = [
    readiness.monitoringReady,
    readiness.overlayReady,
    !readiness.exactAlarmRequired,
  ].filter(Boolean).length;
  const missingSummary = readiness.missing.length > 0
    ? readiness.missing.join(" · ")
    : "Required permissions are ready.";

  const handleCardPress = (key: StudyModePermissionKey) => {
    if (key === "notifications") {
      void onRequestNotifications();
      return;
    }
    onOpenPermission(key);
  };

  return (
    <section className="mx-auto flex min-h-[min(760px,calc(100dvh-7rem))] w-full max-w-2xl flex-col gap-4">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Study Mode setup
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Enable Study Mode
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Complete these quick steps to protect your study time.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close permission setup"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X size={19} />
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <span className="text-[11px] font-semibold text-foreground">Required setup progress</span>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-primary">
          {requiredComplete}/3 ready
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {cards.map((item) => {
          const stateText = item.statusText
            ?? (item.granted ? "Enabled" : item.required ? "Required" : "Optional");
          const stateClass = item.granted
            ? "bg-success/10 text-success"
            : item.required
              ? "bg-warning/10 text-warning"
              : "bg-secondary text-muted-foreground";
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleCardPress(item.key)}
              aria-label={item.title + ". " + stateText + ". " + item.description}
              className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-border/65 bg-card/65 px-3.5 py-3 text-left shadow-sm backdrop-blur-sm transition-colors hover:border-primary/35 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-snug text-foreground">
                  {item.title}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold " + stateClass}>
                  {item.granted && <Check size={11} />}
                  {stateText}
                </span>
                {!item.granted && <ChevronRight size={16} className="text-muted-foreground" />}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="sticky bottom-0 -mx-1 space-y-2 border-t border-border/60 bg-background/95 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        {!readiness.coreReady && (
          <p role="status" className="text-center text-[10px] leading-relaxed text-warning">
            {missingSummary}
          </p>
        )}
        {readiness.coreReady && (
          <p role="status" className="text-center text-[10px] text-success">
            Required permissions are ready. Optional permissions can be completed later.
          </p>
        )}
        <button
          type="button"
          onClick={onComplete}
          disabled={!readiness.coreReady}
          className="min-h-12 w-full rounded-xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Let&apos;s Go
        </button>
        <p className="text-center text-[9px] leading-relaxed text-muted-foreground">
          Permission status is checked by Android. You can change these permissions later in system settings.
        </p>
      </footer>
    </section>
  );
};

export default StudyModePermissionSetup;
