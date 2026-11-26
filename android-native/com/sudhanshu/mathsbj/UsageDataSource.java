package com.sudhanshu.mathsbj;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/** Shared local-only source and aggregation rules for app and widget usage. */
final class UsageDataSource {
    private static final long EVENT_HISTORY_LIMIT_MILLIS = 7L * 24L * 60L * 60L * 1000L;
    private static final long EVENT_STATE_LOOKBACK_MILLIS = 24L * 60L * 60L * 1000L;

    static final class Result {
        final Map<String, Long> appMillisByPackage = new HashMap<>();
        final Map<String, Map<String, AppUsage>> dailyAppUsageByPackage = new HashMap<>();
        final Map<String, Long> deviceMillisByDay = new HashMap<>();
        boolean deviceMillisAvailable;
    }

    static final class AppUsage {
        final long usageMillis;
        final long lastUsedTimestamp;

        AppUsage(long usageMillis, long lastUsedTimestamp) {
            this.usageMillis = usageMillis;
            this.lastUsedTimestamp = lastUsedTimestamp;
        }
    }

    private UsageDataSource() {}

    static Result query(Context context, UsageStatsManager manager, long startMillis, long endMillis) {
        if (context == null || manager == null || startMillis >= endMillis) return null;
        Result result = new Result();
        Calendar day = Calendar.getInstance();
        day.setTimeInMillis(startMillis);
        day.set(Calendar.HOUR_OF_DAY, 0);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        dateFormat.setTimeZone(TimeZone.getDefault());

        while (day.getTimeInMillis() < endMillis) {
            long dayStart = day.getTimeInMillis();
            Calendar nextDay = (Calendar) day.clone();
            nextDay.add(Calendar.DAY_OF_YEAR, 1);
            long dayEnd = Math.min(endMillis, nextDay.getTimeInMillis());
            List<UsageStats> stats = manager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, Math.max(startMillis, dayStart), dayEnd);
            if (stats == null) return null;

            Map<String, AppUsage> dayUsage = new HashMap<>();
            for (UsageStats stat : stats) {
                if (stat == null || stat.getPackageName() == null) continue;
                long duration = Math.max(0L, stat.getTotalTimeInForeground());
                if (duration <= 0L) continue;
                String packageName = stat.getPackageName();
                if (packageName.equals(context.getPackageName())) continue;
                AppUsage previous = dayUsage.get(packageName);
                // Daily UsageStats are already aggregated per package. Taking the maximum
                // makes duplicate interval rows idempotent rather than inflating the day.
                dayUsage.put(packageName, new AppUsage(
                    previous == null ? duration : Math.max(previous.usageMillis, duration),
                    Math.max(previous == null ? 0L : previous.lastUsedTimestamp, stat.getLastTimeUsed())));
            }
            String date = dateFormat.format(day.getTime());
            result.dailyAppUsageByPackage.put(date, dayUsage);
            for (Map.Entry<String, AppUsage> entry : dayUsage.entrySet()) {
                Long previous = result.appMillisByPackage.get(entry.getKey());
                result.appMillisByPackage.put(entry.getKey(),
                    (previous == null ? 0L : previous) + entry.getValue().usageMillis);
            }
            day = nextDay;
        }

        long now = System.currentTimeMillis();
        if (startMillis < now - EVENT_HISTORY_LIMIT_MILLIS) return result;
        try {
            long eventStart = Math.max(0L, startMillis - EVENT_STATE_LOOKBACK_MILLIS);
            UsageEvents source = manager.queryEvents(eventStart, endMillis);
            if (source == null) return result;
            List<UsageEventTimeline.Event> events = new ArrayList<>();
            UsageEvents.Event event = new UsageEvents.Event();
            while (source.hasNextEvent()) {
                if (!source.getNextEvent(event)) continue;
                int type = normalizeEventType(event.getEventType());
                if (type == 0) continue;
                events.add(new UsageEventTimeline.Event(
                    event.getTimeStamp(), event.getPackageName(), event.getClassName(), type));
            }
            long dayStart = startMillis;
            Calendar cursor = Calendar.getInstance();
            cursor.setTimeInMillis(startMillis);
            cursor.set(Calendar.HOUR_OF_DAY, 0);
            cursor.set(Calendar.MINUTE, 0);
            cursor.set(Calendar.SECOND, 0);
            cursor.set(Calendar.MILLISECOND, 0);
            while (dayStart < endMillis) {
                Calendar following = (Calendar) cursor.clone();
                following.add(Calendar.DAY_OF_YEAR, 1);
                long dayEnd = Math.min(endMillis, following.getTimeInMillis());
                String date = dateFormat.format(cursor.getTime());
                result.deviceMillisByDay.put(date, UsageEventTimeline.measure(
                    events, dayStart, dayEnd, context.getPackageName()));
                dayStart = dayEnd;
                cursor = following;
            }
            result.deviceMillisAvailable = true;
        } catch (RuntimeException unavailable) {
            result.deviceMillisByDay.clear();
            result.deviceMillisAvailable = false;
        }
        return result;
    }

    private static int normalizeEventType(int type) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) return UsageEventTimeline.ACTIVITY_RESUMED;
            if (type == UsageEvents.Event.ACTIVITY_PAUSED) return UsageEventTimeline.ACTIVITY_PAUSED;
        } else {
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) return UsageEventTimeline.MOVE_TO_FOREGROUND;
            if (type == UsageEvents.Event.MOVE_TO_BACKGROUND) return UsageEventTimeline.MOVE_TO_BACKGROUND;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (type == UsageEvents.Event.SCREEN_INTERACTIVE) return UsageEventTimeline.SCREEN_INTERACTIVE;
            if (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE) return UsageEventTimeline.SCREEN_NON_INTERACTIVE;
            if (type == UsageEvents.Event.KEYGUARD_SHOWN) return UsageEventTimeline.KEYGUARD_SHOWN;
            if (type == UsageEvents.Event.KEYGUARD_HIDDEN) return UsageEventTimeline.KEYGUARD_HIDDEN;
            if (type == UsageEvents.Event.DEVICE_SHUTDOWN) return UsageEventTimeline.DEVICE_SHUTDOWN;
            if (type == UsageEvents.Event.DEVICE_STARTUP) return UsageEventTimeline.DEVICE_STARTUP;
        }
        return 0;
    }
}
