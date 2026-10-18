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

    private static Set<String> getSelectedContent(SharedPreferences preferences) {
        String json = preferences.getString("contentJson", null);
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
        elapsedSeconds = Math.min(elapsedSeconds, targetSeconds);
        int progress = (int) Math.max(0L, Math.min(100L, elapsedSeconds * 100L / targetSeconds));
        int elapsedMinutes = (int) Math.min(targetMinutes, elapsedSeconds / 60L);
        int remainingMinutes = (int) Math.max(0L, (targetSeconds - elapsedSeconds + 59L) / 60L);
        int streak = Math.max(0, preferences.getInt("currentStreak", 0));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.math_master_home_widget);
        boolean widgetsEnabled = preferences.getBoolean("enabled", true);
        String mode = preferences.getString("mode", "dark");
        String style = preferences.getString("style", "glass");
        String accentValue = preferences.getString("accentColor", "#B8A0FF");
        int accentColor = accentValue.matches("#[0-9A-Fa-f]{6}") ? Color.parseColor(accentValue) : Color.parseColor("#B8A0FF");
        boolean lightMode = "light".equals(mode);
        views.setInt(R.id.widget_root, "setBackgroundResource", lightMode
            ? R.drawable.math_master_home_widget_background_light
            : R.drawable.math_master_home_widget_background);
        int paddingDp = "compact".equals(style) ? 9 : ("minimal".equals(style) ? 11 : 12);
        int paddingPx = (int) (paddingDp * context.getResources().getDisplayMetrics().density + 0.5f);
        views.setViewPadding(R.id.widget_root, paddingPx, paddingPx, paddingPx, paddingPx);
        views.setTextViewTextSize(R.id.widget_progress_percent, TypedValue.COMPLEX_UNIT_SP,
            "compact".equals(style) ? 23f : ("minimal".equals(style) ? 26f : 29f));
        views.setTextViewTextSize(R.id.widget_progress_text, TypedValue.COMPLEX_UNIT_SP,
            "compact".equals(style) ? 12f : 14f);
        views.setTextColor(R.id.widget_progress_percent, accentColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(R.id.widget_progress_bar, "setProgressTintList", ColorStateList.valueOf(accentColor));
        }
        if (lightMode) {
            views.setTextColor(R.id.widget_title_text, Color.parseColor("#253047"));
            views.setTextColor(R.id.widget_target_label, Color.parseColor("#536078"));
            views.setTextColor(R.id.widget_progress_text, Color.parseColor("#202A3D"));
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
        views.setTextViewText(
            R.id.widget_progress_text,
            String.format(Locale.getDefault(), "%d / %d min", elapsedMinutes, targetMinutes)
        );
        views.setProgressBar(R.id.widget_progress_bar, 100, progress, false);
        views.setTextViewText(
            R.id.widget_remaining_text,
            remainingMinutes == 0 ? "Daily target complete ✓" : remainingMinutes + " min left today"
        );
        views.setTextViewText(R.id.widget_streak_text, "🔥 " + streak + "-day streak");

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

        Set<String> selected = getSelectedContent(preferences);
        views.setViewVisibility(R.id.widget_header_row, widgetsEnabled && selected.contains("appIdentity") ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_target_label, widgetsEnabled && selected.contains("target") ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_progress_percent, widgetsEnabled && selected.contains("progress") ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_progress_bar, widgetsEnabled && selected.contains("progress") ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_progress_text, widgetsEnabled && selected.contains("studyTime") ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_remaining_text, widgetsEnabled && selected.contains("remaining") ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_streak_text, widgetsEnabled && selected.contains("streak") ? View.VISIBLE : View.GONE);
        boolean showUpdateStatus = widgetsEnabled && selected.contains("updateStatus");
        views.setViewVisibility(R.id.widget_update_text, showUpdateStatus ? View.VISIBLE : View.GONE);
        if (!showUpdateStatus) views.setViewVisibility(R.id.widget_update_badge, View.GONE);
        views.setViewVisibility(R.id.widget_disabled_text, widgetsEnabled ? View.GONE : View.VISIBLE);
        if (!widgetsEnabled) {
            views.setViewVisibility(R.id.widget_target_label, View.GONE);
            views.setViewVisibility(R.id.widget_progress_percent, View.GONE);
            views.setViewVisibility(R.id.widget_progress_bar, View.GONE);
            views.setViewVisibility(R.id.widget_progress_text, View.GONE);
            views.setViewVisibility(R.id.widget_remaining_text, View.GONE);
            views.setViewVisibility(R.id.widget_streak_text, View.GONE);
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
