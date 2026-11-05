package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class StudyModePackageChangeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_PACKAGE_REMOVED.equals(intent.getAction())) return;
        if (intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) return;
        StudyModeManager.getSelectedPackages(context); // Purge the removed package from saved selection.
        StudyModeManager.reconcile(context);
    }
}
