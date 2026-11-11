package com.sudhanshu.mathsbj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class StudyModePackageChangeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean packageRemoved = Intent.ACTION_PACKAGE_REMOVED.equals(action);
        boolean packageCatalogChanged = packageRemoved
            || Intent.ACTION_PACKAGE_ADDED.equals(action)
            || Intent.ACTION_PACKAGE_CHANGED.equals(action);
        if (!packageCatalogChanged) return;

        // Package labels/icons may change on install, update, enable/disable or removal.
        StudyModePlugin.invalidateAppCatalogCache();
        if (!packageRemoved || intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) return;

        String removedPackage = intent.getData() == null ? null : intent.getData().getSchemeSpecificPart();
        StudyModeFocusService.invalidatePackageCache(removedPackage);
        StudyModeManager.getSelectedPackages(context); // Purge removed packages from restriction selection.
        StudyModeManager.getSelectedStudyAppPackages(context); // Purge stale quick-launch shortcuts too.
        StudyModeManager.reconcile(context);
    }
}
