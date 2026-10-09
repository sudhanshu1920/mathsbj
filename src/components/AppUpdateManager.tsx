import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkForAppUpdate, installAppUpdate } from "@/lib/appUpdateService";
import { PWA_UPDATE_DISCOVERED_EVENT, UPDATE_AVAILABLE_EVENT } from "@/lib/appUpdateEvents";
import { validateReleaseManifest, type ReleaseManifest } from "@/lib/updateFeed";

interface AppUpdateManagerProps { isQuizActive: boolean; }
const DISMISSED_VERSION_KEY = "mathmaster.dismissed-update-version-code";
const AUTO_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

function readDismissedVersion(): number {
  try {
    const value = Number(localStorage.getItem(DISMISSED_VERSION_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch { return 0; }
}

function rememberDismissedVersion(versionCode: number): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, String(Math.max(readDismissedVersion(), versionCode)));
  } catch { /* Keep the current app session functional if storage is blocked. */ }
}

const AppUpdateManager = ({ isQuizActive }: AppUpdateManagerProps) => {
  const [update, setUpdate] = useState<ReleaseManifest | null>(null);
  const [installing, setInstalling] = useState(false);
  const queuedUpdate = useRef<ReleaseManifest | null>(null);
  const lastAutomaticCheckAt = useRef(0);
  const lastAutomaticCheckSucceeded = useRef(false);
  const mounted = useRef(true);

  const showUpdate = useCallback((candidate: unknown, force = false) => {
    let safeCandidate: ReleaseManifest;
    try { safeCandidate = validateReleaseManifest(candidate); }
    catch { return; }
    if (queuedUpdate.current?.versionCode === safeCandidate.versionCode) return;
    if (!force && safeCandidate.versionCode <= readDismissedVersion()) return;
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

    setInstalling(true);
    try {
      const result = await installAppUpdate(candidate);
      if (result.status === "started") {
        rememberDismissedVersion(candidate.versionCode);
        setUpdate(null);
        toast("Update download started", {
          description: "Android will ask you to install the update when the download finishes.",
        });
      } else if (result.status === "applying") {
        rememberDismissedVersion(candidate.versionCode);
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
    } finally { setInstalling(false); }
  }, [isQuizActive]);

  const dismissCurrentUpdate = useCallback(() => {
    if (update) rememberDismissedVersion(update.versionCode);
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

  useEffect(() => {
    mounted.current = true;
    void runCheck(false);
    const onUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ update?: unknown; force?: boolean }>).detail;
      if (detail?.update) showUpdate(detail.update, detail.force === true);
    };
    const onPwaUpdate = () => { void runCheck(false, true); };
    const onForeground = () => { if (document.visibilityState === "visible") void runCheck(false); };
    const onOnline = () => {
      if (document.visibilityState === "visible") void runCheck(false, false, true);
    };
    window.addEventListener(UPDATE_AVAILABLE_EVENT, onUpdateAvailable);
    window.addEventListener(PWA_UPDATE_DISCOVERED_EVENT, onPwaUpdate);
    window.addEventListener("focus", onForeground);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onForeground);
    return () => {
      mounted.current = false;
      window.removeEventListener(UPDATE_AVAILABLE_EVENT, onUpdateAvailable);
      window.removeEventListener(PWA_UPDATE_DISCOVERED_EVENT, onPwaUpdate);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onForeground);
    };
  }, [runCheck, showUpdate]);

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
            <p className="text-sm font-bold text-foreground">Version v{update.versionName} (build {update.versionCode})</p>
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
