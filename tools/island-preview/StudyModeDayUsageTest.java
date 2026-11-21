package com.sudhanshu.mathsbj;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

public final class StudyModeDayUsageTest {
    private static final long MIN = 60_000L;
    private static int assertions;

    public static void main(String[] args) {
        testOverlapAndSplitScreen();
        testNullEventsAndOutOfRangeEvents();
        testMissingPauseAndUnmatchedResume();
        testScreenOffAndShutdown();
        testMidnightClip();
        testDstDayLengths();
        testClampsAndEmptyRanges();
        testSpringBoundsAndSettling();
        System.out.println("PASS StudyModeDayUsage + ScreenTimeIslandSpring: " + assertions + " assertions");
    }

    private static void testOverlapAndSplitScreen() {
        long day = 1_700_000_000_000L;
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(e(day, "a", "A1", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 5 * MIN, "a", "A2", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 10 * MIN, "b", "B1", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 15 * MIN, "a", "A1", StudyModeDayUsage.ACTIVITY_PAUSED));
        events.add(e(day + 20 * MIN, "a", "A2", StudyModeDayUsage.ACTIVITY_PAUSED));
        events.add(e(day + 20 * MIN, "b", "B1", StudyModeDayUsage.ACTIVITY_PAUSED));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(day - 60 * MIN,
            day + 30 * MIN, TimeZone.getTimeZone("UTC"), events);
        eq(20 * MIN, result.totalMillis("a"), "overlapping activities in one package are unioned");
        eq(10 * MIN, result.totalMillis("b"), "split-screen app is independently counted");
        assertHourSum(result, "a");
        assertHourSum(result, "b");
    }

    private static void testNullEventsAndOutOfRangeEvents() {
        long day = 1_700_000_000_000L;
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(null);
        events.add(e(day + 50 * MIN, "future", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day, "today", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(day, day + 10 * MIN,
            TimeZone.getTimeZone("UTC"), events);
        eq(10 * MIN, result.totalMillis("today"), "null and future events are safely ignored");
        eq(0L, result.totalMillis("future"), "future event does not affect today's total");
    }

    private static void testMissingPauseAndUnmatchedResume() {
        long day = 1_700_000_000_000L;
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(e(day + 10 * MIN, "app", "Main", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 20 * MIN, "app", "Main", StudyModeDayUsage.ACTIVITY_RESUMED));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(day,
            day + 35 * MIN, TimeZone.getTimeZone("UTC"), events);
        eq(25 * MIN, result.totalMillis("app"), "duplicate resume ignored and unmatched session closes at now");
        check(result.isPackageActiveAtEnd("app"), "unmatched resume is marked active at the end of the query");
        events.add(e(day + 35 * MIN, "app", "Main", StudyModeDayUsage.ACTIVITY_PAUSED));
        result = StudyModeDayUsage.aggregate(day, day + 40 * MIN, TimeZone.getTimeZone("UTC"), events);
        check(!result.isPackageActiveAtEnd("app"), "matched pause clears the active-at-end marker");
    }

    private static void testScreenOffAndShutdown() {
        long day = 1_700_000_000_000L;
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(e(day, "one", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 5 * MIN, "two", "B", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 10 * MIN, "", "", StudyModeDayUsage.SCREEN_NON_INTERACTIVE));
        events.add(e(day + 20 * MIN, "one", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 25 * MIN, "", "", StudyModeDayUsage.DEVICE_SHUTDOWN));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(day,
            day + 30 * MIN, TimeZone.getTimeZone("UTC"), events);
        eq(15 * MIN, result.totalMillis("one"), "screen off and shutdown close open activities");
        eq(5 * MIN, result.totalMillis("two"), "all overlapping apps close on screen-off");
        events.clear();
        events.add(e(day, "one", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(day + 7 * MIN, "", "", StudyModeDayUsage.KEYGUARD_SHOWN));
        result = StudyModeDayUsage.aggregate(day, day + 30 * MIN, TimeZone.getTimeZone("UTC"), events);
        eq(7 * MIN, result.totalMillis("one"), "keyguard closes active sessions");
    }

    private static void testMidnightClip() {
        TimeZone zone = TimeZone.getTimeZone("Asia/Kolkata");
        Calendar start = Calendar.getInstance(zone);
        start.clear(); start.set(2026, Calendar.NOVEMBER, 21, 0, 0, 0);
        long midnight = start.getTimeInMillis();
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(e(midnight - 40 * MIN, "cross", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(midnight,
            midnight + 25 * MIN, zone, events);
        eq(25 * MIN, result.totalMillis("cross"), "session crossing midnight clips to post-midnight part");
    }

    private static void testDstDayLengths() {
        assertDstDay("America/New_York", 2026, Calendar.MARCH, 8, 23 * 60 * MIN);
        assertDstDay("America/New_York", 2026, Calendar.NOVEMBER, 1, 25 * 60 * MIN);
    }

    private static void assertDstDay(String id, int year, int month, int date, long expectedLength) {
        TimeZone zone = TimeZone.getTimeZone(id);
        Calendar start = Calendar.getInstance(zone); start.clear(); start.set(year, month, date, 0, 0, 0);
        Calendar next = (Calendar) start.clone(); next.add(Calendar.DAY_OF_MONTH, 1);
        long from = start.getTimeInMillis(), to = next.getTimeInMillis();
        eq(expectedLength, to - from, "DST local day length " + id + " " + date);
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(e(from, "dst", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        events.add(e(to, "dst", "A", StudyModeDayUsage.ACTIVITY_PAUSED));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(from, to, zone, events);
        eq(expectedLength, result.totalMillis("dst"), "DST full-day activity total");
        assertHourSum(result, "dst");
    }

    private static void testClampsAndEmptyRanges() {
        long day = 1_700_000_000_000L;
        List<StudyModeDayUsage.Event> events = new ArrayList<>();
        events.add(e(day - 10 * MIN, "clamped", "A", StudyModeDayUsage.ACTIVITY_RESUMED));
        StudyModeDayUsage.Result result = StudyModeDayUsage.aggregate(
            day, day - 5 * MIN, TimeZone.getTimeZone("UTC"), events);
        eq(0L, result.totalMillis("clamped"), "query end before day start clamps to an empty range");
        eq(24, result.hourlyMillis("clamped").length, "hour buckets always contain 24 wall-clock slots");
        result = StudyModeDayUsage.aggregate(day, day + 5 * MIN,
            TimeZone.getTimeZone("UTC"), events);
        eq(5 * MIN, result.totalMillis("clamped"), "activity start is clamped to local midnight");
        assertHourSum(result, "clamped");
        eq(0L, result.totalMillis(null), "null package lookup is safely treated as zero");
    }

    private static void testSpringBoundsAndSettling() {
        float maximum = 0f;
        for (int i = 0; i <= 1000; i++) {
            float t = i / 1000f;
            float value = ScreenTimeIslandSpring.valueAt(t, 0.42f, 0.78f);
            check(!Float.isNaN(value) && !Float.isInfinite(value), "spring remains finite");
            maximum = Math.max(maximum, value);
        }
        check(maximum <= 1.08f, "spring overshoot stays below 8 percent");
        check(ScreenTimeIslandSpring.isSettled(0.7f, 0.42f, 0.78f, 0.01f), "spring settles by 700 ms");
        eq(0f, ScreenTimeIslandSpring.valueAt(Float.NaN, 0.42f, 0.78f), 0f, "NaN input fails safe");
        eq(1f, ScreenTimeIslandSpring.valueAt(Float.POSITIVE_INFINITY, 0.42f, 0.78f), 0f, "infinite time is settled");
    }

    private static StudyModeDayUsage.Event e(long t, String p, String c, int type) {
        return new StudyModeDayUsage.Event(t, p, c, type);
    }
    private static void assertHourSum(StudyModeDayUsage.Result result, String pkg) {
        long sum = 0; for (long value : result.hourlyMillis(pkg)) sum += value;
        eq(result.totalMillis(pkg), sum, "hourly buckets sum to total for " + pkg);
    }
    private static void check(boolean ok, String message) {
        assertions++; if (!ok) throw new AssertionError(message);
    }
    private static void eq(long expected, long actual, String message) {
        assertions++; if (expected != actual) throw new AssertionError(message + ": expected " + expected + " got " + actual);
    }
    private static void eq(float expected, float actual, float epsilon, String message) {
        assertions++; if (Math.abs(expected - actual) > epsilon) throw new AssertionError(message + ": expected " + expected + " got " + actual);
    }
}
