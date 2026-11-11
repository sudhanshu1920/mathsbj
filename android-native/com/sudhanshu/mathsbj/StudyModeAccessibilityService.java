package com.sudhanshu.mathsbj;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.SparseArray;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class StudyModeAccessibilityService extends AccessibilityService {
    private static final long RESCAN_INTERVAL_MS = 1200L;
    private static final long EVENT_RESCAN_DELAY_MS = 100L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable scanRunnable = new Runnable() {
        @Override
        public void run() {
            scanAccessibleWindows();
            handler.postDelayed(this, RESCAN_INTERVAL_MS);
        }
    };

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = getServiceInfo();
        if (info != null) {
            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            info.eventTypes |= AccessibilityEvent.TYPE_WINDOWS_CHANGED
                | AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                | AccessibilityEvent.TYPE_VIEW_FOCUSED;
            setServiceInfo(info);
        }
        StudyModeWindowRegistry.markConnected();
        scheduleScan(0L);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        scheduleScan(EVENT_RESCAN_DELAY_MS);
    }

    @Override
    public void onInterrupt() {
        // Interrupt does not necessarily mean the service was unbound. Keep the
        // registry connected and resume polling after invalidating the stale view.
        StudyModeWindowRegistry.invalidateSnapshot();
        scheduleScan(RESCAN_INTERVAL_MS);
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        handler.removeCallbacks(scanRunnable);
        StudyModeWindowRegistry.clear();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        StudyModeWindowRegistry.clear();
        super.onDestroy();
    }

    private void scheduleScan(long delayMs) {
        handler.removeCallbacks(scanRunnable);
        handler.postDelayed(scanRunnable, Math.max(0L, delayMs));
    }

    private void scanAccessibleWindows() {
        try {
            if (!StudyModeManager.hasAccessibilityDisclosureConsent(this)) {
                StudyModeWindowRegistry.publish(Collections.emptyList());
                return;
            }
            if (!StudyModeManager.shouldEnforceNow(this)) {
                StudyModeWindowRegistry.publish(Collections.emptyList());
                return;
            }
            StudyModeWindowRegistry.publish(readVisibleApplicationWindows());
        } catch (RuntimeException unavailableSnapshot) {
            StudyModeWindowRegistry.invalidateSnapshot();
        }
    }

    private List<StudyModeWindowRegistry.WindowRecord> readVisibleApplicationWindows() {
        List<AccessibilityWindowInfo> allWindows = new ArrayList<>();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                SparseArray<List<AccessibilityWindowInfo>> byDisplay = getWindowsOnAllDisplays();
                if (byDisplay != null) {
                    for (int displayIndex = 0; displayIndex < byDisplay.size(); displayIndex++) {
                        List<AccessibilityWindowInfo> displayWindows = byDisplay.valueAt(displayIndex);
                        if (displayWindows != null) allWindows.addAll(displayWindows);
                    }
                }
            } else {
                List<AccessibilityWindowInfo> defaultDisplayWindows = getWindows();
                if (defaultDisplayWindows != null) allWindows.addAll(defaultDisplayWindows);
            }
        } catch (RuntimeException unavailableWindowList) {
            return Collections.emptyList();
        }

        List<StudyModeWindowRegistry.WindowRecord> records = new ArrayList<>();
        for (AccessibilityWindowInfo window : allWindows) {
            if (window == null) continue;
            try {
                // System, input-method and overlay windows are deliberately excluded.
                if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;

                AccessibilityNodeInfo root = null;
                String packageName = null;
                try {
                    root = window.getRoot();
                    if (root != null) {
                        CharSequence value = root.getPackageName();
                        if (value != null) packageName = value.toString();
                    }
                } finally {
                    if (root != null) root.recycle();
                }

                if (packageName == null || packageName.isEmpty()) continue;
                int displayId = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? window.getDisplayId() : android.view.Display.DEFAULT_DISPLAY;
                records.add(new StudyModeWindowRegistry.WindowRecord(
                    packageName, window.isFocused(), window.getId(), displayId));
            } catch (RuntimeException inaccessibleWindow) {
                // A transient OEM/system window must not invalidate other readable windows.
            } finally {
                window.recycle();
            }
        }
        return records;
    }
}
