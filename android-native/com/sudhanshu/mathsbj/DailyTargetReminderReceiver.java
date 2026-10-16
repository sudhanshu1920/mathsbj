package com.sudhanshu.mathsbj;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Random;
import java.util.TimeZone;

public class DailyTargetReminderReceiver extends BroadcastReceiver {
    public static final String ACTION_FIRE = "com.sudhanshu.mathsbj.DAILY_TARGET_REMINDER";
    private static final String PREFS = "math_master_background_notifications";
    private static final String CHANNEL_ID = "daily_target_reminders";
    private static final int ALARM_REQUEST_CODE = 7401;
    private static final int NOTIFICATION_ID = 7402;
    private static final Random RANDOM = new Random();

    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!ACTION_FIRE.equals(intent == null ? null : intent.getAction())) {
            scheduleNext(context);
            return;
        }

        normalizeDay(prefs);
        String today = todayKey();
        String scheduledDay = intent.getStringExtra("scheduledDay");
        if (scheduledDay == null || !scheduledDay.equals(today)) {
            scheduleNext(context);
            return;
        }

        if (!prefs.getBoolean("enabled", false)
            || !DailyTargetReminderPlugin.hasNotificationPermission(context)) {
            cancelScheduled(context);
            return;
        }

        int targetMinutes = Math.max(1, prefs.getInt("targetMinutes", 5));
        long elapsedSeconds = Math.max(0L, prefs.getLong("elapsedSeconds", 0L));
        if (prefs.getBoolean("completed", false) || elapsedSeconds >= targetMinutes * 60L) {
            prefs.edit().putBoolean("completed", true).apply();
            cancelScheduled(context);
            return;
        }

        Calendar now = Calendar.getInstance();
        int currentMinute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        if (currentMinute > 22 * 60) {
            cancelScheduled(context);
            return;
        }

        int remainingMinutes = (int) Math.max(1L, (long) Math.ceil((targetMinutes * 60L - elapsedSeconds) / 60.0));
        showReminder(context, prefs, remainingMinutes);
        scheduleNext(context);
    }

    public static void scheduleNext(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        normalizeDay(prefs);
        cancelScheduled(context);

        if (!prefs.getBoolean("enabled", false)
            || !DailyTargetReminderPlugin.hasNotificationPermission(context)) return;

        int targetMinutes = Math.max(1, prefs.getInt("targetMinutes", 5));
        long elapsedSeconds = Math.max(0L, prefs.getLong("elapsedSeconds", 0L));
        if (prefs.getBoolean("completed", false) || elapsedSeconds >= targetMinutes * 60L) {
            prefs.edit().putBoolean("completed", true).apply();
            return;
        }

        JSONArray slots = parseArray(prefs.getString("scheduleMinutesJson", "[]"));
        if (slots.length() == 0) {
            slots = new JSONArray();
            slots.put(12 * 60);
            slots.put(14 * 60);
            slots.put(16 * 60);
            slots.put(18 * 60);
            slots.put(20 * 60);
            slots.put(22 * 60);
        }

        Calendar now = Calendar.getInstance();
        long nowMillis = System.currentTimeMillis();
        for (int i = 0; i < slots.length(); i++) {
            int minuteOfDay = slots.optInt(i, -1);
            if (minuteOfDay < 12 * 60 || minuteOfDay > 22 * 60) continue;

            Calendar candidate = (Calendar) now.clone();
            candidate.set(Calendar.HOUR_OF_DAY, minuteOfDay / 60);
            candidate.set(Calendar.MINUTE, minuteOfDay % 60);
            candidate.set(Calendar.SECOND, 0);
            candidate.set(Calendar.MILLISECOND, 0);
            long triggerAt = candidate.getTimeInMillis();
            if (triggerAt <= nowMillis + 5000L) continue;

            Intent alarmIntent = new Intent(context, DailyTargetReminderReceiver.class);
            alarmIntent.setAction(ACTION_FIRE);
            alarmIntent.putExtra("scheduledMinute", minuteOfDay);
            alarmIntent.putExtra("scheduledDay", todayKey());
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Inexact allow-while-idle alarms need no special exact-alarm permission.
                // Android/OEM power policies may still delay delivery.
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            }
            return;
        }
    }

    public static void cancelScheduled(Context context) {
        Intent alarmIntent = new Intent(context, DailyTargetReminderReceiver.class);
        alarmIntent.setAction(ACTION_FIRE);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            alarmIntent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent == null) return;
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();
    }

    private static void normalizeDay(SharedPreferences prefs) {
        String today = todayKey();
        if (!today.equals(prefs.getString("dayKey", ""))) {
            prefs.edit()
                .putString("dayKey", today)
                .putLong("elapsedSeconds", 0L)
                .putBoolean("completed", false)
                .apply();
        }
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static JSONArray parseArray(String value) {
        try { return new JSONArray(value); }
        catch (JSONException ignored) { return new JSONArray(); }
    }

    private static void showReminder(Context context, SharedPreferences prefs, int remainingMinutes) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Daily Target Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Study reminders while today's target is incomplete.");
            manager.createNotificationChannel(channel);
        }

        boolean useMarathi = RANDOM.nextBoolean();
        String language = useMarathi ? "mr" : "hi";
        String title = useMarathi ? "🎯 आजचं लक्ष्य बाकी आहे!" : "🎯 आज का लक्ष्य बाकी है!";
        String source = prefs.getString(useMarathi ? "marathiMessagesJson" : "hindiMessagesJson", "[]");
        JSONArray messages = parseArray(source);
        String previous = prefs.getString("lastMessageId", "");
        String body = null;
        String selectedId = "";
        for (int attempt = 0; attempt < 8 && messages.length() > 0; attempt++) {
            int index = RANDOM.nextInt(messages.length());
            String candidate = messages.optString(index, "");
            String candidateId = language + ":" + index;
            if (candidate.isEmpty() || (messages.length() > 1 && candidateId.equals(previous))) continue;
            body = String.format(Locale.getDefault(), candidate, remainingMinutes);
            selectedId = candidateId;
            break;
        }
        if (body == null) {
            body = useMarathi
                ? "आजचं लक्ष्य अजून बाकी आहे. पुन्हा सुरू करूया!"
                : "आज का लक्ष्य अभी बाकी है। फिर से शुरू करें!";
            selectedId = language + ":fallback";
        }
        prefs.edit().putString("lastMessageId", selectedId).apply();

        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setAction("com.sudhanshu.mathsbj.OPEN_DAILY_TARGET_REMINDER");
        openApp.putExtra("mathmaster_notification_action", "study-reminder");
        openApp.putExtra("mathmaster_notification_day", todayKey());
        openApp.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(context, CHANNEL_ID)
            : new Notification.Builder(context);
        Notification notification = builder
            .setSmallIcon(context.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setWhen(System.currentTimeMillis())
            .build();
        manager.notify(NOTIFICATION_ID, notification);
    }
}
