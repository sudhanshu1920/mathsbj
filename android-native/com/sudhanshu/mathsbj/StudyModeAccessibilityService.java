package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;

/**
 * Foreground package detector for the user-enabled Study Mode blocker.
 *
 * It consumes only window-state package metadata. It does not retrieve window
 * content, inspect text, capture screenshots, or dispatch gestures.
 */
public final class StudyModeAccessibilityService extends AccessibilityService {
    private static volatile boolean connected = false;

    public static boolean isConnected() {
        return connected;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        connected = true;
        StudyModeFocusService.onAccessibilitySourceChanged();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!connected || event == null
            || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }
        CharSequence packageName = event.getPackageName();
        if (packageName == null || packageName.length() == 0) return;
        StudyModeFocusService.onAccessibilityForegroundChanged(packageName.toString());
    }

    @Override
    public void onInterrupt() {
        // No spoken or haptic feedback is produced by this monitoring service.
    }

    @Override
    public boolean onUnbind(Intent intent) {
        connected = false;
        StudyModeFocusService.onAccessibilitySourceChanged();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        connected = false;
        StudyModeFocusService.onAccessibilitySourceChanged();
        super.onDestroy();
    }
}
