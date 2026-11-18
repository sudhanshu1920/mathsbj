package com.sudhanshu.mathsbj;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Device-local screen-time data for home-screen widgets.
 *
 * UsageStats is queried once per local calendar day so Today, Yesterday and the
 * seven-day view share exact calendar boundaries (including DST days). Only
 * package foreground durations and the eligible app catalogue are persisted,
 * inside AppUsageAnalyticsStore's existing AES/GCM encrypted record.
 */
public final class WidgetScreenTimeData {
    private static final String TAG = "WidgetScreenTime";
    private static final String LIFECYCLE_PREFS = "widget_screen_time_lifecycle";
    private static final long CACHE_TTL_MS = 5L * 60L * 1000L;
    private static final long RESUME_REFRESH_COOLDOWN_MS = 2L * 60L * 1000L;
    private static final int MAX_VISIBLE_APPS = 10;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "MathMasterWidgetUsage");
        thread.setDaemon(true);
        return thread;
    });
    private static final Object REFRESH_LOCK = new Object();
    private static final AppUsageAnalyticsStore STORE = new AppUsageAnalyticsStore();
    private static volatile JSONObject cachedSnapshot;
    private static volatile long lastRefreshRequestedAt;
    private static volatile boolean refreshRunning;
    private static volatile boolean iconWarmupRunning;
    private static volatile boolean observedMissingPermission;
    private static final Set<String> ICON_ATTEMPTS = Collections.synchronizedSet(new HashSet<>());
    private static final LruCache<String, String> LABELS = new LruCache<>(256);
    private static final LruCache<String, Bitmap> ICONS = new LruCache<String, Bitmap>(4 * 1024 * 1024) {
        @Override protected int sizeOf(String key, Bitmap value) {
            return value == null || value.isRecycled() ? 0 : value.getByteCount();
        }
    };

    private WidgetScreenTimeData() {}

    public static final class AppChoice {
        public final String packageName;
        public final String label;
        AppChoice(String packageName, String label) {
            this.packageName = packageName;
            this.label = label;
        }
    }

    public static final class Config {
        public String period = "today";        // today | yesterday | 7d
        public String sortOrder = "most_used"; // most_used | least_used | name_asc | name_desc
        public int maxApps = 5;
        public boolean showTotal = true;
        public boolean showAppUsage = true;
        public boolean showPercent = false;
        public boolean compact = false;
        // null = no user filter; [] = explicitly select no apps.
        public String studyFilterJson;
        public String deviceFilterJson;
    }

    static void populate(
        Context context,
        MathMasterWidgetRenderer.Data data,
        int widgetId,
        Set<String> selectedContent,
        Config config
    ) {
        if (context == null || data == null || selectedContent == null) return;
        Config safe = config == null ? new Config() : config;
        boolean wantsStudy = selectedContent.contains("studyAppsScreenTime");
        boolean wantsDevice = selectedContent.contains("deviceAppsScreenTime");
        if (!wantsStudy && !wantsDevice) return;

        maybeRefresh(context);
        boolean permission = hasUsageAccess(context);
        if (!permission) {
            observedMissingPermission = true;
        } else if (observedMissingPermission) {
            observedMissingPermission = false;
            requestRefresh(context, true);
        }
        JSONObject snapshot = readSnapshot(context);
        long updatedAt = snapshot == null ? 0L : snapshot.optLong("queriedAt", 0L);
        boolean stale = updatedAt <= 0L || System.currentTimeMillis() - updatedAt > CACHE_TTL_MS;
        JSONObject days = snapshot == null ? null : snapshot.optJSONObject("days");
        boolean querySucceeded = snapshot != null && snapshot.optBoolean("querySucceeded", false);
        JSONArray deviceInventory = snapshot == null ? null : snapshot.optJSONArray("deviceApps");

        if (wantsStudy) {
            data.studyAppsScreenTime = buildBlock(
                context, true, permission, querySucceeded, days, deviceInventory,
                updatedAt, stale, safe, safe.studyFilterJson);
            warmVisibleIconsAsync(context, data.studyAppsScreenTime);
        }
        if (wantsDevice) {
            data.deviceAppsScreenTime = buildBlock(
                context, false, permission, querySucceeded, days, deviceInventory,
                updatedAt, stale, safe, safe.deviceFilterJson);
            warmVisibleIconsAsync(context, data.deviceAppsScreenTime);
        }
        if (!permission) {
            data.screenTimeAction = MathMasterWidgetActionReceiver.ACTION_USAGE_ACCESS;
        } else if (wantsStudy && data.studyAppsScreenTime != null
            && "no_study_apps".equals(data.studyAppsScreenTime.state)) {
            data.screenTimeAction = MathMasterWidgetActionReceiver.ACTION_STUDY_APPS;
        } else {
            data.screenTimeAction = MathMasterWidgetActionReceiver.ACTION_OPEN_APP;
        }

    }

    private static MathMasterWidgetRenderer.ScreenTimeBlock buildBlock(
        Context context,
        boolean studyOnly,
        boolean permission,
        boolean querySucceeded,
        JSONObject days,
        JSONArray deviceInventory,
        long updatedAt,
        boolean stale,
        Config config,
        String filterJson
    ) {
        MathMasterWidgetRenderer.ScreenTimeBlock block = new MathMasterWidgetRenderer.ScreenTimeBlock();
        block.title = studyOnly ? "Study Apps Usage" : "Device App Usage";
        block.periodLabel = periodLabel(config.period);
        block.updatedAt = updatedAt;
        block.stale = stale;
        block.showTotal = config.showTotal;
        block.showAppUsage = config.showAppUsage;
        block.showPercent = config.showPercent;
        block.compact = config.compact;
        block.maxApps = Math.max(1, Math.min(MAX_VISIBLE_APPS, config.maxApps));

        if (!permission) {
            block.state = "permission_required";
            return block;
        }
        if (!querySucceeded || days == null || deviceInventory == null) {
            block.state = "unavailable";
            return block;
        }

        List<AppChoice> source = studyOnly
            ? getStudyAppChoices(context) : readDeviceChoices(context, deviceInventory);
        if (studyOnly && source.isEmpty()) {
            block.state = "no_study_apps";
            return block;
        }
        if (!studyOnly && source.isEmpty()) {
            block.state = "no_eligible_apps";
            return block;
        }

        Set<String> filter = parseFilter(filterJson);
        if (filter != null) {
            List<AppChoice> filtered = new ArrayList<>();
            for (AppChoice choice : source) if (filter.contains(choice.packageName)) filtered.add(choice);
            source = filtered;
            if (source.isEmpty()) {
                block.state = "filter_empty";
                return block;
            }
        }

        Map<String, Long> usage = aggregatePeriod(days, config.period);
        List<MathMasterWidgetRenderer.ScreenTimeApp> entries = new ArrayList<>();
        long total = 0L;
        PackageManager pm = context.getPackageManager();
        for (AppChoice choice : source) {
            long duration = Math.max(0L, usage.containsKey(choice.packageName) ? usage.get(choice.packageName) : 0L);
            if (!studyOnly && duration == 0L) continue;
            try {
                ApplicationInfo current = getApplicationInfo(pm, choice.packageName);
                if (current == null) continue;
                String label = LABELS.get(choice.packageName);
                if (label == null || label.length() == 0) {
                    CharSequence currentLabel = pm.getApplicationLabel(current);
                    label = currentLabel == null || currentLabel.length() == 0
                        ? choice.label : currentLabel.toString();
                    LABELS.put(choice.packageName, label);
                }
                MathMasterWidgetRenderer.ScreenTimeApp entry = new MathMasterWidgetRenderer.ScreenTimeApp();
                entry.packageName = choice.packageName;
                entry.label = label;
                entry.usageMillis = duration;
                entry.icon = ICONS.get(choice.packageName);
                entries.add(entry);
                total = safeAdd(total, duration);
            } catch (PackageManager.NameNotFoundException | RuntimeException ignored) {
                // Apps can be removed between inventory refresh and rendering.
            }
        }
        if (entries.isEmpty() || total <= 0L) {
            block.state = "no_usage";
            return block;
        }

        sortEntries(entries, config.sortOrder);
        for (MathMasterWidgetRenderer.ScreenTimeApp entry : entries) {
            entry.percent = total > 0L ? (float) (entry.usageMillis * 100.0d / total) : 0f;
        }
        block.totalUsageMillis = total;
        block.totalEligibleApps = entries.size();
        block.state = "ready";
        int visible = Math.min(block.maxApps, entries.size());
        for (int i = 0; i < visible; i++) block.apps.add(entries.get(i));
        return block;
    }

    private static Map<String, Long> aggregatePeriod(JSONObject days, String period) {
        Map<String, Long> totals = new HashMap<>();
        Calendar cursor = Calendar.getInstance();
        cursor.set(Calendar.HOUR_OF_DAY, 0);
        cursor.set(Calendar.MINUTE, 0);
        cursor.set(Calendar.SECOND, 0);
        cursor.set(Calendar.MILLISECOND, 0);
        int count = "yesterday".equals(period) ? 1 : ("7d".equals(period) ? 7 : 1);
        if ("yesterday".equals(period)) cursor.add(Calendar.DAY_OF_YEAR, -1);
        else if ("7d".equals(period)) cursor.add(Calendar.DAY_OF_YEAR, -6);
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setTimeZone(TimeZone.getDefault());
        for (int i = 0; i < count; i++) {
            JSONObject appDay = days.optJSONObject(formatter.format(cursor.getTime()));
            if (appDay != null) {
                Iterator<String> packages = appDay.keys();
                while (packages.hasNext()) {
                    String packageName = packages.next();
                    long value = Math.max(0L, appDay.optLong(packageName, 0L));
                    totals.put(packageName, safeAdd(totals.containsKey(packageName) ? totals.get(packageName) : 0L, value));
                }
            }
            cursor.add(Calendar.DAY_OF_YEAR, 1);
        }
        return totals;
    }

    private static void sortEntries(List<MathMasterWidgetRenderer.ScreenTimeApp> entries, String order) {
        Comparator<MathMasterWidgetRenderer.ScreenTimeApp> byUsage =
            Comparator.comparingLong((MathMasterWidgetRenderer.ScreenTimeApp item) -> item.usageMillis);
        if ("least_used".equals(order)) {
            entries.sort(byUsage.thenComparing(item -> item.label.toLowerCase(Locale.ROOT)));
        } else if ("name_asc".equals(order)) {
            entries.sort(Comparator.comparing(item -> item.label.toLowerCase(Locale.ROOT)));
        } else if ("name_desc".equals(order)) {
            entries.sort(Comparator.comparing((MathMasterWidgetRenderer.ScreenTimeApp item) ->
                item.label.toLowerCase(Locale.ROOT)).reversed());
        } else {
            entries.sort(byUsage.reversed().thenComparing(item -> item.label.toLowerCase(Locale.ROOT)));
        }
    }

    private static Set<String> parseFilter(String json) {
        if (json == null) return null;
        Set<String> result = new HashSet<>();
        if (json.length() > 8192) return result;
        try {
            JSONArray values = new JSONArray(json);
            if (values.length() > 200) return result;
            for (int i = 0; i < values.length(); i++) {
                String value = values.optString(i, "");
                if (value.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+")) result.add(value);
            }
        } catch (JSONException ignored) {
            // Invalid saved filters fail closed instead of exposing an unintended app list.
        }
        return result;
    }

    private static List<AppChoice> getStudyAppChoices(Context context) {
        List<String> packages = StudyModeManager.getSelectedStudyAppPackages(context);
        List<AppChoice> result = new ArrayList<>();
        PackageManager pm = context.getPackageManager();
        for (String packageName : packages) {
            try {
                ApplicationInfo info = getApplicationInfo(pm, packageName);
                if (info == null) continue;
                String label = LABELS.get(packageName);
                if (label == null) {
                    CharSequence current = pm.getApplicationLabel(info);
                    label = current == null ? packageName : current.toString();
                    LABELS.put(packageName, label);
                }
                result.add(new AppChoice(packageName, label));
            } catch (PackageManager.NameNotFoundException | RuntimeException ignored) {
                // An app can be uninstalled between selection lookup and metadata resolution.
            }
        }
        return result;
    }

    /** Available choices for the native editor's optional per-widget app filter. */
    public static List<AppChoice> getAppChoices(Context context, boolean studyOnly) {
        if (studyOnly) return getStudyAppChoices(context);
        JSONObject snapshot = readSnapshot(context);
        JSONArray inventory = snapshot == null ? null : snapshot.optJSONArray("deviceApps");
        if (inventory != null && inventory.length() > 0) return readDeviceChoices(context, inventory);
        return queryDeviceInventory(context);
    }

    private static List<AppChoice> readDeviceChoices(Context context, JSONArray inventory) {
        List<AppChoice> result = new ArrayList<>();
        PackageManager pm = context.getPackageManager();
        for (int i = 0; i < inventory.length(); i++) {
            JSONObject item = inventory.optJSONObject(i);
            if (item == null) continue;
            String packageName = item.optString("packageName", "");
            if (packageName.isEmpty()) continue;
            try {
                ApplicationInfo info = getApplicationInfo(pm, packageName);
                if (info == null) continue;
                CharSequence label = pm.getApplicationLabel(info);
                result.add(new AppChoice(packageName, label == null ? item.optString("label", packageName) : label.toString()));
            } catch (PackageManager.NameNotFoundException | RuntimeException ignored) {
                // Stale inventory entry: do not offer an uninstalled package in the editor.
            }
        }
        result.sort(Comparator.comparing(choice -> choice.label.toLowerCase(Locale.ROOT)));
        return result;
    }

    private static List<AppChoice> queryDeviceInventory(Context context) {
        List<AppChoice> result = new ArrayList<>();
        PackageManager pm = context.getPackageManager();
        List<ApplicationInfo> installed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0L))
            : pm.getInstalledApplications(0);
        if (installed == null) return result;
        Set<String> launchableSystemPackages = new HashSet<>();
        Intent launcher = new Intent(Intent.ACTION_MAIN);
        launcher.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> launchables = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.queryIntentActivities(launcher, PackageManager.ResolveInfoFlags.of(0L))
            : pm.queryIntentActivities(launcher, 0);
        if (launchables != null) {
            for (ResolveInfo match : launchables) {
                ActivityInfo activity = match == null ? null : match.activityInfo;
                ApplicationInfo info = activity == null ? null : activity.applicationInfo;
                if (info != null && info.packageName != null) launchableSystemPackages.add(info.packageName);
            }
        }
        Set<String> seen = new HashSet<>();
        for (ApplicationInfo info : installed) {
            if (info == null || info.packageName == null
                || ((info.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                    && !launchableSystemPackages.contains(info.packageName))
                || !seen.add(info.packageName)) continue;
            String label = LABELS.get(info.packageName);
            if (label == null) {
                CharSequence current = pm.getApplicationLabel(info);
                label = current == null ? info.packageName : current.toString();
                LABELS.put(info.packageName, label);
            }
            result.add(new AppChoice(info.packageName, label));
        }
        result.sort(Comparator.comparing(choice -> choice.label.toLowerCase(Locale.ROOT)));
        return result;
    }

    private static ApplicationInfo getApplicationInfo(PackageManager pm, String packageName)
        throws PackageManager.NameNotFoundException {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0L))
            : pm.getApplicationInfo(packageName, 0);
    }

    static boolean hasUsageAccess(Context context) {
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName())
                : appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    /** Called by the provider; this is coalesced and never blocks the widget render path. */
    static void maybeRefresh(Context context) {
        requestRefresh(context, false);
    }

    static void markUsageAccessSettingsOpened(Context context) {
        context.getSharedPreferences(LIFECYCLE_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("usageAccessSettingsPending", true).apply();
    }

    private static boolean consumeUsageAccessSettingsReturn(Context context) {
        android.content.SharedPreferences preferences =
            context.getSharedPreferences(LIFECYCLE_PREFS, Context.MODE_PRIVATE);
        boolean pending = preferences.getBoolean("usageAccessSettingsPending", false);
        if (pending) preferences.edit().putBoolean("usageAccessSettingsPending", false).apply();
        return pending;
    }

    static void onAppResumed(Context context) {
        boolean returnedFromUsageSettings = consumeUsageAccessSettingsReturn(context);
        if (!hasUsageAccess(context)) {
            observedMissingPermission = true;
            MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
            return;
        }
        boolean permissionRestored = observedMissingPermission;
        observedMissingPermission = false;
        JSONObject snapshot = readSnapshot(context);
        long updated = snapshot == null ? 0L : snapshot.optLong("queriedAt", 0L);
        boolean permissionWasMissing = snapshot != null && !snapshot.optBoolean("permissionGranted", false);
        if (returnedFromUsageSettings || permissionRestored || permissionWasMissing || updated <= 0L
            || System.currentTimeMillis() - updated >= RESUME_REFRESH_COOLDOWN_MS) {
            requestRefresh(context, true);
        } else {
            MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
        }
    }

    static void onStudyAppsChanged(Context context) {
        MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
        requestRefresh(context, true);
    }

    static void onUsageHistoryCleared(Context context) {
        cachedSnapshot = null;
        observedMissingPermission = !hasUsageAccess(context);
        lastRefreshRequestedAt = 0L;
        if (context != null && hasUsageAccess(context)) requestRefresh(context, true);
        else MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
    }

    static void onPackageInventoryChanged(Context context) {
        lastRefreshRequestedAt = 0L;
        ICONS.evictAll();
        LABELS.evictAll();
        ICON_ATTEMPTS.clear();
        requestRefresh(context, true);
    }

    static void onTimeZoneOrClockChanged(Context context) {
        cachedSnapshot = null;
        lastRefreshRequestedAt = 0L;
        try { STORE.clearWidgetSnapshot(context); } catch (Exception ignored) {}
        requestRefresh(context, true);
    }

    private static void requestRefresh(Context context, boolean force) {
        if (context == null) return;
        Context app = context.getApplicationContext();
        long now = System.currentTimeMillis();
        JSONObject existing = readSnapshot(app);
        boolean dateChanged = existing == null || !todayKey().equals(existing.optString("todayKey", ""));
        if (!hasUsageAccess(app)) return;
        long updatedAt = existing == null ? 0L : existing.optLong("queriedAt", 0L);
        if (!force && !dateChanged && updatedAt > 0L && now - updatedAt < CACHE_TTL_MS) {
            warmIconsAsync(app, existing.optJSONArray("iconPackages"));
            return;
        }
        synchronized (REFRESH_LOCK) {
            if (refreshRunning) return;
            if (!force && now - lastRefreshRequestedAt < 2_000L) return;
            refreshRunning = true;
            lastRefreshRequestedAt = now;
        }
        WORKER.execute(() -> {
            try {
                if (!hasUsageAccess(app)) return;
                JSONObject snapshot = querySnapshot(app);
                if (snapshot != null) {
                    STORE.saveWidgetSnapshot(app, snapshot);
                    cachedSnapshot = snapshot;
                    warmIcons(app, snapshot.optJSONArray("iconPackages"));
                }
            } catch (Exception error) {
                android.util.Log.w(TAG, "Could not refresh local widget screen-time data.", error);
            } finally {
                synchronized (REFRESH_LOCK) { refreshRunning = false; }
                MathMasterHomeWidgetProvider.refreshWidgetInstances(app);
            }
        });
    }

    private static JSONObject querySnapshot(Context context) throws Exception {
        UsageStatsManager manager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null || !hasUsageAccess(context)) return null;

        Calendar now = Calendar.getInstance();
        Calendar dayStart = (Calendar) now.clone();
        dayStart.set(Calendar.HOUR_OF_DAY, 0);
        dayStart.set(Calendar.MINUTE, 0);
        dayStart.set(Calendar.SECOND, 0);
        dayStart.set(Calendar.MILLISECOND, 0);

        JSONObject days = new JSONObject();
        SimpleDateFormat formatter = dateFormatter();
        Calendar firstDay = (Calendar) dayStart.clone();
        firstDay.add(Calendar.DAY_OF_YEAR, -6);
        boolean available = true;
        for (int i = 0; i < 7; i++) {
            Calendar end = (Calendar) firstDay.clone();
            end.add(Calendar.DAY_OF_YEAR, 1);
            if (end.after(now)) end = (Calendar) now.clone();
            List<UsageStats> stats = manager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, firstDay.getTimeInMillis(), end.getTimeInMillis());
            if (stats == null) {
                available = false;
            } else {
                JSONObject packageDurations = new JSONObject();
                Map<String, Long> daily = new HashMap<>();
                for (UsageStats stat : stats) {
                    if (stat == null || stat.getPackageName() == null) continue;
                    long duration = Math.max(0L, stat.getTotalTimeInForeground());
                    if (duration <= 0L) continue;
                    // Daily interval queries should return one aggregate per package. max()
                    // avoids double-counting if an OEM returns duplicate interval records.
                    Long previous = daily.get(stat.getPackageName());
                    if (previous == null || duration > previous) daily.put(stat.getPackageName(), duration);
                }
                for (Map.Entry<String, Long> entry : daily.entrySet()) {
                    packageDurations.put(entry.getKey(), entry.getValue());
                }
                days.put(formatter.format(firstDay.getTime()), packageDurations);
            }
            firstDay.add(Calendar.DAY_OF_YEAR, 1);
        }
        List<AppChoice> inventory = queryDeviceInventory(context);
        if (!available) return null;
        JSONArray deviceApps = new JSONArray();
        for (AppChoice app : inventory) {
            JSONObject item = new JSONObject();
            item.put("packageName", app.packageName);
            item.put("label", app.label);
            deviceApps.put(item);
        }

        Set<String> iconPackages = new HashSet<>();
        Map<String, Long> currentUsage = aggregateToday(days);
        List<Map.Entry<String, Long>> top = new ArrayList<>(currentUsage.entrySet());
        top.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
        for (int i = 0; i < Math.min(24, top.size()); i++) iconPackages.add(top.get(i).getKey());
        iconPackages.addAll(StudyModeManager.getSelectedStudyAppPackages(context));

        JSONArray iconList = new JSONArray();
        for (String packageName : iconPackages) iconList.put(packageName);
        JSONObject snapshot = new JSONObject();
        snapshot.put("queriedAt", System.currentTimeMillis());
        snapshot.put("todayKey", todayKey());
        snapshot.put("permissionGranted", true);
        snapshot.put("querySucceeded", available);
        snapshot.put("days", days);
        snapshot.put("deviceApps", deviceApps);
        snapshot.put("iconPackages", iconList);
        return snapshot;
    }

    private static Map<String, Long> aggregateToday(JSONObject days) {
        Map<String, Long> result = new HashMap<>();
        JSONObject today = days.optJSONObject(todayKey());
        if (today == null) return result;
        Iterator<String> keys = today.keys();
        while (keys.hasNext()) {
            String packageName = keys.next();
            result.put(packageName, today.optLong(packageName, 0L));
        }
        return result;
    }

    private static void warmVisibleIconsAsync(Context context, MathMasterWidgetRenderer.ScreenTimeBlock block) {
        if (block == null || !"ready".equals(block.state) || block.apps.isEmpty()) return;
        JSONArray packages = new JSONArray();
        for (MathMasterWidgetRenderer.ScreenTimeApp app : block.apps) {
            if (app != null && app.packageName != null) packages.put(app.packageName);
        }
        warmIconsAsync(context, packages);
    }

    private static boolean hasMissingIcons(JSONArray packages) {
        if (packages == null) return false;
        for (int i = 0; i < packages.length(); i++) {
            String packageName = packages.optString(i, "");
            if (!packageName.isEmpty() && ICONS.get(packageName) == null && !ICON_ATTEMPTS.contains(packageName)) return true;
        }
        return false;
    }

    private static void warmIconsAsync(Context context, JSONArray packages) {
        if (!hasMissingIcons(packages) || iconWarmupRunning) return;
        synchronized (REFRESH_LOCK) {
            if (iconWarmupRunning) return;
            iconWarmupRunning = true;
        }
        WORKER.execute(() -> {
            try { warmIcons(context, packages); }
            finally {
                synchronized (REFRESH_LOCK) { iconWarmupRunning = false; }
                MathMasterHomeWidgetProvider.refreshWidgetInstances(context);
            }
        });
    }

    private static void warmIcons(Context context, JSONArray packages) {
        if (packages == null) return;
        PackageManager pm = context.getPackageManager();
        for (int i = 0; i < packages.length(); i++) {
            String packageName = packages.optString(i, "");
            if (packageName.isEmpty() || ICONS.get(packageName) != null || !ICON_ATTEMPTS.add(packageName)) continue;
            try {
                ApplicationInfo info = getApplicationInfo(pm, packageName);
                Drawable drawable = pm.getApplicationIcon(info);
                int size = Math.max(48, Math.min(96, Math.round(56f * context.getResources().getDisplayMetrics().density)));
                Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, size, size);
                drawable.draw(canvas);
                ICONS.put(packageName, bitmap);
            } catch (PackageManager.NameNotFoundException | RuntimeException ignored) {
                // App metadata can disappear while package broadcasts are being delivered.
            }
        }
    }

    private static JSONObject readSnapshot(Context context) {
        JSONObject value = cachedSnapshot;
        if (value != null) return value;
        try {
            value = STORE.readWidgetSnapshot(context);
            if (value != null) cachedSnapshot = value;
            return value;
        } catch (Exception error) {
            android.util.Log.w(TAG, "Encrypted widget usage cache could not be read.", error);
            return null;
        }
    }

    private static String todayKey() {
        return dateFormatter().format(new Date());
    }

    private static SimpleDateFormat dateFormatter() {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setTimeZone(TimeZone.getDefault());
        return formatter;
    }

    private static String periodLabel(String period) {
        if ("yesterday".equals(period)) return "Yesterday";
        if ("7d".equals(period)) return "Last 7 Days";
        return "Today";
    }

    private static long safeAdd(long left, long right) {
        if (right > 0L && left > Long.MAX_VALUE - right) return Long.MAX_VALUE;
        return left + right;
    }
}
