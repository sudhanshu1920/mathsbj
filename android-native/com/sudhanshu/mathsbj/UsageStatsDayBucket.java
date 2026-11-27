package com.sudhanshu.mathsbj;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * Assigns UsageStats daily buckets to the local calendar day they represent.
 *
 * UsageStatsManager may expand a query to whole aggregation intervals. Never
 * attribute a returned daily bucket to the day that happened to request it;
 * classify it by UsageStats.getFirstTimeStamp() instead.
 */
final class UsageStatsDayBucket {
    private UsageStatsDayBucket() {}

    static long localDayStart(long timestampMillis, TimeZone timeZone) {
        if (timestampMillis <= 0L) return -1L;
        TimeZone zone = timeZone == null ? TimeZone.getDefault() : timeZone;
        Calendar day = Calendar.getInstance(zone);
        day.setTimeInMillis(timestampMillis);
        day.set(Calendar.HOUR_OF_DAY, 0);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);
        return day.getTimeInMillis();
    }

    static boolean belongsToRequestedRange(
        long bucketFirstTimestamp,
        long requestedStartMillis,
        long requestedEndMillis,
        TimeZone timeZone
    ) {
        if (bucketFirstTimestamp <= 0L || requestedStartMillis >= requestedEndMillis) return false;
        long bucketDayStart = localDayStart(bucketFirstTimestamp, timeZone);
        long firstRequestedDay = localDayStart(requestedStartMillis, timeZone);
        return bucketDayStart >= firstRequestedDay && bucketDayStart < requestedEndMillis;
    }
}
