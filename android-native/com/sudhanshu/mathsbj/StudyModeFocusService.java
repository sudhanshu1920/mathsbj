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
import android.net.Uri;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.LruCache;
import android.text.format.DateFormat;
import android.view.Gravity;
import android.view.WindowManager;
import android.view.animation.AlphaAnimation;
import android.view.animation.AnimationSet;
import android.view.animation.TranslateAnimation;
import android.widget.ImageView;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Date;
import java.util.List;

public final class StudyModeFocusService extends Service {
    private static final String CHANNEL_ID = "study_mode_focus";
    private static final int NOTIFICATION_ID = 9528;
    private static final long POLL_INTERVAL_MS = 1600L;
    private static volatile boolean running = false;
    private static volatile boolean starting = false;
    private static volatile boolean stopping = false;
    private static volatile StudyModeFocusService instance = null;

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
    private TextView sessionEndView;
    private String shieldedPackage = "";
    private boolean foregroundStarted = false;
    private String lastForegroundPackage = null;
    private boolean initialForegroundLookup = true;

    public static boolean isRunning() {
        return running;
    }

    public static boolean isMonitoringActive() {
        StudyModeFocusService active = instance;
        if (active == null || !running || !active.foregroundStarted) return false;
        if (StudyModeManager.isPolicyOwner(active)) return true;
        HandlerThread thread = active.monitorThread;
        return active.monitorHandler != null && thread != null && thread.isAlive();
    }

    public static boolean hasOverlayFailure() {
        return running && overlayFailureForStatus;
    }

    private static volatile boolean overlayFailureForStatus = false;
    private static final LruCache<String, android.graphics.drawable.Drawable.ConstantState> STUDY_ICON_CACHE =
        new LruCache<>(32);
    private static final LruCache<String, String> STUDY_LABEL_CACHE = new LruCache<>(64);

    public static void invalidatePackageCache(String packageName) {
        if (packageName == null || packageName.isEmpty()) return;
        STUDY_ICON_CACHE.remove(packageName);
        STUDY_LABEL_CACHE.remove(packageName);
    }

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
        instance = this;
        starting = false;
        stopping = false;
        boolean devicePolicyMode = StudyModeManager.isPolicyOwner(this);
        if (!StudyModeManager.shouldEnforceNow(this)
            || (!devicePolicyMode && (!StudyModeManager.hasForegroundMonitoringPermission(this)
                || !StudyModeManager.hasOverlayPermission(this)))) {
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
        if (!devicePolicyMode) StudyModeManager.setServiceState(this, "focus_shield_running");
        mainHandler.postDelayed(notificationUpdateRunnable, 60_000L);

        // Device Owner suspension already blocks packages at the OS level. In that
        // mode this service only maintains the durable session notification/timer.
        if (!devicePolicyMode && !ensureMonitoringThread()) {
            StudyModeManager.setServiceState(this, "service_stopped");
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundStarted || !StudyModeManager.shouldEnforceNow(this)) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        starting = false;
        stopping = false;
        if (StudyModeManager.isPolicyOwner(this)) {
            updateOngoingNotification();
            return START_STICKY;
        }
        if (!ensureMonitoringThread()) {
            StudyModeManager.setServiceState(this, "service_stopped");
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    public static void onAccessibilityForegroundChanged(String packageName) {
        StudyModeFocusService active = instance;
        if (active == null || !running) return;
        active.mainHandler.post(() -> {
            if (!running || !StudyModeManager.shouldEnforceNow(active)) {
                active.removeShield();
                return;
            }
            String target = packageName == null ? "" : packageName.trim();
            if (!target.isEmpty() && !target.equals(active.getPackageName())
                && StudyModeManager.isPackageSelected(active, target)) {
                active.lastForegroundPackage = target;
                active.showShield(target);
            } else {
                active.lastForegroundPackage = target;
                active.removeShield();
            }
        });
    }

    public static void onAccessibilitySourceChanged() {
        StudyModeFocusService active = instance;
        if (active == null || !running || StudyModeManager.isPolicyOwner(active)) return;
        active.ensureMonitoringThread();
    }

    private synchronized boolean ensureMonitoringThread() {
        if (monitorThread != null && monitorThread.isAlive() && monitorHandler != null) {
            monitorHandler.removeCallbacks(monitorRunnable);
            if (monitorHandler.post(monitorRunnable)) return true;
        }
        if (monitorHandler != null) monitorHandler.removeCallbacksAndMessages(null);
        if (monitorThread != null) monitorThread.quitSafely();
        monitorHandler = null;
        monitorThread = null;
        try {
            HandlerThread replacement = new HandlerThread(
                "StudyModeMonitor",
                android.os.Process.THREAD_PRIORITY_BACKGROUND
            );
            replacement.start();
            Handler replacementHandler = new Handler(replacement.getLooper());
            monitorThread = replacement;
            monitorHandler = replacementHandler;
            if (!replacementHandler.post(monitorRunnable)) {
                monitorHandler = null;
                monitorThread = null;
                replacement.quitSafely();
                return false;
            }
            return true;
        } catch (Exception error) {
            monitorHandler = null;
            monitorThread = null;
            return false;
        }
    }

    private String getNotificationContentText() {
        String timerText = StudyModeManager.getSessionNotificationText(this);
        if (StudyModeManager.isPolicyOwner(this)) return timerText;
        if (!StudyModeManager.hasOverlayPermission(this)) {
            return "Blocking unavailable · allow Display over other apps";
        }
        if (StudyModeAccessibilityService.isConnected()) return timerText;
        if (StudyModeManager.hasUsageAccess(this)) {
            return "Fallback monitoring · " + timerText;
        }
        if (StudyModeManager.isAccessibilityMonitoringEnabled(this)) {
            return "Monitoring disconnected · reconnect Accessibility access";
        }
        return "Monitoring unavailable · enable Accessibility or Usage Access";
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
                .setContentText(getNotificationContentText())
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
                .setContentText(getNotificationContentText())
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
            if (StudyModeManager.isPolicyOwner(StudyModeFocusService.this)) {
                mainHandler.post(() -> { if (running) removeShield(); });
                updateOngoingNotification();
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }
            if (!StudyModeManager.hasForegroundMonitoringPermission(StudyModeFocusService.this)
                || !StudyModeManager.hasOverlayPermission(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this, "permission_required");
                mainHandler.post(() -> { if (running) removeShield(); });
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }

            // Prefer event-driven foreground package detection. Only use UsageStats
            // polling when the Accessibility service is not connected.
            if (StudyModeAccessibilityService.isConnected()) {
                updateOngoingNotification();
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }
            if (!StudyModeManager.hasUsageAccess(StudyModeFocusService.this)) {
                StudyModeManager.setServiceState(StudyModeFocusService.this,
                    StudyModeManager.isAccessibilityMonitoringEnabled(StudyModeFocusService.this)
                        ? "accessibility_disconnected" : "permission_required");
                mainHandler.post(() -> { if (running) removeShield(); });
                if (monitorHandler != null) monitorHandler.postDelayed(this, 60_000L);
                return;
            }

            // UsageStats is a permission-dependent fallback and may detect app
            // switches later than Accessibility window-state events.
            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (power == null || !power.isInteractive() || (keyguard != null && keyguard.isKeyguardLocked())) {
                lastForegroundPackage = null;
                mainHandler.post(() -> {
                    if (running) removeShield();
                });
                if (monitorHandler != null) monitorHandler.postDelayed(this, POLL_INTERVAL_MS);
                return;
            }

            // UsageStatsManager and package checks run off the UI thread. Only
            // WindowManager/View changes are posted back to the main looper.
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
            AnimationSet entrance = new AnimationSet(true);
            AlphaAnimation fade = new AlphaAnimation(0.0f, 1.0f);
            TranslateAnimation rise = new TranslateAnimation(0f, 0f, dp(9), 0f);
            entrance.addAnimation(fade);
            entrance.addAnimation(rise);
            entrance.setDuration(220L);
            shieldView.startAnimation(entrance);
            updateRemainingTime();
            mainHandler.removeCallbacks(countdownRunnable);
            mainHandler.postDelayed(countdownRunnable, 1000L);
            overlayFailureForStatus = false;
            StudyModeManager.setServiceState(this, "focus_shield_running");
        } catch (Exception error) {
            overlayFailureForStatus = true;
            StudyModeManager.setServiceState(this, "overlay_failed");
            removeShield();
        }
    }

    private android.view.View buildShieldView() {
        PopupPalette palette = getPopupPalette();

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackgroundColor(palette.scrim);
        LinearLayout stage = new LinearLayout(this);
        stage.setOrientation(LinearLayout.VERTICAL);
        stage.setGravity(Gravity.CENTER);
        stage.setPadding(dp(16), dp(22), dp(16), dp(22));
        scroll.addView(stage, new ScrollView.LayoutParams(-1, -2));

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        panel.setPadding(dp(19), dp(20), dp(19), dp(18));
        panel.setBackground(roundedGradient(palette.panelTop, palette.panelBottom, palette.border, dp(26)));
        panel.setElevation(dp(18));
        int availableWidth = Math.max(dp(240),
            getResources().getDisplayMetrics().widthPixels - dp(64));
        int panelWidth = Math.min(availableWidth, dp(560));
        LinearLayout.LayoutParams panelParams = new LinearLayout.LayoutParams(panelWidth, -2);
        panelParams.gravity = Gravity.CENTER_HORIZONTAL;
        stage.addView(panel, panelParams);

        // Quote is selected only when this overlay is newly constructed. It is
        // persisted as a shuffled deck so rebuilds/countdown ticks never change it.
        TextView quote = popupText(StudyModeManager.getNextMotivationalQuote(this),
            15, palette.text, Typeface.BOLD, Gravity.CENTER);
        quote.setPadding(dp(3), dp(1), dp(3), dp(1));
        quote.setLineSpacing(dp(3), 1.0f);
        panel.addView(quote, matchWrap());
        addGap(panel, 14);

        LinearLayout activePill = new LinearLayout(this);
        activePill.setGravity(Gravity.CENTER);
        activePill.setOrientation(LinearLayout.HORIZONTAL);
        activePill.setPadding(dp(11), dp(6), dp(11), dp(6));
        activePill.setBackground(rounded(palette.pill, palette.border, dp(30)));
        TextView dot = popupText("●", 9, palette.accent, Typeface.BOLD, Gravity.CENTER);
        activePill.addView(dot, wrapWrap());
        TextView activeLabel = popupText("STUDY MODE ACTIVE", 10, palette.secondaryText,
            Typeface.BOLD, Gravity.CENTER);
        LinearLayout.LayoutParams activeLabelParams = wrapWrap();
        activeLabelParams.leftMargin = dp(7);
        activePill.addView(activeLabel, activeLabelParams);
        if (StudyModeManager.shouldEnforceNow(this)
            && (StudyModeManager.isPolicyOwner(this) || running)) {
            panel.addView(activePill, wrapWrap());
        }
        addGap(panel, 15);

        LinearLayout focusIcon = new LinearLayout(this);
        focusIcon.setGravity(Gravity.CENTER);
        focusIcon.setBackground(rounded(palette.iconSurface, palette.border, dp(24)));
        ImageView lock = new ImageView(this);
        lock.setImageResource(android.R.drawable.ic_lock_lock);
        lock.setColorFilter(palette.accent);
        focusIcon.addView(lock, new LinearLayout.LayoutParams(dp(30), dp(30)));
        panel.addView(focusIcon, new LinearLayout.LayoutParams(dp(54), dp(54)));

        TextView heading = popupText("Stay Focused", 23, palette.text, Typeface.BOLD, Gravity.CENTER);
        LinearLayout.LayoutParams headingParams = matchWrap();
        headingParams.topMargin = dp(9);
        panel.addView(heading, headingParams);

        TextView description = popupText(
            "This app is restricted during your study session.",
            12, palette.secondaryText, Typeface.NORMAL, Gravity.CENTER);
        description.setLineSpacing(dp(2), 1.0f);
        LinearLayout.LayoutParams descriptionParams = matchWrap();
        descriptionParams.topMargin = dp(4);
        panel.addView(description, descriptionParams);
        addGap(panel, 15);

        LinearLayout countdownCard = new LinearLayout(this);
        countdownCard.setOrientation(LinearLayout.VERTICAL);
        countdownCard.setGravity(Gravity.CENTER);
        countdownCard.setPadding(dp(15), dp(12), dp(15), dp(13));
        countdownCard.setBackground(roundedGradient(palette.cardTop, palette.cardBottom,
            palette.cardBorder, dp(18)));
        TextView timerLabel = popupText("◷  TIME REMAINING", 10, palette.secondaryText,
            Typeface.BOLD, Gravity.CENTER);
        countdownCard.addView(timerLabel, matchWrap());
        remainingTimeView = popupText("—", 28, palette.text, Typeface.BOLD, Gravity.CENTER);
        remainingTimeView.setIncludeFontPadding(true);
        LinearLayout.LayoutParams timeParams = matchWrap();
        timeParams.topMargin = dp(5);
        countdownCard.addView(remainingTimeView, timeParams);
        panel.addView(countdownCard, matchWrap());

        sessionEndView = popupText("", 11, palette.secondaryText, Typeface.NORMAL, Gravity.CENTER);
        LinearLayout.LayoutParams untilParams = matchWrap();
        untilParams.topMargin = dp(10);
        panel.addView(sessionEndView, untilParams);

        TextView back = popupText("⌂   Back to Math Master", 14, Color.WHITE,
            Typeface.BOLD, Gravity.CENTER);
        back.setGravity(Gravity.CENTER);
        back.setPadding(dp(12), dp(13), dp(12), dp(13));
        back.setMinHeight(dp(48));
        back.setBackground(roundedGradient(palette.accent, palette.accentDark, palette.accentBorder, dp(15)));
        back.setElevation(dp(3));
        back.setOnClickListener(view -> {
            // Navigation only: the native session store and foreground service are untouched.
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("mathmaster://learn"));
            intent.setClassName(getPackageName(), getPackageName() + ".MainActivity");
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            try {
                startActivity(intent);
                // Avoid replaying the previous blocked foreground package while
                // Android is bringing Math Master back to the foreground.
                lastForegroundPackage = getPackageName();
                removeShield();
            } catch (Exception error) {
                Toast.makeText(
                    StudyModeFocusService.this,
                    "Math Master could not be opened. Try launching it from the app icon.",
                    Toast.LENGTH_LONG
                ).show();
            }
        });
        LinearLayout.LayoutParams buttonParams = matchWrap();
        buttonParams.topMargin = dp(15);
        panel.addView(back, buttonParams);

        addGap(panel, 18);
        TextView studyTitle = popupText("Study Apps", 16, palette.text, Typeface.BOLD, Gravity.CENTER);
        panel.addView(studyTitle, matchWrap());
        TextView studySubtitle = popupText(
            "Continue learning with your selected apps.",
            11, palette.secondaryText, Typeface.NORMAL, Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = matchWrap();
        subtitleParams.topMargin = dp(3);
        panel.addView(studySubtitle, subtitleParams);
        addGap(panel, 11);

        List<String> studyPackages = StudyModeManager.getSelectedStudyAppPackages(this);
        if (studyPackages.isEmpty()) {
            TextView emptyTitle = popupText("No Study Apps selected", 12, palette.text,
                Typeface.BOLD, Gravity.CENTER);
            panel.addView(emptyTitle, matchWrap());
            TextView emptyDescription = popupText(
                "Add your study apps in Study Mode settings.",
                10, palette.secondaryText, Typeface.NORMAL, Gravity.CENTER);
            LinearLayout.LayoutParams emptyParams = matchWrap();
            emptyParams.topMargin = dp(3);
            panel.addView(emptyDescription, emptyParams);
        } else {
            int widthDp = Math.round(getResources().getDisplayMetrics().widthPixels
                / getResources().getDisplayMetrics().density);
            int columns = widthDp >= 560 ? 3 : 2;
            for (int i = 0; i < studyPackages.size(); i += columns) {
                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                LinearLayout.LayoutParams rowParams = matchWrap();
                if (i > 0) rowParams.topMargin = dp(8);
                panel.addView(row, rowParams);
                for (int column = 0; column < columns; column++) {
                    int index = i + column;
                    if (index < studyPackages.size()) {
                        String packageName = studyPackages.get(index);
                        row.addView(buildStudyAppShortcut(packageName, palette),
                            new LinearLayout.LayoutParams(0, dp(64), 1f));
                    } else {
                        row.addView(new android.view.View(this),
                            new LinearLayout.LayoutParams(0, dp(64), 1f));
                    }
                    if (column < columns - 1) row.addView(new android.view.View(this),
                        new LinearLayout.LayoutParams(dp(8), 1));
                }
            }
        }
        return scroll;
    }

    private android.view.View buildStudyAppShortcut(String packageName, PopupPalette palette) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(8), dp(7), dp(7), dp(7));
        card.setBackground(rounded(palette.shortcutSurface, palette.border, dp(14)));
        card.setClickable(true);
        card.setFocusable(true);
        String appLabel = getStudyAppLabel(packageName);
        card.setContentDescription("Open " + appLabel);
        ImageView icon = new ImageView(this);
        android.graphics.drawable.Drawable drawable = getStudyAppIcon(packageName);
        if (drawable != null) icon.setImageDrawable(drawable);
        else icon.setImageResource(android.R.drawable.sym_def_app_icon);
        card.addView(icon, new LinearLayout.LayoutParams(dp(38), dp(38)));
        TextView label = popupText(appLabel, 11, palette.text,
            Typeface.BOLD, Gravity.CENTER_VERTICAL);
        label.setMaxLines(2);
        label.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(0, -2, 1f);
        labelParams.leftMargin = dp(7);
        card.addView(label, labelParams);
        card.setOnClickListener(view -> {
            if (StudyModeManager.launchStudyApp(StudyModeFocusService.this, packageName)) {
                // Remember the selected destination while its first resumed event
                // is still pending, preventing a stale blocked-package overlay loop.
                lastForegroundPackage = packageName;
                removeShield();
            } else {
                Toast.makeText(StudyModeFocusService.this,
                    "This Study App is unavailable or is now blocked. Update Study Apps in settings.",
                    Toast.LENGTH_LONG).show();
                if (!StudyModeManager.getSelectedStudyAppPackages(StudyModeFocusService.this)
                    .contains(packageName)) removeShield();
            }
        });
        return card;
    }

    private String getStudyAppLabel(String packageName) {
        String cached = STUDY_LABEL_CACHE.get(packageName);
        if (cached != null) return cached;
        try {
            CharSequence label = getPackageManager().getApplicationLabel(
                getPackageManager().getApplicationInfo(packageName, 0));
            if (label != null && label.length() > 0) {
                String value = label.toString();
                STUDY_LABEL_CACHE.put(packageName, value);
                return value;
            }
        } catch (Exception ignored) {
            // The package is revalidated again immediately before launch.
        }
        return packageName;
    }

    private android.graphics.drawable.Drawable getStudyAppIcon(String packageName) {
        android.graphics.drawable.Drawable.ConstantState cached = STUDY_ICON_CACHE.get(packageName);
        if (cached != null) return cached.newDrawable(getResources()).mutate();
        try {
            android.graphics.drawable.Drawable drawable =
                getPackageManager().getApplicationIcon(packageName);
            android.graphics.drawable.Drawable.ConstantState state = drawable.getConstantState();
            if (state != null) STUDY_ICON_CACHE.put(packageName, state);
            return drawable;
        } catch (Exception ignored) {
            return null;
        }
    }

    private PopupPalette getPopupPalette() {
        android.content.SharedPreferences preferences =
            getSharedPreferences("math_master_study_mode", MODE_PRIVATE);
        String mode = preferences.getString("popupMode", "dark");
        String theme = preferences.getString("popupTheme", "arctic-blue");
        PopupPalette palette = new PopupPalette();
        palette.light = "light".equals(mode);
        palette.accent = accentForTheme(theme);
        palette.accentDark = blendColor(palette.accent, Color.BLACK, 0.25f);
        palette.accentBorder = blendColor(palette.accent, Color.WHITE, 0.18f);
        if (palette.light) {
            palette.scrim = Color.argb(238, 238, 243, 251);
            palette.panelTop = Color.rgb(255, 255, 255);
            palette.panelBottom = Color.rgb(243, 247, 253);
            palette.text = Color.rgb(24, 35, 55);
            palette.secondaryText = Color.rgb(91, 105, 127);
            palette.pill = blendColor(palette.accent, Color.WHITE, 0.91f);
            palette.iconSurface = blendColor(palette.accent, Color.WHITE, 0.88f);
            palette.cardTop = blendColor(palette.accent, Color.WHITE, 0.94f);
            palette.cardBottom = Color.rgb(246, 249, 255);
            palette.cardBorder = blendColor(palette.accent, Color.WHITE, 0.62f);
            palette.shortcutSurface = Color.rgb(249, 251, 255);
            palette.border = Color.rgb(218, 226, 238);
        } else {
            palette.scrim = Color.argb(246, 5, 10, 23);
            palette.panelTop = Color.rgb(15, 25, 45);
            palette.panelBottom = Color.rgb(10, 17, 33);
            palette.text = Color.rgb(245, 248, 255);
            palette.secondaryText = Color.rgb(165, 181, 207);
            palette.pill = Color.argb(55, Color.red(palette.accent), Color.green(palette.accent), Color.blue(palette.accent));
            palette.iconSurface = Color.argb(42, Color.red(palette.accent), Color.green(palette.accent), Color.blue(palette.accent));
            palette.cardTop = Color.rgb(22, 37, 63);
            palette.cardBottom = Color.rgb(16, 29, 51);
            palette.cardBorder = blendColor(palette.accent, Color.BLACK, 0.45f);
            palette.shortcutSurface = Color.rgb(22, 34, 56);
            palette.border = Color.rgb(48, 65, 91);
        }
        return palette;
    }

    private int accentForTheme(String theme) {
        switch (theme) {
            case "deep-space": case "indigo": return Color.rgb(99, 102, 241);
            case "titanium-silver": case "graphite": return Color.rgb(148, 163, 184);
            case "midnight-violet": return Color.rgb(139, 92, 246);
            case "sapphire": return Color.rgb(37, 99, 235);
            case "ocean-cyan": return Color.rgb(8, 145, 178);
            case "emerald-glass": case "forest": return Color.rgb(16, 185, 129);
            case "aurora": return Color.rgb(34, 211, 238);
            case "soft-rose": return Color.rgb(244, 114, 182);
            case "sunset-gold": return Color.rgb(245, 158, 11);
            case "pearl-white": return Color.rgb(37, 99, 235);
            case "mint": return Color.rgb(13, 148, 136);
            default: return Color.rgb(59, 130, 246);
        }
    }

    private int blendColor(int foreground, int background, float backgroundAmount) {
        float amount = Math.max(0f, Math.min(1f, backgroundAmount));
        return Color.rgb(
            Math.round(Color.red(foreground) * (1f - amount) + Color.red(background) * amount),
            Math.round(Color.green(foreground) * (1f - amount) + Color.green(background) * amount),
            Math.round(Color.blue(foreground) * (1f - amount) + Color.blue(background) * amount)
        );
    }

    private GradientDrawable rounded(int fill, int stroke, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(fill);
        shape.setCornerRadius(radius);
        if (stroke != 0) shape.setStroke(dp(1), stroke);
        return shape;
    }

    private GradientDrawable roundedGradient(int top, int bottom, int stroke, int radius) {
        GradientDrawable shape = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{top, bottom});
        shape.setCornerRadius(radius);
        if (stroke != 0) shape.setStroke(dp(1), stroke);
        return shape;
    }

    private TextView popupText(String value, float size, int color, int style, int gravity) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        text.setTypeface(Typeface.create("sans-serif", style));
        text.setGravity(gravity);
        text.setIncludeFontPadding(true);
        return text;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private LinearLayout.LayoutParams wrapWrap() {
        return new LinearLayout.LayoutParams(-2, -2);
    }

    private void addGap(LinearLayout parent, int heightDp) {
        parent.addView(new android.view.View(this),
            new LinearLayout.LayoutParams(1, dp(heightDp)));
    }

    private static final class PopupPalette {
        boolean light;
        int scrim, panelTop, panelBottom, text, secondaryText, pill, iconSurface;
        int cardTop, cardBottom, cardBorder, shortcutSurface, border;
        int accent, accentDark, accentBorder;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void updateRemainingTime() {
        if (remainingTimeView == null) return;
        long remainingSeconds = StudyModeManager.getCurrentSessionRemainingSeconds(this);
        if (remainingSeconds < 0L) {
            remainingTimeView.setText("Unlimited");
        } else {
            long hours = remainingSeconds / 3600L;
            long minutes = (remainingSeconds % 3600L) / 60L;
            long seconds = remainingSeconds % 60L;
            String value = hours > 0
                ? String.format(java.util.Locale.ROOT, "%02dh %02dm %02ds", hours, minutes, seconds)
                : String.format(java.util.Locale.ROOT, "%02dm %02ds", minutes, seconds);
            remainingTimeView.setText(value);
        }
        if (sessionEndView != null) {
            long sessionEnd = StudyModeManager.getCurrentSessionEndMillis(this);
            sessionEndView.setText(sessionEnd > 0L
                ? "Session ends at " + DateFormat.getTimeFormat(this).format(new Date(sessionEnd))
                : "No scheduled end time");
        }
    }

    private final Runnable countdownRunnable = new Runnable() {
        @Override
        public void run() {
            if (remainingTimeView == null || !running) return;
            updateRemainingTime();
            mainHandler.postDelayed(this, 1000L);
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
        sessionEndView = null;
        shieldedPackage = "";
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Page/Activity task removal is not a session stop. The persisted session
        // and scheduled boundaries remain authoritative.
        if (StudyModeManager.shouldEnforceNow(this) && !StudyModeManager.isPolicyOwner(this)) {
            ensureMonitoringThread();
        } else if (StudyModeManager.isPolicyOwner(this) && StudyModeManager.isSessionActive(this)) {
            updateOngoingNotification();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        running = false;
        starting = false;
        stopping = false;
        if (monitorHandler != null) monitorHandler.removeCallbacksAndMessages(null);
        if (monitorThread != null) monitorThread.quitSafely();
        monitorHandler = null;
        monitorThread = null;
        mainHandler.removeCallbacksAndMessages(null);
        removeShield();
        overlayFailureForStatus = false;
        if (!StudyModeManager.isPolicyOwner(this) && StudyModeManager.shouldEnforceNow(this)
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
