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
  | "notifications"
  | "dnd";

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
      title: "Usage Access",
      description: managed
        ? "Managed device access."
        : advancedReady && !permissions.usageAccess
          ? "Advanced detection is active."
          : "Detect the app in use.",
      granted: permissions.usageAccess === true || managed,
      required: !readiness.monitoringReady && !readiness.advancedMonitoringRequested,
      icon: Smartphone,
      statusText: managed ? "Not required" : advancedReady && !permissions.usageAccess ? "Fallback" : undefined,
    },
    {
      key: "overlay",
      title: "Floating Window",
      description: managed
        ? "Not required for system suspension."
        : "Show the blocking screen.",
      granted: readiness.overlayReady,
      required: !readiness.overlayReady,
      icon: ShieldCheck,
      statusText: managed ? "Not required" : undefined,
    },
    {
      key: "battery",
      title: "Background Operation",
      description: "Review battery restrictions.",
      granted: permissions.batteryOptimizationIgnored === true,
      required: false,
      icon: BatteryCharging,
    },
    ...(permissions.accessibilityAvailable ? [{
      key: "accessibility" as const,
      title: "Accessibility Service",
      description: advancedReady
        ? "Advanced window detection is ready."
        : "Detect app windows in supported views.",
      granted: advancedReady,
      required: readiness.advancedMonitoringRequested && !advancedReady,
      icon: ShieldCheck,
      statusText: readiness.advancedMonitoringRequested && !advancedReady ? "First scan" : undefined,
    }] : []),
    ...(status.exactAlarmFallback ? [{
      key: "exactAlarm" as const,
      title: "Exact Alarms",
      description: readiness.exactAlarmRequired
        ? "Required for this managed schedule."
        : "Inexact scheduling remains available.",
      granted: permissions.exactAlarm === true,
      required: readiness.exactAlarmRequired,
      icon: Clock3,
    }] : []),
    {
      key: "notifications",
      title: "Notifications",
      description: "Study Mode and reminder alerts.",
      granted: permissions.notificationsEnabled === true,
      required: false,
      icon: Bell,
    },
  ];

  const handleCardPress = (key: StudyModePermissionKey) => {
    if (key === "notifications") {
      void onRequestNotifications();
      return;
    }
    onOpenPermission(key);
  };

  return (
    <section className="mx-auto flex min-h-[min(700px,calc(100dvh-7rem))] w-full max-w-2xl flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-sm">
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">Study Mode</p>
            <h2 className="mt-0.5 font-display text-[19px] font-bold tracking-tight text-foreground">Enable permissions</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close permission setup"
          className="motion-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/55 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X size={17} />
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/55 px-3 py-2.5 shadow-sm">
        <span className="text-[10px] font-semibold text-foreground">Required permissions</span>
        <span className={readiness.coreReady
          ? "inline-flex items-center gap-1 text-[10px] font-bold text-success"
          : "inline-flex items-center gap-1 text-[10px] font-bold text-warning"}>
          {readiness.coreReady ? <Check size={12} /> : <ShieldCheck size={12} />}
          {readiness.coreReady ? "Ready" : "Action needed"}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto pb-2 sm:grid-cols-2">
        {cards.map((item) => {
          const stateText = item.statusText
            ?? (item.granted ? "Enabled" : item.required ? "Required" : "Optional");
          const stateReady = item.granted || item.statusText === "Not required" || item.statusText === "Fallback";
          const stateClass = stateReady
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
              className="motion-press group flex min-h-[76px] min-w-0 items-center gap-2.5 rounded-[1.15rem] border border-border/70 bg-card/65 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold leading-snug text-foreground">{item.title}</span>
                <span className="mt-0.5 block line-clamp-1 text-[9px] leading-relaxed text-muted-foreground">{item.description}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={"rounded-full px-2 py-1 text-[8px] font-bold " + stateClass}>{stateText}</span>
                {!stateReady && <ChevronRight size={14} className="text-muted-foreground" />}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="sticky bottom-0 -mx-1 space-y-2 border-t border-border/60 bg-background/95 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {!readiness.coreReady ? (
          <p role="status" className="text-center text-[10px] leading-relaxed text-warning">
            {readiness.missing.join(" · ")}
          </p>
        ) : (
          <p role="status" className="text-center text-[10px] text-success">
            Required permissions are ready.
          </p>
        )}
        <button
          type="button"
          onClick={onComplete}
          disabled={!readiness.coreReady}
          className="motion-press gradient-primary min-h-12 w-full rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Let&apos;s Go
        </button>
      </footer>
    </section>
  );
};

export default StudyModePermissionSetup;
