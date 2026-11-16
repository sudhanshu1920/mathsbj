package com.sudhanshu.mathsbj;

/**
 * Single authoritative state machine for eligible non-study usage and the
 * periodic reminder. Only monitor-confirmed foreground samples advance time.
 */
final class StudyModeUsageAccumulator {
    private static final int DEFAULT_INTERVAL_MINUTES = 2;
    private static final long MAX_SAMPLE_GAP_MS = 4_000L;

    enum State { STOPPED, RUNNING, PAUSED, REMINDER_PENDING, REMINDER_VISIBLE }

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
        if (state == State.STOPPED || state == State.REMINDER_VISIBLE) return false;
        if (state == State.REMINDER_PENDING) return true;

        if (!eligible || !isValidPackageName(packageName) || elapsedRealtimeMs <= 0L) {
            pause();
            return false;
        }

        if (hasSample && elapsedRealtimeMs >= lastSampleElapsedMs) {
            long delta = elapsedRealtimeMs - lastSampleElapsedMs;
            // The total is global: switching between eligible non-study packages
            // does not restart it. Large gaps are excluded to avoid charging
            // background time after a stalled/restarted monitor.
            if (delta > 0L && delta <= MAX_SAMPLE_GAP_MS) {
                accumulatedUsageMs = accumulatedUsageMs > Long.MAX_VALUE - delta
                    ? Long.MAX_VALUE : accumulatedUsageMs + delta;
            }
        }

        lastSampleElapsedMs = elapsedRealtimeMs;
        hasSample = true;
        state = State.RUNNING;

        long thresholdMs = intervalMinutes * 60_000L;
        if (accumulatedUsageMs < thresholdMs) return false;

        state = State.REMINDER_PENDING;
        clearSampleAnchor();
        return true;
    }

    synchronized void setIntervalMinutes(int value) {
        if (!isValidInterval(value)) {
            throw new IllegalArgumentException("Reminder interval must be an integer from 1 to 10 minutes.");
        }
        intervalMinutes = value;
        resetInterval();
    }

    synchronized void pause() {
        if (state == State.STOPPED || state == State.REMINDER_PENDING
            || state == State.REMINDER_VISIBLE) return;
        state = State.PAUSED;
        clearSampleAnchor();
    }

    synchronized void markReminderVisible() {
        if (state != State.STOPPED) {
            accumulatedUsageMs = 0L;
            state = State.REMINDER_VISIBLE;
        }
        clearSampleAnchor();
    }

    synchronized void dismissReminder(boolean resetInterval) {
        if (resetInterval) accumulatedUsageMs = 0L;
        state = State.PAUSED;
        clearSampleAnchor();
    }

    synchronized void resetInterval() {
        accumulatedUsageMs = 0L;
        state = State.PAUSED;
        clearSampleAnchor();
    }

    synchronized void restoreAccumulatedUsageMs(long value) {
        accumulatedUsageMs = Math.max(0L, value);
        long thresholdMs = intervalMinutes * 60_000L;
        if (accumulatedUsageMs >= thresholdMs) {
            accumulatedUsageMs = thresholdMs;
            state = State.REMINDER_PENDING;
        } else {
            state = State.PAUSED;
        }
        clearSampleAnchor();
    }

    synchronized void clear() {
        accumulatedUsageMs = 0L;
        state = State.STOPPED;
        clearSampleAnchor();
    }

    synchronized long getAccumulatedUsageMs() { return accumulatedUsageMs; }
    synchronized int getIntervalMinutes() { return intervalMinutes; }
    synchronized State getState() { return state; }
    synchronized boolean isReminderPending() { return state == State.REMINDER_PENDING; }
    synchronized boolean isReminderVisible() { return state == State.REMINDER_VISIBLE; }

    static boolean isValidInterval(int value) { return value >= 1 && value <= 10; }

    private void clearSampleAnchor() {
        hasSample = false;
        lastSampleElapsedMs = 0L;
    }

    private static boolean isValidPackageName(String value) {
        return value != null && value.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+");
    }
}
