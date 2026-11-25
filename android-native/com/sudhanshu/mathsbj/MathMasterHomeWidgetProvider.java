package com.sudhanshu.mathsbj;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.util.SizeF;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Math Master home-screen widget.
 *
 * One registered provider, seven "neon glass" compositions. Every composition is drawn by
 * {@link MathMasterWidgetRenderer} into a single bitmap, so it looks the same on every launcher;
 * this class only reads the saved data / preferences, picks the composition and wires the tap.
 */
public class MathMasterHomeWidgetProvider extends AppWidgetProvider {
    private static final String WIDGET_PREFS = "math_master_home_widget";
    private static final int REQUEST_CODE = 8907;
    private static final int CONTENT_SCHEMA_VERSION = 4;
    // Single source of truth for the native editor and the in-app Widget Studio catalogue.
    static final String[][] WIDGET_COMPOSITIONS = {
        {"auto", "Auto (adapts to size)"},
        {"hero_wide", "Hero Wide · Blue Neon"},
        {"compact_green", "Compact · Emerald"},
        {"square_math_bot", "Square · Violet with Quiz"},
        {"medium_study", "Compact · Magenta"},
        {"square_cosmic", "Square · Blue with Week"},
        {"extra_wide_weekly", "Extra Wide · This Week"},
        {"minimal_progress", "Mini · Green"}
    };

    static String[][] getWidgetCompositionOptions() {
        String[][] copy = new String[WIDGET_COMPOSITIONS.length][];
        for (int i = 0; i < WIDGET_COMPOSITIONS.length; i++) {
            copy[i] = WIDGET_COMPOSITIONS[i].clone();
        }
        return copy;
    }
    static final String[] CONTENT_OPTIONS = {
        "appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "quiz", "updateStatus",
        "studyAppsScreenTime", "deviceAppsScreenTime"
    };
    private static MathMasterWidgetRenderer.Fonts widgetFonts;

    static final class ScreenTimeConfig {
        String period = "today";
        String sort = "most_used";
        int maxEntries = 5;
        boolean showTotal = true;
        boolean showUsage = true;
        boolean showPercent = false;
        boolean detailed = true;
        Set<String> hiddenStudyPackages = new HashSet<>();
        Set<String> hiddenDevicePackages = new HashSet<>();
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            manager.updateAppWidget(appWidgetId, createViews(context, appWidgetId));
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        for (int appWidgetId : appWidgetIds) {
            String prefix = "instance_" + appWidgetId + "_";
            for (String key : preferences.getAll().keySet()) {
                if (key.startsWith(prefix)) editor.remove(key);
            }
        }
        editor.apply();
        super.onDeleted(context, appWidgetIds);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle options) {
        manager.updateAppWidget(appWidgetId, createViews(context, appWidgetId));
    }

    /** Refresh all saved widgets after the app resumes, the Study Apps list changes, or packages change. */
    public static void refreshScreenTimeWidgets(Context context) {
        if (context == null) return;
        WidgetScreenTimeRepository.invalidateCaches();
        refreshScreenTimeInstances(context);
    }

    /** Re-render Screen Time instances only after the app theme or light/dark mode changes. */
    public static void updateScreenTimeAppearance(Context context) {
        refreshScreenTimeInstances(context, null);
    }

    /** Update active widget instances after a background UsageStats query has completed. */
    public static void refreshScreenTimeInstances(Context context) {
        refreshScreenTimeInstances(context, null);
    }

    public static void refreshScreenTimeInstances(Context context, String refreshedPeriod) {
        if (context == null) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, MathMasterHomeWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(provider);
        if (widgetIds == null || widgetIds.length == 0) return;
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        for (int widgetId : widgetIds) {
            try {
                Set<String> content = getSelectedContent(preferences, widgetId);
                if (!content.contains("studyAppsScreenTime") && !content.contains("deviceAppsScreenTime")) continue;
                ScreenTimeConfig config = readScreenTimeConfig(preferences, widgetId);
                if (refreshedPeriod != null && !refreshedPeriod.equals(config.period)) continue;
                manager.updateAppWidget(widgetId, createViews(context, widgetId));
            } catch (RuntimeException ignored) { /* Keep other pinned widgets updating. */ }
        }
    }

    public static void updateWidgets(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        if (!preferences.getBoolean("enabled", true)) return;
        refreshWidgetInstances(context);
    }

    /** Called when widget preferences change, including the global OFF transition. */
    public static void updateWidgetPreferences(Context context) {
        refreshWidgetInstances(context);
    }

    /** Persist the existing app's live streak snapshot and refresh every pinned instance. */
    public static void syncProgressSnapshot(
        Context context,
        int targetMinutes,
        long elapsedSeconds,
        int currentStreak,
        String dayKey,
        String completedDaysJson
    ) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        preferences.edit()
            .putInt("targetMinutes", Math.max(1, Math.min(1440, targetMinutes)))
            .putLong("elapsedSeconds", Math.max(0L, elapsedSeconds))
            .putInt("currentStreak", Math.max(0, currentStreak))
            .putString("dayKey", dayKey == null ? "" : dayKey)
            .putString("completedDaysJson", completedDaysJson == null ? "[]" : completedDaysJson)
            .apply();
        updateWidgetPreferences(context);
    }

    private static void refreshWidgetInstances(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, MathMasterHomeWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(provider);
        if (widgetIds == null || widgetIds.length == 0) return;
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, createViews(context, widgetId));
        }
    }

    public static void updateReleaseStatus(
        Context context,
        long installedVersionCode,
        String installedVersionName,
        long latestVersionCode,
        String latestVersionName
    ) {
        if (installedVersionCode < 1L || latestVersionCode < 1L
            || !isSafeVersion(installedVersionName) || !isSafeVersion(latestVersionName)) return;
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        preferences.edit()
            .putBoolean("hasCheckedUpdates", true)
            .putBoolean("updateAvailable", latestVersionCode > installedVersionCode)
            .putLong("installedVersionCode", installedVersionCode)
            .putString("installedVersionName", installedVersionName)
            .putLong("latestVersionCode", latestVersionCode)
            .putString("latestVersionName", latestVersionName)
            .apply();
        updateWidgets(context);
    }

    // ------------------------------------------------------------------ fonts

    /** Inter (bundled in assets/fonts); falls back to the system sans-serif if an asset is missing. */
    private static synchronized MathMasterWidgetRenderer.Fonts getWidgetFonts(Context context) {
        if (widgetFonts == null) {
            Context app = context.getApplicationContext() != null ? context.getApplicationContext() : context;
            widgetFonts = new MathMasterWidgetRenderer.Fonts(
                loadFont(app, "fonts/MathMaster-Regular.otf", Typeface.create("sans-serif", Typeface.NORMAL)),
                loadFont(app, "fonts/MathMaster-Medium.otf", Typeface.create("sans-serif-medium", Typeface.NORMAL)),
                loadFont(app, "fonts/MathMaster-Bold.otf", Typeface.create("sans-serif", Typeface.BOLD)));
        }
        return widgetFonts;
    }

    private static Typeface loadFont(Context context, String assetPath, Typeface fallback) {
        try {
            Typeface face = Typeface.createFromAsset(context.getAssets(), assetPath);
            return face != null ? face : fallback;
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }

    // ------------------------------------------------------------------ composition

    private static Bundle getWidgetOptions(Context context, int appWidgetId) {
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return Bundle.EMPTY;
        Bundle options = AppWidgetManager.getInstance(context).getAppWidgetOptions(appWidgetId);
        return options == null ? Bundle.EMPTY : options;
    }

    private static int getWidgetWidthDp(Context context, int appWidgetId) {
        Bundle options = getWidgetOptions(context, appWidgetId);
        int minimum = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        return minimum > 0 ? minimum : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
    }

    private static int getWidgetHeightDp(Context context, int appWidgetId) {
        Bundle options = getWidgetOptions(context, appWidgetId);
        int minimum = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        return minimum > 0 ? minimum : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
    }

    private static String normalizeComposition(String value) {
        if (value == null) return "auto";
        for (String[] option : WIDGET_COMPOSITIONS) if (option[0].equals(value)) return value;
        return "auto";
    }

    private static String resolveComposition(SharedPreferences preferences, int appWidgetId, int widthDp, int heightDp) {
        String requested = normalizeComposition(getInstanceString(
            preferences, appWidgetId, "composition", preferences.getString("composition", "auto")
        ));
        if (!"auto".equals(requested)) return requested;
        return MathMasterWidgetRenderer.autoComposition(widthDp, heightDp);
    }

    /**
     * Background effect. "neon" is the reference neon-glass design; "blur" and "transparent" keep the
     * wallpaper-first surfaces. The old Glass / Compact / Minimal values all mean neon.
     */
    static String normalizeWidgetStyle(String value) {
        if ("transparent".equals(value)) return "transparent";
        if ("blur".equals(value)) return "blur";
        return "neon";
    }

    private static Set<String> getCompletedDays(SharedPreferences preferences) {
        Set<String> completed = new HashSet<>();
        String value = preferences.getString("completedDaysJson", "[]");
        if (value == null || value.length() > 512) return completed;
        try {
            JSONArray array = new JSONArray(value);
            for (int i = 0; i < Math.min(array.length(), 7); i++) {
                String date = array.optString(i, "");
                if (date.matches("\\d{4}-\\d{2}-\\d{2}")) completed.add(date);
            }
        } catch (JSONException ignored) {
            // Ignore malformed optional week data without breaking the widget.
        }
        return completed;
    }

    private static String getInstanceString(SharedPreferences preferences, int appWidgetId, String field, String fallback) {
        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            String key = "instance_" + appWidgetId + "_" + field;
            if (preferences.contains(key)) return preferences.getString(key, fallback);
        }
        return preferences.getString(field, fallback);
    }

    // ------------------------------------------------------------------ saved data

    /** Sunday .. Saturday of the current week, ticked from the saved completed days. */
    private static void fillWeek(SharedPreferences preferences, MathMasterWidgetRenderer.Data data) {
        Set<String> completed = getCompletedDays(preferences);
        Calendar day = Calendar.getInstance();
        int todayIndex = day.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
        day.set(Calendar.HOUR_OF_DAY, 12);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);
        day.add(Calendar.DAY_OF_MONTH, -todayIndex);
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        for (int i = 0; i < 7; i++) {
            data.weekDone[i] = completed.contains(dateFormat.format(day.getTime()));
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
        data.todayIndex = Math.max(0, Math.min(6, todayIndex));
    }

    static MathMasterWidgetRenderer.Data readWidgetData(SharedPreferences preferences) {
        MathMasterWidgetRenderer.Data data = new MathMasterWidgetRenderer.Data();
        int targetMinutes = Math.max(1, Math.min(1440, preferences.getInt("targetMinutes", 5)));
        String storedDay = preferences.getString("dayKey", "");
        long elapsedSeconds = Math.max(0L, preferences.getLong("elapsedSeconds", 0L));
        if (!todayKey().equals(storedDay)) elapsedSeconds = 0L;
        long targetSeconds = targetMinutes * 60L;
        long progressSeconds = Math.min(elapsedSeconds, targetSeconds);
        data.targetMinutes = targetMinutes;
        data.progress = (int) Math.max(0L, Math.min(100L, progressSeconds * 100L / targetSeconds));
        // Study time stays the real accumulated duration, even after today's target is reached.
        data.elapsedMinutes = (int) Math.min(Integer.MAX_VALUE, elapsedSeconds / 60L);
        data.remainingMinutes = (int) Math.max(0L, (targetSeconds - elapsedSeconds + 59L) / 60L);
        data.streak = Math.max(0, preferences.getInt("currentStreak", 0));
        fillWeek(preferences, data);
        String installedVersion = preferences.getString("installedVersionName", "");
        String latestVersion = preferences.getString("latestVersionName", "");
        if (preferences.getBoolean("updateAvailable", false) && isSafeVersion(installedVersion) && isSafeVersion(latestVersion)) {
            data.updateLabel = "UPDATE";
        }
        return data;
    }

    static MathMasterWidgetRenderer.Options buildOptions(
        String composition, String style, boolean enabled, Set<String> selected, ScreenTimeConfig screenTime
    ) {
        MathMasterWidgetRenderer.Options options = new MathMasterWidgetRenderer.Options();
        options.composition = composition;
        options.style = normalizeWidgetStyle(style);
        options.enabled = enabled;
        options.identity = selected.contains("appIdentity");
        options.progress = selected.contains("progress");
        options.target = selected.contains("target");
        options.remaining = selected.contains("remaining");
        options.studyTime = selected.contains("studyTime");
        options.streak = selected.contains("streak");
        options.weekly = selected.contains("weekly");
        options.quiz = selected.contains("quiz");
        options.update = selected.contains("updateStatus");
        options.studyAppsScreenTime = selected.contains("studyAppsScreenTime");
        options.deviceAppsScreenTime = selected.contains("deviceAppsScreenTime");
        ScreenTimeConfig config = screenTime == null ? new ScreenTimeConfig() : screenTime;
        options.screenTimePeriod = config.period;
        options.screenTimeMaxEntries = config.maxEntries;
        options.screenTimeShowTotal = config.showTotal;
        options.screenTimeShowUsage = config.showUsage;
        options.screenTimeShowPercent = config.showPercent;
        options.screenTimeDetailed = config.detailed;
        return options;
    }

    private static void applyScreenTimeTheme(
        SharedPreferences preferences, MathMasterWidgetRenderer.Options options
    ) {
        options.themeMatched = options.studyAppsScreenTime || options.deviceAppsScreenTime;
        if (!options.themeMatched) return;

        options.lightMode = "light".equals(preferences.getString("mode", "dark"));
        String accent = preferences.getString("appAccentColor", "#22d3ee");
        if (accent == null || !accent.matches("^#[0-9a-fA-F]{6}$")) accent = "#22d3ee";
        options.themeAccent = Color.parseColor(accent);
    }


    private static Set<String> defaultContent() {
        return new HashSet<>(Arrays.asList(
            "appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "quiz", "updateStatus"
        ));
    }

    static ScreenTimeConfig readScreenTimeConfig(SharedPreferences preferences, int appWidgetId) {
        ScreenTimeConfig config = new ScreenTimeConfig();
        config.period = normalizeScreenTimePeriod(getInstanceString(preferences, appWidgetId, "screenTimePeriod", "today"));
        config.sort = normalizeScreenTimeSort(getInstanceString(preferences, appWidgetId, "screenTimeSort", "most_used"));
        config.maxEntries = Math.max(1, Math.min(12, getInstanceInt(preferences, appWidgetId, "screenTimeMaxEntries", 5)));
        config.showTotal = getInstanceBoolean(preferences, appWidgetId, "screenTimeShowTotal", true);
        config.showUsage = getInstanceBoolean(preferences, appWidgetId, "screenTimeShowUsage", true);
        config.showPercent = getInstanceBoolean(preferences, appWidgetId, "screenTimeShowPercent", false);
        config.detailed = getInstanceBoolean(preferences, appWidgetId, "screenTimeDetailed", true);
        config.hiddenStudyPackages = readPackageSet(getInstanceString(
            preferences, appWidgetId, "screenTimeHiddenStudyPackages", "[]"));
        config.hiddenDevicePackages = readPackageSet(getInstanceString(
            preferences, appWidgetId, "screenTimeHiddenDevicePackages", "[]"));
        return config;
    }

    private static int getInstanceInt(SharedPreferences preferences, int appWidgetId, String field, int fallback) {
        String key = appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? field : "instance_" + appWidgetId + "_" + field;
        if (!preferences.contains(key)) return fallback;
        try { return preferences.getInt(key, fallback); } catch (ClassCastException ignored) { return fallback; }
    }

    private static boolean getInstanceBoolean(SharedPreferences preferences, int appWidgetId, String field, boolean fallback) {
        String key = appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? field : "instance_" + appWidgetId + "_" + field;
        if (!preferences.contains(key)) return fallback;
        try { return preferences.getBoolean(key, fallback); } catch (ClassCastException ignored) { return fallback; }
    }

    private static Set<String> readPackageSet(String value) {
        Set<String> packages = new HashSet<>();
        try {
            JSONArray array = new JSONArray(value == null ? "[]" : value);
            for (int index = 0; index < array.length(); index++) {
                String packageName = array.optString(index, "");
                if (packageName.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+")) packages.add(packageName);
            }
        } catch (JSONException ignored) {
            // Ignore invalid legacy values; backup validators reject malformed package lists.
        }
        return packages;
    }

    private static String normalizeScreenTimePeriod(String value) {
        return "yesterday".equals(value) || "last_7_days".equals(value) ? value : "today";
    }

    private static String normalizeScreenTimeSort(String value) {
        if ("least_used".equals(value) || "name_asc".equals(value) || "name_desc".equals(value)) return value;
        return "most_used";
    }

    private static void applyScreenTimeData(Context context, MathMasterWidgetRenderer.Data data,
        MathMasterWidgetRenderer.Options options, ScreenTimeConfig config) {
        if (!options.studyAppsScreenTime && !options.deviceAppsScreenTime) return;
        WidgetScreenTimeRepository.Snapshot snapshot =
            WidgetScreenTimeRepository.getCachedSnapshot(context, config.period);
        if (options.studyAppsScreenTime) {
            data.studyAppsScreenTime = WidgetScreenTimeRepository.buildSection(
                context, snapshot, true, config.sort, config.maxEntries, config.hiddenStudyPackages);
        }
        if (options.deviceAppsScreenTime) {
            data.deviceAppsScreenTime = WidgetScreenTimeRepository.buildSection(
                context, snapshot, false, config.sort, config.maxEntries, config.hiddenDevicePackages);
        }
    }

    private static boolean jsonArrayContains(JSONArray array, String value) {
        for (int i = 0; i < array.length(); i++) {
            if (value.equals(array.optString(i, ""))) return true;
        }
        return false;
    }

    private static Set<String> getSelectedContent(SharedPreferences preferences, int appWidgetId) {
        String json = getInstanceString(preferences, appWidgetId, "contentJson", preferences.getString("contentJson", null));
        boolean instanceContent = false;
        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            String prefix = "instance_" + appWidgetId + "_";
            String contentKey = prefix + "contentJson";
            instanceContent = preferences.contains(contentKey);
            int storedVersion = preferences.getInt(prefix + "contentSchemaVersion", 0);
            if (instanceContent && storedVersion < CONTENT_SCHEMA_VERSION) {
                JSONArray migrated;
                try {
                    migrated = new JSONArray(preferences.getString(contentKey, "[]"));
                } catch (JSONException ignored) {
                    migrated = new JSONArray();
                    for (String option : defaultContent()) migrated.put(option);
                }
                if (storedVersion < 2 && !jsonArrayContains(migrated, "weekly") && migrated.length() < 32) migrated.put("weekly");
                if (!jsonArrayContains(migrated, "quiz") && migrated.length() < 32) migrated.put("quiz");
                // Additive migration: never opt existing widgets into the new screen-time content
                // or overwrite their saved appearance/customization.
                preferences.edit()
                    .putString(contentKey, migrated.toString())
                    .putInt(prefix + "contentSchemaVersion", CONTENT_SCHEMA_VERSION)
                    .apply();
                json = migrated.toString();
            }
        }
        if (json == null) return defaultContent();
        Set<String> selected = new HashSet<>();
        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                String item = array.optString(i, "");
                if (Arrays.asList(CONTENT_OPTIONS).contains(item)) selected.add(item);
            }
        } catch (JSONException ignored) {
            return defaultContent();
        }
        if (selected.isEmpty()) selected.add("progress");
        // The web app's own (non-instance) list does not know the quiz tile, so keep it on there.
        if (!instanceContent) selected.add("quiz");
        return selected;
    }

    private static boolean isSafeVersion(String value) {
        return value != null && value.length() <= 40
            && value.matches("[0-9]+(?:\\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?");
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    // ------------------------------------------------------------------ rendering

    /**
     * Draws the widget for a launcher size. variantCount is how many sizes the launcher asked for,
     * so the combined bitmap memory of one RemoteViews stays well inside Android's limit.
     */
    static Bitmap renderWidgetBitmap(
        Context context, MathMasterWidgetRenderer.Options options, MathMasterWidgetRenderer.Data data,
        int widthDp, int heightDp, int variantCount
    ) {
        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        float density = metrics.density > 0f ? metrics.density : 2.75f;
        float widthPx = Math.max(1, widthDp) * density;
        float heightPx = Math.max(1, heightDp) * density;
        long screenPixels = (long) metrics.widthPixels * (long) metrics.heightPixels;
        long budget = Math.min(1200000L, Math.max(300000L, (long) (screenPixels * 0.75d / Math.max(1, variantCount))));
        float scale = 1f;
        if ((double) widthPx * (double) heightPx > budget) {
            scale = (float) Math.sqrt(budget / ((double) widthPx * (double) heightPx));
        }
        int width = Math.max(48, Math.round(widthPx * scale));
        int height = Math.max(32, Math.round(heightPx * scale));
        return MathMasterWidgetRenderer.render(getWidgetFonts(context), data, options, width, height, density * scale);
    }

    /** Live preview for the configuration screen: same renderer and the user's unsaved choices. */
    public static Bitmap renderConfigurationPreview(
        Context context, String composition, String style, Set<String> selected, int widthDp, int heightDp
    ) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        return renderConfigurationPreview(context, composition, style, selected, widthDp, heightDp,
            readScreenTimeConfig(preferences, AppWidgetManager.INVALID_APPWIDGET_ID));
    }

    public static Bitmap renderConfigurationPreview(
        Context context, String composition, String style, Set<String> selected, int widthDp, int heightDp,
        ScreenTimeConfig screenTime
    ) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        String resolved = normalizeComposition(composition);
        if ("auto".equals(resolved)) resolved = MathMasterWidgetRenderer.autoComposition(widthDp, heightDp);
        MathMasterWidgetRenderer.Options options = buildOptions(
            resolved, style, preferences.getBoolean("enabled", true), selected, screenTime);
        applyScreenTimeTheme(preferences, options);
        MathMasterWidgetRenderer.Data data = readWidgetData(preferences);
        applyScreenTimeData(context, data, options, screenTime == null ? new ScreenTimeConfig() : screenTime);
        return renderWidgetBitmap(context, options, data, widthDp, heightDp, 1);
    }

    /** Render the saved configuration for one real, currently pinned launcher instance. */
    public static Bitmap renderWidgetInstancePreview(Context context, int appWidgetId) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Bundle launcherOptions = manager.getAppWidgetOptions(appWidgetId);
        int widthDp = launcherOptions == null ? 0 : launcherOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int heightDp = launcherOptions == null ? 0 : launcherOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        if (widthDp <= 0 && launcherOptions != null) widthDp = launcherOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
        if (heightDp <= 0 && launcherOptions != null) heightDp = launcherOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        widthDp = widthDp > 0 ? Math.min(widthDp, 600) : 320;
        heightDp = heightDp > 0 ? Math.min(heightDp, 400) : 146;

        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        String composition = resolveComposition(preferences, appWidgetId, widthDp, heightDp);
        Set<String> selected = getSelectedContent(preferences, appWidgetId);
        String style = normalizeWidgetStyle(getInstanceString(preferences, appWidgetId, "style", "neon"));
        boolean enabled = preferences.getBoolean("enabled", true);
        ScreenTimeConfig screenTime = readScreenTimeConfig(preferences, appWidgetId);
        MathMasterWidgetRenderer.Options options = buildOptions(composition, style, enabled, selected, screenTime);
        applyScreenTimeTheme(preferences, options);
        MathMasterWidgetRenderer.Data data = readWidgetData(preferences);
        applyScreenTimeData(context, data, options, screenTime);
        if (options.studyAppsScreenTime || options.deviceAppsScreenTime) {
            WidgetScreenTimeRepository.requestRefresh(context, screenTime.period, null);
        }
        return renderWidgetBitmap(context, options, data, widthDp, heightDp, 1);
    }

    private static String describe(MathMasterWidgetRenderer.Options options, MathMasterWidgetRenderer.Data data) {
        if (!options.enabled) return "Math Master widgets are turned off in app settings.";
        StringBuilder text = new StringBuilder("Math Master.");
        if (options.progress) text.append(' ').append(data.progress).append("% of today's target completed.");
        if (options.target) {
            text.append(' ').append(Math.min(data.elapsedMinutes, data.targetMinutes)).append(" of ")
                .append(data.targetMinutes).append(" minutes studied today.");
        } else if (options.studyTime) {
            text.append(' ').append(data.elapsedMinutes).append(" minutes studied today.");
        }
        if (options.remaining) {
            text.append(data.progress >= 100 ? " Daily target complete." : " " + data.remainingMinutes + " minutes left today.");
        }
        if (options.streak) text.append(' ').append(data.streak).append(" day streak.");
        if (options.weekly) {
            int done = 0;
            for (boolean day : data.weekDone) if (day) done++;
            text.append(' ').append(done).append(" of 7 days completed this week.");
        }
        if (options.studyAppsScreenTime && data.studyAppsScreenTime != null) {
            text.append(" Study Apps screen time: ").append(data.studyAppsScreenTime.status).append(".");
        }
        if (options.deviceAppsScreenTime && data.deviceAppsScreenTime != null) {
            text.append(" Device Apps screen time: ").append(data.deviceAppsScreenTime.status).append(".");
        }
        if (options.update && data.updateLabel != null) text.append(" An app update is available.");
        return text.toString();
    }

    public static RemoteViews createViews(Context context, int appWidgetId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Bundle options = getWidgetOptions(context, appWidgetId);
            ArrayList<SizeF> availableSizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (availableSizes != null && !availableSizes.isEmpty()) {
                List<SizeF> validSizes = new ArrayList<>();
                for (SizeF size : availableSizes) {
                    if (size == null
                        || Float.isNaN(size.getWidth()) || Float.isInfinite(size.getWidth())
                        || Float.isNaN(size.getHeight()) || Float.isInfinite(size.getHeight())
                        || size.getWidth() <= 0f || size.getHeight() <= 0f) continue;
                    validSizes.add(size);
                }
                Map<SizeF, RemoteViews> viewsBySize = new LinkedHashMap<>();
                for (SizeF size : validSizes) {
                    int widthDp = Math.max(1, Math.round(size.getWidth()));
                    int heightDp = Math.max(1, Math.round(size.getHeight()));
                    viewsBySize.put(size, createViewsForSize(context, appWidgetId, widthDp, heightDp, validSizes.size()));
                }
                if (!viewsBySize.isEmpty()) return new RemoteViews(viewsBySize);
            }
        }
        return createViewsForSize(context, appWidgetId,
            getWidgetWidthDp(context, appWidgetId), getWidgetHeightDp(context, appWidgetId), 1);
    }

    private static RemoteViews createViewsForSize(
        Context context, int appWidgetId, int widthDp, int heightDp, int variantCount
    ) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        int sizeWidthDp = widthDp > 0 ? widthDp : 320;
        int sizeHeightDp = heightDp > 0 ? heightDp : 146;
        String composition = resolveComposition(preferences, appWidgetId, sizeWidthDp, sizeHeightDp);
        // Read the content first: it also runs the one-time schema migration, which may reset the style.
        Set<String> selected = getSelectedContent(preferences, appWidgetId);
        String style = normalizeWidgetStyle(getInstanceString(preferences, appWidgetId, "style", "neon"));
        boolean enabled = preferences.getBoolean("enabled", true);
        ScreenTimeConfig screenTime = readScreenTimeConfig(preferences, appWidgetId);
        MathMasterWidgetRenderer.Options options = buildOptions(composition, style, enabled, selected, screenTime);
        applyScreenTimeTheme(preferences, options);
        MathMasterWidgetRenderer.Data data = readWidgetData(preferences);
        applyScreenTimeData(context, data, options, screenTime);
        if (options.studyAppsScreenTime || options.deviceAppsScreenTime) {
            WidgetScreenTimeRepository.requestRefresh(context, screenTime.period, null);
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.math_master_home_widget);
        try {
            views.setImageViewBitmap(R.id.widget_canvas,
                renderWidgetBitmap(context, options, data, sizeWidthDp, sizeHeightDp, variantCount));
        } catch (RuntimeException | OutOfMemoryError ignored) {
            // Keep the static preview image rather than losing the widget if drawing ever fails.
        }
        views.setContentDescription(R.id.widget_canvas, describe(options, data));

        boolean hasChecked = preferences.getBoolean("hasCheckedUpdates", false);
        boolean updateAvailable = preferences.getBoolean("updateAvailable", false);
        String latestVersion = preferences.getString("latestVersionName", "");
        Intent launchIntent = null;
        if ((options.studyAppsScreenTime || options.deviceAppsScreenTime)
            && !WidgetScreenTimeRepository.hasUsageAccess(context)) {
            launchIntent = new Intent(context, MathMasterWidgetConfigActivity.class);
            launchIntent.putExtra("openUsageAccessOnly", true);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        } else if (options.studyAppsScreenTime
            && data.studyAppsScreenTime != null && "no_study_apps".equals(data.studyAppsScreenTime.status)) {
            // The empty Study Apps state takes the user directly to the canonical Study Mode picker.
            launchIntent = new Intent(context, MathMasterWidgetConfigActivity.class);
            launchIntent.putExtra("openStudyAppsPickerOnly", true);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        } else {
            launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                if (updateAvailable && hasChecked) {
                    launchIntent.setAction("com.sudhanshu.mathsbj.OPEN_HOME_WIDGET_UPDATE");
                    launchIntent.putExtra("mathmaster_notification_action", "app-update");
                    launchIntent.putExtra("mathmaster_update_version_name", latestVersion);
                    launchIntent.putExtra("mathmaster_update_version_code",
                        String.valueOf(preferences.getLong("latestVersionCode", 0L)));
                }
            }
        }
        if (launchIntent != null) {
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, REQUEST_CODE + Math.max(0, appWidgetId), launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        }
        return views;
    }
}
