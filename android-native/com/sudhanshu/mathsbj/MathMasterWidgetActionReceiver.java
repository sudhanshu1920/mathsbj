package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.util.Log;

/** Handles deliberate screen-time widget actions without exposing app package data to intents. */
public final class MathMasterWidgetActionReceiver extends BroadcastReceiver {
    static final String ACTION_USAGE_ACCESS = "com.sudhanshu.mathsbj.widget.USAGE_ACCESS";
    static final String ACTION_STUDY_APPS = "com.sudhanshu.mathsbj.widget.STUDY_APPS";
    static final String ACTION_OPEN_APP = "com.sudhanshu.mathsbj.widget.OPEN_APP";
    private static final String TAG = "MathMasterWidget";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        try {
            if (ACTION_USAGE_ACCESS.equals(action)) {
                WidgetScreenTimeData.markUsageAccessSettingsOpened(context);
                Intent settings = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(settings);
                return;
            }
            if (ACTION_STUDY_APPS.equals(action)) {
                if (StudyModeManager.openStudyAppsSelection(context)) return;
            }
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null && launch.getComponent() != null
                && context.getPackageName().equals(launch.getComponent().getPackageName())) {
                launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                context.startActivity(launch);
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Widget action could not be completed.", error);
        }
    }
}
