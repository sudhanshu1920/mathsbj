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
            || Intent.ACTION_PACKAGE_CHANGED.equals(action)
            || Intent.ACTION_PACKAGE_REPLACED.equals(action);
        if (!packageCatalogChanged) return;

        // Package broadcasts are the native source of truth for catalogue revisions.
        StudyModePlugin.invalidateAppCatalogCache();
        String changedPackage = intent.getData() == null ? null : intent.getData().getSchemeSpecificPart();
        StudyModeFocusService.invalidatePackageCache(changedPackage);
        StudyModeManager.invalidateStrictExemptPackageCache();

        if (packageRemoved && !intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) {
            StudyModeManager.getSelectedPackages(context); // Purge removed packages from Blocked Apps.
            StudyModeManager.getSelectedStudyAppPackages(context); // Purge removed Study Apps.
            StudyModeManager.reconcile(context); // Also removes any stale Device Owner suspension.
            return;
        }

        // A newly installed app remains outside the strict allowlist by default.
        // Refresh package-level enforcement immediately when Android reports it.
        if (StudyModeManager.isProStrictModeActive(context)) {
            if (StudyModeManager.isPolicyOwner(context)) StudyModeManager.reconcile(context);
            else StudyModeFocusService.requestImmediateEvaluation();
        }
    }
}
