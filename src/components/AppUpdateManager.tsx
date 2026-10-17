import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkForAppUpdate, downloadAppUpdate, installAppUpdate } from "@/lib/appUpdateService";
import { PWA_UPDATE_DISCOVERED_EVENT, UPDATE_AVAILABLE_EVENT } from "@/lib/appUpdateEvents";
import {
  addAndroidUpdateDownloadListener,
  type AndroidUpdateDownloadEvent,
} from "@/nativeAppUpdater";
import { validateReleaseManifest, type ReleaseManifest } from "@/lib/updateFeed";

interface AppUpdateManagerProps { isQuizActive: boolean; }
interface InstalledVersion { versionCode: number; versionName: string; }
type UpdateAction = "update" | "download";
const AUTO_CHECK_COOLDOWN_MS = 5 * 60 * 1000;
const FOREGROUND_EVENT_DEDUPE_MS = 1500;

const AppUpdateManager = ({ isQuizActive }: AppUpdateManagerProps) => {
  const [update, setUpdate] = useState<ReleaseManifest | null>(null);
  const [installedVersion, setInstalledVersion] = useState<InstalledVersion | null>(null);
  const [activeAction, setActiveAction] = useState<UpdateAction | null>(null);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const queuedUpdate = useRef<ReleaseManifest | null>(null);
  // "Later" only dismisses the current version for this running app session.
  const dismissedVersionCode = useRef(0);
  const actionInFlight = useRef(false);
  const activeActionRef = useRef<UpdateAction | null>(null);
  const installedVersionRef = useRef<InstalledVersion | null>(null);
  const lastAutomaticCheckAt = useRef(0);
  const lastAutomaticCheckSucceeded = useRef(false);
  const lastForegroundCheckAt = useRef(0);
  const mounted = useRef(true);
  const canSaveToDownloads = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const setAction = useCallback((action: UpdateAction | null) => {
    activeActionRef.current = action;
    setActiveAction(action);
  }, []);

  const showUpdate = useCallback((candidate: unknown) => {
    let safeCandidate: ReleaseManifest;
    try { safeCandidate = validateReleaseManifest(candidate); }
    catch { return; }
    if (safeCandidate.versionCode <= dismissedVersionCode.current) return;
    const installed = installedVersionRef.current;
    if (installed && safeCandidate.versionCode <= installed.versionCode) return;
    if (queuedUpdate.current?.versionCode === safeCandidate.versionCode) return;
    setUpdate((current) => current && current.versionCode >= safeCandidate.versionCode ? current : safeCandidate);
  }, []);

  const resetActionStatus = useCallback(() => {
    setDownloadStatus("");
    setDownloadProgress(null);
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
    if (actionInFlight.current || activeActionRef.current) return;
    actionInFlight.current = true;
    setAction("update");
    resetActionStatus();
    setDownloadStatus("Preparing and validating the latest release…");
    try {
      const result = await installAppUpdate(candidate);
      if (result.status === "started") {
        setDownloadStatus("Downloading the verified update APK…");
        setDownloadProgress(0);
      } else if (result.status === "applying") {
        setUpdate(null);
        setAction(null);
        toast("Applying update…", { description: "The app will reload to use the updated version." });
      } else if (result.status === "current") {
        setUpdate(null);
        setAction(null);
        toast("You're using the latest version.");
      } else if (result.status === "offline") {
        setAction(null);
        setDownloadStatus("You're offline. Reconnect and try again.");
        toast.error("Unable to check for updates. Please try again.");
      } else if (result.status === "unsupported") {
        setAction(null);
        setDownloadStatus("Updates are not supported in this app environment.");
        toast.error("Updates are not supported in this app environment.");
      } else {
        setAction(null);
        setDownloadStatus("The update could not be started. Please retry.");
        toast.error("Unable to start the update. Please try again.");
      }
    } catch (error) {
      setAction(null);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("INSTALL_PERMISSION_REQUIRED")) {
        setDownloadStatus("Allow Math App to install updates in Android settings, then tap Update Now again.");
        toast.error("Allow this app to install updates in Android settings, then tap Update Now again.");
      } else {
        setDownloadStatus("The update could not be started. Please retry.");
        toast.error("Unable to start the update. Please try again.");
      }
    } finally {
      actionInFlight.current = false;
    }
  }, [isQuizActive, resetActionStatus, setAction]);

  const performDownload = useCallback(async (candidate: ReleaseManifest) => {
    if (actionInFlight.current || activeActionRef.current) return;
    if (!canSaveToDownloads) {
      toast.error("Saving an APK to Downloads is available in the installed Android app.");
      return;
    }
    actionInFlight.current = true;
    setAction("download");
    resetActionStatus();
    setDownloadStatus("Preparing the latest APK for Downloads…");
    try {
      const result = await downloadAppUpdate(candidate);
      if (result.status === "started") {
        setDownloadStatus("Downloading APK to device storage…");
        setDownloadProgress(0);
      } else if (result.status === "current") {
        setAction(null);
        setUpdate(null);
        toast("You're using the latest version.");
      } else if (result.status === "offline") {
        setAction(null);
        setDownloadStatus("You're offline. Reconnect and retry the download.");
        toast.error("Unable to download the APK while offline.");
      } else if (result.status === "unsupported") {
        setAction(null);
        setDownloadStatus("APK download is only available in the Android app.");
        toast.error("APK download is only available in the Android app.");
      } else {
        setAction(null);
        setDownloadStatus("APK download failed. Check your connection and retry.");
        toast.error("Unable to download the APK. Please retry.");
      }
    } catch {
      setAction(null);
      setDownloadStatus("APK download failed. Check your connection and retry.");
      toast.error("Unable to download the APK. Please retry.");
    } finally {
      actionInFlight.current = false;
    }
  }, [canSaveToDownloads, resetActionStatus, setAction]);

  const dismissCurrentUpdate = useCallback(() => {
    if (activeActionRef.current) return;
    if (update) dismissedVersionCode.current = Math.max(dismissedVersionCode.current, update.versionCode);
    setUpdate(null);
    resetActionStatus();
  }, [update]);

  const runCheck = useCallback(async (manual = false, pwaSignal = false, force = false) => {
    const now = Date.now();
    if (!manual && !pwaSignal && !force) {
      const cooldown = lastAutomaticCheckSucceeded.current ? AUTO_CHECK_COOLDOWN_MS : 30_000;
      if (now - lastAutomaticCheckAt.current < cooldown) return;
      lastAutomaticCheckAt.current = now;
    } else if (pwaSignal || force) {
      lastAutomaticCheckAt.current = now;
    }

    try {
      const result = await checkForAppUpdate();
      if (!mounted.current) return;
      if (result.status === "available" || result.status === "current") {
        const current = { versionCode: result.currentVersionCode, versionName: result.currentVersionName };
        installedVersionRef.current = current;
        setInstalledVersion(current);
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
      if (mounted.current && manual) toast.error("Unable to check for updates. Please try again.");
    }
  }, [showUpdate]);

  const checkOnForeground = useCallback(() => {
    if (typeof document === "undefined" || document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastForegroundCheckAt.current < FOREGROUND_EVENT_DEDUPE_MS) return;
    lastForegroundCheckAt.current = now;
    void runCheck(false, false, true);
  }, [runCheck]);

  useEffect(() => {
    mounted.current = true;
    lastForegroundCheckAt.current = Date.now();
    void runCheck(false);
    const onUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ update?: unknown }>).detail;
      if (detail?.update) showUpdate(detail.update);
    };
    const onPwaUpdate = () => { void runCheck(false, true); };
    const onUpdateNotificationTapped = () => { void runCheck(false, false, true); };
    const onOnline = () => {
      if (document.visibilityState === "visible") void runCheck(false, false, true);
    };
    let disposed = false;
    let resumeListener: { remove: () => Promise<void> } | null = null;
    let downloadListener: { remove: () => Promise<void> } | null = null;
    const onDownloadState = (event: AndroidUpdateDownloadEvent) => {
      if (!activeActionRef.current) return;
      if (event.state === "downloading") {
        setDownloadStatus(activeActionRef.current === "download"
          ? "Downloading APK to device storage…"
          : "Downloading the verified update APK…");
        setDownloadProgress(event.progress);
      } else if (event.state === "paused") {
        setDownloadStatus("Download paused by Android. It will resume when network and device conditions allow.");
        setDownloadProgress(event.progress);
      } else if (event.state === "verifying") {
        setDownloadStatus("Verifying APK checksum, package, version and signing certificate…");
        setDownloadProgress(100);
      } else if (event.state === "installer_opened") {
        setAction(null);
        setUpdate(null);
        resetActionStatus();
        toast("Verified APK opened in Android installer.", {
          description: "Confirm installation in Android to finish the update.",
        });
      } else if (event.state === "saved_to_downloads") {
        setAction(null);
        setUpdate(null);
        resetActionStatus();
        toast("APK saved to device Downloads.", {
          description: event.fileName
            ? `Downloads/${event.fileName} — installation was not started.`
            : "Open the Downloads folder to install it later.",
        });
      } else if (event.state === "failed") {
        setAction(null);
        setDownloadProgress(null);
        setDownloadStatus(event.message || "APK download or verification failed. Please retry.");
        toast.error(event.message || "APK download or verification failed.");
      }
    };
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      void addAndroidUpdateDownloadListener(onDownloadState).then((handle) => {
        if (disposed) { if (handle) void handle.remove(); }
        else downloadListener = handle;
      }).catch(() => {
        // DownloadManager still reports failures; the action handler remains safe.
      });
      void App.addListener("resume", checkOnForeground).then((handle) => {
        if (disposed) void handle.remove();
        else resumeListener = handle;
      }).catch(() => {
        // Visibility/focus events are a fallback if the native lifecycle bridge fails.
      });
    }
    window.addEventListener(UPDATE_AVAILABLE_EVENT, onUpdateAvailable);
    window.addEventListener(PWA_UPDATE_DISCOVERED_EVENT, onPwaUpdate);
    window.addEventListener("app-update-notification-tapped", onUpdateNotificationTapped);
    window.addEventListener("focus", checkOnForeground);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", checkOnForeground);
    return () => {
      disposed = true;
      mounted.current = false;
      if (resumeListener) void resumeListener.remove();
      if (downloadListener) void downloadListener.remove();
      window.removeEventListener(UPDATE_AVAILABLE_EVENT, onUpdateAvailable);
      window.removeEventListener(PWA_UPDATE_DISCOVERED_EVENT, onPwaUpdate);
      window.removeEventListener("app-update-notification-tapped", onUpdateNotificationTapped);
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
      if (!open && update && !activeActionRef.current) dismissCurrentUpdate();
    }}>
      <DialogContent className="z-[100] w-[calc(100%-2rem)] max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl border-border/70 p-5">
        <DialogHeader className="space-y-2 text-left">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <span className="text-xl font-black">↻</span>
          </div>
          <DialogTitle className="font-display text-xl font-extrabold">New Update Available!</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            A new version of Math App is available. Choose how you want to update.
          </DialogDescription>
        </DialogHeader>
        {update && (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/40 p-3">
            <div className="space-y-1 text-sm">
              {installedVersion && (
                <p className="text-muted-foreground">
                  Current version: <span className="font-semibold text-foreground">v{installedVersion.versionName} (build {installedVersion.versionCode})</span>
                </p>
              )}
              <p className="text-foreground">
                Latest version: <span className="font-bold">v{update.versionName} (build {update.versionCode})</span>
              </p>
            </div>
            {update.releaseNotes && <p className="text-xs leading-relaxed text-muted-foreground">{update.releaseNotes}</p>}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Update Now downloads and verifies the APK before opening Android Installer. Download APK saves a verified file in Downloads and does not start installation.
            </p>
          </div>
        )}
        {activeAction && (
          <div className="space-y-2 rounded-xl border border-border/70 p-3" role="status" aria-live="polite">
            <p className="text-xs font-medium text-foreground">
              {downloadStatus || (activeAction === "download" ? "Downloading APK…" : "Updating Math App…")}
            </p>
            {downloadProgress !== null && (
              <div
                role="progressbar"
                aria-label="APK download progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={downloadProgress}
                className="h-2 overflow-hidden rounded-full bg-secondary"
              >
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${downloadProgress}%` }} />
              </div>
            )}
          </div>
        )}
        {!activeAction && downloadStatus && (
          <p className="text-xs leading-relaxed text-destructive" role="status">{downloadStatus}</p>
        )}
        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:space-x-0">
          <Button type="button" disabled={!!activeAction || !update} className="w-full rounded-xl" onClick={() => { if (update) void performUpdate(update); }}>
            {activeAction === "update" ? "Updating…" : "Update Now"}
          </Button>
          <Button type="button" variant="outline" disabled={!!activeAction || !update || !canSaveToDownloads} className="w-full rounded-xl" onClick={() => { if (update) void performDownload(update); }}>
            {activeAction === "download" ? "Downloading…" : "Download APK"}
          </Button>
          <Button type="button" variant="ghost" disabled={!!activeAction} className="w-full rounded-xl" onClick={dismissCurrentUpdate}>Later</Button>
        </DialogFooter>
        {!canSaveToDownloads && (
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            APK-to-Downloads is available in the installed Android app.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AppUpdateManager;
