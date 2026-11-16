package com.sudhanshu.mathsbj;

/**
 * Accumulates monitor-confirmed eligible foreground usage across all non-study apps.
 * Package transitions preserve the shared total; uncertain focus and long sample
 * gaps are paused/under-counted rather than charging background or downtime.
 */
final class StudyModeUsageAccumulator {
    private static final int DEFAULT_INTERVAL_MINUTES = 2;
    private static final long MAX_SAMPLE_GAP_MS = 4_000L;
    private long accumulatedUsageMs = 0L;
    private long lastSampleElapsedMs = 0L;
    private boolean hasSample = false;
    private int intervalMinutes = DEFAULT_INTERVAL_MINUTES;

    synchronized boolean sample(String packageName, long elapsedRealtimeMs, boolean eligible, int configuredIntervalMinutes) {
        int safeInterval = isValidInterval(configuredIntervalMinutes)
            ? configuredIntervalMinutes : DEFAULT_INTERVAL_MINUTES;
        if (safeInterval != intervalMinutes) {
            setIntervalMinutes(safeInterval);
            return false;
        }
        if (!eligible || !isValidPackageName(packageName) || elapsedRealtimeMs <= 0L) {
            pause();
            return false;
        }
        if (hasSample && elapsedRealtimeMs >= lastSampleElapsedMs) {
            long delta = elapsedRealtimeMs - lastSampleElapsedMs;
            // Both endpoint samples were eligible, so a short app transition
            // is still part of the single global non-study usage total.
            if (delta > 0L && delta <= MAX_SAMPLE_GAP_MS) {
                accumulatedUsageMs = Math.min(Long.MAX_VALUE - delta, accumulatedUsageMs) + delta;
            }
        }
        lastSampleElapsedMs = elapsedRealtimeMs;
        hasSample = true;
        long thresholdMs = intervalMinutes * 60_000L;
        if (accumulatedUsageMs < thresholdMs) return false;
        // Latch the due state until a reminder is actually shown and acknowledged.
        pause();
        return true;
    }

    synchronized void setIntervalMinutes(int value) {
        if (!isValidInterval(value)) throw new IllegalArgumentException("Reminder interval must be an integer from 1 to 10 minutes.");
        intervalMinutes = value;
        resetInterval();
    }
    synchronized void pause() {
        hasSample = false;
        lastSampleElapsedMs = 0L;
    }
    synchronized void resetInterval() { accumulatedUsageMs = 0L; pause(); }
    synchronized void clear() { resetInterval(); }
    synchronized long getAccumulatedUsageMs() { return accumulatedUsageMs; }
    synchronized int getIntervalMinutes() { return intervalMinutes; }
    static boolean isValidInterval(int value) { return value >= 1 && value <= 10; }
    private static boolean isValidPackageName(String value) {
        return value != null && value.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+");
    }
}
