import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const focusPath = new URL("../android-native/com/sudhanshu/mathsbj/StudyModeFocusService.java", import.meta.url);
const managerPath = new URL("../android-native/com/sudhanshu/mathsbj/StudyModeManager.java", import.meta.url);
const source = readFileSync(focusPath, "utf8");
const manager = readFileSync(managerPath, "utf8");

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return text.slice(start, end);
}

test("foreground lookup keeps a resumable cursor and rate-limits empty wide-history retries", () => {
  const resolver = between(
    source,
    "private String getMostRecentlyResumedPackage()",
    "private void showShield(",
  );
  assert.match(resolver, /lastUsageEventScanTimeMs\s*-\s*EVENT_QUERY_OVERLAP_MS/);
  assert.match(resolver, /EMPTY_INITIAL_LOOKUP_RETRY_MS/);
  assert.match(resolver, /hasResolvedForegroundOnce/);
  assert.match(resolver, /if \(events == null\) \{[\s\S]*?return lastForegroundPackage;/);
  assert.match(resolver, /lastUsageEventScanTimeMs = now;/);
  assert.doesNotMatch(resolver, /initialForegroundLookup/);
});

test("an unknown foreground package cannot remove a valid shield", () => {
  const monitor = between(
    source,
    "private final Runnable monitorRunnable",
    "private void resetForegroundResolution()",
  );
  const unknownBranch = between(
    monitor,
    "if (foreground == null || foreground.trim().isEmpty())",
    "boolean shouldShield",
  );
  assert.match(unknownBranch, /return;/);
  assert.doesNotMatch(unknownBranch, /removeShield\(/);
});

test("newer foreground decisions invalidate queued main-thread overlay requests", () => {
  assert.match(source, /AtomicLong foregroundDecisionSequence/);
  assert.match(source, /decisionSequence != foregroundDecisionSequence\.get\(\)/);
  assert.match(source, /newer_foreground_decision/);
  assert.match(source, /foregroundDecisionSequence\.incrementAndGet\(\)/);
});

test("popup success requires an attached, shown window rather than addView acceptance alone", () => {
  const visibility = between(
    source,
    "private boolean isShieldViewVisible",
    "private android.view.View buildShieldView()",
  );
  assert.match(visibility, /isAttachedToWindow\(\)/);
  assert.match(visibility, /getWindowToken\(\)/);
  assert.match(visibility, /getWindowVisibility\(\)/);
  assert.match(visibility, /isShown\(\)/);
  assert.match(visibility, /POPUP_WINDOW_VISIBLE/);
  assert.match(source, /POPUP_LAUNCH_ACCEPTED/);
  assert.match(source, /POPUP_LAUNCH_FAILED/);
});

test("debug diagnostics include stage, session, package and request without logging screen content", () => {
  assert.match(source, /event=" \+ stage/);
  assert.match(source, /sessionId=" \+ sessionId/);
  assert.match(source, /package=" \+ safePackage/);
  assert.match(source, /requestId=" \+ safeRequest/);
  assert.match(manager, /getActiveSessionId\(Context context\)/);
  assert.match(source, /ApplicationInfo\.FLAG_DEBUGGABLE/);
  assert.doesNotMatch(source, /getText\(\)|rootInActiveWindow|AccessibilityNodeInfo/);
});

test("popup launch recovery is bounded and does not become an infinite overlay retry loop", () => {
  assert.match(source, /MAX_POPUP_FAILURES_PER_FOREGROUND = 3/);
  assert.match(source, /POPUP_RETRY_FIRST_BACKOFF_MS/);
  assert.match(source, /POPUP_RETRY_SECOND_BACKOFF_MS/);
  assert.match(source, /failedPopupAttempts >= MAX_POPUP_FAILURES_PER_FOREGROUND/);
  assert.match(source, /awaiting_new_foreground_transition/);
  assert.match(source, /resetPopupRetryState\\(\\)/);
});

test("diagnostic session lookup is cached off the main-thread popup path", () => {
  assert.match(source, /refreshDiagnosticSessionId\\(false\\)/);
  assert.match(source, /lastDiagnosticSessionRefreshElapsedMs/);
  const logger = between(source, "private void logStage(", "public void onTaskRemoved(");
  assert.doesNotMatch(logger, /getActiveSessionId\\(this\\)/);
});

test("status does not report a running service as active blocking after overlay failure", () => {
  assert.match(manager, /else if \\(StudyModeFocusService\\.hasOverlayFailure\\(\\)\\)\\s*\\{[\\s\\S]*?state = "overlay_failed"/);
  assert.match(source, /overlayFailureForStatus = false;/);
});
