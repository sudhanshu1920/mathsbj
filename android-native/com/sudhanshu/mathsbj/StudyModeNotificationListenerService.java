package com.sudhanshu.mathsbj;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public final class StudyModeNotificationListenerService extends NotificationListenerService {
    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        filterCurrentNotifications();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification notification) {
        filter(notification);
    }

    private void filterCurrentNotifications() {
        if (!StudyModeManager.isEnabled(this)
            || !StudyModeManager.isScheduleActive(this)
            || !StudyModeManager.isNotificationBlockingEnabled(this)) return;
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active == null) return;
            for (StatusBarNotification notification : active) filter(notification);
        } catch (SecurityException ignored) {
            // The operating system may disconnect the listener while access is revoked.
        }
    }

    private void filter(StatusBarNotification notification) {
        if (notification == null || !notification.isClearable()) return;
        if (!StudyModeManager.isEnabled(this)
            || !StudyModeManager.isScheduleActive(this)
            || !StudyModeManager.isNotificationBlockingEnabled(this)) return;
        String packageName = notification.getPackageName();
        if (packageName == null || packageName.equals(getPackageName())) return;
        if (!StudyModeManager.isPackageSelected(this, packageName)) return;
        try {
            cancelNotification(notification.getKey());
        } catch (SecurityException ignored) {
            // Notification Access can be revoked while the listener is running.
        }
    }
}
