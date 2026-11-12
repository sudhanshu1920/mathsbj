import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const focusPath = new URL("../android-native/com/sudhanshu/mathsbj/StudyModeFocusService.java", import.meta.url);
const managerPath = new URL("../android-native/com/sudhanshu/mathsbj/StudyModeManager.java", import.meta.url);
const pagePath = new URL("../src/components/StudyModePage.tsx", import.meta.url);
const source = readFileSync(focusPath, "utf8");
const manager = readFileSync(managerPath, "utf8");
const page = readFileSync(pagePath, "utf8");
const registry = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeWindowRegistry.java", import.meta.url), "utf8");
const accessibility = readFileSync(new URL("../android-native/com/sudhanshu/mathsbj/StudyModeAccessibilityService.java", import.meta.url), "utf8");

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return text.slice(start, end);
}

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
  assert.ok(blockedWindowLookup.includes("StudyModeManager.isPackageSelected(context, window.packageName)"));
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
  assert.ok(registry.includes("StudyModeManager.isPackageSelected(context, window.packageName)"));
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
  const visibility = between(source, "private boolean isShieldViewVisible", "private android.view.View buildShieldView()");
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
  assert.ok(status.indexOf("hasForegroundLookupFailure()") < status.indexOf("isRunning()"));
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
  const failureIndex = status.indexOf("StudyModeFocusService.hasOverlayFailure()");
  const runningIndex = status.indexOf("StudyModeFocusService.isRunning()");
  assert.ok(failureIndex >= 0 && runningIndex > failureIndex);
  assert.ok(status.includes('state = "overlay_failed";'));
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
  const verify = between(source, "private void verifyShieldVisibility(", "private android.view.View buildShieldView()");
  assert.ok(verify.includes("decisionSequence != foregroundDecisionSequence.get()"));
  assert.ok(verify.includes("decision_changed_before_visibility_check"));
});


test("Accessibility events are retained as bounded positive package evidence", () => {
  assert.ok(registry.includes("ACCESSIBILITY_EVENT_TTL_MS = 2200L"));
  assert.ok(registry.includes("MAX_RECENT_ACCESSIBILITY_EVENTS = 8"));
  assert.ok(registry.includes("recordAccessibilityEvent("));
  assert.ok(registry.includes("recentAccessibilityEvents"));
  assert.ok(registry.includes("pruneRecentAccessibilityEventsLocked"));
  assert.ok(registry.includes("StudyModeManager.isPackageSelected(context, packageName)"));
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

test("popup first-frame verification waits for WindowManager traversal", () => {
  const show = between(source, "private void showShield(", "private boolean isShieldViewVisible");
  assert.ok(show.includes("candidate.postOnAnimation(() -> verifyShieldVisibility("));
  assert.ok(!show.includes("postDelayed(() -> verifyShieldVisibility("));
});
