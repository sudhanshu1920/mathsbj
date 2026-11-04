package com.sudhanshu.mathsbj;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.KeyguardManager;
import android.os.PowerManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.text.format.DateFormat;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Calendar;
import java.util.Date;

public final class StudyModeFocusService extends Service {
    private static final String CHANNEL_ID = "study_mode_focus";
    private static final int NOTIFICATION_ID = 9528;
    private static final long POLL_INTERVAL_MS = 1600L;
    private static volatile boolean running = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private android.view.View shieldView;
    private String shieldedPackage = "";
    private boolean foregroundStarted = false;
    private String lastForegroundPackage = null;
    private boolean initialForegroundLookup = true;

    public static boolean isRunning() {
        return running;
    }

    public static boolean hasOverlayFailure() {
        return running && overlayFailureForStatus;
    }

    private static volatile boolean overlayFailureForStatus = false;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
        if (!startForegroundSafely()) {
            stopSelf();
            return;
        }
        running = true;
        StudyModeManager.setServiceState(this, "focus_shield_running");
        handler.post(monitorRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundStarted) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        if (!StudyModeManager.isEnabled(this) || !StudyModeManager.isScheduleActive(this)) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        handler.removeCallbacks(monitorRunnable);
        handler.post(monitorRunnable);
        return START_STICKY;
    }

    private boolean startForegroundSafely() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            PendingIntent content = launch == null ? null : PendingIntent.getActivity(
                this, 9529, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
            builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Study Mode is active")
                .setContentText("Focus Shield is monitoring selected apps")
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setOnlyAlertOnce(true);
            if (content != null) builder.setContentIntent(content);
            Notification notification = builder.build();
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            foregroundStarted = true;
            return true;
        } catch (Exception error) {
            StudyModeManager.setServiceState(this, "service_start_blocked");
            return false;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Study Mode Focus Shield", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Ongoing notification while best-effort Focus Shield monitoring is active.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private final Runnable monitorRunnable = new Runnable() {
        @Override
        public void run() {
            if (!StudyModeManager.isEnabled(StudyModeFocusService.this)
                || !StudyModeManager.isScheduleActive(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this, "waiting_for_schedule");
                removeShield();
                stopSelf();
                return;
            }
            if (!StudyModeManager.hasUsageAccess(StudyModeFocusService.this)
                || !StudyModeManager.hasOverlayPermission(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this, "permission_required");
                removeShield();
                stopSelf();
                return;
            }
            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (power == null || !power.isInteractive() || (keyguard != null && keyguard.isKeyguardLocked())) {
                lastForegroundPackage = null;
                removeShield();
                handler.postDelayed(this, POLL_INTERVAL_MS);
                return;
            }

            String foreground = getMostRecentlyResumedPackage();
            if (foreground != null
                && !foreground.equals(getPackageName())
                && StudyModeManager.isPackageSelected(StudyModeFocusService.this, foreground)) {
                showShield(foreground);
            } else {
                removeShield();
            }
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    private String getMostRecentlyResumedPackage() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null;
        UsageStatsManager usage = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usage == null) return null;

        long now = System.currentTimeMillis();
        UsageEvents events;
        try {
            long lookback = initialForegroundLookup ? 24L * 60L * 60L * 1000L : 12000L;
            events = usage.queryEvents(Math.max(0L, now - lookback), now);
            initialForegroundLookup = false;
        } catch (SecurityException denied) {
            StudyModeManager.setServiceState(this, "permission_required");
            return null;
        }
        if (events == null) return lastForegroundPackage;

        String latest = null;
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            boolean resumed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? type == UsageEvents.Event.ACTIVITY_RESUMED
                : type == UsageEvents.Event.MOVE_TO_FOREGROUND;
            if (resumed) latest = event.getPackageName();
        }
        if (latest != null && !latest.isEmpty()) lastForegroundPackage = latest;
        return lastForegroundPackage;
    }

    private void showShield(String packageName) {
        if (shieldView != null && packageName.equals(shieldedPackage)) return;
        removeShield();
        try {
            shieldView = buildShieldView();
            shieldedPackage = packageName;
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.CENTER;
            params.setTitle("Math Master Study Mode");
            windowManager.addView(shieldView, params);
            overlayFailureForStatus = false;
            StudyModeManager.setServiceState(this, "focus_shield_running");
        } catch (Exception error) {
            overlayFailureForStatus = true;
            StudyModeManager.setServiceState(this, "overlay_failed");
            removeShield();
        }
    }

    private android.view.View buildShieldView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setClickable(true);
        root.setFocusableInTouchMode(true);
        root.setPadding(dp(28), dp(28), dp(28), dp(28));
        root.setBackgroundColor(Color.rgb(14, 20, 32));

        TextView lock = new TextView(this);
        lock.setText("⌑");
        lock.setTextSize(42);
        lock.setTextColor(Color.rgb(115, 165, 255));
        lock.setGravity(Gravity.CENTER);
        root.addView(lock, new LinearLayout.LayoutParams(-1, dp(64)));

        TextView heading = new TextView(this);
        heading.setText("STUDY MODE ACTIVE");
        heading.setTextSize(18);
        heading.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        heading.setTextColor(Color.WHITE);
        heading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(-1, -2);
        headingParams.bottomMargin = dp(10);
        root.addView(heading, headingParams);

        TextView description = new TextView(this);
        description.setText("This app is restricted during your study session.");
        description.setTextSize(14);
        description.setTextColor(Color.LTGRAY);
        description.setGravity(Gravity.CENTER);
        root.addView(description, new LinearLayout.LayoutParams(-1, -2));

        TextView until = new TextView(this);
        until.setText("Available after " + DateFormat.getTimeFormat(this).format(
            new Date(StudyModeManager.getCurrentSessionEndMillis(this))
        ));
        until.setTextSize(13);
        until.setTextColor(Color.rgb(175, 195, 225));
        until.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams untilParams = new LinearLayout.LayoutParams(-1, -2);
        untilParams.topMargin = dp(12);
        root.addView(until, untilParams);

        Button back = new Button(this);
        back.setText("Back to Math Master");
        back.setOnClickListener(view -> {
            removeShield();
            Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(intent);
            }
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1, -2);
        buttonParams.topMargin = dp(24);
        root.addView(back, buttonParams);
        return root;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void removeShield() {
        if (shieldView == null) return;
        try {
            if (windowManager != null) windowManager.removeView(shieldView);
        } catch (Exception ignored) {
            // The system may already have detached the overlay.
        }
        shieldView = null;
        shieldedPackage = "";
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // The user explicitly opted into this scheduled foreground service.
        // Android may still stop it under device policy or battery restrictions.
        if (StudyModeManager.isEnabled(this) && StudyModeManager.isScheduleActive(this)) {
            handler.removeCallbacks(monitorRunnable);
            handler.post(monitorRunnable);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        removeShield();
        running = false;
        overlayFailureForStatus = false;
        if (StudyModeManager.isEnabled(this) && StudyModeManager.isScheduleActive(this)
            && StudyModeManager.hasUsageAccess(this) && StudyModeManager.hasOverlayPermission(this)) {
            StudyModeManager.setServiceState(this, "service_stopped");
        }
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(NOTIFICATION_ID);
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
