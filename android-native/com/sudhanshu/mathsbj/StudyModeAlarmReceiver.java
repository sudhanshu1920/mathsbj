package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class StudyModeAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!"com.sudhanshu.mathsbj.STUDY_MODE_BOUNDARY".equals(action)
            && !"com.sudhanshu.mathsbj.STUDY_MODE_SESSION_BOUNDARY".equals(action)) return;
        StudyModeManager.reconcile(context);
    }
}
