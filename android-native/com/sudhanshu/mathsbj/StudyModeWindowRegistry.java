package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;

public final class StudyModeWindowRegistry {
    private static final long MAX_SNAPSHOT_AGE_MS = 5000L;
    private static final long ACCESSIBILITY_EVENT_TTL_MS = 2200L;
    private static final int MAX_RECENT_ACCESSIBILITY_EVENTS = 8;
    private static final Object LOCK = new Object();

    private static boolean serviceConnected = false;
    private static long snapshotAtElapsedMs = 0L;
    private static boolean snapshotComplete = false;
    private static List<WindowRecord> windows = Collections.emptyList();
    // Short-lived, bounded positive evidence from app-window events; package metadata only.
    private static final Deque<AccessibilityEventRecord> recentAccessibilityEvents = new ArrayDeque<>();

    private StudyModeWindowRegistry() {}

    static void markConnected() {
        synchronized (LOCK) {
            serviceConnected = true;
            snapshotAtElapsedMs = 0L;
            snapshotComplete = false;
            windows = Collections.emptyList();
            recentAccessibilityEvents.clear();
        }
    }

    static void publish(List<WindowRecord> visibleWindows, boolean complete) {
        List<WindowRecord> safeCopy = visibleWindows == null
            ? Collections.emptyList()
            : Collections.unmodifiableList(new ArrayList<>(visibleWindows));
        synchronized (LOCK) {
            if (!serviceConnected) return;
            windows = safeCopy;
            snapshotComplete = complete && !safeCopy.isEmpty();
            snapshotAtElapsedMs = SystemClock.elapsedRealtime();
        }
    }

    static void clear() {
        synchronized (LOCK) {
            serviceConnected = false;
            snapshotAtElapsedMs = 0L;
            snapshotComplete = false;
            windows = Collections.emptyList();
            recentAccessibilityEvents.clear();
        }
    }

    static void invalidateSnapshot() {
        synchronized (LOCK) {
            windows = Collections.emptyList();
            snapshotAtElapsedMs = 0L;
            snapshotComplete = false;
            recentAccessibilityEvents.clear();
        }
    }

    public static boolean isConnected() {
        synchronized (LOCK) {
            return serviceConnected;
        }
    }

    public static boolean hasFreshSnapshot() {
        synchronized (LOCK) {
            return serviceConnected
                && snapshotComplete
                && snapshotAtElapsedMs > 0L
                && SystemClock.elapsedRealtime() - snapshotAtElapsedMs <= MAX_SNAPSHOT_AGE_MS;
        }
    }

    public static boolean isAccessibilityServiceAvailable(Context context) {
        if (context == null) return false;
        ComponentName component = new ComponentName(
            context.getPackageName(),
            context.getPackageName() + ".StudyModeAccessibilityService"
        );
        try {
            PackageManager packageManager = context.getPackageManager();
            android.content.pm.ServiceInfo service = packageManager.getServiceInfo(
                component, PackageManager.GET_META_DATA);
            return service != null
                && service.enabled
                && "android.permission.BIND_ACCESSIBILITY_SERVICE".equals(service.permission);
        } catch (PackageManager.NameNotFoundException unavailableInThisVariant) {
            return false;
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    public static boolean isAccessibilityServiceEnabled(Context context) {
        if (context == null || !isAccessibilityServiceAvailable(context)) return false;
        AccessibilityManager manager = (AccessibilityManager) context.getSystemService(
            Context.ACCESSIBILITY_SERVICE);
        if (manager == null) return false;

        ComponentName expected = new ComponentName(
            context.getPackageName(),
            context.getPackageName() + ".StudyModeAccessibilityService"
        );
        try {
            List<AccessibilityServiceInfo> enabledServices =
                manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
            if (enabledServices == null) return false;
            for (AccessibilityServiceInfo service : enabledServices) {
                if (service == null || service.getResolveInfo() == null
                    || service.getResolveInfo().serviceInfo == null) continue;
                android.content.pm.ServiceInfo resolved = service.getResolveInfo().serviceInfo;
                if (context.getPackageName().equals(resolved.packageName)
                    && expected.getClassName().equals(resolved.name)) return true;
            }
        } catch (RuntimeException unavailable) {
            return false;
        }
        return false;
    }

    /**
     * Returns a selected blocked package from accessible application windows.
     * Focused windows win; UsageStats is used as a tie-breaker; remaining windows
     * preserve Android's reported top-to-bottom ordering.
     */
    /**
     * Bounded positive package evidence from configured AccessibilityEvents.
     * Values are volatile in-process only; no screen text or event history is saved.
     */
    static void recordAccessibilityEvent(String packageName, int eventType, int windowId) {
        if (!isValidPackageName(packageName)) return;
        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            && eventType != AccessibilityEvent.TYPE_WINDOWS_CHANGED
            && eventType != AccessibilityEvent.TYPE_VIEW_FOCUSED) return;

        long now = SystemClock.elapsedRealtime();
        synchronized (LOCK) {
            if (!serviceConnected) return;
            pruneRecentAccessibilityEventsLocked(now);
            Iterator<AccessibilityEventRecord> iterator = recentAccessibilityEvents.iterator();
            while (iterator.hasNext()) {
                AccessibilityEventRecord existing = iterator.next();
                if (existing.windowId == windowId || existing.packageName.equals(packageName)) {
                    iterator.remove();
                }
            }
            while (recentAccessibilityEvents.size() >= MAX_RECENT_ACCESSIBILITY_EVENTS) {
                recentAccessibilityEvents.removeFirst();
            }
            recentAccessibilityEvents.addLast(
                new AccessibilityEventRecord(packageName, eventType, windowId, now));
        }
    }

    private static boolean isValidPackageName(String packageName) {
        if (packageName == null || packageName.isEmpty() || packageName.length() > 255) return false;
        String[] segments = packageName.split("\\.", -1);
        if (segments.length < 2) return false;
        for (String segment : segments) {
            if (segment.isEmpty()) return false;
            char first = segment.charAt(0);
            if (!(Character.isLetter(first) || first == '_')) return false;
            for (int index = 1; index < segment.length(); index++) {
                char value = segment.charAt(index);
                if (!(Character.isLetterOrDigit(value) || value == '_')) return false;
            }
        }
        return true;
    }

    private static void pruneRecentAccessibilityEventsLocked(long now) {
        while (!recentAccessibilityEvents.isEmpty()) {
            AccessibilityEventRecord first = recentAccessibilityEvents.peekFirst();
            if (first == null || now - first.observedAtElapsedMs <= ACCESSIBILITY_EVENT_TTL_MS) break;
            recentAccessibilityEvents.removeFirst();
        }
    }

    public static boolean wasRecentlyObservedAccessibilityEvent(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        long now = SystemClock.elapsedRealtime();
        synchronized (LOCK) {
            pruneRecentAccessibilityEventsLocked(now);
            for (AccessibilityEventRecord event : recentAccessibilityEvents) {
                if (packageName.equals(event.packageName)) return true;
            }
        }
        return false;
    }

    /**
     * Returns a selected blocked package using fresh positive evidence first:
     * AccessibilityEvents (even without a complete snapshot), then accessible
     * interactive windows. UsageStats is only a tie-breaker among visible windows.
     */
    public static String findBlockedPackage(Context context, String usageForegroundPackage) {
        if (context == null) return null;

        final List<WindowRecord> visibleSnapshot;
        final List<AccessibilityEventRecord> eventSnapshot;
        long now = SystemClock.elapsedRealtime();
        synchronized (LOCK) {
            if (!serviceConnected) return null;
            pruneRecentAccessibilityEventsLocked(now);
            eventSnapshot = new ArrayList<>(recentAccessibilityEvents);
            boolean snapshotFresh = snapshotAtElapsedMs > 0L
                && now - snapshotAtElapsedMs <= MAX_SNAPSHOT_AGE_MS;
            visibleSnapshot = snapshotFresh ? new ArrayList<>(windows) : Collections.emptyList();
        }

        String ownPackage = context.getPackageName();
        for (int index = eventSnapshot.size() - 1; index >= 0; index--) {
            String packageName = eventSnapshot.get(index).packageName;
            if (!ownPackage.equals(packageName)
                && StudyModeManager.isPackageSelected(context, packageName)) {
                return packageName;
            }
        }

        for (WindowRecord window : visibleSnapshot) {
            if (window.focused && !ownPackage.equals(window.packageName)
                && StudyModeManager.isPackageSelected(context, window.packageName)) {
                return window.packageName;
            }
        }

        if (usageForegroundPackage != null && !usageForegroundPackage.isEmpty()
            && !ownPackage.equals(usageForegroundPackage)
            && StudyModeManager.isPackageSelected(context, usageForegroundPackage)) {
            for (WindowRecord window : visibleSnapshot) {
                if (usageForegroundPackage.equals(window.packageName)) return usageForegroundPackage;
            }
        }

        for (WindowRecord window : visibleSnapshot) {
            if (!ownPackage.equals(window.packageName)
                && StudyModeManager.isPackageSelected(context, window.packageName)) {
                return window.packageName;
            }
        }
        return null;
    }

    private static final class AccessibilityEventRecord {
        final String packageName;
        final int eventType;
        final int windowId;
        final long observedAtElapsedMs;

        AccessibilityEventRecord(String packageName, int eventType, int windowId, long observedAtElapsedMs) {
            this.packageName = packageName;
            this.eventType = eventType;
            this.windowId = windowId;
            this.observedAtElapsedMs = observedAtElapsedMs;
        }
    }

    static final class WindowRecord {
        final String packageName;
        final boolean focused;
        final int windowId;
        final int displayId;

        WindowRecord(String packageName, boolean focused, int windowId, int displayId) {
            this.packageName = packageName;
            this.focused = focused;
            this.windowId = windowId;
            this.displayId = displayId;
        }
    }
}
