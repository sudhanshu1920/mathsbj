package com.sudhanshu.mathsbj;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Local-only, worker-thread UsageStats snapshots for the existing home-screen widget renderer.
 * Study Apps and the device inventory are intentionally resolved from different sources.
 */
final class WidgetScreenTimeRepository {
    private static final long CACHE_TTL_MS = 2L * 60L * 1000L;
    private static final int MAX_SNAPSHOTS = 9;
    private static final int ICON_SIZE_DP = 24;
    private static final Object LOCK = new Object();
    private static final Map<String, Snapshot> SNAPSHOTS = new HashMap<>();
    private static final Map<String, Long> SNAPSHOT_CACHED_AT = new HashMap<>();
    private static final Map<String, Long> IN_FLIGHT = new HashMap<>();
    private static final Map<String, List<Runnable>> REFRESH_CALLBACKS = new HashMap<>();
    private static long cacheGeneration = 1L;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "MathMasterWidgetUsageStats");
        thread.setDaemon(true);
        return thread;
    });
    private static final LruCache<String, Bitmap> ICONS = new LruCache<String, Bitmap>(1024 * 1024) {
        @Override protected int sizeOf(String key, Bitmap value) {
            return value == null ? 0 : Math.max(1, value.getByteCount());
        }
    };

    private WidgetScreenTimeRepository() {}

    static final class AppChoice {
        final String packageName;
        final String label;
        AppChoice(String packageName, String label) {
            this.packageName = packageName;
            this.label = label;
        }
    }

    private static final class AppRecord {
        final String packageName;
        final String label;
        final boolean eligibleDeviceApp;
        final long usageMillis;
        final Bitmap icon;
        AppRecord(String packageName, String label, boolean eligibleDeviceApp, long usageMillis, Bitmap icon) {
            this.packageName = packageName;
            this.label = label;
            this.eligibleDeviceApp = eligibleDeviceApp;
            this.usageMillis = usageMillis;
            this.icon = icon;
        }
    }

    static final class Snapshot {
        final String status;
        final String period;
        final long startMillis;
        final long endMillis;
        final long updatedAt;
        final Map<String, AppRecord> apps;
        Snapshot(String status, String period, long startMillis, long endMillis, long updatedAt,
                 Map<String, AppRecord> apps) {
            this.status = status;
            this.period = period;
            this.startMillis = startMillis;
            this.endMillis = endMillis;
            this.updatedAt = updatedAt;
            this.apps = apps;
        }
    }

    static void invalidateCaches() {
        synchronized (LOCK) {
            // Keep the last successful snapshot as a clearly timestamped fallback while forcing
            // a new query. Permission revocation is handled synchronously below and never exposes
            // cached usage after access has been withdrawn.
            SNAPSHOT_CACHED_AT.clear();
            REFRESH_CALLBACKS.clear();
            cacheGeneration = cacheGeneration == Long.MAX_VALUE ? 1L : cacheGeneration + 1L;
        }
        synchronized (ICONS) {
            ICONS.evictAll();
        }
    }

    static boolean hasUsageAccess(Context context) {
        return context != null && AppUsageAnalyticsPlugin.hasUsageAccess(context.getApplicationContext());
    }

    static Snapshot getCachedSnapshot(Context context, String period) {
        Bounds bounds = bounds(period);
        String safePeriod = normalizePeriod(period);
        if (!hasUsageAccess(context)) {
            return new Snapshot("permission_required", safePeriod, bounds.start, bounds.end,
                System.currentTimeMillis(), Collections.emptyMap());
        }
        String key = cacheKey(safePeriod, bounds.start, bounds.end);
        synchronized (LOCK) {
            Snapshot cached = SNAPSHOTS.get(key);
            if (cached != null) return cached;
        }
        return new Snapshot("loading", safePeriod, bounds.start, bounds.end, 0L, Collections.emptyMap());
    }

    static void requestRefresh(Context context, String period, Runnable afterRefresh) {
        if (context == null) return;
        Context app = context.getApplicationContext();
        Bounds bounds = bounds(period);
        String safePeriod = normalizePeriod(period);
        String key = cacheKey(safePeriod, bounds.start, bounds.end);
        long now = System.currentTimeMillis();
        final long requestGeneration;
        synchronized (LOCK) {
            Snapshot cached = SNAPSHOTS.get(key);
            long cacheAt = (SNAPSHOT_CACHED_AT.get(key) == null ? 0L : SNAPSHOT_CACHED_AT.get(key));
            if (cached != null && cacheAt > 0L && now - cacheAt < CACHE_TTL_MS) {
                if (afterRefresh != null) MAIN.post(afterRefresh);
                return;
            }
            if (afterRefresh != null) {
                List<Runnable> pendingCallbacks = REFRESH_CALLBACKS.get(key);
                if (pendingCallbacks == null) {
                    pendingCallbacks = new ArrayList<>();
                    REFRESH_CALLBACKS.put(key, pendingCallbacks);
                }
                pendingCallbacks.add(afterRefresh);
            }
            requestGeneration = cacheGeneration;
            Long runningGeneration = IN_FLIGHT.get(key);
            if (runningGeneration != null && runningGeneration == requestGeneration) return;
            // A request from an older selection/package snapshot must not block the refreshed one.
            IN_FLIGHT.put(key, requestGeneration);
        }
        WORKER.execute(() -> {
            Snapshot result;
            try {
                result = query(app, safePeriod, bounds);
            } catch (RuntimeException failure) {
                result = new Snapshot("error", safePeriod, bounds.start, bounds.end,
                    System.currentTimeMillis(), Collections.emptyMap());
            }
            List<Runnable> callbacks;
            synchronized (LOCK) {
                Long activeGeneration = IN_FLIGHT.get(key);
                if (activeGeneration == null || activeGeneration != requestGeneration
                    || cacheGeneration != requestGeneration) {
                    // A newer app selection, package inventory or time-zone snapshot superseded us.
                    return;
                }
                Snapshot previous = SNAPSHOTS.get(key);
                // Retain last-known-good local values when the next system query fails. Keep
                // the original timestamp so a stale value is never presented as freshly queried.
                if ("error".equals(result.status) && previous != null && "ok".equals(previous.status)) {
                    result = previous;
                }
                SNAPSHOTS.put(key, result);
                SNAPSHOT_CACHED_AT.put(key, System.currentTimeMillis());
                IN_FLIGHT.remove(key);
                while (SNAPSHOTS.size() > MAX_SNAPSHOTS) {
                    String oldestKey = null;
                    long oldestTime = Long.MAX_VALUE;
                    for (String candidate : SNAPSHOTS.keySet()) {
                        if (candidate.equals(key) || IN_FLIGHT.containsKey(candidate)) continue;
                        long cachedAt = (SNAPSHOT_CACHED_AT.get(candidate) == null ? 0L : SNAPSHOT_CACHED_AT.get(candidate));
                        if (cachedAt < oldestTime) {
                            oldestTime = cachedAt;
                            oldestKey = candidate;
                        }
                    }
                    if (oldestKey == null) break;
                    SNAPSHOTS.remove(oldestKey);
                    SNAPSHOT_CACHED_AT.remove(oldestKey);
                }
                callbacks = REFRESH_CALLBACKS.remove(key);
            }
            MAIN.post(() -> {
                MathMasterHomeWidgetProvider.refreshScreenTimeInstances(app, safePeriod);
                if (callbacks != null) {
                    for (Runnable callback : callbacks) {
                        try { callback.run(); } catch (RuntimeException ignored) {}
                    }
                }
            });
        });
    }

    static List<AppChoice> getStudyAppChoices(Context context) {
        List<AppChoice> choices = new ArrayList<>();
        if (context == null) return choices;
        PackageManager pm = context.getPackageManager();
        for (String packageName : StudyModeManager.getSelectedStudyAppPackages(context)) {
            AppChoice choice = getChoice(pm, packageName);
            if (choice != null) choices.add(choice);
        }
        sortChoices(choices);
        return choices;
    }

    static List<AppChoice> getDeviceAppChoices(Context context) {
        List<AppChoice> choices = new ArrayList<>();
        if (context == null) return choices;
        PackageManager pm = context.getPackageManager();
        for (ApplicationInfo info : installedApplications(pm)) {
            if (info == null || !isEligibleDeviceApp(pm, info)) continue;
            String label = applicationLabel(pm, info);
            choices.add(new AppChoice(info.packageName, label));
        }
        sortChoices(choices);
        return choices;
    }

    static MathMasterWidgetRenderer.ScreenTimeSection buildSection(
        Context context,
        Snapshot snapshot,
        boolean studyApps,
        Set<String> hiddenPackages,
        String sort,
        int maxEntries
    ) {
        MathMasterWidgetRenderer.ScreenTimeSection section = new MathMasterWidgetRenderer.ScreenTimeSection();
        section.title = studyApps ? "Study Apps" : "Device Apps";
        section.periodLabel = periodLabel(snapshot == null ? "today" : snapshot.period);
        section.lastUpdatedAt = snapshot == null ? 0L : snapshot.updatedAt;

        List<String> selectedStudyPackages = studyApps
            ? StudyModeManager.getSelectedStudyAppPackages(context) : Collections.emptyList();
        if (studyApps && selectedStudyPackages.isEmpty()) {
            section.status = "no_study_apps";
            return section;
        }
        if (snapshot == null || "loading".equals(snapshot.status)) {
            section.status = "loading";
            return section;
        }
        if ("permission_required".equals(snapshot.status)) {
            section.status = "permission_required";
            return section;
        }
        if ("error".equals(snapshot.status)) {
            section.status = "error";
            return section;
        }

        Set<String> hidden = hiddenPackages == null ? Collections.emptySet() : hiddenPackages;
        List<AppRecord> allSelected = new ArrayList<>();
        if (studyApps) {
            for (String packageName : selectedStudyPackages) {
                AppRecord record = snapshot.apps.get(packageName);
                if (record != null) allSelected.add(record);
            }
        } else {
            for (AppRecord record : snapshot.apps.values()) {
                if (record.eligibleDeviceApp && record.usageMillis > 0L && !hidden.contains(record.packageName)) {
                    allSelected.add(record);
                }
            }
        }
        if (allSelected.isEmpty()) {
            section.status = studyApps ? "no_visible_apps" : "no_usage";
            return section;
        }

        long total = 0L;
        for (AppRecord record : allSelected) total += Math.max(0L, record.usageMillis);
        if (total <= 0L) {
            section.status = "no_usage";
            return section;
        }

        List<AppRecord> all = new ArrayList<>();
        for (AppRecord record : allSelected) {
            if (!studyApps || !hidden.contains(record.packageName)) all.add(record);
        }
        if (all.isEmpty()) {
            section.status = "no_visible_apps";
            return section;
        }
        Comparator<AppRecord> comparator = appComparator(sort);
        Collections.sort(all, comparator);

        // Study Apps total includes every currently selected app, even hidden rows and rows beyond
        // the visible limit. Device total is the sum of entries selected for display.
        if (studyApps) {
            section.totalUsageMillis = total;
        } else {
            int count = Math.max(1, Math.min(12, maxEntries));
            int included = Math.min(count, all.size());
            for (int index = 0; index < included; index++) {
                section.totalUsageMillis += Math.max(0L, all.get(index).usageMillis);
            }
            all = new ArrayList<>(all.subList(0, included));
        }

        int count = Math.max(1, Math.min(12, maxEntries));
        int visible = Math.min(count, all.size());
        for (int index = 0; index < visible; index++) {
            AppRecord record = all.get(index);
            MathMasterWidgetRenderer.ScreenTimeEntry entry = new MathMasterWidgetRenderer.ScreenTimeEntry();
            entry.packageName = record.packageName;
            entry.label = record.label;
            entry.usageMillis = Math.max(0L, record.usageMillis);
            entry.percent = section.totalUsageMillis > 0L
                ? (float) (entry.usageMillis * 100.0d / section.totalUsageMillis) : 0f;
            entry.icon = record.icon;
            section.entries.add(entry);
        }
        section.status = "ok";
        return section;
    }

    private static Snapshot query(Context context, String period, Bounds bounds) {
        if (!hasUsageAccess(context)) {
            return new Snapshot("permission_required", period, bounds.start, bounds.end,
                System.currentTimeMillis(), Collections.emptyMap());
        }
        UsageStatsManager manager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null) {
            return new Snapshot("error", period, bounds.start, bounds.end,
                System.currentTimeMillis(), Collections.emptyMap());
        }
        List<UsageStats> stats = manager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, bounds.start, bounds.end);
        if (stats == null) {
            return new Snapshot("error", period, bounds.start, bounds.end,
                System.currentTimeMillis(), Collections.emptyMap());
        }

        Map<String, Long> usage = new HashMap<>();
        Set<String> seenRecords = new HashSet<>();
        for (UsageStats stat : stats) {
            if (stat == null || stat.getPackageName() == null) continue;
            long duration = Math.max(0L, stat.getTotalTimeInForeground());
            if (duration <= 0L) continue;
            String packageName = stat.getPackageName();
            String identity = packageName + "|" + stat.getFirstTimeStamp() + "|"
                + stat.getLastTimeUsed() + "|" + duration;
            if (!seenRecords.add(identity)) continue;
            Long previousDuration = usage.get(packageName);
            usage.put(packageName, (previousDuration == null ? 0L : previousDuration) + duration);
        }

        PackageManager pm = context.getPackageManager();
        Map<String, ApplicationInfo> installed = new HashMap<>();
        for (ApplicationInfo info : installedApplications(pm)) {
            if (info != null && info.packageName != null) installed.put(info.packageName, info);
        }
        Set<String> selectedStudy = new HashSet<>(StudyModeManager.getSelectedStudyAppPackages(context));
        Map<String, AppRecord> appRecords = new HashMap<>();
        float density = Math.max(1f, context.getResources().getDisplayMetrics().density);
        int iconSize = Math.max(40, Math.min(96, Math.round(ICON_SIZE_DP * density)));
        for (Map.Entry<String, ApplicationInfo> item : installed.entrySet()) {
            String packageName = item.getKey();
            ApplicationInfo info = item.getValue();
            Long usageValue = usage.get(packageName);
            long duration = Math.min(Math.max(0L, usageValue == null ? 0L : usageValue),
                Math.max(0L, bounds.end - bounds.start));
            boolean deviceEligible = isEligibleDeviceApp(pm, info);
            if (duration <= 0L && !selectedStudy.contains(packageName)) continue;
            if (!deviceEligible && !selectedStudy.contains(packageName)) continue;
            String label = applicationLabel(pm, info);
            // PackageManager icon decoding is performed by this worker-thread query, never by
            // RemoteViews / Canvas rendering on the main thread.
            Bitmap icon = loadIcon(pm, packageName, info, iconSize);
            appRecords.put(packageName, new AppRecord(packageName, label, deviceEligible, duration, icon));
        }
        return new Snapshot("ok", period, bounds.start, bounds.end, System.currentTimeMillis(), appRecords);
    }

    private static Bitmap loadIcon(PackageManager pm, String packageName, ApplicationInfo info, int size) {
        String cacheKey = packageName;
        synchronized (ICONS) {
            Bitmap cached = ICONS.get(cacheKey);
            if (cached != null && !cached.isRecycled()) return cached;
        }
        try {
            Drawable drawable = pm.getApplicationIcon(info);
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(canvas);
            synchronized (ICONS) {
                ICONS.put(cacheKey, bitmap);
            }
            return bitmap;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static AppChoice getChoice(PackageManager pm, String packageName) {
        try {
            ApplicationInfo info = applicationInfo(pm, packageName);
            if (info == null) return null;
            return new AppChoice(packageName, applicationLabel(pm, info));
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static ApplicationInfo applicationInfo(PackageManager pm, String packageName) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0L));
            }
            return pm.getApplicationInfo(packageName, 0);
        } catch (PackageManager.NameNotFoundException notInstalled) {
            return null;
        }
    }

    private static List<ApplicationInfo> installedApplications(PackageManager pm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0L));
        }
        return pm.getInstalledApplications(0);
    }

    private static String applicationLabel(PackageManager pm, ApplicationInfo info) {
        try {
            CharSequence label = pm.getApplicationLabel(info);
            return label == null || label.length() == 0 ? info.packageName : label.toString();
        } catch (RuntimeException ignored) {
            return info.packageName;
        }
    }

    private static boolean isEligibleDeviceApp(PackageManager pm, ApplicationInfo info) {
        if (info == null || !info.enabled || info.packageName == null) return false;
        int flags = info.flags;
        boolean system = (flags & ApplicationInfo.FLAG_SYSTEM) != 0;
        boolean updatedSystem = (flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0;
        if (!system || updatedSystem) return true;
        // Include preinstalled apps that have a normal launcher entry (for example, OEM
        // and Google apps) while filtering framework and non-launchable technical packages.
        try {
            return pm.getLaunchIntentForPackage(info.packageName) != null;
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    private static void sortChoices(List<AppChoice> choices) {
        Collections.sort(choices, new Comparator<AppChoice>() {
            @Override public int compare(AppChoice left, AppChoice right) {
                return left.label.toLowerCase(Locale.ROOT).compareTo(right.label.toLowerCase(Locale.ROOT));
            }
        });
    }

    private static Comparator<AppRecord> appComparator(String sort) {
        return new Comparator<AppRecord>() {
            @Override public int compare(AppRecord left, AppRecord right) {
                String leftName = left.label.toLowerCase(Locale.ROOT);
                String rightName = right.label.toLowerCase(Locale.ROOT);
                if ("name_asc".equals(sort)) return leftName.compareTo(rightName);
                if ("name_desc".equals(sort)) return rightName.compareTo(leftName);
                int usageOrder = "least_used".equals(sort)
                    ? Long.compare(left.usageMillis, right.usageMillis)
                    : Long.compare(right.usageMillis, left.usageMillis);
                return usageOrder != 0 ? usageOrder : leftName.compareTo(rightName);
            }
        };
    }

    private static Bounds bounds(String period) {
        Calendar today = Calendar.getInstance();
        today.set(Calendar.HOUR_OF_DAY, 0);
        today.set(Calendar.MINUTE, 0);
        today.set(Calendar.SECOND, 0);
        today.set(Calendar.MILLISECOND, 0);
        Calendar start = (Calendar) today.clone();
        Calendar end = Calendar.getInstance();
        if ("yesterday".equals(period)) {
            start.add(Calendar.DAY_OF_YEAR, -1);
            end = (Calendar) today.clone();
        } else if ("last_7_days".equals(period)) {
            start.add(Calendar.DAY_OF_YEAR, -6);
        }
        return new Bounds(start.getTimeInMillis(), end.getTimeInMillis());
    }

    private static String cacheKey(String period, long start, long end) {
        // Today's and Last 7 Days' query end advances every time the widget renders. Calendar
        // start + timezone identifies the period; the two-minute TTL controls its freshness.
        return period + "|" + TimeZone.getDefault().getID() + "|" + start;
    }

    private static String normalizePeriod(String period) {
        if ("yesterday".equals(period) || "last_7_days".equals(period)) return period;
        return "today";
    }

    private static String periodLabel(String period) {
        if ("yesterday".equals(period)) return "Yesterday";
        if ("last_7_days".equals(period)) return "Last 7 Days";
        return "Today";
    }

    private static final class Bounds {
        final long start;
        final long end;
        Bounds(long start, long end) { this.start = start; this.end = end; }
    }
}
