package com.sudhanshu.mathsbj;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Build;
import android.util.TypedValue;
import android.view.View;
import android.view.Gravity;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class MathMasterHomeWidgetProvider extends AppWidgetProvider {
    private static final String WIDGET_PREFS = "math_master_home_widget";
    private static final int REQUEST_CODE = 8907;

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

    public static void updateWidgets(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        if (!preferences.getBoolean("enabled", true)) return;
        refreshWidgetInstances(context);
    }

    /** Called when widget preferences change, including the global OFF transition. */
    public static void updateWidgetPreferences(Context context) {
        refreshWidgetInstances(context);
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

    private static Bundle getWidgetOptions(Context context, int appWidgetId) {
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return Bundle.EMPTY;
        Bundle options = AppWidgetManager.getInstance(context).getAppWidgetOptions(appWidgetId);
        return options == null ? Bundle.EMPTY : options;
    }

    private static int getWidgetWidthDp(Context context, int appWidgetId) {
        Bundle options = getWidgetOptions(context, appWidgetId);
        return Math.max(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0));
    }

    private static int getWidgetHeightDp(Context context, int appWidgetId) {
        Bundle options = getWidgetOptions(context, appWidgetId);
        return Math.max(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0),
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0));
    }

    private static boolean isCompactSize(Context context, int appWidgetId) {
        int width = getWidgetWidthDp(context, appWidgetId);
        int height = getWidgetHeightDp(context, appWidgetId);
        return (width > 0 && width < 220) || (height > 0 && height < 130);
    }

    private static boolean isTallWidget(Context context, int appWidgetId) {
        int width = getWidgetWidthDp(context, appWidgetId);
        int height = getWidgetHeightDp(context, appWidgetId);
        return width > 0 && height > width * 1.3f;
    }

    private static boolean isWideWidget(Context context, int appWidgetId) {
        int width = getWidgetWidthDp(context, appWidgetId);
        int height = getWidgetHeightDp(context, appWidgetId);
        return width > 0 && height > 0 && width >= height * 1.7f;
    }

    private static int getWidgetLayout(Context context, int appWidgetId) {
        if (isTallWidget(context, appWidgetId)) return R.layout.math_master_home_widget;
        if (isCompactSize(context, appWidgetId)) return R.layout.math_master_home_widget_compact;
        if (isWideWidget(context, appWidgetId)) return R.layout.math_master_home_widget_wide;
        return R.layout.math_master_home_widget;
    }

    private static int completedAccentColor(String dayKey, int streak) {
        int[] celebrationColors = {
            Color.parseColor("#50D9A0"), Color.parseColor("#58D6F2"),
            Color.parseColor("#FFCA68"), Color.parseColor("#FF83B5"),
            Color.parseColor("#B8A0FF"), Color.parseColor("#FF9A72"),
            Color.parseColor("#A8E063")
        };
        int hash = ((dayKey == null ? "" : dayKey) + "#" + streak).hashCode() & 0x7fffffff;
        return celebrationColors[hash % celebrationColors.length];
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

    private static void bindWeekProgress(
        RemoteViews views, SharedPreferences preferences, int accentColor, boolean lightMode
    ) {
        int[] dayIds = { R.id.widget_week_day_0, R.id.widget_week_day_1, R.id.widget_week_day_2,
            R.id.widget_week_day_3, R.id.widget_week_day_4, R.id.widget_week_day_5, R.id.widget_week_day_6 };
        int[] statusIds = { R.id.widget_week_status_0, R.id.widget_week_status_1, R.id.widget_week_status_2,
            R.id.widget_week_status_3, R.id.widget_week_status_4, R.id.widget_week_status_5, R.id.widget_week_status_6 };
        Set<String> completed = getCompletedDays(preferences);
        Calendar day = Calendar.getInstance();
        day.set(Calendar.HOUR_OF_DAY, 12);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);
        day.add(Calendar.DAY_OF_MONTH, -6);
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        SimpleDateFormat labelFormat = new SimpleDateFormat("EEEEE", Locale.getDefault());
        int idleColor = lightMode ? Color.parseColor("#7C8498") : Color.parseColor("#9F9AB8");
        for (int i = 0; i < 7; i++) {
            String date = dateFormat.format(day.getTime());
            boolean done = completed.contains(date);
            String label = labelFormat.format(day.getTime());
            views.setTextViewText(dayIds[i], label);
            views.setTextViewText(statusIds[i], done ? "✓" : "·");
            views.setTextColor(dayIds[i], idleColor);
            views.setTextColor(statusIds[i], done ? accentColor : idleColor);
            views.setContentDescription(statusIds[i], label + (done ? ", target completed" : ", target not completed"));
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
    }

    private static String getInstanceString(SharedPreferences preferences, int appWidgetId, String field, String fallback) {
        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            String key = "instance_" + appWidgetId + "_" + field;
            if (preferences.contains(key)) return preferences.getString(key, fallback);
        }
        return preferences.getString(field, fallback);
    }

    private static Set<String> getSelectedContent(SharedPreferences preferences, int appWidgetId) {
        String json = getInstanceString(preferences, appWidgetId, "contentJson", preferences.getString("contentJson", null));
        if (json == null) {
            return new HashSet<>(Arrays.asList("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "updateStatus"));
        }
        Set<String> selected = new HashSet<>();
        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                String item = array.optString(i, "");
                if (Arrays.asList("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "updateStatus").contains(item)) {
                    selected.add(item);
                }
            }
        } catch (JSONException ignored) {
            return new HashSet<>(Arrays.asList("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "updateStatus"));
        }
        if (selected.isEmpty()) selected.add("progress");
        return selected;
    }

    private static boolean isSafeVersion(String value) {
        return value != null && value.length() <= 40
            && value.matches("[0-9]+(?:\\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?");
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    public static RemoteViews createViews(Context context, int appWidgetId) {
        SharedPreferences preferences = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        int targetMinutes = Math.max(1, Math.min(1440, preferences.getInt("targetMinutes", 5)));
        String storedDay = preferences.getString("dayKey", "");
        long elapsedSeconds = Math.max(0L, preferences.getLong("elapsedSeconds", 0L));
        if (!todayKey().equals(storedDay)) elapsedSeconds = 0L;

        long targetSeconds = targetMinutes * 60L;
        long progressSeconds = Math.min(elapsedSeconds, targetSeconds);
        int progress = (int) Math.max(0L, Math.min(100L, progressSeconds * 100L / targetSeconds));
        // Study time remains the actual accumulated duration, even after today's target is reached.
        int elapsedMinutes = (int) Math.min(Integer.MAX_VALUE, elapsedSeconds / 60L);
        int remainingMinutes = (int) Math.max(0L, (targetSeconds - elapsedSeconds + 59L) / 60L);
        int streak = Math.max(0, preferences.getInt("currentStreak", 0));
        Set<String> selected = getSelectedContent(preferences, appWidgetId);

        RemoteViews views = new RemoteViews(context.getPackageName(), getWidgetLayout(context, appWidgetId));
        boolean widgetsEnabled = preferences.getBoolean("enabled", true);
        String mode = preferences.getString("mode", "dark");
        String style = getInstanceString(preferences, appWidgetId, "style", "glass");
        String widgetTheme = getInstanceString(preferences, appWidgetId, "theme", "app");
        String accentValue = "violet".equals(widgetTheme)
            ? "#B8A0FF" : preferences.getString("appAccentColor", preferences.getString("accentColor", "#B8A0FF"));
        int accentColor = accentValue.matches("#[0-9A-Fa-f]{6}") ? Color.parseColor(accentValue) : Color.parseColor("#B8A0FF");
        boolean targetComplete = progress >= 100;
        if (targetComplete) accentColor = completedAccentColor(todayKey(), streak);
        boolean lightMode = "light".equals(mode);
        views.setInt(R.id.widget_root, "setBackgroundResource", lightMode
            ? R.drawable.math_master_home_widget_background_light
            : R.drawable.math_master_home_widget_background);
        boolean smallWidget = isCompactSize(context, appWidgetId);
        boolean tallWidget = isTallWidget(context, appWidgetId);
        views.setInt(R.id.widget_root, "setGravity", tallWidget ? Gravity.CENTER_VERTICAL : Gravity.TOP);
        int paddingDp = smallWidget || "compact".equals(style) ? 4 : ("minimal".equals(style) ? 7 : 9);
        int paddingPx = (int) (paddingDp * context.getResources().getDisplayMetrics().density + 0.5f);
        views.setViewPadding(R.id.widget_root, paddingPx, paddingPx, paddingPx, paddingPx);
        views.setTextViewTextSize(R.id.widget_progress_percent, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 22f : ("minimal".equals(style) ? 26f : 29f));
        views.setTextViewTextSize(R.id.widget_target_value, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 10f : ("minimal".equals(style) ? 12f : 14f));
        views.setTextViewTextSize(R.id.widget_target_label, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 8f : 10f);
        views.setTextViewTextSize(R.id.widget_study_time_text, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 8f : 11f);
        views.setTextViewTextSize(R.id.widget_remaining_text, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 8f : 11f);
        views.setTextViewTextSize(R.id.widget_streak_text, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 8f : 11f);
        views.setTextViewTextSize(R.id.widget_update_text, TypedValue.COMPLEX_UNIT_SP,
            smallWidget || "compact".equals(style) ? 7f : 10f);
        int[] dayLabelIds = { R.id.widget_week_day_0, R.id.widget_week_day_1, R.id.widget_week_day_2,
            R.id.widget_week_day_3, R.id.widget_week_day_4, R.id.widget_week_day_5, R.id.widget_week_day_6 };
        int[] dayStatusIds = { R.id.widget_week_status_0, R.id.widget_week_status_1, R.id.widget_week_status_2,
            R.id.widget_week_status_3, R.id.widget_week_status_4, R.id.widget_week_status_5, R.id.widget_week_status_6 };
        for (int i = 0; i < 7; i++) {
            views.setTextViewTextSize(dayLabelIds[i], TypedValue.COMPLEX_UNIT_SP, smallWidget ? 6f : 8f);
            views.setTextViewTextSize(dayStatusIds[i], TypedValue.COMPLEX_UNIT_SP, smallWidget ? 8f : 10f);
        }
        views.setTextColor(R.id.widget_progress_percent, accentColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(R.id.widget_progress_bar, "setProgressTintList", ColorStateList.valueOf(accentColor));
        }
        if (lightMode) {
            views.setTextColor(R.id.widget_title_text, Color.parseColor("#253047"));
            views.setTextColor(R.id.widget_target_label, Color.parseColor("#536078"));
            views.setTextColor(R.id.widget_target_value, Color.parseColor("#202A3D"));
            views.setTextColor(R.id.widget_study_time_text, Color.parseColor("#475569"));
            views.setTextColor(R.id.widget_remaining_text, Color.parseColor("#475569"));
            views.setTextColor(R.id.widget_streak_text, Color.parseColor("#805A11"));
            views.setTextColor(R.id.widget_update_text, Color.parseColor("#526078"));
            views.setTextColor(R.id.widget_update_badge, accentColor);
            views.setTextColor(R.id.widget_disabled_text, accentColor);
        } else {
            views.setTextColor(R.id.widget_progress_percent, accentColor);
            views.setTextColor(R.id.widget_target_label, Color.parseColor("#AFAAC7"));
        }
        views.setTextViewText(R.id.widget_progress_percent, progress + "%");
        views.setTextViewText(R.id.widget_target_value, targetMinutes + " min target");
        views.setTextViewText(R.id.widget_study_time_text, elapsedMinutes + " min studied");
        views.setProgressBar(R.id.widget_progress_bar, 100, progress, false);
        views.setTextViewText(R.id.widget_remaining_text,
            targetComplete ? "✓ Daily target complete!" : remainingMinutes + " min left today");
        if (targetComplete) views.setTextColor(R.id.widget_remaining_text, accentColor);
        views.setTextViewText(R.id.widget_streak_text, "🔥 " + streak + "-day streak");
        bindWeekProgress(views, preferences, accentColor, lightMode);

        boolean hasChecked = preferences.getBoolean("hasCheckedUpdates", false);
        boolean updateAvailable = preferences.getBoolean("updateAvailable", false);
        String installedVersion = preferences.getString("installedVersionName", "");
        String latestVersion = preferences.getString("latestVersionName", "");
        if (updateAvailable && isSafeVersion(installedVersion) && isSafeVersion(latestVersion)) {
            views.setViewVisibility(R.id.widget_update_badge, android.view.View.VISIBLE);
            views.setTextViewText(R.id.widget_update_badge, "UPDATE");
            views.setTextViewText(R.id.widget_update_text, "New version available · v" + latestVersion);
        } else {
            views.setViewVisibility(R.id.widget_update_badge, android.view.View.GONE);
            if (hasChecked && isSafeVersion(installedVersion)) {
                views.setTextViewText(R.id.widget_update_text, "v" + installedVersion + " · You're up to date");
            } else {
                views.setTextViewText(R.id.widget_update_text, "Updates refresh when the app opens");
            }
        }

        boolean showIdentity = widgetsEnabled && selected.contains("appIdentity");
        boolean showProgress = widgetsEnabled && selected.contains("progress");
        boolean showTarget = widgetsEnabled && selected.contains("target");
        boolean showStudyTime = widgetsEnabled && selected.contains("studyTime");
        boolean showRemaining = widgetsEnabled && selected.contains("remaining");
        boolean showStreak = widgetsEnabled && selected.contains("streak");
        boolean showUpdateStatus = widgetsEnabled && selected.contains("updateStatus");
        views.setViewVisibility(R.id.widget_header_row, showIdentity ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_target_label, showTarget ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_target_value, showTarget ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_progress_percent, showProgress ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_progress_bar, showProgress ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_study_time_text, showStudyTime ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_remaining_text, showRemaining ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_streak_container, showStreak ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_streak_text, showStreak ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_week_strip, showStreak ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_update_text, showUpdateStatus ? View.VISIBLE : View.GONE);
        if (!showUpdateStatus) views.setViewVisibility(R.id.widget_update_badge, View.GONE);
        views.setViewVisibility(R.id.widget_disabled_text, widgetsEnabled ? View.GONE : View.VISIBLE);
        if (!widgetsEnabled) {
            views.setViewVisibility(R.id.widget_target_label, View.GONE);
            views.setViewVisibility(R.id.widget_progress_percent, View.GONE);
            views.setViewVisibility(R.id.widget_progress_bar, View.GONE);
            views.setViewVisibility(R.id.widget_target_value, View.GONE);
            views.setViewVisibility(R.id.widget_study_time_text, View.GONE);
            views.setViewVisibility(R.id.widget_remaining_text, View.GONE);
            views.setViewVisibility(R.id.widget_streak_container, View.GONE);
            views.setViewVisibility(R.id.widget_streak_text, View.GONE);
            views.setViewVisibility(R.id.widget_week_strip, View.GONE);
            views.setViewVisibility(R.id.widget_update_text, View.GONE);
            views.setViewVisibility(R.id.widget_update_badge, View.GONE);
        }

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (updateAvailable && hasChecked) {
                launchIntent.setAction("com.sudhanshu.mathsbj.OPEN_HOME_WIDGET_UPDATE");
                launchIntent.putExtra("mathmaster_notification_action", "app-update");
                launchIntent.putExtra("mathmaster_update_version_name", latestVersion);
                launchIntent.putExtra("mathmaster_update_version_code",
                    String.valueOf(preferences.getLong("latestVersionCode", 0L)));
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                REQUEST_CODE,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        }
        return views;
    }
}
