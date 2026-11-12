package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.SparseArray;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class StudyModeAccessibilityService extends AccessibilityService {
    private static final long RESCAN_INTERVAL_MS = 1200L;
    private static final long IDLE_RESCAN_INTERVAL_MS = 15_000L;
    private static final long EVENT_RESCAN_DELAY_MS = 100L;
    private static final long EVENT_SCAN_MIN_INTERVAL_MS = 350L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean eventScanQueued = false;
    private long lastEventScanElapsedMs = 0L;

    private final Runnable eventScanRunnable = new Runnable() {
        @Override
        public void run() {
            eventScanQueued = false;
            lastEventScanElapsedMs = SystemClock.elapsedRealtime();
            scanAccessibleWindows();
        }
    };

    private final Runnable scanRunnable = new Runnable() {
        @Override
        public void run() {
            scanAccessibleWindows();
            long nextDelayMs = RESCAN_INTERVAL_MS;
            try {
                if (!StudyModeManager.hasAccessibilityDisclosureConsent(StudyModeAccessibilityService.this)
                    || !StudyModeManager.shouldEnforceNow(StudyModeAccessibilityService.this)) {
                    // The service remains bound by Android, but avoid continuous
                    // window enumeration when the user has not consented or no
                    // Study Mode schedule/session is actively enforcing.
                    nextDelayMs = IDLE_RESCAN_INTERVAL_MS;
                }
            } catch (RuntimeException unavailableState) {
                nextDelayMs = IDLE_RESCAN_INTERVAL_MS;
            }
            handler.postDelayed(this, nextDelayMs);
        }
    };

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = getServiceInfo();
        if (info != null) {
            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            info.eventTypes |= AccessibilityEvent.TYPE_WINDOWS_CHANGED
                | AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                | AccessibilityEvent.TYPE_VIEW_FOCUSED;
            setServiceInfo(info);
        }
        StudyModeWindowRegistry.markConnected();
        scheduleScan(0L);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || !StudyModeManager.hasAccessibilityDisclosureConsent(this)) return;

        CharSequence eventPackage = event.getPackageName();
        if (eventPackage != null) {
            // Keep only package/window metadata; never inspect the event source or
            // read text, messages, passwords, screenshots, or gestures.
            StudyModeWindowRegistry.recordAccessibilityEvent(
                eventPackage.toString(), event.getEventType(), event.getWindowId());
        }

        // Wake the already-running monitor immediately. Its bounded coalescing
        // prevents an Accessibility event burst from creating duplicate work.
        StudyModeFocusService.requestImmediateEvaluation();
        scheduleEventScan();
    }

    @Override
    public void onInterrupt() {
        // Interrupt does not necessarily mean the service was unbound. Keep the
        // registry connected and resume polling after invalidating the stale view.
        StudyModeWindowRegistry.invalidateSnapshot();
        handler.removeCallbacks(eventScanRunnable);
        eventScanQueued = false;
        scheduleScan(RESCAN_INTERVAL_MS);
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        handler.removeCallbacks(scanRunnable);
        handler.removeCallbacks(eventScanRunnable);
        eventScanQueued = false;
        StudyModeWindowRegistry.clear();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        eventScanQueued = false;
        StudyModeWindowRegistry.clear();
        super.onDestroy();
    }

    private void scheduleScan(long delayMs) {
        handler.removeCallbacks(scanRunnable);
        handler.postDelayed(scanRunnable, Math.max(0L, delayMs));
    }

    /**
     * Keep event-driven scans independent from the periodic safety scan.
     * Coalescing prevents repeated event callbacks from cancelling/reposting
     * the periodic task and starving all-window enumeration.
     */
    private void scheduleEventScan() {
        if (eventScanQueued) return;
        long now = SystemClock.elapsedRealtime();
        long elapsedSinceLastScan = lastEventScanElapsedMs == 0L
            ? EVENT_SCAN_MIN_INTERVAL_MS
            : now - lastEventScanElapsedMs;
        long throttleDelay = Math.max(0L, EVENT_SCAN_MIN_INTERVAL_MS - elapsedSinceLastScan);
        eventScanQueued = true;
        handler.postDelayed(eventScanRunnable, Math.max(EVENT_RESCAN_DELAY_MS, throttleDelay));
    }

    private void scanAccessibleWindows() {
        try {
            if (!StudyModeManager.hasAccessibilityDisclosureConsent(this)) {
                StudyModeWindowRegistry.publish(Collections.emptyList(), false);
                return;
            }
            if (!StudyModeManager.shouldEnforceNow(this)) {
                StudyModeWindowRegistry.publish(Collections.emptyList(), false);
                return;
            }
            WindowSnapshot snapshot = readVisibleApplicationWindows();
            StudyModeWindowRegistry.publish(snapshot.windows, snapshot.complete);
        } catch (RuntimeException unavailableSnapshot) {
            StudyModeWindowRegistry.invalidateSnapshot();
        }
    }

    private WindowSnapshot readVisibleApplicationWindows() {
        List<AccessibilityWindowInfo> allWindows = new ArrayList<>();
        boolean complete = true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                SparseArray<List<AccessibilityWindowInfo>> byDisplay = getWindowsOnAllDisplays();
                if (byDisplay == null || byDisplay.size() == 0) {
                    complete = false;
                } else {
                    for (int displayIndex = 0; displayIndex < byDisplay.size(); displayIndex++) {
                        List<AccessibilityWindowInfo> displayWindows = byDisplay.valueAt(displayIndex);
                        if (displayWindows == null) {
                            complete = false;
                            continue;
                        }
                        allWindows.addAll(displayWindows);
                    }
                }
            } else {
                List<AccessibilityWindowInfo> defaultDisplayWindows = getWindows();
                if (defaultDisplayWindows == null || defaultDisplayWindows.isEmpty()) {
                    complete = false;
                } else {
                    allWindows.addAll(defaultDisplayWindows);
                }
            }
        } catch (RuntimeException unavailableWindowList) {
            return new WindowSnapshot(Collections.emptyList(), false);
        }

        List<StudyModeWindowRegistry.WindowRecord> records = new ArrayList<>();
        boolean hasApplicationWindow = false;
        for (AccessibilityWindowInfo window : allWindows) {
            if (window == null) {
                complete = false;
                continue;
            }
            try {
                // System, input-method and overlay windows are deliberately excluded.
                if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
                hasApplicationWindow = true;

                AccessibilityNodeInfo root = null;
                String packageName = null;
                try {
                    root = window.getRoot();
                    if (root != null) {
                        CharSequence value = root.getPackageName();
                        if (value != null) packageName = value.toString();
                    }
                } finally {
                    if (root != null) root.recycle();
                }

                if (packageName == null || packageName.isEmpty()) {
                    complete = false;
                    continue;
                }
                int displayId = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? window.getDisplayId() : android.view.Display.DEFAULT_DISPLAY;
                records.add(new StudyModeWindowRegistry.WindowRecord(
                    packageName, window.isFocused(), window.getId(), displayId));
            } catch (RuntimeException inaccessibleWindow) {
                // A single unreadable app window makes the whole view snapshot incomplete.
                complete = false;
            } finally {
                window.recycle();
            }
        }
        complete = complete && hasApplicationWindow && !records.isEmpty();
        return new WindowSnapshot(records, complete);
    }

    private static final class WindowSnapshot {
        final List<StudyModeWindowRegistry.WindowRecord> windows;
        final boolean complete;

        WindowSnapshot(List<StudyModeWindowRegistry.WindowRecord> windows, boolean complete) {
            this.windows = windows;
            this.complete = complete;
        }
    }
}
