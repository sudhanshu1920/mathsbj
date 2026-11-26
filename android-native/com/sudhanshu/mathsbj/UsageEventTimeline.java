package com.sudhanshu.mathsbj;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Reconstructs non-overlapping, screen-interactive foreground time from UsageEvents. */
final class UsageEventTimeline {
    static final int ACTIVITY_RESUMED = 1;
    static final int ACTIVITY_PAUSED = 2;
    static final int MOVE_TO_FOREGROUND = 3;
    static final int MOVE_TO_BACKGROUND = 4;
    static final int SCREEN_INTERACTIVE = 5;
    static final int SCREEN_NON_INTERACTIVE = 6;
    static final int KEYGUARD_SHOWN = 7;
    static final int KEYGUARD_HIDDEN = 8;
    static final int DEVICE_SHUTDOWN = 9;
    static final int DEVICE_STARTUP = 10;

    static final class Event {
        final long timestamp;
        final String packageName;
        final String activityName;
        final int type;

        Event(long timestamp, String packageName, String activityName, int type) {
            this.timestamp = timestamp;
            this.packageName = packageName == null ? "" : packageName;
            this.activityName = activityName == null ? "" : activityName;
            this.type = type;
        }
    }

    private UsageEventTimeline() {}

    static long measure(List<Event> source, long startMillis, long endMillis, String excludedPackage) {
        if (source == null || startMillis >= endMillis) return 0L;
        List<Event> events = new ArrayList<>(source);
        Collections.sort(events, Comparator.comparingLong(event -> event.timestamp));

        Map<String, Set<String>> activitiesByPackage = new HashMap<>();
        Set<String> legacyForegroundPackages = new HashSet<>();
        boolean screenInteractive = true;
        boolean keyguardShown = false;
        long cursor = events.isEmpty() ? startMillis : Math.min(startMillis, events.get(0).timestamp);
        long total = 0L;

        for (Event event : events) {
            long timestamp = Math.max(cursor, event.timestamp);
            if (timestamp > cursor && hasEligibleForeground(
                activitiesByPackage, legacyForegroundPackages, screenInteractive, keyguardShown, excludedPackage
            )) {
                long intervalStart = Math.max(startMillis, cursor);
                long intervalEnd = Math.min(endMillis, timestamp);
                if (intervalEnd > intervalStart) total += intervalEnd - intervalStart;
            }
            cursor = timestamp;
            if (event.timestamp < startMillis) {
                apply(event, activitiesByPackage, legacyForegroundPackages);
                if (event.type == SCREEN_INTERACTIVE || event.type == DEVICE_STARTUP) screenInteractive = true;
                else if (event.type == SCREEN_NON_INTERACTIVE || event.type == DEVICE_SHUTDOWN) screenInteractive = false;
                else if (event.type == KEYGUARD_SHOWN) keyguardShown = true;
                else if (event.type == KEYGUARD_HIDDEN) keyguardShown = false;
                continue;
            }
            if (event.timestamp >= endMillis) break;

            if (event.type == SCREEN_INTERACTIVE || event.type == DEVICE_STARTUP) {
                screenInteractive = true;
            } else if (event.type == SCREEN_NON_INTERACTIVE || event.type == DEVICE_SHUTDOWN) {
                screenInteractive = false;
                activitiesByPackage.clear();
                legacyForegroundPackages.clear();
            } else if (event.type == KEYGUARD_SHOWN) {
                keyguardShown = true;
                activitiesByPackage.clear();
                legacyForegroundPackages.clear();
            } else if (event.type == KEYGUARD_HIDDEN) {
                keyguardShown = false;
            } else {
                apply(event, activitiesByPackage, legacyForegroundPackages);
            }
        }

        if (endMillis > cursor && hasEligibleForeground(
            activitiesByPackage, legacyForegroundPackages, screenInteractive, keyguardShown, excludedPackage
        )) {
            long intervalStart = Math.max(startMillis, cursor);
            if (endMillis > intervalStart) total += endMillis - intervalStart;
        }
        return Math.max(0L, total);
    }

    private static void apply(
        Event event,
        Map<String, Set<String>> activitiesByPackage,
        Set<String> legacyForegroundPackages
    ) {
        if (event.packageName.isEmpty()) return;
        if (event.type == ACTIVITY_RESUMED) {
            Set<String> activities = activitiesByPackage.get(event.packageName);
            if (activities == null) {
                activities = new HashSet<>();
                activitiesByPackage.put(event.packageName, activities);
            }
            activities.add(activityKey(event));
        } else if (event.type == ACTIVITY_PAUSED) {
            Set<String> activities = activitiesByPackage.get(event.packageName);
            if (activities == null) return;
            if (event.activityName.isEmpty()) activities.clear();
            else activities.remove(activityKey(event));
            if (activities.isEmpty()) activitiesByPackage.remove(event.packageName);
        } else if (event.type == MOVE_TO_FOREGROUND) {
            legacyForegroundPackages.add(event.packageName);
        } else if (event.type == MOVE_TO_BACKGROUND) {
            legacyForegroundPackages.remove(event.packageName);
            activitiesByPackage.remove(event.packageName);
        }
    }

    private static String activityKey(Event event) {
        return event.activityName.isEmpty() ? "\u0000" : event.activityName;
    }

    private static boolean hasEligibleForeground(
        Map<String, Set<String>> activitiesByPackage,
        Set<String> legacyForegroundPackages,
        boolean screenInteractive,
        boolean keyguardShown,
        String excludedPackage
    ) {
        if (!screenInteractive || keyguardShown) return false;
        for (Map.Entry<String, Set<String>> entry : activitiesByPackage.entrySet()) {
            if (!entry.getValue().isEmpty() && !entry.getKey().equals(excludedPackage)) return true;
        }
        for (String packageName : legacyForegroundPackages) {
            if (!packageName.equals(excludedPackage)) return true;
        }
        return false;
    }
}
