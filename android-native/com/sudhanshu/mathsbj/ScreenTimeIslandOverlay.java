package com.sudhanshu.mathsbj;

import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.view.Choreographer;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowMetrics;
import android.view.WindowManager;

import java.util.List;

/**
 * Fixed-size, Choreographer-driven WindowManager overlay for the Screen Time Island.
 *
 * The window is created once at the expanded size plus a small halo margin and is never resized
 * while animating. {@link ScreenTimeIslandMotion} produces every frame (capsule size, entrance,
 * count-up, press, drag, exit) and {@link ScreenTimeIslandPainter} draws it, so the animation runs
 * on vsync without relayouts. The window ignores touches until the island has settled.
 */
public final class ScreenTimeIslandOverlay implements Choreographer.FrameCallback {
    private static final long HOLD_MS = 4200L;
    private static final long LONG_PRESS_MS = 520L;

    private final Context context;
    private final WindowManager windowManager;
    private final IslandView view;
    private final WindowManager.LayoutParams params;
    private final ScreenTimeIslandMotion motion;
    private final ScreenTimeIslandMotion.Frame frame = new ScreenTimeIslandMotion.Frame();
    private final String packageName;
    private final String deepLink;
    private final Runnable onRemoved;
    private final float density;
    private final Choreographer choreographer;
    private final int expandedWidth;
    private final int expandedHeight;
    private final int windowWidth;
    private final int windowHeight;
    private final int padTop;
    private int collapsedWidth;
    private int collapsedHeight;
    private int anchorTop;
    private int cameraOffsetX;
    private boolean attached;
    private boolean callbackPosted;
    private boolean startRequested;
    private boolean boundsResolved;
    private boolean touchable;
    private boolean touchDown;
    private boolean moved;
    private boolean longPressFired;
    private long touchStartedAt;
    private float touchDownX;
    private float touchDownY;

    /** {@code hourlyMillis} is accepted for API compatibility; the island shows the daily total only. */
    public ScreenTimeIslandOverlay(Context source, String appPackage, String appLabel,
                                   Drawable appIcon, long totalMillis, long[] hourlyMillis,
                                   int accentColor, String openDeepLink, Runnable removedCallback) {
        context = source.getApplicationContext();
        packageName = appPackage == null ? "" : appPackage;
        deepLink = openDeepLink == null
            ? new Uri.Builder().scheme("mathmaster").authority("learn").build().toString()
            : openDeepLink;
        onRemoved = removedCallback;
        density = context.getResources().getDisplayMetrics().density;
        windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) throw new IllegalStateException("WindowManager unavailable");
        int screenWidth = context.getResources().getDisplayMetrics().widthPixels;
        collapsedWidth = dp(112);
        collapsedHeight = dp(34);
        anchorTop = dp(6);
        expandedWidth = Math.round(ScreenTimeIslandPainter.expandedWidthPx(screenWidth, density));
        expandedHeight = Math.round(ScreenTimeIslandPainter.expandedHeightPx(expandedWidth, density));
        padTop = ScreenTimeIslandPainter.padTop(density);
        windowWidth = expandedWidth + 2 * ScreenTimeIslandPainter.padSide(density);
        windowHeight = expandedHeight + padTop + ScreenTimeIslandPainter.padBottom(density);
        boolean reducedMotion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
            && android.provider.Settings.Global.getFloat(context.getContentResolver(),
                android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
        motion = new ScreenTimeIslandMotion(collapsedWidth, collapsedHeight,
            expandedWidth, expandedHeight, reducedMotion, HOLD_MS);
        params = createWindowParams();
        view = new IslandView(context, appLabel, appIcon, Math.max(0L, totalMillis), accentColor);
        choreographer = Choreographer.getInstance();
        updateDescription(appLabel, Math.max(0L, totalMillis));
    }

    public boolean show() {
        if (attached) return true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) resolveCutout(null);
            applyGeometry();
            windowManager.addView(view, params);
            attached = true;
            startRequested = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
            if (startRequested) {
                scheduleFrame();
            } else {
                // Below Android 11 the cutout is only readable from the attached view.
                view.post(() -> {
                    if (!attached) return;
                    resolveCutout(view.getRootWindowInsets());
                    updateWindow();
                    startRequested = true;
                    scheduleFrame();
                });
            }
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
        long now = frameTimeNanos / 1_000_000L;
        if (startRequested && !motion.isStarted()) {
            motion.setCollapsedSize(collapsedWidth, collapsedHeight);
            motion.start(now);
        }
        if (touchDown && !longPressFired && !moved && now - touchStartedAt >= LONG_PRESS_MS) {
            longPressFired = true;
            touchDown = false;
            motion.setTouching(false);
            motion.releaseDrag(now);
            openMathMaster();
            motion.dismiss(now);
        }
        boolean finished = motion.evaluate(now, frame);
        updateTouchability(frame.interactive);
        if (finished) {
            removeImmediately();
            return;
        }
        view.invalidate();
        scheduleFrame();
    }

    private void scheduleFrame() {
        if (attached && !callbackPosted) {
            callbackPosted = true;
            choreographer.postFrameCallback(this);
        }
    }

    private static long nowMs() { return System.nanoTime() / 1_000_000L; }

    private void applyGeometry() {
        params.width = windowWidth;
        params.height = windowHeight;
        params.x = cameraOffsetX;
        params.y = anchorTop - padTop;
    }

    private void updateWindow() {
        applyGeometry();
        try {
            windowManager.updateViewLayout(view, params);
        } catch (RuntimeException ignored) {
            removeImmediately();
        }
    }

    private void updateTouchability(boolean interactive) {
        if (!attached || interactive == touchable) return;
        touchable = interactive;
        int flags = params.flags;
        if (interactive) flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        else flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        if (flags == params.flags) return;
        params.flags = flags;
        try {
            windowManager.updateViewLayout(view, params);
        } catch (RuntimeException error) {
            removeImmediately();
        }
    }

    /** Centres the collapsed pill on a top-centre camera cutout; otherwise floats below the top edge. */
    private void resolveCutout(WindowInsets rootInsets) {
        if (boundsResolved) return;
        boundsResolved = true;
        int top = dp(6);
        android.graphics.Rect centred = null;
        int screenMid = context.getResources().getDisplayMetrics().widthPixels / 2;
        try {
            DisplayCutout cutout = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowMetrics metrics = windowManager.getCurrentWindowMetrics();
                WindowInsets insets = metrics.getWindowInsets();
                cutout = insets == null ? null : insets.getDisplayCutout();
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && rootInsets != null) {
                cutout = rootInsets.getDisplayCutout();
            }
            if (cutout != null) {
                List<android.graphics.Rect> rects = cutout.getBoundingRects();
                int tolerance = dp(28);
                for (android.graphics.Rect rect : rects) {
                    if (rect == null || rect.isEmpty() || rect.top > dp(40)) continue;
                    int centerX = (rect.left + rect.right) / 2;
                    if (Math.abs(centerX - screenMid) <= tolerance
                        && (centred == null || rect.width() > centred.width())) centred = rect;
                }
            }
        } catch (RuntimeException ignored) {
            centred = null;
        }
        if (centred != null) {
            collapsedWidth = Math.max(dp(112), Math.min(dp(140), centred.width() + dp(18)));
            collapsedHeight = Math.max(dp(34), Math.min(dp(40), centred.height() + dp(6)));
            top = Math.max(0, (centred.top + centred.bottom - collapsedHeight) / 2);
            cameraOffsetX = (centred.left + centred.right) / 2 - screenMid;
        }
        anchorTop = top;
    }

    private WindowManager.LayoutParams createWindowParams() {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams value = new WindowManager.LayoutParams(
            windowWidth, windowHeight, type,
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
        try {
            windowManager.removeViewImmediate(view);
        } catch (WindowManager.BadTokenException | IllegalArgumentException | IllegalStateException ignored) {
            // Idempotent across configuration, permission, and service teardown races.
        } finally {
            if (onRemoved != null) onRemoved.run();
        }
    }

    private int dp(int value) { return Math.round(value * density); }

    private final class IslandView extends View {
        private final ScreenTimeIslandPainter painter;

        IslandView(Context context, String label, Drawable icon, long totalMillis, int accent) {
            super(context);
            painter = new ScreenTimeIslandPainter(context, label, icon, accent, expandedWidth, expandedHeight);
            painter.setDurationTarget(totalMillis);
            setWillNotDraw(false);
            setClickable(true);
            setFocusable(false);
            setFocusableInTouchMode(false);
            setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
            setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
            setLayerType(View.LAYER_TYPE_NONE, null);
        }

        private boolean isInsideCapsule(float x, float y) {
            float scale = frame.scale * (1f - 0.026f * Math.max(0f, Math.min(1f, frame.press)));
            float halfWidth = frame.width * scale * 0.5f;
            float halfHeight = frame.height * scale * 0.5f;
            float centerX = getWidth() * 0.5f;
            float centerY = padTop + frame.offsetY + frame.height * 0.5f;
            return x >= centerX - halfWidth && x <= centerX + halfWidth
                && y >= centerY - halfHeight && y <= centerY + halfHeight;
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            painter.draw(canvas, getWidth(), getHeight(), frame);
        }

        @Override public boolean onTouchEvent(MotionEvent event) {
            if (!attached || !frame.interactive) return false;
            long now = nowMs();
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    if (!isInsideCapsule(event.getX(), event.getY())) return false;
                    touchDown = true;
                    moved = false;
                    longPressFired = false;
                    touchStartedAt = now;
                    touchDownX = event.getX();
                    touchDownY = event.getY();
                    motion.setTouching(true);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (touchDown) {
                        float dy = event.getY() - touchDownY;
                        float dx = event.getX() - touchDownX;
                        if (Math.abs(dx) > dp(10) || Math.abs(dy) > dp(10)) moved = true;
                        if (moved) motion.setDrag(dy < 0f ? dy : dy * 0.18f);
                        if (dy < -dp(26)) {
                            touchDown = false;
                            motion.setTouching(false);
                            motion.releaseDrag(now);
                            motion.dismiss(now);
                        }
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!touchDown) return true;
                    touchDown = false;
                    motion.setTouching(false);
                    motion.releaseDrag(now);
                    if (!longPressFired && !moved) performClick();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    touchDown = false;
                    motion.setTouching(false);
                    motion.releaseDrag(now);
                    return true;
                default:
                    return true;
            }
        }

        @Override public boolean performClick() {
            super.performClick();
            motion.toggle(nowMs());
            return true;
        }
    }
}
