package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityService;
import android.content.ComponentName;
import android.content.Context;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;

/**
 * Opt-in, package-only foreground detection for the Focus Shield.
 *
 * This service intentionally does not request window-content access, view IDs,
 * gestures, key filtering, or text feedback. It forwards only package transitions.
 */
public final class StudyModeAccessibilityService extends AccessibilityService {
    private static volatile boolean connected = false;
    private static volatile String lastDeliveredPackage = "";
    private static volatile long lastDeliveredEventTime = 0L;

    public static boolean isConnected() {
        return connected;
    }

    public static String getLastKnownForegroundPackage() {
        return connected && !lastDeliveredPackage.isEmpty() ? lastDeliveredPackage : null;
    }

    public static boolean isEnabled(Context context) {
        try {
            String enabledServices = Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            if (TextUtils.isEmpty(enabledServices)) return false;
            ComponentName expected = new ComponentName(context, StudyModeAccessibilityService.class);
            for (String flattened : enabledServices.split(":")) {
                ComponentName enabled = ComponentName.unflattenFromString(flattened);
                if (expected.equals(enabled)) return true;
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        connected = true;
        lastDeliveredPackage = "";
        lastDeliveredEventTime = 0L;
        StudyModeFocusService.onAccessibilityAvailabilityChanged(getApplicationContext(), true);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!connected || event == null) return;

        final int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            && (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.LOLLIPOP
                || type != AccessibilityEvent.TYPE_WINDOWS_CHANGED)) return;

        CharSequence rawPackage = event.getPackageName();
        if (rawPackage == null) {
            lastDeliveredPackage = "";
            long unknownEventTime = event.getEventTime();
            lastDeliveredEventTime = Math.max(lastDeliveredEventTime, unknownEventTime);
            StudyModeFocusService.clearAccessibilityForegroundPackage(
                getApplicationContext(), unknownEventTime
            );
            return;
        }
        String packageName = rawPackage.toString();
        if (!packageName.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+")) return;

        // The focus shield owns an overlay window. Ignore its own window-change
        // event while visible so it cannot dismiss itself recursively.
        if (packageName.equals(getPackageName()) && StudyModeFocusService.isShieldVisible()) return;

        long eventTime = event.getEventTime();
        if (eventTime > 0L && eventTime < lastDeliveredEventTime) return;
        if (packageName.equals(lastDeliveredPackage) && eventTime <= lastDeliveredEventTime) return;

        lastDeliveredPackage = packageName;
        lastDeliveredEventTime = Math.max(lastDeliveredEventTime, eventTime);
        StudyModeFocusService.reportAccessibilityForegroundPackage(
            getApplicationContext(), packageName, eventTime
        );
    }

    @Override
    public void onInterrupt() {
        // No content capture or ongoing interaction is performed by this service.
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        connected = false;
        lastDeliveredPackage = "";
        lastDeliveredEventTime = 0L;
        StudyModeFocusService.onAccessibilityAvailabilityChanged(getApplicationContext(), false);
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        connected = false;
        lastDeliveredPackage = "";
        lastDeliveredEventTime = 0L;
        StudyModeFocusService.onAccessibilityAvailabilityChanged(getApplicationContext(), false);
        super.onDestroy();
    }
}
