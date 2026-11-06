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
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.ref.WeakReference;


public final class StudyModeFocusService extends Service {
    private static final String CHANNEL_ID = "study_mode_focus";
    private static final int NOTIFICATION_ID = 9528;
    private static final long POLL_INTERVAL_MS = 1600L;
    private static volatile boolean running = false;
    private static volatile boolean starting = false;
    private static volatile boolean stopping = false;
    private static volatile WeakReference<StudyModeFocusService> activeInstance = new WeakReference<>(null);

    public static boolean isStopping() {
        return stopping;
    }

    public static void markStopping() {
        if (running) stopping = true;
    }

    public static boolean isStarting() {
        return starting;
    }

    public static void markStarting() {
        starting = true;
    }

    public static void clearStarting() {
        starting = false;
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private HandlerThread monitorThread;
    private Handler monitorHandler;
    private WindowManager windowManager;
    private android.view.View shieldView;
    private TextView remainingTimeView;
    private String shieldedPackage = "";
    private boolean foregroundStarted = false;
    private boolean startupFailed = false;
    private boolean screenReceiverRegistered = false;
    private String lastForegroundPackage = null;
    private boolean initialForegroundLookup = true;

    private final BroadcastReceiver screenStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null) return;
            String action = intent.getAction();
            if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                lastForegroundPackage = null;
                initialForegroundLookup = true;
                mainHandler.post(() -> { if (running) removeShield(); });
                if (monitorHandler != null) {
                    monitorHandler.removeCallbacks(monitorRunnable);
                    monitorHandler.postDelayed(monitorRunnable, 60_000L);
                }
            } else if (Intent.ACTION_USER_PRESENT.equals(action)) {
                // Resume fallback detection immediately after the keyguard is gone.
                if (monitorHandler != null) {
                    monitorHandler.removeCallbacks(monitorRunnable);
                    monitorHandler.post(monitorRunnable);
                }
            }
        }
    };

    public static boolean isRunning() {
        return running;
    }

    public static boolean hasOverlayFailure() {
        return running && overlayFailureForStatus;
    }

    /** Called by the optional Accessibility service; all view work is serialized on the main thread. */
    public static void onForegroundPackageChanged(Context context, String packageName) {
        StudyModeFocusService service = activeInstance.get();
        if (service == null || !running) return;
        service.mainHandler.post(() -> {
            if (!running) return;
            if (packageName == null || packageName.isEmpty()
                || packageName.equals(service.getPackageName())
                || !StudyModeManager.isPackageSelected(service, packageName)) {
                service.removeShield();
            } else {
                service.showShield(packageName);
            }
        });
    }

    private static volatile boolean overlayFailureForStatus = false;

    private final Runnable notificationUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            updateOngoingNotification();
            mainHandler.postDelayed(this, 60_000L);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        starting = false;
        stopping = false;
        StudyModeManager.refreshEnforcementCache(this);
        if (!StudyModeManager.shouldEnforceNow(this)
            || !StudyModeManager.hasForegroundMonitoringPermission(this)
            || !StudyModeManager.hasOverlayPermission(this)) {
            stopSelf();
            return;
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
        if (!startForegroundSafely()) {
            stopSelf();
            return;
        }
        running = true;
        activeInstance = new WeakReference<>(this);
        registerScreenStateReceiver();
        StudyModeManager.setServiceState(this,
            StudyModeManager.hasForegroundMonitoringSource(this)
                ? "focus_shield_running" : "accessibility_disconnected");
        mainHandler.postDelayed(notificationUpdateRunnable, 60_000L);

        monitorThread = new HandlerThread(
            "StudyModeMonitor",
            android.os.Process.THREAD_PRIORITY_BACKGROUND
        );
        monitorThread.start();
        monitorHandler = new Handler(monitorThread.getLooper());
        monitorHandler.post(monitorRunnable);
    }

    private void registerScreenStateReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(screenStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(screenStateReceiver, filter);
            }
            screenReceiverRegistered = true;
        } catch (Exception ignored) {
            // The 60-second locked-state watchdog remains as a fallback.
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundStarted || !StudyModeManager.shouldEnforceNow(this) || monitorHandler == null) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        starting = false;
        stopping = false;
        StudyModeManager.refreshEnforcementCache(this);
        monitorHandler.removeCallbacks(monitorRunnable);
        monitorHandler.post(monitorRunnable);
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
                .setContentTitle(StudyModeManager.getSessionNotificationTitle(this))
                .setContentText(StudyModeManager.getSessionNotificationText(this))
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
            startupFailed = true;
            StudyModeManager.setServiceState(this, "service_start_blocked");
            return false;
        }
    }

    private void updateOngoingNotification() {
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
                .setContentTitle(StudyModeManager.getSessionNotificationTitle(this))
                .setContentText(StudyModeManager.getSessionNotificationText(this))
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setOnlyAlertOnce(true);
            if (content != null) builder.setContentIntent(content);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(NOTIFICATION_ID, builder.build());
        } catch (Exception ignored) {
            // Notification refresh must not interrupt package restrictions/session expiry.
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
            if (StudyModeManager.completeExpiredSession(StudyModeFocusService.this)) {
                StudyModeManager.reconcile(StudyModeFocusService.this);
            }
            if (!StudyModeManager.shouldEnforceNow(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this,
                    StudyModeManager.isEnabled(StudyModeFocusService.this) ? "waiting_for_schedule" : "disabled");
                mainHandler.post(() -> {
                    if (!running) return;
                    removeShield();
                    stopSelf();
                });
                return;
            }
            if (!StudyModeManager.hasForegroundMonitoringPermission(StudyModeFocusService.this)
                || !StudyModeManager.hasOverlayPermission(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this, "permission_required");
                updateOngoingNotification();
                mainHandler.post(() -> { if (running) removeShield(); });
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }

            // Accessibility is the immediate, user-enabled event source. This
            // watchdog only handles expiry and permission reconnection; it does
            // not poll UsageStats while Accessibility is connected.
            if (StudyModeAccessibilityService.isConnected()) {
                StudyModeManager.setServiceState(StudyModeFocusService.this, "focus_shield_running");
                updateOngoingNotification();
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }

            // Do not claim active interception when Accessibility is enabled in
            // Settings but Android has not bound it, and Usage Access is absent.
            if (!StudyModeManager.hasUsageAccess(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this,
                    StudyModeManager.hasAccessibilityServiceEnabled(StudyModeFocusService.this)
                        ? "accessibility_disconnected" : "permission_required");
                updateOngoingNotification();
                mainHandler.post(() -> { if (running) removeShield(); });
                if (monitorHandler != null) monitorHandler.postDelayed(this, 15_000L);
                return;
            }

            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (power == null || !power.isInteractive() || (keyguard != null && keyguard.isKeyguardLocked())) {
                lastForegroundPackage = null;
                initialForegroundLookup = true;
                mainHandler.post(() -> { if (running) removeShield(); });
                // Do not poll every 1.6 seconds while the display is locked.
                // ACTION_USER_PRESENT wakes this check immediately on unlock.
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }

            // UsageStats is a best-effort fallback. Queries run off the UI
            // thread; only WindowManager/View changes run on the main looper.
            String foreground = getMostRecentlyResumedPackage();
            boolean shouldShield = foreground != null
                && !foreground.equals(getPackageName())
                && StudyModeManager.isPackageSelected(StudyModeFocusService.this, foreground);
            mainHandler.post(() -> {
                if (!running) return;
                if (shouldShield) showShield(foreground);
                else removeShield();
            });
            if (monitorHandler != null) monitorHandler.postDelayed(this, POLL_INTERVAL_MS);
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
        // A package-change callback can already be queued when OFF, expiry or
        // a permission change updates the authoritative enforcement snapshot.
        // Revalidate here on the UI thread so a stale event cannot resurrect
        // the blocking overlay after the session has ended.
        if (!running || !StudyModeManager.isPackageSelected(this, packageName)) {
            removeShield();
            return;
        }
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
            updateRemainingTime();
            mainHandler.removeCallbacks(countdownRunnable);
            mainHandler.postDelayed(countdownRunnable, 60_000L);
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
        root.setPadding(dp(22), dp(22), dp(22), dp(22));
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

        remainingTimeView = new TextView(this);
        remainingTimeView.setTextSize(13);
        remainingTimeView.setTextColor(Color.rgb(190, 210, 245));
        remainingTimeView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams remainingParams = new LinearLayout.LayoutParams(-1, -2);
        remainingParams.topMargin = dp(14);
        root.addView(remainingTimeView, remainingParams);

        Button back = new Button(this);
        back.setText("Back to Math Master");
        back.setAllCaps(false);
        back.setTextColor(Color.WHITE);
        back.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(47, 105, 198)));
        back.setOnClickListener(view -> {
            // Open the existing Capacitor Activity with a private URL that the
            // app routes to its Learning landing screen. Do not end the focus session.
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("mathmaster://learn"));
            intent.setClassName(getPackageName(), getPackageName() + ".MainActivity");
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            try {
                startActivity(intent);
                removeShield();
            } catch (Exception error) {
                Toast.makeText(
                    StudyModeFocusService.this,
                    "Math Master could not be opened. Try launching it from the app icon.",
                    Toast.LENGTH_LONG
                ).show();
            }
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1, -2);
        buttonParams.topMargin = dp(18);
        root.addView(back, buttonParams);
        return root;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void updateRemainingTime() {
        if (remainingTimeView == null) return;
        long remainingSeconds = StudyModeManager.getCurrentSessionRemainingSeconds(this);
        if (remainingSeconds < 0L) {
            remainingTimeView.setText("Unlimited focus session");
            return;
        }
        long totalMinutes = (remainingSeconds + 59L) / 60L;
        long hours = totalMinutes / 60L;
        long minutes = totalMinutes % 60L;
        String time = hours > 0 ? hours + "h " + minutes + "m" : minutes + "m";
        remainingTimeView.setText("Time remaining · " + time);
    }

    private final Runnable countdownRunnable = new Runnable() {
        @Override
        public void run() {
            if (remainingTimeView == null || !running) return;
            updateRemainingTime();
            mainHandler.postDelayed(this, 60_000L);
        }
    };

    private void removeShield() {
        mainHandler.removeCallbacks(countdownRunnable);
        if (shieldView != null) {
            try {
                if (windowManager != null) windowManager.removeView(shieldView);
            } catch (Exception ignored) {
                // The system may already have detached the overlay.
            }
        }
        shieldView = null;
        remainingTimeView = null;
        shieldedPackage = "";
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Removing the Activity task is not a session stop. Persisted session
        // state and the native foreground service remain authoritative.
        if (StudyModeManager.shouldEnforceNow(this) && monitorHandler != null) {
            monitorHandler.removeCallbacks(monitorRunnable);
            monitorHandler.post(monitorRunnable);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        starting = false;
        stopping = false;
        if (monitorHandler != null) monitorHandler.removeCallbacksAndMessages(null);
        if (monitorThread != null) monitorThread.quitSafely();
        if (screenReceiverRegistered) {
            try { unregisterReceiver(screenStateReceiver); }
            catch (Exception ignored) {}
            screenReceiverRegistered = false;
        }
        mainHandler.removeCallbacksAndMessages(null);
        removeShield();
        overlayFailureForStatus = false;
        if (activeInstance.get() == this) activeInstance = new WeakReference<>(null);
        if (!startupFailed && StudyModeManager.shouldEnforceNow(this)
            && StudyModeManager.hasForegroundMonitoringPermission(this) && StudyModeManager.hasOverlayPermission(this)) {
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
