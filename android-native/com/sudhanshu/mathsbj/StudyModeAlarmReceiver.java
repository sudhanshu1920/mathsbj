package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class StudyModeAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"com.sudhanshu.mathsbj.STUDY_MODE_BOUNDARY".equals(intent.getAction())) return;
        StudyModeManager.reconcile(context);
    }
}
