package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class DailyTargetReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            DailyTargetReminderReceiver.scheduleNext(context);
            if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
                // Existing launcher instances can retain stale RemoteViews after an APK update.
                // Re-render every pinned instance while preserving its per-widget preferences.
                MathMasterHomeWidgetProvider.updateWidgetPreferences(context);
            }
        }
    }
}
