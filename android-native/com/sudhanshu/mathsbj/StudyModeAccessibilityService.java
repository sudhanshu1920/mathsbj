package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;

/**
 * Optional, explicitly user-enabled foreground app detector.
 *
 * It reads only AccessibilityEvent.getPackageName(); it never retrieves window
 * content, view nodes, screen text, passwords, or performs gestures.
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
        try {
            StudyModeManager.refreshEnforcementCache(getApplicationContext());
            StudyModeManager.reconcile(getApplicationContext());
        } catch (Exception ignored) {
            // The saved session remains intact; UsageStats is the permitted fallback.
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!connected || event == null || !StudyModeManager.isEnforcementActiveCached()) return;

        int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            && type != AccessibilityEvent.TYPE_WINDOWS_CHANGED) return;

        CharSequence value = event.getPackageName();
        if (value == null || value.length() == 0) return;

        String packageName = value.toString();
        if (packageName.equals(lastPackage)) return;
        lastPackage = packageName;

        // Update lastPackage even for Math Master so reopening the same
        // restricted app after tapping Back is intercepted again.
        if (packageName.equals(getPackageName())) return;
        StudyModeFocusService.onForegroundPackageChanged(this, packageName);
    }

    @Override
    public void onInterrupt() {
        lastPackage = "";
    }

    @Override
    public boolean onUnbind(Intent intent) {
        connected = false;
        lastPackage = "";
        try {
            StudyModeManager.reconcile(getApplicationContext());
        } catch (Exception ignored) {
            // Do not close or discard the persisted focus session on service disconnect.
        }
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        connected = false;
        lastPackage = "";
        super.onDestroy();
    }
}
