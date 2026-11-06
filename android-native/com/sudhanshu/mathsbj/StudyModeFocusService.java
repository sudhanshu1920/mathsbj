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
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.view.View;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.ScrollView;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.ref.WeakReference;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Random;

import org.json.JSONArray;
import org.json.JSONException;


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
    private TextView sessionEndView;
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
            mainHandler.postDelayed(countdownRunnable, 1_000L);
            overlayFailureForStatus = false;
            StudyModeManager.setServiceState(this, "focus_shield_running");
        } catch (Exception error) {
            overlayFailureForStatus = true;
            StudyModeManager.setServiceState(this, "overlay_failed");
            removeShield();
        }
    }

    private static final String[] MOTIVATIONAL_QUOTES = {
        "आज की मेहनत, कल की सफलता बनेगी।",
        "सपने पूरे करने हैं तो पढ़ाई से दोस्ती करो।",
        "हर मिनट की पढ़ाई तुम्हें मंज़िल के करीब ले जाती है।",
        "खुद पर विश्वास रखो, तुम कर सकते हो!",
        "आज थोड़ा और पढ़ लो, कल खुद पर गर्व होगा।",
        "मोबाइल नहीं, अपने सपनों पर ध्यान दो।",
        "सफलता का रास्ता अनुशासन से होकर जाता है।",
        "एकाग्रता ही सफलता की सबसे बड़ी ताकत है।",
        "हार मत मानो, तुम्हारी मेहनत रंग लाएगी।",
        "पढ़ाई आज की, सफलता कल की।",
        "हर छोटा प्रयास बड़े परिणाम की शुरुआत है।",
        "अपने लक्ष्य को याद करो और आगे बढ़ते रहो।",
        "समय की कदर करो, यही सफलता की चाबी है।",
        "आज का फोकस ही कल का भविष्य बनाएगा।",
        "तुम्हारा मुकाबला किसी और से नहीं, खुद से है।"
    };

    private android.view.View buildShieldView() {
        int[] palette = getPopupPalette();
        int background = palette[0];
        int card = palette[1];
        int border = palette[2];
        int text = palette[3];
        int muted = palette[4];
        int accent = palette[5];

        FrameLayout root = new FrameLayout(this);
        root.setClickable(true);
        root.setFocusableInTouchMode(true);
        GradientDrawable backdrop = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { background, blendColors(background, palette[6], 38), background }
        );
        root.setBackground(backdrop);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(scroll, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER);
        page.setMinimumHeight(Math.max(dp(440), getResources().getDisplayMetrics().heightPixels - dp(48)));
        scroll.addView(page, new ScrollView.LayoutParams(-1, -2));

        int availableWidth = getResources().getDisplayMetrics().widthPixels - dp(36);
        int contentWidth = Math.min(availableWidth, dp(480));
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(18), dp(24), dp(18), dp(26));
        page.addView(content, new LinearLayout.LayoutParams(contentWidth, -2));

        // Choose once for this new overlay instance. Timer updates never rebuild the quote.
        LinearLayout quoteCard = new LinearLayout(this);
        quoteCard.setOrientation(LinearLayout.VERTICAL);
        quoteCard.setGravity(Gravity.CENTER);
        quoteCard.setPadding(dp(18), dp(15), dp(18), dp(15));
        quoteCard.setBackground(roundedBackground(card, border, 21));
        TextView quoteLabel = makeText("आज का संकल्प", 10, accent, true);
        quoteLabel.setGravity(Gravity.CENTER);
        quoteCard.addView(quoteLabel, new LinearLayout.LayoutParams(-1, -2));
        TextView quote = makeText(nextMotivationalQuote(), 17, text, true);
        quote.setGravity(Gravity.CENTER);
        quote.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams quoteParams = new LinearLayout.LayoutParams(-1, -2);
        quoteParams.topMargin = dp(7);
        quoteCard.addView(quote, quoteParams);
        content.addView(quoteCard, fullWidthParams(0, 0));
        quoteCard.setAlpha(0f);
        quoteCard.setTranslationY(dp(8));
        quoteCard.animate().alpha(1f).translationY(0f).setDuration(260L).start();

        TextView status = makeText("●  STUDY MODE ACTIVE", 11, accent, true);
        status.setGravity(Gravity.CENTER);
        status.setPadding(dp(15), dp(8), dp(15), dp(8));
        status.setBackground(roundedBackground(withAlpha(accent, 30), withAlpha(accent, 105), 999));
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(-2, -2);
        statusParams.topMargin = dp(14);
        statusParams.bottomMargin = dp(14);
        content.addView(status, statusParams);

        LinearLayout focusHeader = new LinearLayout(this);
        focusHeader.setOrientation(LinearLayout.VERTICAL);
        focusHeader.setGravity(Gravity.CENTER);
        TextView focusIcon = makeText("✦", 27, accent, true);
        focusIcon.setGravity(Gravity.CENTER);
        focusIcon.setBackground(roundedBackground(withAlpha(accent, 30), withAlpha(accent, 95), 18));
        focusHeader.addView(focusIcon, new LinearLayout.LayoutParams(dp(52), dp(52)));
        TextView heading = makeText("Stay Focused", 24, text, true);
        heading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(-1, -2);
        headingParams.topMargin = dp(10);
        focusHeader.addView(heading, headingParams);
        TextView description = makeText(
            "This app is restricted during your study session.", 13, muted, false);
        description.setGravity(Gravity.CENTER);
        description.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(-1, -2);
        descriptionParams.topMargin = dp(5);
        focusHeader.addView(description, descriptionParams);
        content.addView(focusHeader, fullWidthParams(0, 0));

        LinearLayout timerCard = new LinearLayout(this);
        timerCard.setOrientation(LinearLayout.VERTICAL);
        timerCard.setGravity(Gravity.CENTER);
        timerCard.setPadding(dp(16), dp(14), dp(16), dp(13));
        timerCard.setBackground(roundedBackground(card, border, 19));
        TextView timerLabel = makeText("TIME REMAINING", 10, muted, true);
        timerLabel.setGravity(Gravity.CENTER);
        timerCard.addView(timerLabel, new LinearLayout.LayoutParams(-1, -2));
        remainingTimeView = makeText("--:--:--", 31, accent, true);
        remainingTimeView.setGravity(Gravity.CENTER);
        remainingTimeView.setIncludeFontPadding(false);
        LinearLayout.LayoutParams timeParams = new LinearLayout.LayoutParams(-1, -2);
        timeParams.topMargin = dp(5);
        timerCard.addView(remainingTimeView, timeParams);
        sessionEndView = makeText("", 12, muted, false);
        sessionEndView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams endParams = new LinearLayout.LayoutParams(-1, -2);
        endParams.topMargin = dp(8);
        timerCard.addView(sessionEndView, endParams);
        content.addView(timerCard, fullWidthParams(dp(17), 0));

        TextView back = makeText("↩   Back to Math Master", 15, Color.WHITE, true);
        back.setGravity(Gravity.CENTER);
        back.setPadding(dp(14), dp(14), dp(14), dp(14));
        back.setBackground(new RippleDrawable(
            ColorStateList.valueOf(withAlpha(Color.WHITE, 65)),
            roundedBackground(accent, accent, 16), null
        ));
        back.setClickable(true);
        back.setFocusable(true);
        back.setOnClickListener(view -> {
            // Navigate to Math Master. Never stop the focus service or session here.
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
        content.addView(back, fullWidthParams(dp(15), 0));

        content.addView(buildStudyAppsSection(palette), fullWidthParams(dp(17), 0));
        return root;
    }

    private LinearLayout buildStudyAppsSection(int[] palette) {
        int card = palette[1];
        int border = palette[2];
        int text = palette[3];
        int muted = palette[4];
        int accent = palette[5];

        LinearLayout section = new LinearLayout(this);
        section.setOrientation(LinearLayout.VERTICAL);
        TextView title = makeText("Study Apps", 16, text, true);
        section.addView(title, new LinearLayout.LayoutParams(-1, -2));
        TextView subtitle = makeText("Continue learning with your selected apps.", 11, muted, false);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(-1, -2);
        subtitleParams.topMargin = dp(3);
        section.addView(subtitle, subtitleParams);

        List<String> packages = StudyModeManager.getStudyAppPackages(this);
        if (packages.isEmpty()) {
            TextView empty = makeText(
                "Add quick-access apps in Study Mode settings.", 11, muted, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(12), dp(14), dp(12), dp(14));
            empty.setBackground(roundedBackground(card, border, 15));
            section.addView(empty, fullWidthParams(dp(9), 0));
            return section;
        }

        PackageManager pm = getPackageManager();
        for (int i = 0; i < packages.size(); i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            section.addView(row, fullWidthParams(dp(8), 0));
            addStudyShortcut(row, pm, packages.get(i), card, border, text, accent);
            if (i + 1 < packages.size()) {
                addStudyShortcut(row, pm, packages.get(i + 1), card, border, text, accent);
            } else {
                View spacer = new View(this);
                row.addView(spacer, new LinearLayout.LayoutParams(0, dp(66), 1f));
            }
        }
        return section;
    }

    private void addStudyShortcut(
        LinearLayout row,
        PackageManager pm,
        String packageName,
        int card,
        int border,
        int text,
        int accent
    ) {
        try {
            Drawable icon = pm.getApplicationIcon(packageName);
            CharSequence appLabel = pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0));
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.HORIZONTAL);
            item.setGravity(Gravity.CENTER_VERTICAL);
            item.setPadding(dp(9), dp(9), dp(8), dp(9));
            item.setBackground(new RippleDrawable(
                ColorStateList.valueOf(withAlpha(accent, 60)),
                roundedBackground(card, border, 15), null
            ));
            item.setClickable(true);
            item.setFocusable(true);
            ImageView appIcon = new ImageView(this);
            appIcon.setImageDrawable(icon);
            appIcon.setScaleType(ImageView.ScaleType.FIT_CENTER);
            item.addView(appIcon, new LinearLayout.LayoutParams(dp(31), dp(31)));
            TextView label = makeText(
                appLabel == null ? packageName : appLabel.toString(), 11, text, true);
            label.setMaxLines(2);
            label.setGravity(Gravity.CENTER_VERTICAL);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(0, -2, 1f);
            labelParams.leftMargin = dp(8);
            item.addView(label, labelParams);
            LinearLayout.LayoutParams itemParams = new LinearLayout.LayoutParams(0, dp(66), 1f);
            itemParams.rightMargin = dp(6);
            row.addView(item, itemParams);
            item.setOnClickListener(view -> launchStudyShortcut(packageName));
        } catch (Exception ignored) {
            // An app uninstalled after the saved list was read is skipped safely.
        }
    }

    private void launchStudyShortcut(String packageName) {
        try {
            // Re-check persisted membership and Blocked Apps immediately before launch.
            StudyModeManager.launchStudyApp(this, packageName);
            removeShield();
        } catch (Exception error) {
            Toast.makeText(
                this,
                error.getMessage() == null ? "This Study App could not be opened." : error.getMessage(),
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private String nextMotivationalQuote() {
        SharedPreferences preferences = getSharedPreferences("math_master_study_mode", MODE_PRIVATE);
        List<Integer> cycle = new ArrayList<>();
        int cursor = 0;
        try {
            JSONArray stored = new JSONArray(preferences.getString("motivationalQuoteOrder", "[]"));
            cursor = preferences.getInt("motivationalQuoteCursor", 0);
            if (stored.length() == MOTIVATIONAL_QUOTES.length) {
                for (int i = 0; i < stored.length(); i++) {
                    int value = stored.optInt(i, -1);
                    if (value < 0 || value >= MOTIVATIONAL_QUOTES.length || cycle.contains(value)) {
                        cycle.clear();
                        break;
                    }
                    cycle.add(value);
                }
            }
        } catch (JSONException ignored) {
            cycle.clear();
        }

        if (cycle.size() != MOTIVATIONAL_QUOTES.length || cursor >= cycle.size() || cursor < 0) {
            cycle.clear();
            for (int i = 0; i < MOTIVATIONAL_QUOTES.length; i++) cycle.add(i);
            Collections.shuffle(cycle, new Random());
            int previous = preferences.getInt("motivationalQuoteLast", -1);
            if (cycle.size() > 1 && cycle.get(0) == previous) Collections.swap(cycle, 0, 1);
            JSONArray order = new JSONArray();
            for (Integer index : cycle) order.put(index);
            cursor = 0;
            preferences.edit()
                .putString("motivationalQuoteOrder", order.toString())
                .putInt("motivationalQuoteCursor", 0)
                .apply();
        }

        int selected = cycle.get(cursor);
        preferences.edit()
            .putInt("motivationalQuoteCursor", cursor + 1)
            .putInt("motivationalQuoteLast", selected)
            .apply();
        return MOTIVATIONAL_QUOTES[selected];
    }

    private int[] getPopupPalette() {
        SharedPreferences preferences = getSharedPreferences("math_master_study_mode", MODE_PRIVATE);
        boolean light = "light".equals(preferences.getString("overlayMode", "dark"));
        int[] colors = themeColors(preferences.getString("overlayTheme", "arctic-blue"));
        int background = light ? Color.rgb(242, 246, 252) : colors[0];
        int card = light ? Color.WHITE : Color.argb(228, 22, 32, 49);
        int border = light ? Color.argb(35, 25, 45, 75) : Color.argb(95, 170, 195, 235);
        int primaryText = light ? Color.rgb(20, 30, 48) : Color.rgb(247, 249, 255);
        int secondaryText = light ? Color.rgb(92, 105, 126) : Color.rgb(183, 196, 218);
        return new int[] { background, card, border, primaryText, secondaryText, colors[1], colors[2] };
    }

    private int[] themeColors(String theme) {
        if ("deep-space".equals(theme)) return new int[] { Color.rgb(7, 11, 22), Color.rgb(99, 102, 241), Color.rgb(56, 189, 248) };
        if ("titanium-silver".equals(theme)) return new int[] { Color.rgb(17, 21, 27), Color.rgb(203, 213, 225), Color.rgb(148, 163, 184) };
        if ("midnight-violet".equals(theme)) return new int[] { Color.rgb(18, 13, 31), Color.rgb(139, 92, 246), Color.rgb(99, 102, 241) };
        if ("sapphire".equals(theme)) return new int[] { Color.rgb(7, 20, 38), Color.rgb(37, 99, 235), Color.rgb(14, 165, 233) };
        if ("ocean-cyan".equals(theme)) return new int[] { Color.rgb(6, 21, 26), Color.rgb(8, 145, 178), Color.rgb(20, 184, 166) };
        if ("emerald-glass".equals(theme)) return new int[] { Color.rgb(7, 22, 17), Color.rgb(16, 185, 129), Color.rgb(20, 184, 166) };
        if ("aurora".equals(theme)) return new int[] { Color.rgb(10, 16, 28), Color.rgb(34, 211, 238), Color.rgb(139, 92, 246) };
        if ("soft-rose".equals(theme)) return new int[] { Color.rgb(27, 16, 22), Color.rgb(244, 114, 182), Color.rgb(251, 113, 133) };
        if ("sunset-gold".equals(theme)) return new int[] { Color.rgb(27, 18, 8), Color.rgb(245, 158, 11), Color.rgb(251, 113, 133) };
        if ("graphite".equals(theme)) return new int[] { Color.rgb(14, 17, 21), Color.rgb(161, 161, 170), Color.rgb(100, 116, 139) };
        if ("pearl-white".equals(theme)) return new int[] { Color.rgb(246, 248, 251), Color.rgb(37, 99, 235), Color.rgb(15, 118, 110) };
        if ("indigo".equals(theme)) return new int[] { Color.rgb(17, 19, 41), Color.rgb(79, 70, 229), Color.rgb(129, 140, 248) };
        if ("forest".equals(theme)) return new int[] { Color.rgb(11, 21, 16), Color.rgb(21, 128, 61), Color.rgb(132, 204, 22) };
        if ("mint".equals(theme)) return new int[] { Color.rgb(7, 23, 19), Color.rgb(13, 148, 136), Color.rgb(52, 211, 153) };
        return new int[] { Color.rgb(7, 17, 31), Color.rgb(59, 130, 246), Color.rgb(34, 211, 238) };
    }

    private GradientDrawable roundedBackground(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private TextView makeText(String value, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans-serif-medium", bold ? Typeface.BOLD : Typeface.NORMAL));
        view.setIncludeFontPadding(true);
        return view;
    }

    private LinearLayout.LayoutParams fullWidthParams(int topMarginDp, int bottomMarginDp) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(topMarginDp);
        params.bottomMargin = dp(bottomMarginDp);
        return params;
    }

    private int blendColors(int base, int overlay, int alpha) {
        return Color.argb(
            255,
            (Color.red(base) * (255 - alpha) + Color.red(overlay) * alpha) / 255,
            (Color.green(base) * (255 - alpha) + Color.green(overlay) * alpha) / 255,
            (Color.blue(base) * (255 - alpha) + Color.blue(overlay) * alpha) / 255
        );
    }

    private int withAlpha(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void updateRemainingTime() {
        if (remainingTimeView == null) return;
        long remainingSeconds = StudyModeManager.getCurrentSessionRemainingSeconds(this);
        if (remainingSeconds < 0L) {
            remainingTimeView.setText("Unlimited");
            if (sessionEndView != null) sessionEndView.setText("This focus session has no fixed end time");
            return;
        }

        long hours = remainingSeconds / 3600L;
        long minutes = (remainingSeconds % 3600L) / 60L;
        long seconds = remainingSeconds % 60L;
        remainingTimeView.setText(String.format(
            Locale.getDefault(), "%02d:%02d:%02d", hours, minutes, seconds
        ));

        if (sessionEndView != null) {
            long endMillis = StudyModeManager.getCurrentSessionEndMillis(this);
            if (endMillis > 0L) {
                SimpleDateFormat dateKey = new SimpleDateFormat("yyyyMMdd", Locale.getDefault());
                String pattern = dateKey.format(new Date(endMillis)).equals(dateKey.format(new Date()))
                    ? "hh:mm a" : "EEE, dd MMM · hh:mm a";
                sessionEndView.setText("Session ends at " +
                    new SimpleDateFormat(pattern, Locale.getDefault()).format(new Date(endMillis)));
            } else {
                sessionEndView.setText("Session ends when your schedule finishes");
            }
        }
    }

    private final Runnable countdownRunnable = new Runnable() {
        @Override
        public void run() {
            if (remainingTimeView == null || !running) return;
            updateRemainingTime();
            mainHandler.postDelayed(this, 1_000L);
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
