import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkForAppUpdate, installAppUpdate } from "@/lib/appUpdateService";
import { PWA_UPDATE_DISCOVERED_EVENT, UPDATE_AVAILABLE_EVENT } from "@/lib/appUpdateEvents";
import { validateReleaseManifest, type ReleaseManifest } from "@/lib/updateFeed";

interface AppUpdateManagerProps { isQuizActive: boolean; }
interface InstalledVersion { versionCode: number; versionName: string; }
const AUTO_CHECK_COOLDOWN_MS = 5 * 60 * 1000;
const FOREGROUND_EVENT_DEDUPE_MS = 1500;

const AppUpdateManager = ({ isQuizActive }: AppUpdateManagerProps) => {
  const [update, setUpdate] = useState<ReleaseManifest | null>(null);
  const [installedVersion, setInstalledVersion] = useState<InstalledVersion | null>(null);
  const [installing, setInstalling] = useState(false);
  const queuedUpdate = useRef<ReleaseManifest | null>(null);
  // "Later" is scoped to the current running app session. A fresh app launch
  // rechecks the published manifest and can notify again if the update remains.
  const dismissedVersionCode = useRef(0);
  const installAttemptInFlight = useRef(false);
  const lastAutomaticCheckAt = useRef(0);
  const lastAutomaticCheckSucceeded = useRef(false);
  const lastForegroundCheckAt = useRef(0);
  const mounted = useRef(true);

  const showUpdate = useCallback((candidate: unknown) => {
    let safeCandidate: ReleaseManifest;
    try { safeCandidate = validateReleaseManifest(candidate); }
    catch { return; }
    if (queuedUpdate.current?.versionCode === safeCandidate.versionCode) return;
    if (safeCandidate.versionCode <= dismissedVersionCode.current) return;
    setUpdate((current) => current && current.versionCode >= safeCandidate.versionCode ? current : safeCandidate);
  }, []);

  const performUpdate = useCallback(async (candidate: ReleaseManifest) => {
    if (isQuizActive) {
      queuedUpdate.current = candidate;
      setUpdate(null);
      toast("Update queued", {
        description: "The update will start after the current quiz ends, so your session is not interrupted.",
      });
      return;
    }

    if (installAttemptInFlight.current) return;
    installAttemptInFlight.current = true;
    setInstalling(true);
    try {
      const result = await installAppUpdate(candidate);
      if (result.status === "started") {
        // Do not persist dismissal here. If installation is cancelled or fails,
        // the next foreground check should offer the same update again.
        setUpdate(null);
        toast("Update download started", {
          description: "Android will ask you to install the update when the download finishes.",
        });
      } else if (result.status === "applying") {
        setUpdate(null);
        toast("Applying update…", { description: "The app will reload to use the updated version." });
      } else if (result.status === "offline") {
        toast.error("Unable to check for updates. Please try again.");
      } else if (result.status === "unsupported") {
        toast.error("Updates are not supported in this app environment.");
      } else {
        toast.error("Unable to start the update. Please try again.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("INSTALL_PERMISSION_REQUIRED")) {
        toast.error("Allow this app to install updates in Android settings, then tap Update Now again.");
      } else {
        toast.error("Unable to start the update. Please try again.");
      }
    } finally {
      installAttemptInFlight.current = false;
      if (mounted.current) setInstalling(false);
    }
  }, [isQuizActive]);

  const dismissCurrentUpdate = useCallback(() => {
    if (update) dismissedVersionCode.current = Math.max(dismissedVersionCode.current, update.versionCode);
    setUpdate(null);
  }, [update]);

  const runCheck = useCallback(async (manual = false, pwaSignal = false, force = false) => {
    const now = Date.now();
    if (!manual && !pwaSignal && !force) {
      const cooldown = lastAutomaticCheckSucceeded.current
        ? AUTO_CHECK_COOLDOWN_MS
        : 30_000;
      if (now - lastAutomaticCheckAt.current < cooldown) return;
      lastAutomaticCheckAt.current = now;
    } else if (pwaSignal || force) {
      lastAutomaticCheckAt.current = now;
    }

    try {
      const result = await checkForAppUpdate();
      if (!mounted.current) return;
      if (result.status === "available" || result.status === "current") {
        setInstalledVersion({
          versionCode: result.currentVersionCode,
          versionName: result.currentVersionName,
        });
      }
      lastAutomaticCheckSucceeded.current =
        result.status === "available" || result.status === "current";
      if (result.status === "available") showUpdate(result.update);
      else if (pwaSignal && result.status === "current") showUpdate(result.latest);
      else if (manual && result.status === "current") toast("You're using the latest version.");
      else if (manual && (result.status === "offline" || result.status === "error")) {
        toast.error("Unable to check for updates. Please try again.");
      }
    } catch {
      lastAutomaticCheckSucceeded.current = false;
      // A failed automatic network check must never become an unhandled
      // rejection. Manual checks get explicit feedback; startup stays silent.
      if (mounted.current && manual) {
        toast.error("Unable to check for updates. Please try again.");
      }
    }
  }, [showUpdate]);

  const checkOnForeground = useCallback(() => {
    if (typeof document === "undefined" || document.visibilityState !== "visible") return;
    const now = Date.now();
    // Native resume can also fire focus/visibility events. Coalesce that one
    // foreground transition while still forcing a fresh manifest read.
    if (now - lastForegroundCheckAt.current < FOREGROUND_EVENT_DEDUPE_MS) return;
    lastForegroundCheckAt.current = now;
    void runCheck(false, false, true);
  }, [runCheck]);

  useEffect(() => {
    mounted.current = true;
    // Avoid repeating the startup check for the focus event that commonly
    // follows the initial page load.
    lastForegroundCheckAt.current = Date.now();
    void runCheck(false);
    const onUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ update?: unknown }>).detail;
      if (detail?.update) showUpdate(detail.update);
    };
    const onPwaUpdate = () => { void runCheck(false, true); };
    const onOnline = () => {
      if (document.visibilityState === "visible") void runCheck(false, false, true);
    };
    let disposed = false;
    let resumeListener: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("resume", checkOnForeground).then((handle) => {
        if (disposed) void handle.remove();
        else resumeListener = handle;
      }).catch(() => {
        // Visibility/focus events remain a fallback if the native listener fails.
      });
    }
    window.addEventListener(UPDATE_AVAILABLE_EVENT, onUpdateAvailable);
    window.addEventListener(PWA_UPDATE_DISCOVERED_EVENT, onPwaUpdate);
    window.addEventListener("focus", checkOnForeground);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", checkOnForeground);
    return () => {
      disposed = true;
      mounted.current = false;
      if (resumeListener) void resumeListener.remove();
      window.removeEventListener(UPDATE_AVAILABLE_EVENT, onUpdateAvailable);
      window.removeEventListener(PWA_UPDATE_DISCOVERED_EVENT, onPwaUpdate);
      window.removeEventListener("focus", checkOnForeground);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", checkOnForeground);
    };
  }, [runCheck, showUpdate, checkOnForeground]);

  useEffect(() => {
    if (isQuizActive || !queuedUpdate.current) return;
    const pending = queuedUpdate.current;
    queuedUpdate.current = null;
    void performUpdate(pending);
  }, [isQuizActive, performUpdate]);

  return (
    <Dialog open={!!update} onOpenChange={(open) => {
      if (!open && update && !installing) dismissCurrentUpdate();
    }}>
      <DialogContent className="z-[100] w-[calc(100%-2rem)] max-w-sm rounded-3xl border-border/70 p-5">
        <DialogHeader className="space-y-2 text-left">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <span className="text-xl font-black">↻</span>
          </div>
          <DialogTitle className="font-display text-xl font-extrabold">New Update Available!</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            A new version of Math App is available.
          </DialogDescription>
        </DialogHeader>
        {update && (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-secondary/40 p-3">
            <div className="space-y-1 text-sm">
              {installedVersion && (
                <p className="text-muted-foreground">
                  Current version: <span className="font-semibold text-foreground">v{installedVersion.versionName} (build {installedVersion.versionCode})</span>
                </p>
              )}
              <p className="text-foreground">
                New version: <span className="font-bold">v{update.versionName} (build {update.versionCode})</span>
              </p>
            </div>
            {update.releaseNotes && <p className="text-xs leading-relaxed text-muted-foreground">{update.releaseNotes}</p>}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={installing} className="flex-1 rounded-xl" onClick={dismissCurrentUpdate}>Later</Button>
          <Button type="button" disabled={installing || !update} className="flex-1 rounded-xl" onClick={() => { if (update) void performUpdate(update); }}>
            {installing ? "Starting…" : "Update Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppUpdateManager;
