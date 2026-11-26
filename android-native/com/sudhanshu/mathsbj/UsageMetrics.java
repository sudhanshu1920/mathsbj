package com.sudhanshu.mathsbj;

final class UsageMetrics {
    private UsageMetrics() {}

    static float percentage(long usageMillis, long totalUsageMillis) {
        if (usageMillis <= 0L || totalUsageMillis <= 0L) return 0f;
        double value = Math.min(100d, usageMillis * 100d / totalUsageMillis);
        return (float) Math.max(1d, value);
    }

    static float deviceDayProgress(long usageMillis) {
        if (usageMillis <= 0L) return 0f;
        return (float) Math.max(0d, Math.min(1d, usageMillis / 86_400_000d));
    }
}
