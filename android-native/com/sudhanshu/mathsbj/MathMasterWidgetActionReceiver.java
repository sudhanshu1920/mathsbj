package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Explicit, app-owned actions from a Math Master home-screen widget. */
public final class MathMasterWidgetActionReceiver extends BroadcastReceiver {
    private static final String TAG = "MathMasterWidgets";
    public static final String ACTION_OPEN_STUDY_APPS =
        "com.sudhanshu.mathsbj.action.OPEN_STUDY_APPS";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (ACTION_OPEN_STUDY_APPS.equals(intent.getAction())) {
            if (!StudyModeManager.openStudyAppsSelection(context)) {
                Log.w(TAG, "screenTimeAction [STUDY_APPS_NAVIGATION_FAILED]");
            }
        }
    }
}
