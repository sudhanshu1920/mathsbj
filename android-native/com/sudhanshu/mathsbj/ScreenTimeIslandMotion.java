package com.sudhanshu.mathsbj;

/**
 * Android-free timeline for the Screen Time Island.
 *
 * The overlay window keeps one fixed, bounded size for the whole life of the island. Everything
 * that moves is computed here and drawn on the Canvas: capsule width/height/corner radius,
 * entrance and exit, content stagger, the count-up, press feedback, drag-to-dismiss and the hold
 * timer. A frame is a pure function of the clock, so the overlay, the desktop preview and the JVM
 * tests all read exactly the same numbers and nothing allocates while animating.
 */
public final class ScreenTimeIslandMotion {
    public static final long ENTER_MS = 120L;
    public static final long EXPAND_START_MS = 70L;
    public static final long CONTENT_DELAY_MS = 110L;
    public static final long FIRST_SETTLE_MS = 520L;
    public static final long TOGGLE_SETTLE_MS = 360L;
    public static final long COUNTER_DELAY_MS = 120L;
    public static final long COUNTER_MS = 640L;
    public static final long DISMISS_MS = 360L;
    public static final long REDUCED_FADE_MS = 120L;
    public static final float OVERSHOOT_LIMIT = 1.06f;

    private static final float WIDTH_RESPONSE = 0.40f;
    private static final float WIDTH_DAMPING = 0.74f;
    private static final float HEIGHT_RESPONSE = 0.42f;
    private static final float HEIGHT_DAMPING = 0.78f;
    private static final long HEIGHT_LAG_MS = 36L;
    private static final float TOGGLE_RESPONSE = 0.30f;
    private static final float TOGGLE_DAMPING = 0.90f;
    private static final float COLLAPSE_RESPONSE = 0.34f;
    private static final float COLLAPSE_DAMPING = 0.97f;
    private static final float DRAG_RESPONSE = 0.26f;
    private static final float DRAG_DAMPING = 0.90f;
    private static final long MAX_FRAME_STEP_MS = 64L;

    /** Mutable, reusable result of {@link #evaluate(long, Frame)}. */
    public static final class Frame {
        /** Capsule size in pixels. */
        public float width;
        public float height;
        public float radius;
        /** Vertical offset in pixels (drag follow). */
        public float offsetY;
        /** Whole-capsule opacity and scale (entrance, exit, press). */
        public float alpha;
        public float scale;
        /** 0 = camera pill, 1 = fully expanded (may overshoot slightly). */
        public float morph;
        /** Milliseconds since the content reveal began. */
        public float contentMs;
        /** 0..1 content exit progress while dismissing. */
        public float exit;
        /** 0..1 eased progress of the usage count-up. */
        public float counter;
        /** 0..1 breathing phase for the live dot and the current-hour bar. */
        public float pulse;
        /** 0..1 progress of the one-off rim light sweep, or -1 when idle. */
        public float shimmer;
        /** 0..1 smoothed press depth. */
        public float press;
        /** True while the settled island accepts touches. */
        public boolean interactive;

        void clear() {
            width = 0f;
            height = 0f;
            radius = 0f;
            offsetY = 0f;
            alpha = 0f;
            scale = 1f;
            morph = 0f;
            contentMs = 0f;
            exit = 0f;
            counter = 0f;
            pulse = 0.5f;
            shimmer = -1f;
            press = 0f;
            interactive = false;
        }
    }

    private float collapsedWidth;
    private float collapsedHeight;
    private final float expandedWidth;
    private final float expandedHeight;
    private final boolean reducedMotion;
    private final long holdMs;

    private boolean started;
    private boolean dismissing;
    private boolean finished;
    private boolean firstExpansion = true;
    private long startMs;
    private long morphStartMs;
    private float morphFrom;
    private float morphTo = 1f;
    private float morphResponse = WIDTH_RESPONSE;
    private float morphDamping = WIDTH_DAMPING;
    private float heightResponse = HEIGHT_RESPONSE;
    private float heightDamping = HEIGHT_DAMPING;
    private long heightLagMs = HEIGHT_LAG_MS;
    private long settleAtMs;
    private long dismissStartMs;
    private float dismissFrom;
    private boolean touching;
    private boolean dragging;
    private float dragY;
    private float dragFrom;
    private long dragReleaseMs = -1L;
    private long holdAccumMs;
    private long lastEvalMs = -1L;
    private float press;
    private float pressTarget;

    public ScreenTimeIslandMotion(float collapsedWidth, float collapsedHeight,
                                  float expandedWidth, float expandedHeight,
                                  boolean reducedMotion, long holdMs) {
        this.collapsedWidth = Math.max(1f, collapsedWidth);
        this.collapsedHeight = Math.max(1f, collapsedHeight);
        this.expandedWidth = Math.max(this.collapsedWidth, expandedWidth);
        this.expandedHeight = Math.max(this.collapsedHeight, expandedHeight);
        this.reducedMotion = reducedMotion;
        this.holdMs = Math.max(500L, holdMs);
    }

    /** The camera pill size can be refined until the first frame (cutout discovery). */
    public void setCollapsedSize(float width, float height) {
        if (started) return;
        collapsedWidth = Math.min(expandedWidth, Math.max(1f, width));
        collapsedHeight = Math.min(expandedHeight, Math.max(1f, height));
    }

    public void start(long nowMs) {
        if (started) return;
        started = true;
        startMs = nowMs;
        lastEvalMs = nowMs;
        morphFrom = reducedMotion ? 1f : 0f;
        morphTo = 1f;
        morphStartMs = reducedMotion ? nowMs : nowMs + EXPAND_START_MS;
        settleAtMs = reducedMotion ? nowMs + REDUCED_FADE_MS : morphStartMs + FIRST_SETTLE_MS;
    }

    public boolean isStarted() { return started; }
    public boolean isDismissing() { return dismissing; }
    public boolean isFinished() { return finished; }
    public boolean isReducedMotion() { return reducedMotion; }
    public boolean isExpandedTarget() { return morphTo >= 0.5f; }

    public void setTouching(boolean down) {
        touching = down;
        pressTarget = down ? 1f : 0f;
    }

    /** Follows the finger; negative values move the capsule up. */
    public void setDrag(float dyPixels) {
        dragging = true;
        dragReleaseMs = -1L;
        dragY = clampRange(dyPixels, -expandedHeight, expandedHeight * 0.25f);
    }

    public void releaseDrag(long nowMs) {
        if (!dragging) return;
        dragging = false;
        dragFrom = dragY;
        dragReleaseMs = nowMs;
    }

    /** Flips between the camera pill and the expanded island; ignored until settled. */
    public boolean toggle(long nowMs) {
        if (!started || dismissing || finished || nowMs < settleAtMs) return false;
        float current = widthProgress(nowMs);
        morphFrom = clampRange(current, 0f, 1f);
        morphTo = morphTo >= 0.5f ? 0f : 1f;
        if (reducedMotion) {
            morphFrom = morphTo;
            morphStartMs = nowMs;
            settleAtMs = nowMs;
            firstExpansion = false;
            holdAccumMs = 0L;
            return true;
        }
        morphStartMs = nowMs;
        morphResponse = TOGGLE_RESPONSE;
        morphDamping = TOGGLE_DAMPING;
        heightResponse = TOGGLE_RESPONSE;
        heightDamping = TOGGLE_DAMPING;
        heightLagMs = 0L;
        settleAtMs = nowMs + TOGGLE_SETTLE_MS;
        firstExpansion = false;
        holdAccumMs = 0L;
        return true;
    }

    public void dismiss(long nowMs) {
        if (!started || dismissing || finished) return;
        dismissing = true;
        dismissStartMs = nowMs;
        dismissFrom = clampRange(widthProgress(nowMs), 0f, 1f);
    }

    /**
     * Fills {@code out} for the given clock. Returns true once the dismissal has completed and the
     * overlay should be removed.
     */
    public boolean evaluate(long nowMs, Frame out) {
        if (!started) {
            out.clear();
            return false;
        }
        long step = lastEvalMs < 0L ? 0L : clampRangeLong(nowMs - lastEvalMs, 0L, MAX_FRAME_STEP_MS);
        lastEvalMs = nowMs;
        press += (pressTarget - press) * (1f - (float) Math.exp(-step / 70.0));

        boolean interactive = !dismissing && nowMs >= settleAtMs;
        if (interactive && !touching && !dragging) {
            holdAccumMs += step;
            if (holdAccumMs >= holdMs) {
                dismiss(nowMs);
                interactive = false;
            }
        }

        float enter = clampRange((nowMs - startMs) / (float) ENTER_MS, 0f, 1f);
        float alpha = easeOutCubic(enter);
        float scale = reducedMotion ? 1f
            : 0.88f + 0.12f * easeOutCubic(clampRange((nowMs - startMs) / (float) (ENTER_MS + 60L), 0f, 1f));
        float wProgress;
        float hProgress;
        float exit = 0f;
        if (dismissing) {
            long d = Math.max(0L, nowMs - dismissStartMs);
            if (reducedMotion) {
                wProgress = dismissFrom;
                hProgress = dismissFrom;
                alpha = Math.min(alpha, 1f - clampRange(d / (float) REDUCED_FADE_MS, 0f, 1f));
                exit = clampRange(d / (float) REDUCED_FADE_MS, 0f, 1f);
                finished = d >= REDUCED_FADE_MS;
            } else {
                float collapse = clampRange(
                    ScreenTimeIslandSpring.valueAt(d / 1000f, COLLAPSE_RESPONSE, COLLAPSE_DAMPING), 0f, 1f);
                wProgress = dismissFrom * (1f - collapse);
                hProgress = wProgress;
                exit = clampRange(d / 110f, 0f, 1f);
                alpha = Math.min(alpha, d <= 210L ? 1f : clampRange(1f - (d - 210L) / 150f, 0f, 1f));
                scale *= 1f - 0.06f * clampRange((d - 190L) / 170f, 0f, 1f);
                finished = d >= DISMISS_MS;
            }
        } else {
            wProgress = widthProgress(nowMs);
            hProgress = heightProgress(nowMs);
        }

        float drag = dragY;
        if (!dragging && dragReleaseMs >= 0L) {
            float s = clampRange(ScreenTimeIslandSpring.valueAt(
                (nowMs - dragReleaseMs) / 1000f, DRAG_RESPONSE, DRAG_DAMPING), 0f, 1f);
            drag = dragFrom * (1f - s);
            if (s >= 0.999f) {
                dragReleaseMs = -1L;
                dragY = 0f;
                drag = 0f;
            }
        }

        wProgress = clampRange(wProgress, 0f, OVERSHOOT_LIMIT);
        hProgress = clampRange(hProgress, 0f, OVERSHOOT_LIMIT);
        out.width = lerp(collapsedWidth, expandedWidth, wProgress);
        out.height = lerp(collapsedHeight, expandedHeight, hProgress);
        out.radius = out.height * 0.5f;
        out.offsetY = drag;
        out.alpha = alpha;
        out.scale = scale;
        out.morph = Math.min(wProgress, hProgress);
        out.contentMs = reducedMotion ? 10_000f : Math.max(0f, nowMs - (morphStartMs + CONTENT_DELAY_MS));
        out.exit = exit;
        out.counter = reducedMotion ? 1f : easeOutCubic(clampRange(
            (nowMs - (startMs + COUNTER_DELAY_MS)) / (float) COUNTER_MS, 0f, 1f));
        out.pulse = (float) (0.5 + 0.5 * Math.sin((nowMs - startMs) * (Math.PI * 2.0 / 1600.0)));
        float sweep = (nowMs - (morphStartMs + 140L)) / 560f;
        out.shimmer = firstExpansion && !reducedMotion && sweep >= 0f && sweep <= 1f
            ? easeInOutCubic(sweep) : -1f;
        out.press = press;
        out.interactive = interactive;
        return finished;
    }

    private float widthProgress(long nowMs) {
        return track(nowMs, 0L, morphResponse, morphDamping);
    }

    private float heightProgress(long nowMs) {
        return track(nowMs, heightLagMs, heightResponse, heightDamping);
    }

    private float track(long nowMs, long lagMs, float response, float damping) {
        float seconds = (nowMs - morphStartMs - lagMs) / 1000f;
        return morphFrom + (morphTo - morphFrom) * ScreenTimeIslandSpring.valueAt(seconds, response, damping);
    }

    private static float easeOutCubic(float value) {
        float x = clampRange(value, 0f, 1f);
        float inverse = 1f - x;
        return 1f - inverse * inverse * inverse;
    }

    private static float easeInOutCubic(float value) {
        float x = clampRange(value, 0f, 1f);
        return x < 0.5f ? 4f * x * x * x : 1f - (float) Math.pow(-2f * x + 2f, 3.0) / 2f;
    }

    private static float lerp(float a, float b, float p) { return a + (b - a) * p; }

    private static float clampRange(float value, float min, float max) {
        if (Float.isNaN(value) || Float.isInfinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    private static long clampRangeLong(long value, long min, long max) {
        return Math.max(min, Math.min(max, value));
    }
}
