package com.sudhanshu.mathsbj;

/**
 * Accounts only monitor-confirmed consecutive samples of the same focused app.
 * Package transitions break the sample anchor but preserve the global interval.
 * Uncertain boundaries are under-counted rather than charging background time.
 */
final class StudyModeUsageAccumulator {
    private static final int DEFAULT_INTERVAL_MINUTES = 2;
    private static final long MAX_SAMPLE_GAP_MS = 4_000L;
    private long accumulatedUsageMs = 0L;
    private long lastSampleElapsedMs = 0L;
    private String lastPackageName = "";
    private boolean hasSample = false;
    private int intervalMinutes = DEFAULT_INTERVAL_MINUTES;

    boolean sample(String packageName, long elapsedRealtimeMs, boolean eligible, int configuredIntervalMinutes) {
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
        if (hasSample && packageName.equals(lastPackageName)
            && elapsedRealtimeMs >= lastSampleElapsedMs) {
            long delta = elapsedRealtimeMs - lastSampleElapsedMs;
            if (delta > 0L && delta <= MAX_SAMPLE_GAP_MS) {
                accumulatedUsageMs = Math.min(Long.MAX_VALUE - delta, accumulatedUsageMs) + delta;
            }
        }
        lastSampleElapsedMs = elapsedRealtimeMs;
        lastPackageName = packageName;
        hasSample = true;
        long thresholdMs = intervalMinutes * 60_000L;
        if (accumulatedUsageMs < thresholdMs) return false;
        resetInterval();
        return true;
    }

    void setIntervalMinutes(int value) {
        if (!isValidInterval(value)) throw new IllegalArgumentException("Reminder interval must be an integer from 1 to 10 minutes.");
        intervalMinutes = value;
        resetInterval();
    }
    void pause() {
        hasSample = false;
        lastSampleElapsedMs = 0L;
        lastPackageName = "";
    }
    void resetInterval() { accumulatedUsageMs = 0L; pause(); }
    void clear() { resetInterval(); }
    long getAccumulatedUsageMs() { return accumulatedUsageMs; }
    int getIntervalMinutes() { return intervalMinutes; }
    static boolean isValidInterval(int value) { return value >= 1 && value <= 10; }
    private static boolean isValidPackageName(String value) {
        return value != null && value.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+");
    }
}
