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

            final Context applicationContext = context.getApplicationContext();
            final BroadcastReceiver.PendingResult pendingResult = goAsync();
            Thread refreshThread = new Thread(() -> {
                try {
                    MathMasterHomeWidgetProvider.updateWidgetPreferences(applicationContext);
                } catch (RuntimeException error) {
                    android.util.Log.w("MathMasterWidget", "Unable to refresh pinned widgets after a lifecycle change.", error);
                } finally {
                    pendingResult.finish();
                }
            }, "MathMasterWidgetRefresh");
            refreshThread.setDaemon(true);
            refreshThread.start();
        }
    }
}
