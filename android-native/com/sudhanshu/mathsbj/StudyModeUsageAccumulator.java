package com.sudhanshu.mathsbj;

/**
 * One authoritative state machine for periodic non-study usage reminders.
 *
 * Samples are supplied by the Focus Service using elapsedRealtime(), which also
 * makes this class deterministic under a fake clock in tests. Package switches
 * between eligible apps keep the same accumulated total. Uncertain sample gaps
 * are excluded instead of counting background time.
 */
final class StudyModeUsageAccumulator {
    enum State { RUNNING, PAUSED, DUE, VISIBLE, STOPPED }

    private static final int DEFAULT_INTERVAL_MINUTES = 2;
    private static final long MAX_SAMPLE_GAP_MS = 2_500L;
    private long accumulatedUsageMs = 0L;
    private long lastSampleElapsedMs = 0L;
    private boolean hasSample = false;
    private int intervalMinutes = DEFAULT_INTERVAL_MINUTES;
    private State state = State.PAUSED;

    synchronized boolean sample(
        String packageName,
        long elapsedRealtimeMs,
        boolean eligible,
        int configuredIntervalMinutes
    ) {
        int safeInterval = isValidInterval(configuredIntervalMinutes)
            ? configuredIntervalMinutes : DEFAULT_INTERVAL_MINUTES;
        if (safeInterval != intervalMinutes) {
            setIntervalMinutes(safeInterval);
            return false;
        }
        if (state == State.STOPPED || state == State.VISIBLE) return false;
        if (state == State.DUE) return true;

        if (!eligible || !isValidPackageName(packageName) || elapsedRealtimeMs <= 0L) {
            pause();
            return false;
        }

        if (hasSample && elapsedRealtimeMs >= lastSampleElapsedMs) {
            long delta = elapsedRealtimeMs - lastSampleElapsedMs;
            // A short transition between two confirmed eligible windows belongs
            // to the shared global usage total, even when the package changes.
            if (delta > 0L && delta <= MAX_SAMPLE_GAP_MS) {
                accumulatedUsageMs = Math.min(Long.MAX_VALUE - delta, accumulatedUsageMs) + delta;
            }
        }

        lastSampleElapsedMs = elapsedRealtimeMs;
        hasSample = true;
        state = State.RUNNING;

        long thresholdMs = intervalMinutes * 60_000L;
        if (accumulatedUsageMs < thresholdMs) return false;

        // DUE is latched. Focus changes and monitor callbacks can retry display,
        // but can never create a second timer or clear the completed interval.
        state = State.DUE;
        clearSampleAnchor();
        return true;
    }

    synchronized void setIntervalMinutes(int value) {
        if (!isValidInterval(value)) {
            throw new IllegalArgumentException("Reminder interval must be an integer from 1 to 10 minutes.");
        }
        if (intervalMinutes == value) return;
        intervalMinutes = value;
        resetInterval();
    }

    synchronized void pause() {
        if (state == State.RUNNING) state = State.PAUSED;
        clearSampleAnchor();
    }

    /** Transition a completed timer into a visible, acknowledged reminder. */
    synchronized boolean markVisible() {
        if (state == State.VISIBLE) return true;
        if (state != State.DUE) return false;
        accumulatedUsageMs = 0L;
        clearSampleAnchor();
        state = State.VISIBLE;
        return true;
    }

    /** Restore a reminder after the foreground service process is recreated. */
    synchronized void restoreVisible() {
        accumulatedUsageMs = 0L;
        clearSampleAnchor();
        state = State.VISIBLE;
    }

    /** A user action acknowledges the reminder and starts a fresh interval. */
    synchronized void acknowledgeReminder() {
        accumulatedUsageMs = 0L;
        clearSampleAnchor();
        state = State.PAUSED;
    }

    synchronized void resetInterval() {
        accumulatedUsageMs = 0L;
        clearSampleAnchor();
        state = State.PAUSED;
    }

    synchronized void clear() {
        accumulatedUsageMs = 0L;
        clearSampleAnchor();
        state = State.STOPPED;
    }

    private void clearSampleAnchor() {
        hasSample = false;
        lastSampleElapsedMs = 0L;
    }

    synchronized long getAccumulatedUsageMs() { return accumulatedUsageMs; }
    synchronized int getIntervalMinutes() { return intervalMinutes; }
    synchronized State getState() { return state; }
    synchronized boolean isDue() { return state == State.DUE; }
    synchronized boolean isVisible() { return state == State.VISIBLE; }
    static boolean isValidInterval(int value) { return value >= 1 && value <= 10; }

    private static boolean isValidPackageName(String value) {
        return value != null && value.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+");
    }
}
