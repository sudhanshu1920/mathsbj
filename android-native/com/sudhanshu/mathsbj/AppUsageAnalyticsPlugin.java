package com.sudhanshu.mathsbj;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
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

@CapacitorPlugin(name = "AppUsageAnalytics")
public final class AppUsageAnalyticsPlugin extends Plugin {
    private static final long MAX_RANGE_MILLIS = 180L * 24L * 60L * 60L * 1000L;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "MathMasterUsageStats");
        thread.setDaemon(true);
        return thread;
    });
    private final AppUsageAnalyticsStore store = new AppUsageAnalyticsStore();

    @PluginMethod
    public void getUsage(PluginCall call) {
        Long requestedStart = call.getLong("startTimeMs");
        Long requestedEnd = call.getLong("endTimeMs");
        if (requestedStart == null || requestedEnd == null || requestedStart >= requestedEnd
            || requestedEnd - requestedStart > MAX_RANGE_MILLIS) {
            call.reject("Choose a valid app usage date range up to 180 days.");
            return;
        }

        WORKER.execute(() -> {
            try {
                Context context = getContext().getApplicationContext();
                boolean permissionGranted = hasUsageAccess(context);
                boolean dataAvailable = false;
                if (permissionGranted) {
                    UsageStatsManager usageManager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
                    if (usageManager != null) {
                        List<UsageStats> stats = usageManager.queryUsageStats(
                            UsageStatsManager.INTERVAL_DAILY,
                            requestedStart,
                            requestedEnd
                        );
                        if (stats != null) {
                            JSONObject replacements = collectDailyStats(context, stats, requestedStart, requestedEnd);
                            store.upsertDays(context, replacements);
                            dataAvailable = true;
                        }
                    }
                }

                JSONObject data = store.read(context);
                JSObject response = buildResponse(context, data, requestedStart, requestedEnd);
                response.put("permissionGranted", permissionGranted);
                response.put("dataAvailable", dataAvailable);
                response.put("status", !permissionGranted ? "permission_required"
                    : (dataAvailable ? "ok" : "system_data_unavailable"));
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Android could not read or save local app usage data.", error);
            }
        });
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Android Usage Access settings could not be opened.", error);
        }
    }

    @PluginMethod
    public void clearHistory(PluginCall call) {
        WORKER.execute(() -> {
            try {
                store.clear(getContext());
                JSObject result = new JSObject();
                result.put("cleared", true);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not clear local usage history.", error);
            }
        });
    }

    @PluginMethod
    public void setRetention(PluginCall call) {
        Integer days = call.getInt("days");
        if (days == null || (days != 30 && days != 90 && days != 180)) {
            call.reject("Choose a 30, 90 or 180 day local retention period.");
            return;
        }
        WORKER.execute(() -> {
            try {
                int saved = store.setRetentionDays(getContext(), days);
                JSObject result = new JSObject();
                result.put("retentionDays", saved);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not update local usage retention.", error);
            }
        });
    }

    private boolean hasUsageAccess(Context context) {
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName())
                : appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception ignored) {
            return false;
        }
    }

    private JSONObject collectDailyStats(
        Context context, List<UsageStats> stats, long requestedStart, long requestedEnd
    ) throws JSONException {
        JSONObject replacements = new JSONObject();
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setTimeZone(TimeZone.getDefault());

        Calendar cursor = Calendar.getInstance();
        cursor.setTimeInMillis(requestedStart);
        cursor.set(Calendar.HOUR_OF_DAY, 0);
        cursor.set(Calendar.MINUTE, 0);
        cursor.set(Calendar.SECOND, 0);
        cursor.set(Calendar.MILLISECOND, 0);
        while (cursor.getTimeInMillis() < requestedEnd) {
            JSONObject day = new JSONObject();
            day.put("queriedAt", System.currentTimeMillis());
            day.put("apps", new JSONObject());
            replacements.put(formatter.format(cursor.getTime()), day);
            cursor.add(Calendar.DAY_OF_YEAR, 1);
        }

        PackageManager packageManager = context.getPackageManager();
        Map<String, ApplicationInfo> installedCache = new HashMap<>();
        Set<String> missingPackages = new HashSet<>();
        for (UsageStats usage : stats) {
            if (usage == null) continue;
            long duration = Math.max(0L, usage.getTotalTimeInForeground());
            String packageName = usage.getPackageName();
            if (duration <= 0L || packageName == null || packageName.equals(context.getPackageName())) continue;

            String date = formatter.format(new Date(usage.getFirstTimeStamp()));
            JSONObject day = replacements.optJSONObject(date);
            if (day == null) continue;

            ApplicationInfo appInfo = installedCache.get(packageName);
            if (appInfo == null && !missingPackages.contains(packageName)) {
                try {
                    appInfo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                        ? packageManager.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0L))
                        : packageManager.getApplicationInfo(packageName, 0);
                    installedCache.put(packageName, appInfo);
                } catch (PackageManager.NameNotFoundException notInstalled) {
                    missingPackages.add(packageName);
                } catch (Exception ignored) {
                    missingPackages.add(packageName);
                }
            }
            if (appInfo == null) continue;

            JSONObject apps = day.optJSONObject("apps");
            if (apps == null) {
                apps = new JSONObject();
                day.put("apps", apps);
            }
            JSONObject entry = apps.optJSONObject(packageName);
            if (entry == null) {
                entry = new JSONObject();
                CharSequence label;
                try {
                    label = packageManager.getApplicationLabel(appInfo);
                } catch (Exception ignored) {
                    label = packageName;
                }
                entry.put("label", label == null || label.length() == 0 ? packageName : label.toString());
                entry.put("usageMillis", 0L);
                entry.put("lastUsedTimestamp", 0L);
            }
            entry.put("usageMillis", entry.optLong("usageMillis", 0L) + duration);
            entry.put("lastUsedTimestamp", Math.max(entry.optLong("lastUsedTimestamp", 0L), usage.getLastTimeUsed()));
            apps.put(packageName, entry);
        }
        return replacements;
    }

    private JSObject buildResponse(Context context, JSONObject data, long start, long end) throws Exception {
        JSONObject savedDays = data.optJSONObject("days");
        if (savedDays == null) savedDays = new JSONObject();

        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setTimeZone(TimeZone.getDefault());
        Calendar cursor = Calendar.getInstance();
        cursor.setTimeInMillis(start);
        cursor.set(Calendar.HOUR_OF_DAY, 0);
        cursor.set(Calendar.MINUTE, 0);
        cursor.set(Calendar.SECOND, 0);
        cursor.set(Calendar.MILLISECOND, 0);

        Map<String, AppAggregate> aggregates = new HashMap<>();
        JSArray daily = new JSArray();
        long total = 0L;
        String fromDate = formatter.format(cursor.getTime());
        String toDate = formatter.format(new Date(Math.max(start, end - 1L)));
        while (cursor.getTimeInMillis() < end) {
            String date = formatter.format(cursor.getTime());
            JSONObject day = savedDays.optJSONObject(date);
            JSONObject dayApps = day == null ? null : day.optJSONObject("apps");
            long dayTotal = 0L;

            if (dayApps != null) {
                Iterator<String> packages = dayApps.keys();
                while (packages.hasNext()) {
                    String packageName = packages.next();
                    JSONObject app = dayApps.optJSONObject(packageName);
                    if (app == null) continue;
                    long duration = Math.max(0L, app.optLong("usageMillis", 0L));
                    if (duration == 0L) continue;
                    dayTotal += duration;

                    AppAggregate aggregate = aggregates.get(packageName);
                    if (aggregate == null) {
                        aggregate = new AppAggregate(packageName, app.optString("label", packageName));
                        aggregates.put(packageName, aggregate);
                    }
                    aggregate.usageMillis += duration;
                    aggregate.lastUsedTimestamp = Math.max(aggregate.lastUsedTimestamp, app.optLong("lastUsedTimestamp", 0L));
                    aggregate.daily.put(date, duration);
                }
            }

            JSONObject dayResult = new JSONObject();
            dayResult.put("date", date);
            dayResult.put("usageMillis", dayTotal);
            daily.put(JSObject.fromJSONObject(dayResult));
            total += dayTotal;
            cursor.add(Calendar.DAY_OF_YEAR, 1);
        }

        List<AppAggregate> ordered = new ArrayList<>(aggregates.values());
        ordered.sort(Comparator.comparingLong((AppAggregate app) -> app.usageMillis).reversed());
        JSArray apps = new JSArray();
        String mostUsedPackage = "";
        long mostUsed = 0L;
        PackageManager packageManager = context.getPackageManager();
        for (AppAggregate aggregate : ordered) {
            if (mostUsedPackage.isEmpty()) {
                mostUsedPackage = aggregate.packageName;
                mostUsed = aggregate.usageMillis;
            }
            JSObject item = new JSObject();
            item.put("packageName", aggregate.packageName);
            item.put("label", aggregate.label);
            item.put("usageMillis", aggregate.usageMillis);
            item.put("lastUsedTimestamp", aggregate.lastUsedTimestamp);
            item.put("percent", total > 0L ? (aggregate.usageMillis * 100.0d / total) : 0.0d);
            item.put("iconDataUrl", loadIconDataUrl(packageManager, aggregate.packageName));
            JSArray appDaily = new JSArray();
            cursor.setTimeInMillis(start);
            cursor.set(Calendar.HOUR_OF_DAY, 0);
            cursor.set(Calendar.MINUTE, 0);
            cursor.set(Calendar.SECOND, 0);
            cursor.set(Calendar.MILLISECOND, 0);
            while (cursor.getTimeInMillis() < end) {
                String date = formatter.format(cursor.getTime());
                JSObject point = new JSObject();
                point.put("date", date);
                point.put("usageMillis", aggregate.daily.getOrDefault(date, 0L));
                appDaily.put(point);
                cursor.add(Calendar.DAY_OF_YEAR, 1);
            }
            item.put("dailyUsage", appDaily);
            apps.put(item);
        }

        String historyStartDate = "";
        List<String> dates = new ArrayList<>();
        Iterator<String> savedKeys = savedDays.keys();
        while (savedKeys.hasNext()) dates.add(savedKeys.next());
        Collections.sort(dates);
        if (!dates.isEmpty()) historyStartDate = dates.get(0);

        JSObject response = new JSObject();
        response.put("fromDate", fromDate);
        response.put("toDate", toDate);
        response.put("totalUsageMillis", total);
        response.put("mostUsedPackage", mostUsedPackage);
        response.put("mostUsedMillis", mostUsed);
        response.put("apps", apps);
        response.put("dailyUsage", daily);
        response.put("retentionDays", data.optInt("retentionDays", 90));
        response.put("lastUpdatedAt", data.optLong("lastUpdatedAt", 0L));
        response.put("historyStartDate", historyStartDate);
        response.put("storage", "encrypted-local-only");
        return response;
    }

    private String loadIconDataUrl(PackageManager manager, String packageName) {
        try {
            Drawable drawable = manager.getApplicationIcon(packageName);
            if (drawable == null) return "";
            int size = Math.max(48, Math.min(88, Math.round(64 * getContext().getResources().getDisplayMetrics().density)));
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(canvas);
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream);
            bitmap.recycle();
            return "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static final class AppAggregate {
        final String packageName;
        final String label;
        final Map<String, Long> daily = new HashMap<>();
        long usageMillis;
        long lastUsedTimestamp;

        AppAggregate(String packageName, String label) {
            this.packageName = packageName;
            this.label = label;
        }
    }
}
