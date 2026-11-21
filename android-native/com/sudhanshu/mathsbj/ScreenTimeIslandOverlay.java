package com.sudhanshu.mathsbj;

import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;

import java.util.Calendar;
import java.util.List;

/** Bounded, touchable-only-when-settled WindowManager overlay for Screen Time Island. */
public final class ScreenTimeIslandOverlay implements Choreographer.FrameCallback {
    private static final int ENTER = 0;
    private static final int MORPH = 1;
    private static final int HOLD = 2;
    private static final int TOGGLE = 3;
    private static final int DISMISS = 4;
    private static final long EMERGE_MS = 140L;
    private static final long REDUCED_CROSSFADE_MS = 120L;
    private static final long MORPH_MS = 480L;
    private static final long DISMISS_MS = 380L;
    private static final long CONTENT_EXIT_MS = 110L;
    private static final long BAR_STAGGER_COMPLETION_MS = 480L;
    private static final long HOLD_MS = 4200L;
    private static final long LONG_PRESS_MS = 520L;

    private final Context context;
    private final WindowManager windowManager;
    private final IslandView view;
    private final WindowManager.LayoutParams params;
    private int collapsedWidth;
    private int collapsedHeight;
    private final int expandedWidth;
    private final int expandedHeight;
    private final int accent;
    private final long totalTodayMillis;
    private final String packageName;
    private final String deepLink;
    private final Runnable onRemoved;
    private final float density;
    private final int currentHour;
    private final Choreographer choreographer;
    private int phase = ENTER;
    private long phaseStartedAt;
    private long lastFrameAt;
    private long heldMillis;
    private long touchStartedAt;
    private float touchDownX;
    private float touchDownY;
    private boolean touchDown;
    private boolean longPressFired;
    private boolean moved;
    private boolean attached;
    private boolean callbackPosted;
    private float morphProgress;
    private float toggleFrom;
    private float toggleTo;
    private boolean targetExpanded = true;
    private int anchorTop;
    private boolean boundsResolved;
    private boolean reducedMotion;

    public ScreenTimeIslandOverlay(Context source, String appPackage, String appLabel,
                                   Drawable appIcon, long totalMillis, long[] hourlyMillis,
                                   int accentColor, String openDeepLink, Runnable removedCallback) {
        context = source.getApplicationContext();
        packageName = appPackage == null ? "" : appPackage;
        deepLink = openDeepLink == null ? new Uri.Builder().scheme("mathmaster").authority("learn").build().toString() : openDeepLink;
        onRemoved = removedCallback;
        accent = accentColor;
        totalTodayMillis = Math.max(0L, totalMillis);
        density = context.getResources().getDisplayMetrics().density;
        currentHour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) throw new IllegalStateException("WindowManager unavailable");
        int screenWidth = context.getResources().getDisplayMetrics().widthPixels;
        collapsedWidth = dp(120);
        collapsedHeight = dp(36);
        expandedWidth = Math.max(dp(112), Math.min(screenWidth - dp(32), dp(356)));
        expandedHeight = dp(96);
        params = createWindowParams();
        view = new IslandView(context, appLabel, appIcon, hourlyMillis, totalTodayMillis);
        choreographer = Choreographer.getInstance();
        phaseStartedAt = SystemClock.uptimeMillis();
        lastFrameAt = phaseStartedAt;
        reducedMotion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
            && android.provider.Settings.Global.getFloat(context.getContentResolver(),
                android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
        updateDescription(appLabel, totalTodayMillis);
    }

    public boolean show() {
        if (attached) return true;
        try {
            windowManager.addView(view, params);
            attached = true;
            if (reducedMotion) {
                morphProgress = 1f;
                phase = ENTER;
                setWindowBounds(expandedWidth, expandedHeight);
                updateTouchability(false);
            } else {
                setWindowBounds(collapsedWidth, collapsedHeight);
            }
            scheduleFrame();
            view.post(this::resolveCutoutAndAnchor);
            return true;
        } catch (WindowManager.BadTokenException | IllegalStateException | SecurityException error) {
            removeImmediately();
            return false;
        }
    }

    public boolean isVisible() { return attached; }
    public String getPackageName() { return packageName; }

    /** Removes without animation for security/lifecycle transitions. */
    public void dismissImmediately() {
        removeImmediately();
    }

    @Override
    public void doFrame(long frameTimeNanos) {
        callbackPosted = false;
        if (!attached) return;
        long now = SystemClock.uptimeMillis();
        long delta = Math.max(0L, Math.min(64L, now - lastFrameAt));
        lastFrameAt = now;
        if (touchDown && !longPressFired && now - touchStartedAt >= LONG_PRESS_MS) {
            longPressFired = true;
            openMathMaster();
            startDismiss();
        }

        float alpha = 1f;
        float iconScale = 1f;
        float barProgress = 1f;
        float pulse = (float) (0.5d + 0.5d * Math.sin(now * Math.PI / 600d));
        long displayedMillis = totalTodayMillis;

        if (phase == ENTER) {
            long duration = reducedMotion ? REDUCED_CROSSFADE_MS : EMERGE_MS;
            float progress = clamp((now - phaseStartedAt) / (float) duration, 0f, 1f);
            alpha = progress;
            iconScale = reducedMotion ? 1f : progress;
            if (progress >= 1f) {
                if (reducedMotion) {
                    phase = HOLD;
                    phaseStartedAt = now;
                    heldMillis = 0L;
                    updateTouchability(true);
                    view.setLayerType(View.LAYER_TYPE_NONE, null);
                } else {
                    phase = MORPH;
                    phaseStartedAt = now;
                    view.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                    updateTouchability(false);
                }
            }
        } else if (phase == MORPH) {
            long elapsed = now - phaseStartedAt;
            float widthProgress = ScreenTimeIslandSpring.valueAt(elapsed / 1000f, 0.42f, 0.78f);
            float heightProgress = ScreenTimeIslandSpring.valueAt(Math.max(0L, elapsed - 60L) / 1000f, 0.42f, 0.78f);
            morphProgress = clamp(Math.min(widthProgress, heightProgress), 0f, 1.06f);
            setInterpolatedBounds(widthProgress, heightProgress);
            float contentProgress = clamp((morphProgress - 0.55f) / 0.45f, 0f, 1f);
            iconScale = contentProgress;
            barProgress = clamp((elapsed - 170L) / (float) BAR_STAGGER_COMPLETION_MS, 0f, 1f);
            displayedMillis = Math.round(totalTodayMillis * easeOutCubic(elapsed / 520f));
            if (elapsed >= MORPH_MS) {
                morphProgress = 1f;
                setWindowBounds(expandedWidth, expandedHeight);
                phase = HOLD;
                phaseStartedAt = now;
                heldMillis = 0L;
                view.setLayerType(View.LAYER_TYPE_NONE, null);
                updateTouchability(true);
                view.sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED);
            }
        } else if (phase == HOLD) {
            morphProgress = targetExpanded ? 1f : 0f;
            barProgress = clamp((MORPH_MS - 170L + Math.max(0L, now - phaseStartedAt))
                / (float) BAR_STAGGER_COMPLETION_MS, 0f, 1f);
            if (!touchDown) heldMillis += delta;
            if (heldMillis >= HOLD_MS) startDismiss();
        } else if (phase == TOGGLE) {
            long elapsed = now - phaseStartedAt;
            float spring = ScreenTimeIslandSpring.valueAt(elapsed / 1000f, 0.34f, 0.86f);
            morphProgress = toggleFrom + (toggleTo - toggleFrom) * clamp(spring, 0f, 1.05f);
            setWindowBounds(Math.round(lerp(collapsedWidth, expandedWidth, morphProgress)),
                Math.round(lerp(collapsedHeight, expandedHeight, morphProgress)));
            if (elapsed >= 420L) {
                morphProgress = toggleTo;
                targetExpanded = toggleTo >= 0.5f;
                setWindowBounds(targetExpanded ? expandedWidth : collapsedWidth,
                    targetExpanded ? expandedHeight : collapsedHeight);
                phase = HOLD;
                phaseStartedAt = now;
                heldMillis = 0L;
                view.setLayerType(View.LAYER_TYPE_NONE, null);
                updateTouchability(true);
            }
        } else if (phase == DISMISS) {
            long elapsed = now - phaseStartedAt;
            float spring = ScreenTimeIslandSpring.valueAt(elapsed / 1000f, 0.42f, 0.90f);
            float collapse = clamp(spring, 0f, 1f);
            morphProgress = toggleFrom * (1f - collapse);
            float widthProgress = morphProgress;
            float heightProgress = Math.max(0f, morphProgress);
            setWindowBounds(Math.round(lerp(collapsedWidth, expandedWidth, widthProgress)),
                Math.round(lerp(collapsedHeight, expandedHeight, heightProgress)));
            alpha = elapsed <= 240L ? 1f : clamp(1f - (elapsed - 240L) / 140f, 0f, 1f);
            iconScale = alpha;
            barProgress = elapsed < CONTENT_EXIT_MS ? 1f - elapsed / (float) CONTENT_EXIT_MS : 0f;
            if (elapsed >= DISMISS_MS) {
                removeImmediately();
                return;
            }
        }

        view.render(morphProgress, alpha, iconScale, barProgress, pulse, displayedMillis);
        scheduleFrame();
    }

    private void resolveCutoutAndAnchor() {
        if (!attached || boundsResolved) return;
        boundsResolved = true;
        int top = dp(6);
        int cameraWidth = 0;
        int cameraHeight = 0;
        android.graphics.Rect centred = null;
        try {
            DisplayCutout cutout = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowManager.WindowMetrics metrics = windowManager.getCurrentWindowMetrics();
                WindowInsets insets = metrics.getWindowInsets();
                cutout = insets == null ? null : insets.getDisplayCutout();
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowInsets insets = view.getRootWindowInsets();
                cutout = insets == null ? null : insets.getDisplayCutout();
            }
            if (cutout != null) {
                List<android.graphics.Rect> rects = cutout.getBoundingRects();
                int screenMid = context.getResources().getDisplayMetrics().widthPixels / 2;
                int tolerance = dp(28);
                for (android.graphics.Rect rect : rects) {
                    if (rect == null || rect.isEmpty() || rect.top > dp(40)) continue;
                    int centerX = (rect.left + rect.right) / 2;
                    int offset = Math.abs(centerX - screenMid);
                    if (offset <= tolerance && (centred == null || rect.width() > centred.width())) centred = rect;
                }
            }
        } catch (RuntimeException ignored) {
            centred = null;
        }
        if (centred != null) {
            cameraWidth = centred.width();
            cameraHeight = centred.height();
            collapsedWidth =BoundWidth(cameraWidth + dp(20));
            collapsedHeight = BoundHeight(cameraHeight + dp(8));
            top = Math.max(0, (centred.top + centred.bottom - collapsedHeight) / 2);
        }
        anchorTop = top;
        params.y = anchorTop;
        setWindowBounds(collapsedWidth, collapsedHeight);
        if (phase == HOLD && targetExpanded) {
            setWindowBounds(expandedWidth, expandedHeight);
        }
        try {
            windowManager.updateViewLayout(view, params);
        } catch (RuntimeException ignored) {
            removeImmediately();
        }
    }

    private final class IslandView extends View {
        private final ScreenTimeIslandPainter painter;
        private float morph;
        private float alpha = 0f;
        private float iconScale = 1f;
        private float barProgress = 1f;
        private float pulse = 0.5f;
        private long elapsedMillis;

        IslandView(Context context, String label, Drawable icon, long[] hourly, long totalMillis) {
            super(context);
            painter = new ScreenTimeIslandPainter(context, label, icon, hourly);
            painter.setDurationTarget(totalMillis);
            setWillNotDraw(false);
            setClickable(true);
            setFocusable(false);
            setFocusableInTouchMode(false);
            setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
            setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
            setLayerType(View.LAYER_TYPE_NONE, null);
        }

        void render(float nextMorph, float nextAlpha, float nextIconScale,
                    float nextBars, float nextPulse, long nextElapsed) {
            morph = nextMorph;
            alpha = nextAlpha;
            iconScale = nextIconScale;
            barProgress = nextBars;
            pulse = nextPulse;
            elapsedMillis = nextElapsed;
            invalidate();
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            painter.draw(canvas, getWidth(), getHeight(), morph, alpha,
                iconScale, barProgress, pulse, accent, currentHour, elapsedMillis);
        }

        @Override public boolean onTouchEvent(MotionEvent event) {
            if (!attached || phase == ENTER || phase == MORPH || phase == DISMISS) return false;
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    touchDown = true;
                    moved = false;
                    longPressFired = false;
                    touchStartedAt = SystemClock.uptimeMillis();
                    touchDownX = event.getX();
                    touchDownY = event.getY();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (touchDown) {
                        float dy = event.getY() - touchDownY;
                        float dx = event.getX() - touchDownX;
                        if (Math.abs(dx) > dp(12) || Math.abs(dy) > dp(12)) moved = true;
                        if (dy < -dp(20)) {
                            touchDown = false;
                            startDismiss();
                        }
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!touchDown) return true;
                    touchDown = false;
                    long held = SystemClock.uptimeMillis() - touchStartedAt;
                    if (!longPressFired && !moved && held < LONG_PRESS_MS) performClick();
                    invalidate();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    touchDown = false;
                    return true;
                default:
                    return true;
            }
        }

        @Override public boolean performClick() {
            super.performClick();
            toggleExpanded();
            return true;
        }
    }

    private WindowManager.LayoutParams createWindowParams() {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams value = new WindowManager.LayoutParams(
            collapsedWidth, collapsedHeight, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT);
        value.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        value.setTitle("Math Master Screen Time Island");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            value.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            value.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        return value;
    }

    private void setInterpolatedBounds(float widthProgress, float heightProgress) {
        int width = Math.round(lerp(collapsedWidth, expandedWidth, clamp(widthProgress, 0f, 1.06f)));
        int height = Math.round(lerp(collapsedHeight, expandedHeight, clamp(heightProgress, 0f, 1.06f)));
        setWindowBounds(width, height);
    }

    private void setWindowBounds(int width, int height) {
        if (!attached) {
            params.width = width;
            params.height = height;
            return;
        }
        if (params.width == width && params.height == height) return;
        params.width = width;
        params.height = height;
        try {
            windowManager.updateViewLayout(view, params);
        } catch (WindowManager.BadTokenException | IllegalStateException error) {
            removeImmediately();
        }
    }

    private void updateTouchability(boolean touchable) {
        if (!attached) return;
        int flags = params.flags;
        if (touchable) flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        else flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        if (flags == params.flags) return;
        params.flags = flags;
        try { windowManager.updateViewLayout(view, params); }
        catch (RuntimeException error) { removeImmediately(); }
    }

    private void toggleExpanded() {
        if (!attached || (phase != HOLD)) return;
        toggleFrom = morphProgress;
        toggleTo = targetExpanded ? 0f : 1f;
        targetExpanded = toggleTo >= 0.5f;
        phase = TOGGLE;
        phaseStartedAt = SystemClock.uptimeMillis();
        view.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        updateTouchability(false);
    }

    private void startDismiss() {
        if (!attached || phase == DISMISS) return;
        toggleFrom = clamp(morphProgress, 0f, 1f);
        phase = DISMISS;
        phaseStartedAt = SystemClock.uptimeMillis();
        view.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        updateTouchability(false);
    }

    private void scheduleFrame() {
        if (attached && !callbackPosted) {
            callbackPosted = true;
            choreographer.postFrameCallback(this);
        }
    }

    private void openMathMaster() {
        try {
            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink));
            open.setPackage(context.getPackageName());
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(open);
        } catch (RuntimeException ignored) {
            // Deep-link routing is best effort; the overlay remains dismissible.
        }
    }

    private void updateDescription(String label, long millis) {
        long minutes = Math.max(0L, millis) / 60_000L;
        long hours = minutes / 60L;
        long remainder = minutes % 60L;
        String duration = hours > 0L
            ? hours + (hours == 1L ? " hour " : " hours ") + remainder + (remainder == 1L ? " minute" : " minutes")
            : (minutes < 1L ? "less than one minute" : minutes + (minutes == 1L ? " minute" : " minutes"));
        view.setContentDescription("Screen time. " + (label == null ? "App" : label) + ". " + duration + " today");
    }

    private void removeImmediately() {
        if (!attached) return;
        attached = false;
        if (callbackPosted) {
            choreographer.removeFrameCallback(this);
            callbackPosted = false;
        }
        touchDown = false;
        view.setLayerType(View.LAYER_TYPE_NONE, null);
        try {
            windowManager.removeViewImmediate(view);
        } catch (WindowManager.BadTokenException | IllegalArgumentException | IllegalStateException ignored) {
            // Idempotent across configuration, permission, and service teardown races.
        } finally {
            if (onRemoved != null) onRemoved.run();
        }
    }

    private int BoundWidth(int value) { return Math.max(dp(112), Math.min(dp(140), value)); }
    private int BoundHeight(int value) { return Math.max(dp(34), Math.min(dp(40), value)); }
    private int dp(int value) { return Math.round(value * density); }
    private static float clamp(float value, float min, float max) {
        if (Float.isNaN(value) || Float.isInfinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }
    private static float lerp(float a, float b, float p) { return a + (b - a) * p; }
    private static float easeOutCubic(float value) {
        float x = clamp(value, 0f, 1f);
        float inverse = 1f - x;
        return 1f - inverse * inverse * inverse;
    }
}