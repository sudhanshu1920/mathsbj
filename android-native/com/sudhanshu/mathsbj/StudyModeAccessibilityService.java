package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

/**
 * Optional, user-enabled, event-driven foreground package detection.
 * This service deliberately does not retrieve window content, view trees,
 * node text, gestures, or passwords. It reads only the event package name.
 */
public final class StudyModeAccessibilityService extends AccessibilityService {
    private static volatile boolean connected = false;
    private String lastPackage = "";

    public static boolean isConnected() {
        return connected;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        connected = true;
        lastPackage = "";
        // The user just enabled this service in Android Settings. Reconcile
        // the persisted session; service-start restrictions are handled by
        // StudyModeManager and are not bypassed here.
        try {
            StudyModeManager.reconcile(getApplicationContext());
        } catch (Exception ignored) {
            // Status remains persisted; UsageStats fallback can still operate.
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!connected || event == null) return;
        int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            && type != AccessibilityEvent.TYPE_WINDOWS_CHANGED) return;

        CharSequence packageName = event.getPackageName();
        if (packageName == null || packageName.length() == 0) return;
        String current = packageName.toString();
        if (current.equals(lastPackage)) return;
        lastPackage = current;

        if (!StudyModeManager.shouldEnforceNow(this)) return;
        StudyModeFocusService.onForegroundPackageChanged(this, current);
    }

    @Override
    public void onInterrupt() {
        lastPackage = "";
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        connected = false;
        lastPackage = "";
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        connected = false;
        lastPackage = "";
        super.onDestroy();
    }
}
