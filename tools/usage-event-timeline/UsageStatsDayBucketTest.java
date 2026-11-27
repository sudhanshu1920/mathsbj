package com.sudhanshu.mathsbj;

import java.util.Calendar;
import java.util.TimeZone;

public final class UsageStatsDayBucketTest {
    public static void main(String[] args) {
        rejectsYesterdayBucketFromToday();
        keepsTodayBucketWithinToday();
        rejectsTodayBucketFromYesterday();
        assignsBucketsUsingLocalCalendarDaysAcrossDst();
        System.out.println("UsageStats day buckets: 4 scenarios passed");
    }

    private static void rejectsYesterdayBucketFromToday() {
        TimeZone zone = TimeZone.getTimeZone("Asia/Kolkata");
        long yesterday = localMidnight(2026, Calendar.NOVEMBER, 26, zone);
        long today = localMidnight(2026, Calendar.NOVEMBER, 27, zone);
        long nowToday = today + 12L * 60L * 60L * 1000L;
        truth(!UsageStatsDayBucket.belongsToRequestedRange(yesterday, today, nowToday, zone));
    }

    private static void keepsTodayBucketWithinToday() {
        TimeZone zone = TimeZone.getTimeZone("Asia/Kolkata");
        long today = localMidnight(2026, Calendar.NOVEMBER, 27, zone);
        long nowToday = today + 12L * 60L * 60L * 1000L;
        truth(UsageStatsDayBucket.belongsToRequestedRange(today, today, nowToday, zone));
        truth(UsageStatsDayBucket.belongsToRequestedRange(today + 8L * 60L * 60L * 1000L, today, nowToday, zone));
    }

    private static void rejectsTodayBucketFromYesterday() {
        TimeZone zone = TimeZone.getTimeZone("Asia/Kolkata");
        long yesterday = localMidnight(2026, Calendar.NOVEMBER, 26, zone);
        long today = localMidnight(2026, Calendar.NOVEMBER, 27, zone);
        truth(UsageStatsDayBucket.belongsToRequestedRange(yesterday, yesterday, today, zone));
        truth(!UsageStatsDayBucket.belongsToRequestedRange(today, yesterday, today, zone));
    }

    private static void assignsBucketsUsingLocalCalendarDaysAcrossDst() {
        TimeZone zone = TimeZone.getTimeZone("America/New_York");
        long springForwardDay = localMidnight(2026, Calendar.MARCH, 8, zone);
        long nextDay = localMidnight(2026, Calendar.MARCH, 9, zone);
        equal(23L * 60L * 60L * 1000L, nextDay - springForwardDay);
        long end = nextDay + 10L * 60L * 60L * 1000L;
        truth(UsageStatsDayBucket.belongsToRequestedRange(
            springForwardDay + 4L * 60L * 60L * 1000L, springForwardDay, end, zone));
        truth(!UsageStatsDayBucket.belongsToRequestedRange(
            springForwardDay - 1L, springForwardDay, end, zone));
        truth(UsageStatsDayBucket.belongsToRequestedRange(nextDay, springForwardDay, end, zone));
    }

    private static long localMidnight(int year, int month, int day, TimeZone zone) {
        Calendar calendar = Calendar.getInstance(zone);
        calendar.clear();
        calendar.set(year, month, day, 0, 0, 0);
        return calendar.getTimeInMillis();
    }

    private static void truth(boolean value) {
        if (!value) throw new AssertionError("Expected true");
    }

    private static void equal(long expected, long actual) {
        if (expected != actual) throw new AssertionError("Expected " + expected + " but was " + actual);
    }
}
