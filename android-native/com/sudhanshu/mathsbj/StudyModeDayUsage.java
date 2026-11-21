package com.sudhanshu.mathsbj;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

/** Pure-Java, device-local foreground usage aggregator for a single wall-clock day. */
public final class StudyModeDayUsage {
    public static final int ACTIVITY_RESUMED = 1;
    public static final int ACTIVITY_PAUSED = 2;
    public static final int SCREEN_NON_INTERACTIVE = 3;
    public static final int KEYGUARD_SHOWN = 4;
    public static final int DEVICE_SHUTDOWN = 5;
    public static final int MOVE_TO_FOREGROUND = 6;
    public static final int MOVE_TO_BACKGROUND = 7;

    private StudyModeDayUsage() {}

    public static final class Event {
        public final long timestampMs;
        public final String packageName;
        public final String activityClass;
        public final int type;

        public Event(long timestampMs, String packageName, String activityClass, int type) {
            this.timestampMs = timestampMs;
            this.packageName = packageName == null ? "" : packageName;
            this.activityClass = activityClass == null ? "" : activityClass;
            this.type = type;
        }
    }

    public static final class Result {
        private final Map<String, Long> totals;
        private final Map<String, long[]> hourly;
        public final long dayStartMs;
        public final long throughMs;

        private Result(Map<String, Long> totals, Map<String, long[]> hourly,
                       long dayStartMs, long throughMs) {
            this.totals = Collections.unmodifiableMap(new HashMap<>(totals));
            Map<String, long[]> copy = new HashMap<>();
            for (Map.Entry<String, long[]> entry : hourly.entrySet()) {
                copy.put(entry.getKey(), entry.getValue().clone());
            }
            this.hourly = Collections.unmodifiableMap(copy);
            this.dayStartMs = dayStartMs;
            this.throughMs = throughMs;
        }

        public long totalMillis(String packageName) {
            Long value = totals.get(packageName);
            return value == null ? 0L : value;
        }

        /** Returns a defensive copy of the 24 device-local wall-clock hour buckets. */
        public long[] hourlyMillis(String packageName) {
            long[] value = hourly.get(packageName);
            return value == null ? new long[24] : value.clone();
        }

        public Map<String, Long> totals() { return totals; }
    }

    /**
     * Aggregates resumed activity intervals. Events may start before dayStartMs so
     * a session crossing midnight contributes only its post-midnight portion.
     * Multiple resumed activities in one package are unioned; split-screen apps
     * remain independently accounted. The last unmatched resume is closed at now.
     */
    public static Result aggregate(long dayStartMs, long nowMs, TimeZone zone, List<Event> input) {
        long endMs = Math.max(dayStartMs, nowMs);
        TimeZone safeZone = zone == null ? TimeZone.getDefault() : (TimeZone) zone.clone();
        List<Event> events = new ArrayList<>();
        if (input != null) {
            for (Event event : input) if (event != null) events.add(event);
        }
        Collections.sort(events, new Comparator<Event>() {
            @Override public int compare(Event left, Event right) {
                return left.timestampMs < right.timestampMs ? -1
                    : (left.timestampMs == right.timestampMs ? 0 : 1);
            }
        });

        Map<String, Activity> activeActivities = new HashMap<>();
        Map<String, PackageActivity> activePackages = new HashMap<>();
        Map<String, Long> totals = new HashMap<>();
        Map<String, long[]> buckets = new HashMap<>();

        for (Event event : events) {
            if (event.timestampMs > endMs) continue;
            long at = Math.max(0L, event.timestampMs);
            if (event.type == SCREEN_NON_INTERACTIVE || event.type == KEYGUARD_SHOWN
                    || event.type == DEVICE_SHUTDOWN) {
                closeAll(activeActivities, activePackages, totals, buckets,
                    dayStartMs, endMs, at, safeZone);
                continue;
            }
            if (event.packageName.isEmpty()) continue;
            String activityKey = event.packageName + '\u0000' + event.activityClass;
            if (event.type == ACTIVITY_RESUMED || event.type == MOVE_TO_FOREGROUND) {
                if (activeActivities.containsKey(activityKey)) continue;
                activeActivities.put(activityKey, new Activity(event.packageName));
                PackageActivity state = activePackages.get(event.packageName);
                if (state == null) {
                    state = new PackageActivity();
                    activePackages.put(event.packageName, state);
                }
                if (state.activityCount == 0) state.startedAtMs = at;
                state.activityCount++;
            } else if (event.type == ACTIVITY_PAUSED || event.type == MOVE_TO_BACKGROUND) {
                Activity removed = activeActivities.remove(activityKey);
                if (removed == null) continue;
                PackageActivity state = activePackages.get(removed.packageName);
                if (state == null) continue;
                state.activityCount = Math.max(0, state.activityCount - 1);
                if (state.activityCount == 0) {
                    addInterval(removed.packageName, state.startedAtMs, at,
                        dayStartMs, endMs, safeZone, totals, buckets);
                    activePackages.remove(removed.packageName);
                }
            }
        }
        closeAll(activeActivities, activePackages, totals, buckets,
            dayStartMs, endMs, endMs, safeZone);
        return new Result(totals, buckets, dayStartMs, endMs);
    }

    private static void closeAll(Map<String, Activity> activities,
                                 Map<String, PackageActivity> packages,
                                 Map<String, Long> totals, Map<String, long[]> buckets,
                                 long dayStartMs, long nowMs, long atMs, TimeZone zone) {
        for (Map.Entry<String, PackageActivity> entry : packages.entrySet()) {
            PackageActivity state = entry.getValue();
            addInterval(entry.getKey(), state.startedAtMs, atMs,
                dayStartMs, nowMs, zone, totals, buckets);
        }
        activities.clear();
        packages.clear();
    }

    private static void addInterval(String packageName, long startMs, long endMs,
                                    long dayStartMs, long nowMs, TimeZone zone,
                                    Map<String, Long> totals, Map<String, long[]> buckets) {
        long cursor = Math.max(dayStartMs, Math.max(0L, startMs));
        long end = Math.min(nowMs, endMs);
        if (end <= cursor) return;
        long total = totals.containsKey(packageName) ? totals.get(packageName) : 0L;
        long[] hours = buckets.get(packageName);
        if (hours == null) {
            hours = new long[24];
            buckets.put(packageName, hours);
        }
        Calendar boundary = Calendar.getInstance(zone);
        Calendar local = Calendar.getInstance(zone);
        while (cursor < end) {
            local.setTimeInMillis(cursor);
            int hour = local.get(Calendar.HOUR_OF_DAY);
            boundary.setTimeInMillis(cursor);
            boundary.set(Calendar.MINUTE, 0);
            boundary.set(Calendar.SECOND, 0);
            boundary.set(Calendar.MILLISECOND, 0);
            boundary.set(Calendar.HOUR_OF_DAY, hour + 1);
            long nextHour = boundary.getTimeInMillis();
            if (nextHour <= cursor) nextHour = cursor + 60_000L;
            long segmentEnd = Math.min(end, nextHour);
            long duration = segmentEnd - cursor;
            if (duration <= 0L) break;
            hours[hour] = saturatingAdd(hours[hour], duration);
            total = saturatingAdd(total, duration);
            cursor = segmentEnd;
        }
        totals.put(packageName, total);
    }

    private static long saturatingAdd(long left, long right) {
        if (right > 0L && left > Long.MAX_VALUE - right) return Long.MAX_VALUE;
        return left + right;
    }

    private static final class Activity {
        final String packageName;
        Activity(String packageName) { this.packageName = packageName; }
    }

    private static final class PackageActivity {
        int activityCount;
        long startedAtMs;
    }
}
