import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const focusPath = new URL("../android-native/com/sudhanshu/mathsbj/StudyModeFocusService.java", import.meta.url);
const managerPath = new URL("../android-native/com/sudhanshu/mathsbj/StudyModeManager.java", import.meta.url);
const pagePath = new URL("../src/components/StudyModePage.tsx", import.meta.url);
const permissionSetupPath = new URL("../src/components/StudyModePermissionSetup.tsx", import.meta.url);
const source = readFileSync(focusPath, "utf8");
const manager = readFileSync(managerPath, "utf8");
const page = readFileSync(pagePath, "utf8");
const permissionSetup = readFileSync(permissionSetupPath, "utf8");
const registry = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeWindowRegistry.java", import.meta.url), "utf8");
const accessibility = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeAccessibilityService.java", import.meta.url), "utf8");
const alarmReceiver = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeAlarmReceiver.java", import.meta.url), "utf8");
const usageAccumulator = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeUsageAccumulator.java", import.meta.url), "utf8");
const islandDayUsage = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeDayUsage.java", import.meta.url), "utf8");
const islandSpring = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/ScreenTimeIslandSpring.java", import.meta.url), "utf8");
const islandPainter = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/ScreenTimeIslandPainter.java", import.meta.url), "utf8");
const islandOverlay = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/ScreenTimeIslandOverlay.java", import.meta.url), "utf8");
const studyModeTs = readFileSync(new URL("../src/lib/studyMode.ts", import.meta.url), "utf8");
const studyModeCss = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return text.slice(start, end);
}


test("periodic reminder intervals persist, validate 1–10 and apply without restarting Study Mode", () => {
  assert.ok(manager.includes('KEY_REMINDER_INTERVAL_MINUTES = "reminderIntervalMinutes"'));
  assert.ok(manager.includes('DEFAULT_REMINDER_INTERVAL_MINUTES = 2'));
  assert.ok(manager.includes("StudyModeUsageAccumulator.isValidInterval(value)"));
  assert.ok(manager.includes("StudyModeFocusService.onReminderIntervalChanged(context, value)"));
  assert.ok(source.includes("clearUnshownPeriodicReminderState(service)"));
  assert.ok(source.includes("if (service.periodicReminderVisible.get()) return;"));
  assert.ok(manager.includes('result.put("reminderIntervalMinutes", getReminderIntervalMinutes(context))'));
  assert.ok(page.includes("Array.from({ length: 10 }, (_, index) => index + 1)"));
  assert.ok(page.includes("!Number.isInteger(value) || value < 1 || value > 10"));
  assert.ok(page.includes("setStudyModeReminderInterval(value)"));
  assert.ok(usageAccumulator.includes("value >= 1 && value <= 10"));
});

test("usage accounting is monotonic, shared globally and pauses on uncertain focus", () => {
  for (const invariant of [
    "MAX_SAMPLE_GAP_MS = 4_000L", "elapsedRealtimeMs >= lastSampleElapsedMs",
    "synchronized void pause()", "synchronized void resetInterval()",
    "long thresholdMs = intervalMinutes * 60_000L",
    "enum State { STOPPED, RUNNING, PAUSED, REMINDER_PENDING, REMINDER_VISIBLE }",
  ]) assert.ok(usageAccumulator.includes(invariant), `Missing usage invariant: ${invariant}`);
  assert.ok(source.includes("SystemClock.elapsedRealtime()"));
  assert.ok(source.includes("StudyModeWindowRegistry.findFocusedPackage"));
  assert.ok(!source.includes("activePackage = foreground;"), "connected but incomplete Accessibility focus must not reuse cached UsageEvents package");
  const focusedPackageLookup = between(
    registry,
    "public static String findFocusedPackage(",
    "private static final class AccessibilityEventRecord",
  );
  assert.ok(focusedPackageLookup.includes("if (connected)"));
  assert.ok(focusedPackageLookup.includes("if (!fresh || !complete) return null;"));
  assert.ok(focusedPackageLookup.indexOf("if (connected)") < focusedPackageLookup.indexOf("if (usageForegroundPackage == null"));
  assert.ok(source.includes("StudyModeManager.isSelectedStudyAppPackage(StudyModeFocusService.this, activePackage)"));
  assert.ok(registry.includes("snapshotComplete"));
  assert.ok(registry.includes("window.focused"));
  assert.ok(source.includes("periodicReminderUsage.pause()"));
  assert.ok(source.includes("periodicReminderVisible.get()"));
  assert.ok(source.includes("!activePackage.equals(getPackageName())"));
});

test("Blocked Apps and Study Apps precedence is retained for periodic reminders", () => {
  const monitor = between(source, "private final Runnable monitorRunnable", "private void resetForegroundResolution()");
  assert.ok(monitor.includes("if (shouldShield)"));
  assert.ok(monitor.includes("StudyModeManager.isSelectedStudyAppPackage"));
  assert.ok(monitor.includes("StudyModeManager.isPeriodicReminderExemptPackage"));
  assert.ok(monitor.includes("boolean reminderDue = periodicReminderUsage.sample("));
  assert.ok(source.includes("suspendPeriodicReminderForBlockedApp()"));
  assert.ok(!monitor.includes('dismissPeriodicReminder("blocked_app"'));
  assert.ok(manager.includes("getEnforcedPackages(context).contains(packageName)"));
  assert.ok(manager.includes("Settings is intentionally not globally exempt."));
});

test("PRO uses the Study Apps allowlist in foreground and window enforcement, and clears on master OFF", () => {
  assert.ok(manager.includes('KEY_PRO_ENABLED = "proStrictModeEnabled"'));
  assert.ok(manager.includes("isProStrictModeActive(Context context)"));
  assert.ok(manager.includes("return !getStrictStudyAllowlist(context).contains(packageName);"));
  assert.ok(manager.includes("enabledEditor.putBoolean(KEY_PRO_ENABLED, false)"));
  assert.ok(manager.includes("getPolicyEnforcedPackages(Context context)"));
  assert.ok(manager.includes("PRO_ALLOWLIST_INVENTORY_FAILED"));
  assert.ok(source.includes("StudyModeManager.isPackageRestricted(\n                StudyModeFocusService.this, foreground)"));
  assert.ok(source.includes("void onProModeChanged()"));
  assert.ok(source.includes("StudyModeManager.isProStrictModeActive(this)"));
  assert.ok(registry.includes("StudyModeManager.isPackageRestricted(context, window.packageName)"));
  assert.ok(page.includes("setStudyModeProEnabled(enabled)"));
  assert.ok(page.includes("persistProAllowlist"));
  assert.ok(page.includes('aria-pressed={status?.proEnabled === true}'));
  const shield = between(
    source,
    "private android.view.View buildShieldView(String packageName)",
    "private android.view.View buildStudyAppShortcut(",
  );
  assert.ok(shield.includes("getStudyAppLabel(packageName)"));
  assert.ok(shield.includes("getStudyAppIcon(packageName)"));
  assert.ok(!shield.includes("Continue Anyway"));
});

test("a due interval remains latched across focus changes until the reminder is attached", () => {
  const sampling = between(usageAccumulator, "synchronized boolean sample(", "synchronized void setIntervalMinutes(");
  assert.ok(sampling.includes("if (accumulatedUsageMs < thresholdMs) return false;"));
  assert.ok(sampling.includes("if (state == State.REMINDER_PENDING) return true;"));
  assert.ok(sampling.includes("state = State.REMINDER_PENDING;"));
  assert.ok(!sampling.includes("resetInterval();"));
  const show = between(source, "private void showPeriodicReminder(", "private void restorePeriodicReminderOverlay(");
  assert.ok(show.indexOf("StudyModeManager.savePendingPeriodicReminder")
    < show.indexOf("windowManager.addView(candidate, periodicReminderWindowParams())"));
  assert.ok(show.includes("periodicReminderUsage.markReminderVisible()"));
});

test("periodic reminder is a separate persistent overlay; Continue Anyway resets the next interval", () => {
  assert.ok(source.includes("private final AtomicBoolean periodicReminderVisible = new AtomicBoolean(false)"));
  assert.ok(source.includes("private void showPeriodicReminder("));
  assert.ok(source.includes("private void dismissPeriodicReminder(String reason, boolean resetInterval)"));
  assert.ok(source.includes("periodicReminderVisible.compareAndSet(false, true)"));
  assert.ok(source.includes('dismissPeriodicReminder("continue_anyway", true)'));
  assert.ok(source.includes("StudyModeManager.launchStudyApp(StudyModeFocusService.this, packageName)"));
  assert.ok(source.includes("periodicReminderUsage.dismissReminder(resetInterval)"));
  assert.ok(source.includes("TYPE_APPLICATION_OVERLAY"));
  assert.ok(source.includes("dispatchKeyEvent(KeyEvent event)"));
  assert.ok(source.includes("KeyEvent.KEYCODE_BACK"));
  const restore = between(source, "private void restorePeriodicReminderOverlay()", "private android.view.View buildPeriodicReminderView(");
  assert.ok(restore.includes("shieldView != null || popupState != PopupState.IDLE"));
});

test("interval changes, OFF/expiry and service recovery preserve the correct timer state", () => {
  assert.ok(source.includes("void onReminderIntervalChanged(Context context, int intervalMinutes)"));
  assert.ok(source.includes("periodicReminderUsage.setIntervalMinutes(intervalMinutes)"));
  assert.ok(source.includes("periodicReminderUsage.clear()"));
  assert.ok(source.includes("periodicReminderUsage.pause()"));
  const destroy = between(source, "public void onDestroy()", "public IBinder onBind(");
  assert.ok(destroy.includes("periodicReminderUsage.clear()"));
  assert.ok(destroy.includes('dismissPeriodicReminder("service_destroyed", false)'));
  assert.ok(destroy.includes("StudyModeManager.saveReminderUsageMs(this, periodicReminderUsage.getAccumulatedUsageMs())"));
});

test("fake-clock model fires at the configured 1, 2, 5 and 10-minute eligible-usage threshold", () => {
  class Model {
    constructor(interval) { this.interval = interval; this.total = 0; this.last = null; this.state = "PAUSED"; }
    sample(pkg, at, eligible = true) {
      if (this.state === "STOPPED" || this.state === "REMINDER_VISIBLE") return false;
      if (this.state === "REMINDER_PENDING") return true;
      if (!eligible || !pkg || at <= 0) { this.last = null; this.state = "PAUSED"; return false; }
      if (this.last !== null && at >= this.last) {
        const delta = at - this.last;
        if (delta > 0 && delta <= 4000) this.total += delta;
      }
      this.last = at;
      this.state = "RUNNING";
      if (this.total < this.interval * 60000) return false;
      this.state = "REMINDER_PENDING";
      this.last = null;
      return true;
    }
    changeInterval(value) { this.interval = value; this.total = 0; this.last = null; this.state = "PAUSED"; }
    show() { this.total = 0; this.last = null; this.state = "REMINDER_VISIBLE"; }
    dismiss(reset) { if (reset) this.total = 0; this.last = null; this.state = "PAUSED"; }
    restore(total) { this.total = total; this.last = null; this.state = total >= this.interval * 60000 ? "REMINDER_PENDING" : "PAUSED"; }
  }
  for (const interval of [1, 2, 5, 10]) {
    const timer = new Model(interval);
    const threshold = interval * 60000;
    let dueAt = null;
    timer.sample("com.example.first", 1000);
    for (let at = 2000; at <= threshold + 1000; at += 1000) {
      const pkg = at < threshold / 2 ? "com.example.first" : "com.example.second";
      if (timer.sample(pkg, at) && dueAt === null) dueAt = at;
    }
    assert.equal(dueAt, threshold + 1000, `${interval}-minute timer fires once exact eligible usage accrues`);
    assert.equal(timer.state, "REMINDER_PENDING");
    assert.equal(timer.sample("com.example.third", threshold + 2000), true, "due reminder remains latched until attached");
  }
});

test("Study Apps, Blocked Apps, screen-off and uncertain focus pause without losing prior eligible usage", () => {
  const timer = new (class {
    total = 0; last = null; state = "PAUSED";
    sample(pkg, at, eligible = true) {
      if (this.state === "REMINDER_PENDING" || this.state === "REMINDER_VISIBLE") return this.state === "REMINDER_PENDING";
      if (!eligible || !pkg) { this.last = null; this.state = "PAUSED"; return false; }
      if (this.last !== null && at >= this.last) {
        const delta = at - this.last;
        if (delta > 0 && delta <= 4000) this.total += delta;
      }
      this.last = at; this.state = "RUNNING";
      if (this.total >= 120000) { this.state = "REMINDER_PENDING"; this.last = null; return true; }
      return false;
    }
  })();
  timer.sample("com.example.social", 1000);
  for (let at = 2000; at <= 31000; at += 1000) timer.sample("com.example.social", at);
  const beforePause = timer.total;
  timer.sample("com.example.notes", 32000, false);
  timer.sample("com.example.social", 90000);
  assert.equal(timer.total, beforePause, "Study Apps and long uncertain gaps are excluded");
  timer.sample("com.example.social", 91000, false);
  assert.equal(timer.total, beforePause, "screen-off and blocked packages are excluded");
});

test("Continue Anyway resets the next interval while interval edits reset shared usage", () => {
  const timer = {
    interval: 2, total: 45000, last: null, state: "RUNNING",
    change(value) { this.interval = value; this.total = 0; this.last = null; this.state = "PAUSED"; },
    dismiss(reset) { if (reset) this.total = 0; this.state = "PAUSED"; this.last = null; },
  };
  timer.change(5);
  assert.equal(timer.total, 0);
  timer.total = 30000;
  timer.dismiss(true);
  assert.equal(timer.total, 0);
  assert.ok(usageAccumulator.includes("intervalMinutes = value;"));
  assert.ok(manager.includes(".putLong(KEY_REMINDER_USAGE_MS, 0L)"));
});

test("accumulated usage survives service replacement without counting downtime; pending reminders restore", () => {
  const timer = {
    interval: 2, total: 119000, last: null, state: "PAUSED",
    restore(value) { this.total = value; this.last = null; this.state = value >= this.interval * 60000 ? "REMINDER_PENDING" : "PAUSED"; },
    sample(at) {
      if (this.state === "REMINDER_PENDING") return true;
      if (this.last !== null && at - this.last > 0 && at - this.last <= 4000) this.total += at - this.last;
      this.last = at; this.state = "RUNNING";
      if (this.total >= this.interval * 60000) { this.state = "REMINDER_PENDING"; return true; }
      return false;
    },
  };
  timer.restore(119000);
  assert.equal(timer.sample(900000), false, "service downtime is not included");
  assert.equal(timer.total, 119000);
  assert.equal(timer.sample(901000), true);
  assert.equal(timer.state, "REMINDER_PENDING");
  assert.ok(manager.includes("getReminderUsageMs(Context context)"));
  assert.ok(manager.includes("savePendingPeriodicReminder(Context context, String reminderId, String packageName)"));
  assert.ok(source.includes("StudyModeManager.getPendingPeriodicReminderId(this)"));
});

test("the reminder stays attached across focus changes and offers a real Study Apps picker handoff", () => {
  const dismiss = between(source, "private void dismissPeriodicReminder(", "private android.view.View buildShieldView(String packageName)");
  assert.ok(!source.includes('dismissPeriodicReminder("focused_app_changed"'));
  assert.ok(dismiss.includes("StudyModeManager.clearPendingPeriodicReminder(this)"));
  assert.ok(source.includes("refreshPeriodicReminderStudyApps()"));
  assert.ok(source.includes("StudyModeManager.openStudyAppsSelection(StudyModeFocusService.this)"));
  assert.ok(source.includes('dismissPeriodicReminder("study_apps_selection_opened", true)'));
  assert.ok(source.includes("StudyModeManager.launchStudyApp(StudyModeFocusService.this, packageName)"));
  assert.ok(manager.includes("KEY_OPEN_STUDY_APPS_PICKER"));
  assert.ok(page.includes("openStudyAppsPicker"));
  assert.ok(page.includes("setStudyPickerOpen(true)"));
  assert.ok(readFileSync(new URL("../src/pages/Index.tsx", import.meta.url), "utf8").includes("consumeStudyAppsPickerRequest"));
  const index = readFileSync(new URL("../src/pages/Index.tsx", import.meta.url), "utf8");
  assert.ok(index.includes("if (isPracticeSessionInProgress(practicePhase))"));
  assert.ok(index.includes("setStudyAppsPickerPending(true)"));
  assert.ok(index.includes("Study Apps will open after the current quiz."));
  assert.ok(index.includes("!studyAppsPickerPending || isPracticeSessionInProgress(practicePhase)"));
});

test("rapid interval edits are serialized and last choice wins", () => {
  assert.ok(page.includes("reminderIntervalSaveQueueRef.current"));
  assert.ok(page.includes("reminderIntervalRequestRef.current"));
  assert.ok(page.includes("request !== reminderIntervalRequestRef.current"));
});

test("advanced accessibility monitoring enumerates interactive app windows without reading screen content", () => {
  assert.ok(accessibility.includes("FLAG_RETRIEVE_INTERACTIVE_WINDOWS"));
  assert.ok(accessibility.includes("getWindowsOnAllDisplays()"));
  assert.ok(accessibility.includes("getWindows()"));
  assert.ok(accessibility.includes("AccessibilityWindowInfo.TYPE_APPLICATION"));
  assert.ok(accessibility.includes("root.getPackageName()"));
  assert.ok(accessibility.includes("window.isFocused()"));
  assert.ok(registry.includes("MAX_SNAPSHOT_AGE_MS"));
  assert.ok(registry.includes("snapshotComplete"));
  assert.ok(registry.includes("findBlockedPackage"));
  const blockedWindowLookup = between(
    registry,
    "public static String findBlockedPackage(",
    "static final class WindowRecord",
  );
  assert.ok(!blockedWindowLookup.includes("!snapshotComplete"));
  assert.ok(blockedWindowLookup.includes("snapshotAtElapsedMs"));
  assert.ok(blockedWindowLookup.includes("StudyModeManager.isPackageRestricted(context, window.packageName)"));
  assert.ok(accessibility.includes("snapshot.complete"));
  assert.ok(accessibility.includes("hasApplicationWindow"));
  assert.ok(accessibility.includes("IDLE_RESCAN_INTERVAL_MS"));
  assert.ok(accessibility.includes("nextDelayMs = IDLE_RESCAN_INTERVAL_MS"));
  assert.ok(source.includes("isAccessibilityWindowMonitoringRequired"));
  assert.ok(source.includes("hasForegroundLookupFailure()"));
  assert.ok(source.includes("boolean accessibilityWindowCoverageRequired ="));
  assert.ok(source.includes("StudyModeManager.isAccessibilityWindowMonitoringRequired(StudyModeFocusService.this);"));
  assert.ok(source.includes("if (accessibilityWindowCoverageRequired && !StudyModeWindowRegistry.hasFreshSnapshot()"));
  assert.ok(source.includes("an incomplete window list"));
  assert.ok(source.includes("cannot prove that no blocked split-screen pane exists"));
  assert.ok(source.includes("ACCESSIBILITY_WINDOW_SNAPSHOT_UNAVAILABLE"));
  assert.ok(manager.includes("accessibilityMonitoringReady"));
  assert.ok(manager.includes("(!usageGranted && (!accessibilityEnabled || !accessibilityConsent)) || !overlayGranted"));
  assert.ok(manager.includes("accessibilityEnabled && accessibilityConsent && !accessibilityMonitoringReady"));
  assert.ok(manager.includes("(!usageGranted || usageLookupFailed) && !accessibilityMonitoringReady"));
  assert.ok(manager.includes("accessibilityConsent"));
  assert.ok(registry.includes("StudyModeManager.isPackageRestricted(context, window.packageName)"));
  assert.ok(accessibility.includes("hasAccessibilityDisclosureConsent(this)"));
  const interrupt = accessibility.slice(accessibility.indexOf("public void onInterrupt()"), accessibility.indexOf("@Override", accessibility.indexOf("public void onInterrupt()") + 1));
  assert.ok(interrupt.includes("invalidateSnapshot()"));
  assert.ok(interrupt.includes("scheduleScan(RESCAN_INTERVAL_MS)"));
  assert.ok(!interrupt.includes("StudyModeWindowRegistry.clear()"));
  assert.ok(manager.includes("recordAccessibilityDisclosureConsent"));
  for (const forbidden of ["getText(", "getChild(", "performAction(", "takeScreenshot("]) {
    assert.ok(!accessibility.includes(forbidden), "Accessibility scanner must not collect text, traverse nodes, act, or take screenshots");
  }
});

test("foreground lookup retains a moving event cursor and bounds wide retries", () => {
  const resolver = between(source, "private String getMostRecentlyResumedPackage()", "private void showShield(");
  assert.ok(resolver.includes("EVENT_QUERY_OVERLAP_MS"));
  assert.ok(resolver.includes("EMPTY_INITIAL_LOOKUP_RETRY_MS"));
  assert.ok(resolver.includes("INITIAL_EVENT_LOOKBACK_MS"));
  assert.ok(resolver.includes("lastUsageEventScanTimeMs = now;"));
  assert.ok(!resolver.includes("initialForegroundLookup"));
});

test("an empty initial event stream keeps a bounded recent fallback window", () => {
  const resolver = between(source, "private String getMostRecentlyResumedPackage()", "private void showShield(");
  assert.ok(resolver.includes("else if (!hasResolvedForegroundOnce)"));
  assert.ok(resolver.includes("EMPTY_INITIAL_LOOKUP_FALLBACK_MS"));
});

test("an unresolved foreground package does not dismiss an existing shield", () => {
  const monitor = between(source, "private final Runnable monitorRunnable", "private void resetForegroundResolution()");
  const unknownBranch = between(
    monitor,
    "if (foreground == null || foreground.trim().isEmpty())",
    "boolean shouldShield",
  );
  assert.ok(unknownBranch.includes("return;"));
  assert.ok(!unknownBranch.includes("removeShield("));
});

test("new foreground decisions invalidate stale queued main-thread requests", () => {
  assert.ok(source.includes("AtomicLong foregroundDecisionSequence"));
  assert.ok(source.includes("decisionSequence != foregroundDecisionSequence.get()"));
  assert.ok(source.includes("newer_foreground_decision"));
  assert.ok(source.includes("foregroundDecisionSequence.incrementAndGet()"));
});

test("popup visibility requires an attached and shown overlay window", () => {
  const visibility = between(source, "private boolean isShieldViewVisible", "private android.view.View buildShieldView(String packageName)");
  for (const invariant of [
    "view.isAttachedToWindow()",
    "view.getWindowToken() != null",
    "view.getWindowVisibility()",
    "view.isShown()",
    "POPUP_WINDOW_VISIBLE",
  ]) assert.ok(visibility.includes(invariant), `Missing visibility invariant: ${invariant}`);
  assert.ok(source.includes("POPUP_LAUNCH_ACCEPTED"));
  assert.ok(source.includes("POPUP_LAUNCH_FAILED"));
});

test("failed overlay removal does not permit a second overlapping blocker", () => {
  const show = between(source, "private void showShield(", "private boolean isShieldViewVisible");
  const removal = between(source, "private void removeShield(String reason)", "private void logStage(");
  assert.ok(show.includes('removeShield("replacing_or_recovering");'));
  assert.ok(show.includes("previous_overlay_removal_failed"));
  assert.ok(removal.includes("windowManager.removeViewImmediate(existingView)"));
  assert.ok(removal.includes("popupState = PopupState.RECOVERY_REQUIRED;"));
  assert.ok(removal.includes('StudyModeManager.setServiceState(this, "overlay_failed")'));
});

test("popup failures back off, then periodically retry the same blocked package", () => {
  for (const invariant of [
    "MAX_POPUP_FAILURES_PER_FOREGROUND = 3",
    "POPUP_RETRY_FIRST_BACKOFF_MS",
    "POPUP_RETRY_SECOND_BACKOFF_MS",
    "POPUP_RETRY_RECOVERY_BACKOFF_MS = 30_000L",
    "failedPopupAttempts >= MAX_POPUP_FAILURES_PER_FOREGROUND",
    "POPUP_RETRY_CYCLE_REARMED",
    "recovery_backoff_elapsed",
    "resetPopupRetryState()",
  ]) assert.ok(source.includes(invariant), `Missing retry invariant: ${invariant}`);

  const retryGate = between(
    source,
    "private synchronized boolean shouldDeferPopupLaunch(",
    "private synchronized void recordPopupLaunchFailure(",
  );
  assert.ok(retryGate.indexOf("SystemClock.elapsedRealtime() < nextPopupRetryElapsedMs")
    < retryGate.indexOf("failedPopupAttempts >= MAX_POPUP_FAILURES_PER_FOREGROUND"));
  assert.ok(retryGate.includes("failedPopupAttempts = 0;"));
  assert.ok(retryGate.includes("return false;"));
});

test("popup retry state is synchronized across worker and UI threads", () => {
  assert.ok(source.includes("private synchronized void resetPopupRetryState()"));
  assert.ok(source.includes("private synchronized void resetPopupRetryStateForDifferentPackage(String packageName)"));
  assert.ok(source.includes("private synchronized boolean shouldDeferPopupLaunch(String packageName, String requestId)"));
  assert.ok(source.includes("private synchronized void recordPopupLaunchFailure(String packageName)"));
});
test("debug diagnostics include request context without reading screen content", () => {
  for (const invariant of [
    'event=" + stage',
    'sessionId=" + sessionId',
    'package=" + safePackage',
    'requestId=" + safeRequest',
    "ApplicationInfo.FLAG_DEBUGGABLE",
  ]) assert.ok(source.includes(invariant), `Missing diagnostic invariant: ${invariant}`);
  assert.ok(manager.includes("getActiveSessionId(Context context)"));
  assert.ok(!source.includes("getText()"));
  assert.ok(!source.includes("rootInActiveWindow"));
  assert.ok(!source.includes("AccessibilityNodeInfo"));
});

test("diagnostic session lookup is cached off the main-thread popup path", () => {
  assert.ok(source.includes("refreshDiagnosticSessionId(false)"));
  assert.ok(source.includes("lastDiagnosticSessionRefreshElapsedMs"));
  const logger = between(source, "private void logStage(", "public void onTaskRemoved(");
  assert.ok(!logger.includes("getActiveSessionId(this)"));
});

test("foreground lookup failures surface as unavailable while service is alive", () => {
  assert.ok(source.includes("hasForegroundLookupFailure()"));
  assert.ok(source.includes("foregroundLookupFailureForStatus = true;"));
  assert.ok(source.includes("foregroundLookupFailureForStatus = false;"));
  const status = between(manager, "public static JSObject getStatus(Context context)", "boolean exactFallback");
  assert.ok(status.indexOf("hasForegroundLookupFailure()") >= 0);
  assert.ok(status.indexOf("hasForegroundLookupFailure()") < status.indexOf("getMonitoringState()"));
  assert.ok(status.includes('"monitoring_unavailable".equals(monitorState)'));
  assert.ok(page.includes('status.enforcementState === "monitoring_unavailable"'));
  assert.ok(page.includes("grant Usage Access or enable Advanced window detection"));
});

test("service teardown preserves an overlay cleanup failure instead of overwriting it as stopped", () => {
  const destroy = between(source, "public void onDestroy()", "public IBinder onBind(");
  assert.ok(destroy.includes("boolean overlayCleanupFailed = shieldView != null;"));
  assert.ok(destroy.includes('overlayCleanupFailed ? "overlay_failed" : "service_stopped"'));
});

test("overlay launch failure is not reported as active blocking while the service stays alive", () => {
  const status = between(manager, "public static JSObject getStatus(Context context)", "boolean exactFallback");
  assert.ok(status.includes("StudyModeFocusService.getMonitoringState()"));
  assert.ok(status.includes('"overlay_failed".equals(monitorState)'));
  const healthState = between(source, "public static String getMonitoringState()", "public static boolean requestMonitorRecovery(");
  assert.ok(healthState.includes('return "overlay_failed"'));
  assert.ok(source.includes("overlayFailureForStatus = false;"));
});

test("decision generation changes only when the foreground restriction decision changes", () => {
  const monitor = between(source, "private final Runnable monitorRunnable", "private void resetForegroundResolution()");
  assert.ok(monitor.includes("boolean decisionChanged = !foreground.equals(lastDecisionPackage)"));
  assert.ok(monitor.includes("shouldShield != lastDecisionShouldShield"));
  assert.ok(monitor.includes("long decisionSequence = decisionChanged"));
  assert.ok(monitor.includes("? foregroundDecisionSequence.incrementAndGet()"));
  assert.ok(monitor.includes(": foregroundDecisionSequence.get()"));
  assert.ok(source.includes("verifiedRequestId, decisionSequence"));
  const verify = between(source, "private void verifyShieldVisibility(", "private android.view.View buildShieldView(String packageName)");
  assert.ok(verify.includes("decisionSequence != foregroundDecisionSequence.get()"));
  assert.ok(verify.includes("decision_changed_before_visibility_check"));
});


test("Accessibility events are retained as bounded positive package evidence", () => {
  assert.ok(registry.includes("ACCESSIBILITY_EVENT_TTL_MS = 2200L"));
  assert.ok(registry.includes("MAX_RECENT_ACCESSIBILITY_EVENTS = 8"));
  assert.ok(registry.includes("recordAccessibilityEvent("));
  assert.ok(registry.includes("recentAccessibilityEvents"));
  assert.ok(registry.includes("pruneRecentAccessibilityEventsLocked"));
  assert.ok(registry.includes("StudyModeManager.isPackageRestricted(context, packageName)"));
  assert.ok(registry.includes("wasRecentlyObservedAccessibilityEvent"));
  const lookup = between(
    registry,
    "public static String findBlockedPackage(",
    "private static final class AccessibilityEventRecord",
  );
  assert.ok(lookup.includes("eventSnapshot"));
  assert.ok(lookup.indexOf("eventSnapshot.size() - 1") < lookup.indexOf("for (WindowRecord window"));
  assert.ok(lookup.includes("snapshotFresh"));
});

test("Accessibility events wake the monitor without cancelling the periodic window scan", () => {
  const eventHandler = between(
    accessibility,
    "public void onAccessibilityEvent(AccessibilityEvent event)",
    "public void onInterrupt()",
  );
  assert.ok(eventHandler.includes("event.getPackageName()"));
  assert.ok(eventHandler.includes("event.getEventType()"));
  assert.ok(eventHandler.includes("event.getWindowId()"));
  assert.ok(eventHandler.includes("StudyModeWindowRegistry.recordAccessibilityEvent"));
  assert.ok(eventHandler.includes("StudyModeFocusService.requestImmediateEvaluation()"));
  assert.ok(eventHandler.includes("scheduleEventScan()"));
  assert.ok(!eventHandler.includes("scheduleScan("));

  const eventScheduler = between(
    accessibility,
    "private void scheduleEventScan()",
    "private void scanAccessibleWindows()",
  );
  assert.ok(eventScheduler.includes("if (eventScanQueued) return;"));
  assert.ok(eventScheduler.includes("EVENT_SCAN_MIN_INTERVAL_MS"));
  assert.ok(!eventScheduler.includes("removeCallbacks(scanRunnable)"));
  assert.ok(accessibility.includes("handler.postDelayed(this, nextDelayMs)"));
  assert.ok(accessibility.includes("handler.removeCallbacks(eventScanRunnable)"));
  for (const forbidden of ["TYPE_WINDOW_CONTENT_CHANGED", "getText(", "getChild(", "getSource(", "performAction(", "takeScreenshot("]) {
    assert.ok(!accessibility.includes(forbidden), "Accessibility monitoring must not read or traverse screen content");
  }
});

test("Accessibility package events trigger bounded immediate foreground reevaluation", () => {
  assert.ok(source.includes("activeService = this"));
  assert.ok(source.includes("public static void requestImmediateEvaluation()"));
  assert.ok(source.includes("AtomicBoolean immediateEvaluationQueued"));
  assert.ok(source.includes("MIN_IMMEDIATE_RECHECK_INTERVAL_MS = 250L"));
  assert.ok(source.includes("currentHandler.removeCallbacks(monitorRunnable)"));
  assert.ok(source.includes("currentHandler.postDelayed(immediateEvaluationRunnable, delay)"));
  const monitor = between(source, "private final Runnable monitorRunnable", "private void resetForegroundResolution()");
  assert.ok(monitor.includes('foregroundSource = eventMatched ? "accessibility_event" : "accessible_interactive_window"'));
  assert.ok(monitor.includes("foregroundSource);"));
});

test("Advanced Accessibility reconnect and window events recover unhealthy monitoring with bounded backoff", () => {
  const recovery = between(
    accessibility,
    "private void recoverFocusServiceIfNeeded(String reason)",
    "private void scheduleScan(",
  );
  for (const invariant of [
    "FOCUS_SERVICE_RECOVERY_BACKOFF_MS",
    "StudyModeManager.hasAccessibilityDisclosureConsent(this)",
    "StudyModeManager.shouldEnforceNow(this)",
    "StudyModeFocusService.isMonitoringHealthy()",
    "StudyModeFocusService.isRunning()",
    "StudyModeFocusService.isStopping()",
    "StudyModeFocusService.isStarting()",
    "StudyModeFocusService.requestMonitorRecovery(reason)",
    "StudyModeManager.requestFocusServiceRecovery(this, reason)",
    "PROCESS_RECOVERY_STARTED",
    "PROCESS_RECOVERY_FAILED",
  ]) {
    assert.ok(recovery.includes(invariant), `Missing recovery invariant: ${invariant}`);
  }
  assert.ok(!recovery.includes("StudyModeManager.reconcile(this)"));
  assert.ok(accessibility.includes("1500L, 3000L, 6000L, 15_000L, 30_000L"));
  assert.ok(accessibility.includes('recoverFocusServiceIfNeeded("periodic_health_check")'));

  const connected = between(
    accessibility,
    "protected void onServiceConnected()",
    "public void onAccessibilityEvent(AccessibilityEvent event)",
  );
  assert.ok(connected.indexOf("StudyModeWindowRegistry.markConnected()")
    < connected.indexOf('recoverFocusServiceIfNeeded("service_connected")'));
  assert.ok(connected.includes('ACCESSIBILITY_CONNECTED'));

  const eventHandler = between(
    accessibility,
    "public void onAccessibilityEvent(AccessibilityEvent event)",
    "public void onInterrupt()",
  );
  assert.ok(eventHandler.indexOf("StudyModeWindowRegistry.recordAccessibilityEvent(")
    < eventHandler.indexOf('recoverFocusServiceIfNeeded("accessibility_event")'));
  assert.ok(eventHandler.indexOf('recoverFocusServiceIfNeeded("accessibility_event")')
    < eventHandler.indexOf("StudyModeFocusService.requestImmediateEvaluation()"));
  assert.ok(accessibility.includes('ACCESSIBILITY_DISCONNECTED'));
});

test("popup first-frame verification waits for WindowManager traversal", () => {
  const show = between(source, "private void showShield(", "private boolean isShieldViewVisible");
  assert.ok(show.includes("candidate.postOnAnimation(() -> verifyShieldVisibility("));
  assert.ok(!show.includes("postDelayed(() -> verifyShieldVisibility("));
});


test("focus popup removes navigation and uses a compact, theme-aware layout", () => {
  const popup = between(source, "private android.view.View buildShieldView(String packageName)", "private android.view.View buildStudyAppShortcut(");
  assert.ok(!popup.includes("Back to Math Master"));
  assert.ok(!popup.includes("mathmaster://learn"));
  assert.ok(!popup.includes("TextView back"));
  assert.ok(!popup.includes("buttonParams"));
  assert.ok(popup.includes("stage.setPadding(dp(14), dp(12), dp(14), dp(12))"));
  assert.ok(popup.includes("panel.setPadding(dp(17), dp(16), dp(17), dp(15))"));
  assert.ok(popup.includes("new LinearLayout.LayoutParams(dp(46), dp(46))"));
  assert.ok(popup.includes("StudyModeManager.getNextMotivationalQuote(this)"));
  assert.ok(popup.includes("panel.addView(activePill, wrapWrap())"));
  assert.ok(source.includes('preferences.getString("popupMode", "dark")'));
  assert.ok(source.includes("palette.light = \"light\".equals(mode)"));
});

test("popup timer remains bound to the persisted native session and configured end time", () => {
  const timer = between(source, "private void updateRemainingTime()", "private final Runnable countdownRunnable");
  assert.ok(timer.includes("StudyModeManager.getCurrentSessionRemainingSeconds(this)"));
  assert.ok(timer.includes("StudyModeManager.getCurrentSessionEndMillis(this)"));
  assert.ok(timer.includes("DateFormat.getTimeFormat(this).format(new Date(sessionEnd))"));
  assert.ok(source.includes("mainHandler.postDelayed(countdownRunnable, 1000L)"));
});

test("Study Apps only render real selected launch targets and keep native launch behavior", () => {
  const popup = between(source, "private android.view.View buildShieldView(String packageName)", "private android.view.View buildStudyAppShortcut(");
  const shortcut = between(source, "private android.view.View buildStudyAppShortcut(", "private String getStudyAppLabel(");
  assert.ok(popup.includes("List<String> studyPackages = StudyModeManager.getSelectedStudyAppPackages(this)"));
  assert.ok(popup.includes("if (!studyPackages.isEmpty())"));
  assert.ok(!popup.includes("No Study Apps selected"));
  assert.ok(!popup.includes("emptyDescription"));
  assert.ok(popup.includes("new LinearLayout.LayoutParams(0, dp(56), 1f)"));
  assert.ok(shortcut.includes("StudyModeManager.launchStudyApp(StudyModeFocusService.this, packageName)"));
  assert.ok(shortcut.includes("lastForegroundPackage = packageName"));
  assert.ok(shortcut.includes("removeShield()"));
  assert.ok(manager.includes("getSelectedStudyAppPackages(Context context)"));
  assert.ok(manager.includes("isInstalledSelectablePackage(context, packageName)"));
});

test("popup and Study App interactions cannot end the Study Mode session", () => {
  const popup = between(source, "private android.view.View buildShieldView(String packageName)", "private android.view.View buildStudyAppShortcut(");
  const shortcut = between(source, "private android.view.View buildStudyAppShortcut(", "private String getStudyAppLabel(");
  for (const forbidden of ["finishSession(", "setEnabled(", "stopSelf(", "mathmaster://learn"]) {
    assert.ok(!popup.includes(forbidden), "Popup must not end or navigate away from the active session");
  }
  for (const forbidden of ["finishSession(", "setEnabled(", "stopSelf("]) {
    assert.ok(!shortcut.includes(forbidden), "Study App launch must not stop the active session");
  }
  assert.ok(source.includes("StudyModeManager.shouldEnforceNow(this)"));
  assert.ok(source.includes("private final Runnable monitorRunnable"));
});

test("Focus Service health is based on a live monitor heartbeat, not the process flag", () => {
  for (const invariant of [
    "MONITOR_HEALTH_TIMEOUT_MS = 10_000L",
    "lastMonitorHeartbeatElapsedMs",
    "thread.getLooper().getThread().isAlive()",
    "SystemClock.elapsedRealtime() - heartbeat <= MONITOR_HEALTH_TIMEOUT_MS",
    "public static boolean isMonitoringHealthy()",
    "public static boolean requestMonitorRecovery(String reason)",
    "monitorGeneration",
    "monitorThreadLock",
    "monitorRecoveryInFlight.compareAndSet(false, true)",
  ]) assert.ok(source.includes(invariant), `Missing monitor-health invariant: ${invariant}`);

  const monitor = between(source, "private final Runnable monitorRunnable", "private void resetForegroundResolution()");
  assert.ok(monitor.includes("Thread.currentThread() != monitorThread"));
  assert.ok(monitor.includes("lastMonitorHeartbeatElapsedMs = SystemClock.elapsedRealtime()"));
  assert.ok(monitor.includes("scheduleMonitorCycle(POLL_INTERVAL_MS, monitorGenerationAtStart)"));
  assert.ok(source.includes("SERVICE_RESTARTED_WITH_NULL_INTENT"));
  const start = between(source, "public int onStartCommand(", "private boolean startForegroundSafely()");
  assert.ok(start.includes("intent == null"));
  assert.ok(start.includes("return START_STICKY"));
  assert.ok(start.includes('intent == null ? "sticky_restart" : "start_command"'));
});

test("blocking_active is only reported after actual overlay attachment and visibility", () => {
  const verify = between(source, "private void verifyShieldVisibility(", "private android.view.View buildShieldView(String packageName)");
  assert.ok(verify.indexOf("isShieldViewVisible(candidate)")
    < verify.indexOf('StudyModeManager.setServiceState(this, "blocking_active")'));
  assert.ok(source.includes("public static boolean isBlockingActive()"));
  const status = between(source, "public static String getMonitoringState()", "public static boolean requestMonitorRecovery(");
  assert.ok(source.includes("service.isShieldViewVisible(service.shieldView)"));
  assert.ok(status.includes('"blocking_pending"'));
  assert.ok(status.includes('"monitoring_unavailable"'));
});

test("background foreground-service restrictions are reported rather than faked as healthy", () => {
  assert.ok(source.includes('"ForegroundServiceStartNotAllowedException"'));
  assert.ok(source.includes('"FOREGROUND_START_RESTRICTED"'));
  assert.ok(manager.includes('"ForegroundServiceStartNotAllowedException"'));
  assert.ok(manager.includes('"monitoring_unavailable"'));
  assert.ok(manager.includes("public static void logStudyModeDiagnostic"));
  assert.ok(accessibility.includes('"PROCESS_RECOVERY_FAILED"'));
});

test("HyperOS background switches are shown as manual, unverified OEM settings", () => {
  assert.ok(manager.includes("public static boolean isXiaomiDevice()"));
  assert.ok(manager.includes('permissions.put("xiaomiDevice", isXiaomiDevice())'));
  assert.ok(permissionSetup.includes('key: "oemBackground"'));
  assert.ok(permissionSetup.includes("Check manually"));
  assert.ok(permissionSetup.includes("Android cannot reliably verify these OEM-only switches."));
});

test("Advanced Accessibility recovery uses a deduplicated exact alarm before restarting a stopped foreground service", () => {
  const recovery = between(
    manager,
    "public static synchronized boolean requestFocusServiceRecovery(Context context, String reason)",
    "/** Called only by StudyModeAlarmReceiver for the scheduled exact-alarm action. */",
  );
  assert.ok(recovery.includes("hasAccessibilityDisclosureConsent(app)"));
  assert.ok(recovery.includes("shouldEnforceNow(app)"));
  assert.ok(recovery.includes("hasExactAlarmPermission(app)"));
  assert.ok(recovery.includes("FOCUS_RECOVERY_PENDING_WINDOW_MS"));
  assert.ok(recovery.includes("setExactAndAllowWhileIdle("));
  assert.ok(recovery.includes("focusServiceRecoveryPendingIntent(app)"));
  assert.ok(manager.includes("ACTION_FOCUS_SERVICE_RECOVERY"));
  assert.ok(!recovery.includes("startForegroundService("));
  assert.ok(manager.includes("onFocusServiceRecoveryAlarm(Context context)"));
  assert.ok(alarmReceiver.includes("StudyModeManager.onFocusServiceRecoveryAlarm(context)"));

  const accessRecovery = between(
    accessibility,
    "private void recoverFocusServiceIfNeeded(String reason)",
    "private void scheduleScan(",
  );
  assert.ok(accessRecovery.includes("StudyModeManager.requestFocusServiceRecovery(this, reason)"));
  assert.ok(!accessRecovery.includes("StudyModeManager.reconcile(this)"));
});

test("Screen Time Island is opt-in to the same Study Mode eligibility and never replaces the reminder cadence", () => {
  const monitor = between(source, "private final Runnable monitorRunnable", "private boolean isPhoneCallActive()");
  assert.ok(manager.includes('KEY_SCREEN_TIME_ISLAND_ENABLED = "screenTimeIslandEnabled"'));
  assert.ok(manager.includes('KEY_SCREEN_TIME_ISLAND_INTERVAL_MINUTES = "screenTimeIslandIntervalMinutes"'));
  assert.ok(manager.includes("DEFAULT_SCREEN_TIME_ISLAND_INTERVAL_MINUTES = 5"));
  assert.ok(manager.includes("isScreenTimeIslandEnabled(Context context)"));
  assert.ok(manager.includes("getScreenTimeIslandIntervalMinutes(Context context)"));
  assert.ok(manager.includes("StudyModeFocusService.onScreenTimeIslandSettingsChanged(context)"));
  assert.ok(manager.includes('result.put("screenTimeIslandEnabled", isScreenTimeIslandEnabled(context))'));
  assert.ok(manager.includes('result.put("screenTimeIslandIntervalMinutes", getScreenTimeIslandIntervalMinutes(context))'));
  assert.ok(monitor.includes("StudyModeManager.shouldEnforceNow(StudyModeFocusService.this)"));
  assert.ok(monitor.includes("StudyModeManager.isSelectedStudyAppPackage(StudyModeFocusService.this, activePackage)"));
  assert.ok(monitor.includes("StudyModeManager.isPeriodicReminderExemptPackage(StudyModeFocusService.this, activePackage)"));
  assert.ok(monitor.includes("!StudyModeManager.isProStrictModeActive(StudyModeFocusService.this)"));
  assert.ok(monitor.includes("!shouldShield"));
  assert.ok(monitor.includes("!activePackage.equals(getPackageName())"));
  assert.ok(monitor.includes("islandUsage.sample("));
  assert.ok(monitor.includes("periodicReminderUsage.sample("));
  assert.ok(source.includes("private final StudyModeUsageAccumulator islandUsage"));
  assert.ok(source.includes("periodic_popup_priority"));
  assert.ok(source.includes("popup_conflict_timeout"));
  assert.ok(source.includes("isPhoneCallActive()"));
  assert.ok(source.includes("dismissScreenTimeIslandImmediately(\"screen_not_interactive\")"));
  assert.ok(source.includes("dismissScreenTimeIslandImmediately(\"configuration_changed\")"));
  assert.ok(source.includes("dismissScreenTimeIslandImmediately(\"overlay_permission_missing\")"));
});

test("Screen Time Island local day usage aggregation and spring math stay Android-free and DST-safe", () => {
  assert.doesNotMatch(islandDayUsage, /^import android\./m);
  assert.match(islandDayUsage, /Calendar\.getInstance\(zone\)/);
  assert.match(islandDayUsage, /Calendar\.HOUR_OF_DAY/);
  assert.match(islandDayUsage, /ACTIVITY_RESUMED/);
  assert.match(islandDayUsage, /SCREEN_NON_INTERACTIVE/);
  assert.match(islandDayUsage, /hourlyMillis\(String packageName\)/);
  assert.match(islandDayUsage, /isPackageActiveAtEnd\(String packageName\)/);
  assert.match(source, /__monitor_live_session__/);
  assert.doesNotMatch(islandSpring, /^import android\./m);
  assert.match(islandSpring, /Math\.sqrt/);
  assert.match(islandSpring, /isSettled/);
  assert.match(islandSpring, /Float\.isNaN/);
});

test("Screen Time Island overlay remains a tight, no-focus, no-network Canvas surface", () => {
  assert.match(islandOverlay, /TYPE_APPLICATION_OVERLAY/);
  assert.match(islandOverlay, /FLAG_NOT_FOCUSABLE/);
  assert.match(islandOverlay, /FLAG_NOT_TOUCH_MODAL/);
  assert.match(islandOverlay, /FLAG_NOT_TOUCHABLE/);
  assert.match(islandOverlay, /Math Master Screen Time Island/);
  assert.match(islandOverlay, /Choreographer/);
  assert.match(islandOverlay, /MotionEvent\.ACTION_MOVE/);
  assert.match(islandOverlay, /LONG_PRESS_MS/);
  assert.match(islandOverlay, /ACCESSIBILITY_LIVE_REGION_POLITE/);
  assert.match(islandOverlay, /\.scheme\("mathmaster"\)/);
  assert.match(islandOverlay, /\.authority\("learn"\)/);
  assert.doesNotMatch(islandOverlay, /https?:\/\//);
  assert.doesNotMatch(islandOverlay, /AccessibilityNodeInfo|AccessibilityService|TYPE_ACCESSIBILITY_OVERLAY/);
  assert.match(islandPainter, /Canvas/);
  assert.match(islandPainter, /Paint/);
  assert.match(islandPainter, /MathMaster-Regular\.otf/);
  assert.match(islandPainter, /MathMaster-Medium\.otf/);
  assert.match(islandPainter, /MathMaster-Bold\.otf/);
  assert.match(islandPainter, /accentForTheme/);
  assert.doesNotMatch(islandPainter, /RenderEffect|BlurMaskFilter/);
});

test("Screen Time Island settings and preview are validated and wired through the native bridge", () => {
  assert.match(studyModeTs, /screenTimeIslandEnabled\?: boolean/);
  assert.match(studyModeTs, /screenTimeIslandIntervalMinutes\?: number/);
  assert.match(studyModeTs, /setStudyModeScreenTimeIsland/);
  assert.match(studyModeTs, /previewStudyModeScreenTimeIsland/);
  assert.match(studyModeTs, /minutes < 1 \|\| minutes > 10/);
  assert.match(page, /Screen Time Island/);
  assert.match(page, /aria-label="Enable Screen Time Island"/);
  assert.match(page, /Choose reminder interval/);
  assert.match(page, /previewStudyModeScreenTimeIsland/);
  assert.match(page, /Overlay and Usage Access are needed/);
  assert.match(studyModeCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(studyModeCss, /cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
});

