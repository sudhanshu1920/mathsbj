package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class StudyModePackageChangeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_PACKAGE_REMOVED.equals(intent.getAction())) return;
        if (intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) return;
        android.net.Uri data = intent.getData();
        if (data != null) {
            String packageName = data.getSchemeSpecificPart();
            StudyModeManager.removeStudyAppPackage(context, packageName);
        }
        StudyModeManager.getSelectedPackages(context); // Purge the removed package from saved Blocked Apps.
        StudyModeManager.reconcile(context);
    }
}
