package com.sudhanshu.mathsbj;

import java.util.Arrays;
import java.util.List;
import java.util.Calendar;
import java.util.TimeZone;

public final class UsageEventTimelineTest {
    private static final String APP_A = "com.example.study";
    private static final String APP_B = "com.example.reader";
    private static final String SELF = "com.sudhanshu.mathsbj";

    public static void main(String[] args) {
        sumsSequentialSessionsWithoutDoubleCounting();
        handlesCommonDurationsAndOverlappingApps();
        ignoresDuplicateLifecycleEventsAndRepeatedQueries();
        excludesScreenOffAndLockedIntervals();
        clipsSessionsAtLocalDayBoundaries();
        clipsAcrossDaylightSavingTransitions();
        closesMissingEndEventsAtTheQueryBoundary();
        excludesMathMasterFromDeviceUsage();
        computesSharePercentagesAgainstTheFullTotal();
        System.out.println("Usage aggregation: 9 scenarios passed");
    }

    private static void sumsSequentialSessionsWithoutDoubleCounting() {
        List<UsageEventTimeline.Event> events = Arrays.asList(
            event(0, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(30_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED),
            event(30_000, APP_B, "ReaderActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(330_000, APP_B, "ReaderActivity", UsageEventTimeline.ACTIVITY_PAUSED));
        equal(330_000L, measure(events, 0, 360_000));
    }

    private static void handlesCommonDurationsAndOverlappingApps() {
        long[] durations = { 30_000L, 300_000L, 1_800_000L, 3_600_000L };
        for (long duration : durations) {
            List<UsageEventTimeline.Event> session = Arrays.asList(
                event(0, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
                event(duration, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED));
            equal(duration, measure(session, 0, duration + 1_000L));
        }

        List<UsageEventTimeline.Event> overlapping = Arrays.asList(
            event(0, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(10_000, APP_B, "ReaderActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(30_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED),
            event(40_000, APP_B, "ReaderActivity", UsageEventTimeline.ACTIVITY_PAUSED));
        equal(40_000L, measure(overlapping, 0, 60_000));
    }

    private static void ignoresDuplicateLifecycleEventsAndRepeatedQueries() {
        List<UsageEventTimeline.Event> events = Arrays.asList(
            event(0, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(0, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(30_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED),
            event(30_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED));
        equal(30_000L, measure(events, 0, 120_000));
        equal(30_000L, measure(events, 0, 120_000));
    }

    private static void excludesScreenOffAndLockedIntervals() {
        List<UsageEventTimeline.Event> events = Arrays.asList(
            event(0, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(10_000, "", "", UsageEventTimeline.SCREEN_NON_INTERACTIVE),
            event(100_000, "", "", UsageEventTimeline.SCREEN_INTERACTIVE),
            event(100_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(110_000, "", "", UsageEventTimeline.KEYGUARD_SHOWN),
            event(200_000, "", "", UsageEventTimeline.KEYGUARD_HIDDEN),
            event(200_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(210_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED));
        equal(30_000L, measure(events, 0, 240_000));
    }

    private static void clipsSessionsAtLocalDayBoundaries() {
        long midnight = 86_400_000L;
        List<UsageEventTimeline.Event> events = Arrays.asList(
            event(midnight - 30_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(midnight + 30_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED));
        equal(30_000L, measure(events, 0, midnight));
        equal(30_000L, measure(events, midnight, midnight + 60_000));
    }

    private static void clipsAcrossDaylightSavingTransitions() {
        TimeZone original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));
            Calendar startOfDay = Calendar.getInstance();
            startOfDay.clear();
            startOfDay.set(2024, Calendar.MARCH, 10, 0, 0, 0);
            long start = startOfDay.getTimeInMillis();
            startOfDay.add(Calendar.DAY_OF_YEAR, 1);
            long end = startOfDay.getTimeInMillis();
            equal(23L * 60L * 60L * 1000L, end - start);
            List<UsageEventTimeline.Event> events = Arrays.asList(
                event(start - 1_000L, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED),
                event(end + 1_000L, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_PAUSED));
            equal(end - start, measure(events, start, end));
        } finally {
            TimeZone.setDefault(original);
        }
    }

    private static void closesMissingEndEventsAtTheQueryBoundary() {
        List<UsageEventTimeline.Event> events = Arrays.asList(
            event(1_000, APP_A, "StudyActivity", UsageEventTimeline.ACTIVITY_RESUMED));
        equal(29_000L, measure(events, 0, 30_000));
    }

    private static void excludesMathMasterFromDeviceUsage() {
        List<UsageEventTimeline.Event> events = Arrays.asList(
            event(0, SELF, "MainActivity", UsageEventTimeline.ACTIVITY_RESUMED),
            event(30_000, SELF, "MainActivity", UsageEventTimeline.ACTIVITY_PAUSED));
        equal(0L, measure(events, 0, 60_000));
    }

    private static void computesSharePercentagesAgainstTheFullTotal() {
        long total = 264L * 60_000L;
        close(78.4f, UsageMetrics.percentage(207L * 60_000L, total));
        close(16.3f, UsageMetrics.percentage(43L * 60_000L, total));
        close(4.9f, UsageMetrics.percentage(13L * 60_000L, total));
        close(1f, UsageMetrics.percentage(60_000L, total));
        close(0f, UsageMetrics.percentage(0L, 0L));
    }

    private static UsageEventTimeline.Event event(long at, String pkg, String activity, int type) {
        return new UsageEventTimeline.Event(at, pkg, activity, type);
    }

    private static long measure(List<UsageEventTimeline.Event> events, long start, long end) {
        return UsageEventTimeline.measure(events, start, end, SELF);
    }

    private static void equal(long expected, long actual) {
        if (expected != actual) throw new AssertionError("Expected " + expected + " but was " + actual);
    }

    private static void close(float expected, float actual) {
        if (Math.abs(expected - actual) > 0.1f) throw new AssertionError("Expected " + expected + " but was " + actual);
    }
}
