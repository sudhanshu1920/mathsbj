package com.sudhanshu.mathsbj;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Process;
import android.util.LruCache;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Local-only, permission-aware screen-time snapshots shared by the home-screen widget renderer. */
final class WidgetScreenTimeData {
    private static final String TAG = "WidgetScreenTime";
    static final String ACTION_DATA_UPDATED = "com.sudhanshu.mathsbj.WIDGET_SCREEN_TIME_UPDATED";
    private static final String PREFS = "math_master_widget_screen_time";
    private static final long CACHE_TTL_MS = 5L * 60L * 1000L;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "MathMasterWidgetUsage");
        t.setDaemon(true);
        return t;
    });
    private static final AtomicBoolean REFRESHING = new AtomicBoolean(false);
    private static final LruCache<String, Bitmap> ICONS = new LruCache<>(96);
    private static volatile long lastRefreshAt;
    private static volatile long inventoryCachedAt;
    private static volatile long lastRefreshFailedAt;
    private static volatile Map<String, ApplicationInfo> inventoryCache = Collections.emptyMap();

    static final class App {
        final String packageName;
        final String label;
        final long usageMillis;
        final int percentage;
        final Bitmap icon;
        App(String packageName, String label, long usageMillis, int percentage, Bitmap icon) {
            this.packageName = packageName; this.label = label; this.usageMillis = usageMillis;
            this.percentage = percentage; this.icon = icon;
        }
    }

    static final class Block {
        String state = "unavailable";
        String title = "Screen Time";
        String periodLabel = "Today";
        String updatedLabel = "";
        long totalUsageMillis = 0L;
        boolean showTotal = true;
        boolean showPercent = true;
        boolean showUsage = true;
        boolean compact = false;
        final List<App> apps = new ArrayList<>();
    }

    private WidgetScreenTimeData() {}

    static Block load(Context context, boolean studyOnly, int widgetId) {
        Context app = context.getApplicationContext();
        String prefix = "instance_" + widgetId + "_";
        android.content.SharedPreferences prefs = app.getSharedPreferences("math_master_home_widget", Context.MODE_PRIVATE);
        String key = studyOnly ? "study" : "device";
        return load(app, studyOnly, widgetId,
            prefs.getString(prefix + key + "Period", "today"),
            prefs.getString(prefix + key + "Sort", "most_used"),
            prefs.getInt(prefix + key + "MaxApps", 5),
            prefs.getBoolean(prefix + key + "ShowTotal", true),
            prefs.getBoolean(prefix + key + "ShowPercent", true),
            prefs.getBoolean(prefix + key + "ShowUsage", true),
            prefs.getBoolean(prefix + key + "Compact", false));
    }

    static Block load(Context context, boolean studyOnly, int widgetId, String requestedPeriod,
        String requestedSort, int requestedMax, boolean showTotal, boolean showPercent,
        boolean showUsage, boolean compact) {
        Context app = context.getApplicationContext();
        String prefix = "instance_" + widgetId + "_";
        android.content.SharedPreferences widgetPrefs = app.getSharedPreferences("math_master_home_widget", Context.MODE_PRIVATE);
        String key = studyOnly ? "study" : "device";
        boolean filterEnabled = widgetPrefs.getBoolean(prefix + key + "AppFilterEnabled", false);
        Set<String> appFilter = parsePackageFilter(widgetPrefs.getString(prefix + key + "AppFilterJson", "[]"));
        return load(app, studyOnly, widgetId, requestedPeriod, requestedSort, requestedMax,
            showTotal, showPercent, showUsage, compact, filterEnabled, appFilter);
    }

    static Block load(Context context, boolean studyOnly, int widgetId, String requestedPeriod,
        String requestedSort, int requestedMax, boolean showTotal, boolean showPercent,
        boolean showUsage, boolean compact, boolean filterEnabled, Set<String> appFilter) {
        Context app = context.getApplicationContext();
        String period = safePeriod(requestedPeriod);
        String sort = safeSort(requestedSort);
        int max = Math.max(1, Math.min(8, requestedMax));

        Block block = new Block();
        block.title = studyOnly ? "Study Apps Usage" : "Device App Usage";
        block.periodLabel = periodLabel(period);
        block.showTotal = showTotal; block.showPercent = showPercent;
        block.showUsage = showUsage; block.compact = compact;

        if (!hasUsageAccess(app)) {
            block.state = "permission_required";
            return block;
        }
        List<String> studyPackages = studyOnly ? StudyModeManager.getSelectedStudyAppPackages(app) : Collections.emptyList();
        if (studyOnly && studyPackages.isEmpty()) {
            block.state = "no_study_apps";
            return block;
        }
        if (filterEnabled && appFilter.isEmpty()) {
            block.state = "filter_empty";
            return block;
        }

        try {
            JSONObject days = AppUsageAnalyticsStore.shared().readWidgetDays(app);
            List<String> dates = requestedDates(period);
            Map<String, Long> totals = new HashMap<>();
            Map<String, String> labels = new HashMap<>();
            long newestQuery = 0L;
            boolean allDaysFresh = true;
            for (String date : dates) {
                JSONObject day = days.optJSONObject(date);
                if (day == null) { allDaysFresh = false; continue; }
                long queriedAt = day.optLong("queriedAt", 0L);
                newestQuery = Math.max(newestQuery, queriedAt);
                if (queriedAt <= 0L || System.currentTimeMillis() - queriedAt > CACHE_TTL_MS) allDaysFresh = false;
                JSONObject apps = day.optJSONObject("apps");
                if (apps == null) continue;
                Iterator<String> iterator = apps.keys();
                while (iterator.hasNext()) {
                    String pkg = iterator.next();
                    JSONObject item = apps.optJSONObject(pkg);
                    if (item == null) continue;
                    long duration = Math.max(0L, item.optLong("usageMillis", 0L));
                    if (duration > 0L) {
                        totals.put(pkg, totals.getOrDefault(pkg, 0L) + duration);
                        labels.put(pkg, item.optString("label", pkg));
                    }
                }
            }
            if (!allDaysFresh) scheduleRefresh(app);
            if (newestQuery > 0L) {
                block.updatedLabel = (allDaysFresh ? "Updated " : "Stale · updated ")
                    + relativeAge(System.currentTimeMillis() - newestQuery);
            }

            List<App> all = new ArrayList<>();
            if (studyOnly) {
                for (String pkg : studyPackages) {
                    if (filterEnabled && !appFilter.contains(pkg)) continue;
                    if (!isInstalledVisible(app, pkg)) continue;
                    long duration = totals.getOrDefault(pkg, 0L);
                    String label = resolveLabel(app, pkg, labels.get(pkg));
                    all.add(new App(pkg, label, duration, 0, null));
                }
            } else {
                Map<String, ApplicationInfo> inventory = cachedDeviceInventory();
                if (inventory.isEmpty()) {
                    block.state = lastRefreshFailedAt > 0L
                        && System.currentTimeMillis() - lastRefreshFailedAt < 60_000L ? "unavailable" : "loading";
                    scheduleRefresh(app);
                    return block;
                }
                for (Map.Entry<String, Long> entry : totals.entrySet()) {
                    if (filterEnabled && !appFilter.contains(entry.getKey())) continue;
                    ApplicationInfo info = inventory.get(entry.getKey());
                    if (info == null) continue;
                    all.add(new App(entry.getKey(), resolveLabel(app, entry.getKey(), labels.get(entry.getKey())),
                        entry.getValue(), 0, icon(app, entry.getKey())));
                }
            }
            Comparator<App> comparator;
            if ("least_used".equals(sort)) comparator = Comparator.comparingLong(a -> a.usageMillis);
            else if ("name_az".equals(sort)) comparator = Comparator.comparing(a -> a.label.toLowerCase(Locale.ROOT));
            else if ("name_za".equals(sort)) comparator = Comparator.comparing((App a) -> a.label.toLowerCase(Locale.ROOT)).reversed();
            else comparator = Comparator.comparingLong((App a) -> a.usageMillis).reversed();
            all.sort(comparator);

            long total = 0L;
            for (App appEntry : all) total += appEntry.usageMillis;
            block.totalUsageMillis = total;
            if (total <= 0L) {
                block.state = allDaysFresh ? "no_usage"
                    : (lastRefreshFailedAt > 0L && System.currentTimeMillis() - lastRefreshFailedAt < 60_000L
                        ? "unavailable" : "loading");
                return block;
            }
            int visible = 0;
            for (App appEntry : all) {
                if (visible++ >= max) break;
                int percent = total > 0L ? (int) Math.round(appEntry.usageMillis * 100d / total) : 0;
                block.apps.add(new App(appEntry.packageName, appEntry.label, appEntry.usageMillis,
                    Math.max(0, Math.min(100, percent)), icon(app, appEntry.packageName)));
            }
            block.state = block.apps.isEmpty() ? "no_usage" : "ready";
            return block;
        } catch (Exception error) {
            Log.w(TAG, "Unable to prepare screen-time widget data", error);
            scheduleRefresh(app);
            block.state = "unavailable";
            return block;
        }
    }

    static void scheduleRefresh(Context context) {
        Context app = context.getApplicationContext();
        if (!hasUsageAccess(app)
            || (lastRefreshFailedAt > 0L && System.currentTimeMillis() - lastRefreshFailedAt < 60_000L)
            || !REFRESHING.compareAndSet(false, true)) return;
        WORKER.execute(() -> {
            try {
                UsageStatsManager manager = (UsageStatsManager) app.getSystemService(Context.USAGE_STATS_SERVICE);
                if (manager == null) throw new IllegalStateException("UsageStatsManager is unavailable.");
                JSONObject replacements = new JSONObject();
                SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                formatter.setTimeZone(TimeZone.getDefault());
                Calendar cursor = Calendar.getInstance();
                cursor.add(Calendar.DAY_OF_YEAR, -6);
                cursor.set(Calendar.HOUR_OF_DAY, 0); cursor.set(Calendar.MINUTE, 0);
                cursor.set(Calendar.SECOND, 0); cursor.set(Calendar.MILLISECOND, 0);
                Calendar end = Calendar.getInstance();
                while (cursor.before(end)) {
                    long start = cursor.getTimeInMillis();
                    Calendar next = (Calendar) cursor.clone();
                    next.add(Calendar.DAY_OF_YEAR, 1);
                    long finish = Math.min(next.getTimeInMillis(), end.getTimeInMillis());
                    List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, finish);
                    if (stats == null) throw new IllegalStateException("UsageStats query returned null.");
                    JSONObject day = new JSONObject();
                    JSONObject apps = new JSONObject();
                    Map<String, Long> packageDurations = new HashMap<>();
                    Map<String, Long> lastUsed = new HashMap<>();
                    for (UsageStats stat : stats) {
                        if (stat == null || stat.getPackageName() == null) continue;
                        String pkg = stat.getPackageName();
                        long duration = Math.max(0L, stat.getTotalTimeInForeground());
                        if (duration <= 0L) continue;
                        // Daily UsageStats should be one record per package; max prevents duplicate rows being added twice.
                        packageDurations.put(pkg, Math.max(packageDurations.getOrDefault(pkg, 0L), duration));
                        lastUsed.put(pkg, Math.max(lastUsed.getOrDefault(pkg, 0L), stat.getLastTimeUsed()));
                    }
                    PackageManager pm = app.getPackageManager();
                    for (Map.Entry<String, Long> entry : packageDurations.entrySet()) {
                        try {
                            ApplicationInfo info = getApplicationInfo(pm, entry.getKey());
                            JSONObject item = new JSONObject();
                            CharSequence label = pm.getApplicationLabel(info);
                            item.put("label", label == null ? entry.getKey() : label.toString());
                            item.put("usageMillis", entry.getValue());
                            item.put("lastUsedTimestamp", lastUsed.getOrDefault(entry.getKey(), 0L));
                            apps.put(entry.getKey(), item);
                        } catch (PackageManager.NameNotFoundException ignored) {
                            // Uninstalled or invisible packages are not presented as installed apps.
                        }
                    }
                    day.put("queriedAt", System.currentTimeMillis());
                    day.put("apps", apps);
                    replacements.put(formatter.format(cursor.getTime()), day);
                    cursor.add(Calendar.DAY_OF_YEAR, 1);
                }
                AppUsageAnalyticsStore.shared().upsertWidgetDays(app, replacements);
                deviceInventory(app);
                lastRefreshFailedAt = 0L;
            } catch (Exception error) {
                lastRefreshFailedAt = System.currentTimeMillis();
                Log.w(TAG, "Screen-time refresh failed; existing encrypted usage snapshot is retained.", error);
            } finally {
                REFRESHING.set(false);
                try {
                    MathMasterHomeWidgetProvider.refreshWidgetInstances(app);
                } catch (RuntimeException refreshError) {
                    Log.w(TAG, "Pinned widget refresh failed after UsageStats collection.", refreshError);
                }
                android.content.Intent updated = new android.content.Intent(ACTION_DATA_UPDATED);
                updated.setPackage(app.getPackageName());
                app.sendBroadcast(updated);
            }
        });
    }

    static boolean hasUsageAccess(Context context) {
        try {
            AppOpsManager ops = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (ops == null) return false;
            int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName())
                : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception ignored) { return false; }
    }

    static void openUsageSettings(Context context) {
        try {
            android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception error) {
            Log.w(TAG, "Usage Access settings could not be opened.", error);
        }
    }

    static final class AppChoice {
        final String packageName;
        final String label;
        AppChoice(String packageName, String label) { this.packageName = packageName; this.label = label; }
    }

    static List<AppChoice> getSelectableApps(Context context, boolean studyOnly) {
        Context app = context.getApplicationContext();
        List<AppChoice> choices = new ArrayList<>();
        PackageManager pm = app.getPackageManager();
        if (studyOnly) {
            for (String pkg : StudyModeManager.getSelectedStudyAppPackages(app)) {
                choices.add(new AppChoice(pkg, resolveLabel(app, pkg, pkg)));
            }
        } else {
            for (ApplicationInfo info : deviceInventory(app).values()) {
                CharSequence label = pm.getApplicationLabel(info);
                choices.add(new AppChoice(info.packageName, label == null ? info.packageName : label.toString()));
            }
        }
        choices.sort(Comparator.comparing(choice -> choice.label.toLowerCase(Locale.ROOT)));
        return choices;
    }

    private static Set<String> parsePackageFilter(String json) {
        Set<String> result = new HashSet<>();
        try {
            JSONArray values = new JSONArray(json == null ? "[]" : json);
            for (int i = 0; i < values.length(); i++) {
                String pkg = values.optString(i, "");
                if (pkg.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+")) result.add(pkg);
            }
        } catch (JSONException ignored) {}
        return result;
    }

    static void onAppResumed(Context context) {
        if (hasUsageAccess(context)) {
            lastRefreshFailedAt = 0L;
            scheduleRefresh(context);
        }
        MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
    }

    static void onStudyAppsChanged(Context context) {
        if (hasUsageAccess(context)) scheduleRefresh(context);
        MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
    }

    static void onPackageInventoryChanged(Context context) {
        lastRefreshFailedAt = 0L;
        synchronized (WidgetScreenTimeData.class) {
            inventoryCache = Collections.emptyMap();
            inventoryCachedAt = 0L;
            ICONS.evictAll();
        }
        if (hasUsageAccess(context)) scheduleRefresh(context);
        MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
    }

    static void onTimeBoundaryChanged(Context context) {
        synchronized (WidgetScreenTimeData.class) {
            inventoryCachedAt = 0L;
        }
        lastRefreshFailedAt = 0L;
        if (hasUsageAccess(context)) scheduleRefresh(context);
        MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
    }

    private static List<String> requestedDates(String period) {
        List<String> result = new ArrayList<>();
        Calendar cursor = Calendar.getInstance();
        if ("yesterday".equals(period)) cursor.add(Calendar.DAY_OF_YEAR, -1);
        else if ("last_7_days".equals(period)) cursor.add(Calendar.DAY_OF_YEAR, -6);
        cursor.set(Calendar.HOUR_OF_DAY, 0); cursor.set(Calendar.MINUTE, 0);
        cursor.set(Calendar.SECOND, 0); cursor.set(Calendar.MILLISECOND, 0);
        int count = "last_7_days".equals(period) ? 7 : 1;
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(TimeZone.getDefault());
        for (int i = 0; i < count; i++) {
            result.add(format.format(cursor.getTime()));
            cursor.add(Calendar.DAY_OF_YEAR, 1);
        }
        return result;
    }

    private static String safePeriod(String value) {
        return "yesterday".equals(value) || "last_7_days".equals(value) ? value : "today";
    }
    private static String safeSort(String value) {
        return "least_used".equals(value) || "name_az".equals(value) || "name_za".equals(value) ? value : "most_used";
    }
    private static String periodLabel(String value) {
        if ("yesterday".equals(value)) return "Yesterday";
        if ("last_7_days".equals(value)) return "Last 7 Days";
        return "Today";
    }
    private static String relativeAge(long age) {
        if (age < 60_000L) return "just now";
        if (age < 3_600_000L) return Math.max(1L, age / 60_000L) + "m ago";
        return Math.max(1L, age / 3_600_000L) + "h ago";
    }
    private static String resolveLabel(Context context, String pkg, String fallback) {
        try {
            ApplicationInfo info = getApplicationInfo(context.getPackageManager(), pkg);
            CharSequence label = context.getPackageManager().getApplicationLabel(info);
            return label == null ? (fallback == null ? pkg : fallback) : label.toString();
        } catch (Exception ignored) { return fallback == null ? pkg : fallback; }
    }
    private static boolean isInstalledVisible(Context context, String pkg) {
        try { getApplicationInfo(context.getPackageManager(), pkg); return true; }
        catch (Exception ignored) { return false; }
    }
    private static ApplicationInfo getApplicationInfo(PackageManager pm, String pkg) throws PackageManager.NameNotFoundException {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0L)) : pm.getApplicationInfo(pkg, 0);
    }
    private static Map<String, ApplicationInfo> cachedDeviceInventory() {
        if (inventoryCache.isEmpty() || System.currentTimeMillis() - inventoryCachedAt >= CACHE_TTL_MS) {
            return Collections.emptyMap();
        }
        return inventoryCache;
    }

    private static synchronized Map<String, ApplicationInfo> deviceInventory(Context context) {
        long now = System.currentTimeMillis();
        if (!inventoryCache.isEmpty() && now - inventoryCachedAt < CACHE_TTL_MS) return inventoryCache;
        PackageManager pm = context.getPackageManager();
        List<ApplicationInfo> installed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0L)) : pm.getInstalledApplications(0);
        Set<String> launchableSystem = new HashSet<>();
        android.content.Intent launcher = new android.content.Intent(android.content.Intent.ACTION_MAIN);
        launcher.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> launchables = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.queryIntentActivities(launcher, PackageManager.ResolveInfoFlags.of(0L)) : pm.queryIntentActivities(launcher, 0);
        if (launchables != null) for (ResolveInfo match : launchables) {
            ActivityInfo activity = match == null ? null : match.activityInfo;
            if (activity != null && activity.applicationInfo != null) launchableSystem.add(activity.applicationInfo.packageName);
        }
        Map<String, ApplicationInfo> result = new HashMap<>();
        if (installed != null) for (ApplicationInfo info : installed) {
            if (info == null || info.packageName == null) continue;
            if ((info.flags & ApplicationInfo.FLAG_SYSTEM) != 0 && !launchableSystem.contains(info.packageName)) continue;
            result.put(info.packageName, info);
        }
        inventoryCache = Collections.unmodifiableMap(result);
        inventoryCachedAt = now;
        return inventoryCache;
    }
    private static Bitmap icon(Context context, String pkg) {
        Bitmap cached = ICONS.get(pkg);
        if (cached != null && !cached.isRecycled()) return cached;
        try {
            Drawable drawable = context.getPackageManager().getApplicationIcon(pkg);
            int size = 72;
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(canvas);
            ICONS.put(pkg, bitmap);
            return bitmap;
        } catch (Exception ignored) { return null; }
    }
}
