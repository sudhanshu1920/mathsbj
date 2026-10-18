package com.sudhanshu.mathsbj;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class MathMasterHomeWidgetProvider extends AppWidgetProvider {
    private static final String WIDGET_PREFS = "math_master_home_widget";
    private static final int REQUEST_CODE = 8907;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            manager.updateAppWidget(appWidgetId, createViews(context));
        }
    }

    public static void updateWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, MathMasterHomeWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(provider);
        if (widgetIds == null || widgetIds.length == 0) return;
        RemoteViews views = createViews(context);
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, views);
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

    private static boolean isSafeVersion(String value) {
        return value != null && value.length() <= 40
            && value.matches("[0-9]+(?:\\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?");
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    private static RemoteViews createViews(Context context) {
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
