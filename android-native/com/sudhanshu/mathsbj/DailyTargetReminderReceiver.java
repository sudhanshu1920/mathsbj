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
import android.util.Log;

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
    private static final String TAG = "MathAppReminders";
    private static final int ALARM_REQUEST_CODE = 7401;
    private static final int NOTIFICATION_ID = 7402;
    private static final int REMINDER_POLICY_VERSION = 2;
    private static final int[] DEFAULT_REMINDER_MINUTES = {
        720, 840, 960, 1080, 1140, 1185, 1230, 1260, 1290, 1310, 1320
    };
    private static final String DEFAULT_REMINDER_SCHEDULE_JSON =
        "[720,840,960,1080,1140,1185,1230,1260,1290,1310,1320]";
    private static final Random RANDOM = new Random();

    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!ACTION_FIRE.equals(intent == null ? null : intent.getAction())) {
            scheduleNext(context);
            return;
        }

        normalizeDay(prefs);
        ensureCurrentSchedulePolicy(prefs);
        Log.i(TAG, "Alarm received; validating current local target state.");
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
            Log.i(TAG, "Reminder skipped because the daily target is complete.");
            scheduleNext(context);
            return;
        }

        Calendar now = Calendar.getInstance();
        int currentMinute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        if (currentMinute > 22 * 60) {
            // Respect the 10 PM cutoff today while retaining tomorrow's noon alarm.
            scheduleNext(context);
            return;
        }

        JSONArray slots = parseArray(prefs.getString("scheduleMinutesJson", DEFAULT_REMINDER_SCHEDULE_JSON));
        int stageIndex = getStageIndex(slots, currentMinute);
        if (stageIndex < 0) {
            // An alarm delayed past today's 10 PM cutoff must not post a stale reminder.
            scheduleNext(context);
            return;
        }

        int remainingMinutes = (int) Math.max(1L, (long) Math.ceil((targetMinutes * 60L - elapsedSeconds) / 60.0));
        int minutesToCutoff = getMinutesUntilCutoff();
        boolean posted = showReminder(context, prefs, remainingMinutes, stageIndex, minutesToCutoff);
        if (posted) {
            Log.i(TAG, "Reminder posted to NotificationManager; actual device presentation is not observable here.");
        } else {
            Log.w(TAG, "Reminder not posted because Android notifications or its channel are disabled.");
        }
        scheduleNext(context);
    }

    public static boolean scheduleNext(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        normalizeDay(prefs);
        ensureCurrentSchedulePolicy(prefs);
        cancelScheduled(context);

        if (!prefs.getBoolean("enabled", false)
            || !DailyTargetReminderPlugin.hasNotificationPermission(context)) {
            Log.i(TAG, "No reminder scheduled because opt-in is disabled or notification permission is unavailable.");
            return false;
        }

        int targetMinutes = Math.max(1, prefs.getInt("targetMinutes", 5));
        long elapsedSeconds = Math.max(0L, prefs.getLong("elapsedSeconds", 0L));

        JSONArray slots = parseArray(prefs.getString("scheduleMinutesJson", DEFAULT_REMINDER_SCHEDULE_JSON));

        if (prefs.getBoolean("completed", false) || elapsedSeconds >= targetMinutes * 60L) {
            prefs.edit().putBoolean("completed", true).apply();
            return scheduleTomorrow(context, slots);
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
            if (triggerAt <= nowMillis) continue;

            return scheduleAlarm(context, candidate, minuteOfDay, todayKey());
        }

        // No eligible slot remains today; retain tomorrow's first reminder.
        return scheduleTomorrow(context, slots);
    }

    private static boolean scheduleTomorrow(Context context, JSONArray slots) {
        Calendar now = Calendar.getInstance();
        int firstMinute = -1;
        for (int i = 0; i < slots.length(); i++) {
            int candidateMinute = slots.optInt(i, -1);
            if (candidateMinute < 12 * 60 || candidateMinute > 22 * 60) continue;
            if (firstMinute < 0 || candidateMinute < firstMinute) firstMinute = candidateMinute;
        }
        if (firstMinute < 12 * 60 || firstMinute > 22 * 60) return false;

        Calendar tomorrow = (Calendar) now.clone();
        tomorrow.add(Calendar.DAY_OF_YEAR, 1);
        tomorrow.set(Calendar.HOUR_OF_DAY, firstMinute / 60);
        tomorrow.set(Calendar.MINUTE, firstMinute % 60);
        tomorrow.set(Calendar.SECOND, 0);
        tomorrow.set(Calendar.MILLISECOND, 0);
        return scheduleAlarm(context, tomorrow, firstMinute, todayKey(tomorrow.getTime()));
    }

    private static boolean scheduleAlarm(Context context, Calendar candidate, int minuteOfDay, String scheduledDay) {
        Intent alarmIntent = new Intent(context, DailyTargetReminderReceiver.class);
        alarmIntent.setAction(ACTION_FIRE);
        alarmIntent.putExtra("scheduledMinute", minuteOfDay);
        alarmIntent.putExtra("scheduledDay", scheduledDay);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.w(TAG, "Alarm scheduling failed: Android AlarmManager is unavailable.");
            return false;
        }
        long triggerAt = candidate.getTimeInMillis();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Inexact allow-while-idle alarms need no special exact-alarm permission.
                // Android/OEM power policies may still delay delivery.
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            }
            Log.i(TAG, "Next local reminder alarm scheduled (slot " + minuteOfDay + ", day " + scheduledDay + ").");
            return true;
        } catch (RuntimeException error) {
            Log.w(TAG, "Alarm scheduling failed because the Android platform rejected the request.", error);
            return false;
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
        if (pendingIntent == null) {
            Log.i(TAG, "No pending reminder alarm existed to cancel.");
            return;
        }
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();
        Log.i(TAG, "Pending local reminder alarm cancelled.");
    }

    private static boolean matchesCurrentSchedule(JSONArray slots) {
        if (slots.length() != DEFAULT_REMINDER_MINUTES.length) return false;
        for (int index = 0; index < DEFAULT_REMINDER_MINUTES.length; index++) {
            if (slots.optInt(index, -1) != DEFAULT_REMINDER_MINUTES[index]) return false;
        }
        return true;
    }

    /**
     * On package replacement, SharedPreferences survive while the old six-slot
     * schedule would otherwise survive too. Migrate the policy before arming an
     * alarm so a never-opened upgraded app still uses the current 11-stage day.
     */
    private static void ensureCurrentSchedulePolicy(SharedPreferences prefs) {
        JSONArray current = parseArray(prefs.getString("scheduleMinutesJson", "[]"));
        if (prefs.getInt("schedulePolicyVersion", 0) == REMINDER_POLICY_VERSION
            && matchesCurrentSchedule(current)) {
            return;
        }
        prefs.edit()
            .putInt("schedulePolicyVersion", REMINDER_POLICY_VERSION)
            .putString("scheduleMinutesJson", DEFAULT_REMINDER_SCHEDULE_JSON)
            .apply();
        Log.i(TAG, "Migrated persisted daily-target reminders to the current 11-stage schedule.");
    }

    private static int getStageIndex(JSONArray slots, int currentMinute) {
        if (slots.length() == 0 || currentMinute < slots.optInt(0, 720)
            || currentMinute > slots.optInt(slots.length() - 1, 1320)) {
            return -1;
        }
        int stageIndex = -1;
        for (int index = 0; index < slots.length(); index++) {
            if (slots.optInt(index, -1) > currentMinute) break;
            stageIndex = index;
        }
        return stageIndex;
    }

    private static int getMinutesUntilCutoff() {
        Calendar cutoff = Calendar.getInstance();
        cutoff.set(Calendar.HOUR_OF_DAY, 22);
        cutoff.set(Calendar.MINUTE, 0);
        cutoff.set(Calendar.SECOND, 0);
        cutoff.set(Calendar.MILLISECOND, 0);
        long remainingMillis = cutoff.getTimeInMillis() - System.currentTimeMillis();
        return (int) Math.max(0L, (long) Math.ceil(remainingMillis / 60000.0));
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
        return todayKey(new Date());
    }

    private static String todayKey(Date date) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date);
    }

    private static JSONArray parseArray(String value) {
        try { return new JSONArray(value); }
        catch (JSONException ignored) { return new JSONArray(); }
    }

    private static JSONArray getFallbackMessages(int stageIndex, boolean marathi) {
        String[][] fallback = marathi ? new String[][] {
            {
                "चॅम्पियन, आजचं टार्गेट सुरू करूया का? अभ्यासाचे %1$d मिनिटं बाकी 💪",
                "नवीन दिवस, नवीन संधी! अजून %1$d मिनिटांचा अभ्यास 🚀"
            },
            {
                "दुपार झाली! टार्गेट झोपलंय की तू? %1$d मिनिटं बाकी 😂",
                "फोनला आराम मिळाला, आता मेंदूची पाळी! %1$d मिनिटं 😎"
            },
            {
                "टार्गेटशी एवढी ओळख नको! %1$d मिनिटं अभ्यास करूया 😂",
                "टार्गेट रात्री स्वप्नात येईल—अजून %1$d मिनिटं 😏"
            },
            {
                "संध्याकाळ झाली! बहाणे थांबवून %1$d मिनिटं पूर्ण करूया 😏",
                "अभ्यास उद्यावर ढकलू नकोस—%1$d मिनिटं बाकी 😂"
            },
            {
                "आता वेळ वाया नको! %1$d मिनिटांचा अभ्यास बाकी 🔥",
                "आजचा दिवस हातात आहे—%1$d मिनिटं पूर्ण करूया 💪"
            },
            {
                "वेळ पुढे जातोय! %1$d मिनिटं अभ्यास बाकी 🔥",
                "लक्ष्य जवळ आणूया—अजून %1$d मिनिटं 💪"
            },
            {
                "रात्रीची तयारी, टार्गेट अजून बाकी? %1$d मिनिटं 😂",
                "आजच टार्गेटला निरोप देऊया—%1$d मिनिटं 😏"
            },
            {
                "आता लक्ष्यावर फोकस! %1$d मिनिटं बाकी ⏳",
                "दिवस संपण्याआधी एक छोटीशी जिंक मिळव—%1$d मिनिटं 💪"
            },
            {
                "फायनल राऊंड! %1$d मिनिटं पूर्ण करून आजचा दिवस जिंक 🔥",
                "आजचं टार्गेट आजच—अजून %1$d मिनिटं 😎"
            },
            {
                "रात्री 10 वाजेपर्यंत %2$d मिनिटं! अभ्यासाचे %1$d मिनिटं बाकी ⏳",
                "10 वाजेपर्यंत फक्त %2$d मिनिटं—शक्य तितकं पूर्ण करूया 🚀 (%1$d मिनिटं)"
            },
            {
                "आजचा शेवटचा रिमाइंडर! अभ्यासाचे %1$d मिनिटं बाकी 💪",
                "अंतिम चेक-इन—शक्य तितकं लक्ष्य पूर्ण करूया 🌟 (%1$d मिनिटं)"
            }
        } : new String[][] {
            {
                "चैंपियन, आज का लक्ष्य शुरू करें? पढ़ाई के %1$d मिनट बाकी 💪",
                "नया दिन, नया मौका! %1$d मिनट पढ़ाई करें 🚀"
            },
            {
                "दोपहर हो गई! टारगेट सो रहा है क्या? %1$d मिनट बाकी 😂",
                "मोबाइल को आराम, अब दिमाग की बारी! %1$d मिनट 😎"
            },
            {
                "टारगेट से इतनी दोस्ती क्यों? %1$d मिनट पढ़ाई करें 😂",
                "टारगेट रात को सपने में आएगा—%1$d मिनट बाकी 😏"
            },
            {
                "शाम हो गई! बहाने बंद, %1$d मिनट पढ़ाई करें 😏",
                "आज का काम कल पर न डालें—%1$d मिनट बाकी 😂"
            },
            {
                "अब वक्त बर्बाद नहीं! %1$d मिनट पढ़ाई बाकी 🔥",
                "दिन अभी हाथ में है—%1$d मिनट पूरे करें 💪"
            },
            {
                "वक्त निकल रहा है! %1$d मिनट पढ़ाई बाकी 🔥",
                "लक्ष्य करीब लाएं—अभी %1$d मिनट 💪"
            },
            {
                "रात होने वाली है, टारगेट बाकी? %1$d मिनट 😂",
                "आज ही टारगेट खत्म करें—%1$d मिनट बाकी 😏"
            },
            {
                "अब लक्ष्य पर फोकस करें! %1$d मिनट बाकी ⏳",
                "दिन खत्म होने से पहले एक जीत दिला दें—%1$d मिनट 💪"
            },
            {
                "फाइनल राउंड! %1$d मिनट पूरे करके आज जीतें 🔥",
                "आज का टारगेट आज ही—%1$d मिनट बाकी 😎"
            },
            {
                "रात 10 बजे तक %2$d मिनट! पढ़ाई के %1$d मिनट बाकी ⏳",
                "10 बजे तक सिर्फ %2$d मिनट—जितना हो सके पूरा करें 🚀 (%1$d मिनट)"
            },
            {
                "आज का आखिरी रिमाइंडर! पढ़ाई के %1$d मिनट बाकी 💪",
                "अंतिम चेक-इन—जितना हो सके लक्ष्य पूरा करें 🌟 (%1$d मिनट)"
            }
        };
        JSONArray result = new JSONArray();
        int safeStage = Math.max(0, Math.min(stageIndex, fallback.length - 1));
        for (String message : fallback[safeStage]) result.put(message);
        return result;
    }

    private static boolean showReminder(
        Context context,
        SharedPreferences prefs,
        int remainingMinutes,
        int stageIndex,
        int minutesToCutoff
    ) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            Log.w(TAG, "Reminder not posted because NotificationManager is unavailable.");
            return false;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Daily Target Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Study reminders while today's target is incomplete.");
            manager.createNotificationChannel(channel);
        }

        if (!androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            Log.w(TAG, "Reminder not posted because app-level Android notifications are disabled.");
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
            if (existing != null && existing.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                Log.w(TAG, "Reminder not posted because its Android notification channel is disabled.");
                return false;
            }
        }

        boolean useMarathi = RANDOM.nextBoolean();
        String language = useMarathi ? "mr" : "hi";
        String title;
        if (stageIndex >= 8) {
            title = useMarathi ? "⏳ आजची शेवटची फेरी!" : "⏳ आज का आखिरी दौर!";
        } else if (stageIndex >= 4) {
            title = useMarathi ? "🔥 आजचं टार्गेट पूर्ण करूया!" : "🔥 आज का टारगेट पूरा करें!";
        } else {
            title = useMarathi ? "🎯 आजचं लक्ष्य सुरू करूया!" : "🎯 आज का लक्ष्य शुरू करें!";
        }

        String source = prefs.getString(useMarathi ? "marathiMessagesJson" : "hindiMessagesJson", "[]");
        JSONArray allStages = parseArray(source);
        JSONArray messages = allStages.optJSONArray(stageIndex);
        if (messages == null || messages.length() == 0) {
            // The first alarm after upgrading may run before the WebView syncs
            // the new nested message pools. Use a local stage-aware fallback.
            messages = getFallbackMessages(stageIndex, useMarathi);
        }

        String previous = prefs.getString("lastMessageId", "");
        String previousText = prefs.getString("lastMessageText", "");
        String body = null;
        String selectedId = "";
        for (int attempt = 0; attempt < 12 && messages.length() > 0; attempt++) {
            int index = RANDOM.nextInt(messages.length());
            String candidate = messages.optString(index, "");
            String candidateId = language + ":" + stageIndex + ":" + index;
            if (candidate.isEmpty() || candidate.equals(previousText) || candidateId.equals(previous)) continue;
            body = String.format(Locale.getDefault(), candidate, remainingMinutes, minutesToCutoff);
            selectedId = candidateId;
            prefs.edit().putString("lastMessageText", candidate).apply();
            break;
        }
        if (body == null) {
            for (int index = 0; index < messages.length(); index++) {
                String candidate = messages.optString(index, "");
                if (candidate.isEmpty() || candidate.equals(previousText)) continue;
                body = String.format(Locale.getDefault(), candidate, remainingMinutes, minutesToCutoff);
                selectedId = language + ":" + stageIndex + ":" + index;
                prefs.edit().putString("lastMessageText", candidate).apply();
                break;
            }
        }
        if (body == null) {
            String fallback = useMarathi
                ? "आजचं लक्ष्य अजून बाकी आहे. पुन्हा सुरू करूया! अभ्यासाचे %1$d मिनिटं बाकी."
                : "आज का लक्ष्य अभी बाकी है। फिर से शुरू करें! पढ़ाई के %1$d मिनट बाकी।";
            body = String.format(Locale.getDefault(), fallback, remainingMinutes, minutesToCutoff);
            selectedId = language + ":" + stageIndex + ":fallback";
            prefs.edit().putString("lastMessageText", fallback).apply();
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
        return true;
    }
}
