package com.sudhanshu.mathsbj;

/** Pure-JVM checks for the Screen Time Island timeline (no Android classes involved). */
public final class ScreenTimeIslandMotionTest {
    private static final float CW = 112f;
    private static final float CH = 34f;
    private static final float EW = 372f;
    private static final float EH = 70f;
    private static int assertions;

    public static void main(String[] args) {
        testEntranceAndExpansion();
        testFrameContinuity();
        testHoldPausesWhileTouched();
        testDismissCompletes();
        testToggleIsContinuousAndGated();
        testDragAndRelease();
        testReducedMotion();
        testCounterAndPress();
        System.out.println("PASS ScreenTimeIslandMotion: " + assertions + " assertions");
    }

    private static ScreenTimeIslandMotion motion(boolean reduced, long hold) {
        ScreenTimeIslandMotion m = new ScreenTimeIslandMotion(CW, CH, EW, EH, reduced, hold);
        m.start(0L);
        return m;
    }

    private static void testEntranceAndExpansion() {
        ScreenTimeIslandMotion m = motion(false, 4200L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        float previousAlpha = -1f;
        float maxWidth = 0f;
        for (long t = 0L; t <= 1200L; t++) {
            m.evaluate(t, f);
            noNaN(f, "t=" + t);
            isTrue(f.alpha >= previousAlpha - 1e-5f, "alpha never decreases while entering (t=" + t + ")");
            previousAlpha = f.alpha;
            maxWidth = Math.max(maxWidth, f.width);
            near(f.height * 0.5f, f.radius, 1e-3, "pill radius is always half the height");
            isTrue(f.morph >= 0f && f.morph <= ScreenTimeIslandMotion.OVERSHOOT_LIMIT + 1e-4f, "morph stays bounded");
            if (t == 0L) near(CW, f.width, 0.01, "starts as the camera pill");
            if (t == ScreenTimeIslandMotion.ENTER_MS + 10L) near(1f, f.alpha, 1e-4, "fully opaque after the entrance");
        }
        float delta = EW - CW;
        isTrue(maxWidth <= EW + delta * 0.065f, "overshoot stays within 6.5% of the travel");
        isTrue(maxWidth > EW + delta * 0.005f, "there is a visible spring overshoot");
        near(EW, f.width, delta * 0.005, "settles on the expanded width");
        near(EH, f.height, (EH - CH) * 0.005, "settles on the expanded height");
    }

    private static void testFrameContinuity() {
        ScreenTimeIslandMotion m = motion(false, 4200L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        float previous = CW;
        float delta = EW - CW;
        for (long t = 0L; t <= 900L; t++) {
            m.evaluate(t, f);
            isTrue(Math.abs(f.width - previous) <= delta * 0.02f, "no width jump larger than 2% of travel per ms (t=" + t + ")");
            previous = f.width;
        }
    }

    private static void testHoldPausesWhileTouched() {
        ScreenTimeIslandMotion m = motion(false, 1500L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        long t = 0L;
        for (; t <= 700L; t += 8L) m.evaluate(t, f);
        isTrue(f.interactive, "island becomes interactive once settled");
        m.setTouching(true);
        for (; t <= 12_000L; t += 8L) m.evaluate(t, f);
        isTrue(!m.isDismissing(), "hold timer is paused while the finger is down");
        m.setTouching(false);
        for (long end = t + 1000L; t <= end; t += 8L) m.evaluate(t, f);
        isTrue(!m.isDismissing(), "hold keeps running for its remaining time after release");
        for (long end = t + 800L; t <= end; t += 8L) m.evaluate(t, f);
        isTrue(m.isDismissing(), "island dismisses itself after the hold");
        isTrue(!f.interactive, "no touches while dismissing");
    }

    private static void testDismissCompletes() {
        ScreenTimeIslandMotion m = motion(false, 4200L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        long t = 0L;
        for (; t <= 800L; t++) m.evaluate(t, f);
        m.dismiss(t);
        float previousAlpha = 1f;
        float previousWidth = f.width;
        boolean finished = false;
        long dismissAt = t;
        for (; t <= dismissAt + ScreenTimeIslandMotion.DISMISS_MS + 40L; t++) {
            finished = m.evaluate(t, f);
            noNaN(f, "dismiss t=" + t);
            isTrue(f.alpha <= previousAlpha + 1e-5f, "alpha only falls while dismissing");
            isTrue(f.width <= previousWidth + 0.5f, "capsule only shrinks while dismissing");
            isTrue(f.width >= CW - 0.5f, "capsule never collapses below the camera pill");
            previousAlpha = f.alpha;
            previousWidth = f.width;
            if (finished) break;
        }
        isTrue(finished, "dismissal finishes within the dismiss window");
        isTrue(t - dismissAt <= ScreenTimeIslandMotion.DISMISS_MS + 2L, "dismissal never takes longer than DISMISS_MS");
        near(0f, f.alpha, 0.02, "fully transparent at the end of the dismissal");
    }

    private static void testToggleIsContinuousAndGated() {
        ScreenTimeIslandMotion m = motion(false, 60_000L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        for (long t = 0L; t <= 100L; t++) m.evaluate(t, f);
        isTrue(!m.toggle(100L), "toggle is ignored before the island has settled");
        long t = 101L;
        for (; t <= 800L; t++) m.evaluate(t, f);
        float before = f.width;
        isTrue(m.toggle(t), "toggle works once settled");
        m.evaluate(t, f);
        near(before, f.width, 1.0, "no jump at the instant of the toggle");
        long end = t + 700L;
        for (; t <= end; t++) m.evaluate(t, f);
        near(CW, f.width, 1.0, "toggle collapses to the camera pill");
        isTrue(f.interactive, "collapsed island stays interactive so it can be expanded again");
        isTrue(m.toggle(t), "second toggle is accepted after the settle time");
        end = t + 700L;
        for (; t <= end; t++) m.evaluate(t, f);
        near(EW, f.width, 1.5, "second toggle expands again");
    }

    private static void testDragAndRelease() {
        ScreenTimeIslandMotion m = motion(false, 60_000L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        long t = 0L;
        for (; t <= 800L; t++) m.evaluate(t, f);
        m.setDrag(-30f);
        m.evaluate(t++, f);
        near(-30f, f.offsetY, 0.01, "capsule follows the finger");
        m.setDrag(-5000f);
        m.evaluate(t++, f);
        isTrue(f.offsetY >= -EH - 0.01f, "drag is clamped to the island height");
        m.setDrag(-30f);
        m.releaseDrag(t);
        long end = t + 800L;
        for (; t <= end; t++) m.evaluate(t, f);
        near(0f, f.offsetY, 0.5, "capsule springs back after release");
    }

    private static void testReducedMotion() {
        ScreenTimeIslandMotion m = motion(true, 4200L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        m.evaluate(0L, f);
        near(EW, f.width, 0.01, "reduced motion starts expanded");
        near(1f, f.scale, 1e-6, "reduced motion has no scale animation");
        near(1f, f.counter, 1e-6, "reduced motion shows the final number immediately");
        isTrue(f.shimmer < 0f, "reduced motion has no rim sweep");
        for (long t = 1L; t <= 200L; t++) m.evaluate(t, f);
        near(1f, f.alpha, 1e-4, "cross-fade reaches full opacity");
        isTrue(f.interactive, "interactive after the cross-fade");
        m.dismiss(300L);
        boolean finished = false;
        for (long t = 300L; t <= 300L + ScreenTimeIslandMotion.REDUCED_FADE_MS + 8L; t++) finished = m.evaluate(t, f);
        isTrue(finished, "reduced motion dismissal is a short fade");
        near(0f, f.alpha, 0.02, "faded out");
    }

    private static void testCounterAndPress() {
        ScreenTimeIslandMotion m = motion(false, 60_000L);
        ScreenTimeIslandMotion.Frame f = new ScreenTimeIslandMotion.Frame();
        float previous = -1f;
        for (long t = 0L; t <= 900L; t++) {
            m.evaluate(t, f);
            isTrue(f.counter >= previous - 1e-6f, "count-up never goes backwards");
            previous = f.counter;
            if (t < ScreenTimeIslandMotion.EXPAND_START_MS + ScreenTimeIslandMotion.CONTENT_DELAY_MS) {
                near(0f, f.contentMs, 1e-6, "content waits for the morph");
            }
        }
        near(1f, f.counter, 1e-4, "count-up completes");
        m.setTouching(true);
        long t = 901L;
        for (long end = t + 400L; t <= end; t += 8L) m.evaluate(t, f);
        isTrue(f.press > 0.95f, "press depth rises while touched");
        m.setTouching(false);
        for (long end = t + 800L; t <= end; t += 8L) m.evaluate(t, f);
        isTrue(f.press < 0.05f, "press depth relaxes after release");
    }

    private static void noNaN(ScreenTimeIslandMotion.Frame f, String where) {
        float[] values = { f.width, f.height, f.radius, f.offsetY, f.alpha, f.scale, f.morph,
            f.contentMs, f.exit, f.counter, f.pulse, f.press };
        for (float v : values) isTrue(!Float.isNaN(v) && !Float.isInfinite(v), "finite frame values (" + where + ")");
    }

    private static void near(double expected, double actual, double tolerance, String message) {
        assertions++;
        if (Math.abs(expected - actual) > tolerance) {
            throw new AssertionError(message + ": expected " + expected + " +/- " + tolerance + " but was " + actual);
        }
    }

    private static void isTrue(boolean condition, String message) {
        assertions++;
        if (!condition) throw new AssertionError(message);
    }
}
