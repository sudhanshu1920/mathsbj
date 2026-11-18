package com.sudhanshu.mathsbj;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.service.notification.StatusBarNotification;

public class DailyTargetReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            cancelStaleUpdateNotifications(context);
            // Refresh every already-pinned widget after APK replacement while keeping per-ID preferences.
            MathMasterHomeWidgetProvider.updateWidgetPreferences(context);
        }
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            DailyTargetReminderReceiver.scheduleNext(context);
            StudyModeManager.reconcile(context);
            WidgetScreenTimeData.onTimeBoundaryChanged(context);
        }
    }

    /**
     * Remove only update-related notifications left by the previously installed APK.
     * Daily reminders and Study Mode notifications use different tags and are untouched.
     */
    private static void cancelStaleUpdateNotifications(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        StatusBarNotification[] active = manager.getActiveNotifications();
        for (StatusBarNotification notification : active) {
            String tag = notification.getTag();
            if ("mathmaster-update".equals(tag) || "mathapp-apk-saved".equals(tag)) {
                manager.cancel(tag, notification.getId());
            }
        }
    }
}
