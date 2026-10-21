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
    public static final int REMINDER_POLICY_VERSION = 3;
    private static final int[] DEFAULT_REMINDER_MINUTES = {
        540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140,
        1185, 1230, 1260, 1290, 1310, 1320
    };
    private static final String DEFAULT_REMINDER_SCHEDULE_JSON =
        "[540,600,660,720,780,840,900,960,1020,1080,1140,1185,1230,1260,1290,1310,1320]";
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
            cancelVisibleReminder(context);
            return;
        }

        int targetMinutes = Math.max(1, prefs.getInt("targetMinutes", 5));
        long elapsedSeconds = Math.max(0L, prefs.getLong("elapsedSeconds", 0L));
        if (elapsedSeconds >= targetMinutes * 60L) {
            prefs.edit().putBoolean("completed", true).apply();
            cancelVisibleReminder(context);
            Log.i(TAG, "Reminder skipped because the daily target is complete.");
            scheduleNext(context);
            return;
        }

        Calendar now = Calendar.getInstance();
        int currentMinute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        if (currentMinute > 22 * 60) {
            // Respect the 10 PM cutoff today while retaining tomorrow's 9 AM alarm.
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
        int completedMinutes = (int) Math.min((long) targetMinutes, elapsedSeconds / 60L);
        int completionPercentage = (int) Math.min(
            99L,
            Math.round(elapsedSeconds * 100.0 / (targetMinutes * 60L))
        );
        boolean posted = showReminder(
            context, prefs, remainingMinutes, stageIndex, minutesToCutoff,
            completedMinutes, targetMinutes, completionPercentage
        );
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

        if (elapsedSeconds >= targetMinutes * 60L) {
            prefs.edit().putBoolean("completed", true).apply();
            cancelVisibleReminder(context);
            return scheduleTomorrow(context, slots);
        }

        Calendar now = Calendar.getInstance();
        long nowMillis = System.currentTimeMillis();
        for (int i = 0; i < slots.length(); i++) {
            int minuteOfDay = slots.optInt(i, -1);
            if (minuteOfDay < 9 * 60 || minuteOfDay > 22 * 60) continue;

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
            if (candidateMinute < 9 * 60 || candidateMinute > 22 * 60) continue;
            if (firstMinute < 0 || candidateMinute < firstMinute) firstMinute = candidateMinute;
        }
        if (firstMinute < 9 * 60 || firstMinute > 22 * 60) return false;

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

    /** Remove the currently visible reminder when the user finishes the target or opts out. */
    public static void cancelVisibleReminder(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
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
     * alarm so a never-opened upgraded app still uses the current 17-stage day.
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
            // Old message pools use a different stage count/order. Clear them
            // so the stage-correct offline fallback runs until the WebView syncs
            // the upgraded full pools; never label a morning alarm with an old noon message.
            .putString("marathiMessagesJson", "[]")
            .putString("hindiMessagesJson", "[]")
            .apply();
        Log.i(TAG, "Migrated persisted daily-target reminders to the current 17-stage schedule.");
    }

    private static int getStageIndex(JSONArray slots, int currentMinute) {
        if (slots.length() == 0 || currentMinute < slots.optInt(0, 540)
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
            { "उठ चॅम्पियन! आजचं टार्गेट तुझी वाट पाहतंय! अजून %1$d मिनिटं 💪", "आज बहाणे नाहीत—फक्त प्रगती! उरलेले %1$d मिनिटं सुरू कर 🔥" },
            { "फोन जागा आहे, इंटरनेट जागं आहे... आता अभ्यासालाही उठव 😂 अजून %1$d मिनिटं", "चॅम्पियन, टार्गेटला सुप्रभात म्हणालास? आता कामालाही सुरुवात कर 😏 %1$d मिनिटं बाकी" },
            { "अकरा वाजले! टार्गेटकडे फक्त बघून ते पूर्ण होत नाही जनाब 😏 %1$d मिनिटं बाकी", "चित्रं पाहण्याचा पहिला टप्पा झाला असेल; आता अभ्यासाचा टप्पा सुरू कर 😂 %1$d मिनिटं बाकी" },
            { "जेवणाची वेळ झाली; पण टार्गेटने अजून नाश्ताही केलेला नाही 😂 %1$d मिनिटं बाकी", "जेवणाचा विराम ठीक आहे बॉस, अभ्यासालाही आज हजेरी लावू दे 😎 %1$d मिनिटं बाकी" },
            { "आजचा अभ्यास उद्यावर पाठवायचं कुरिअर रद्द कर 😂 अजून %1$d मिनिटं", "टार्गेट आणि तुझ्यात एवढं अंतर कशाला? छोटा फेरा सुरू कर 🚀 %1$d मिनिटं" },
            { "दहा मिनिटं लक्ष दे; बहाण्यांनाही थोडा आराम दे 😂 अजून %1$d मिनिटं", "छोटी सुरुवात कर—मोठं टार्गेटही पावलांनीच पूर्ण होतं 💪 %1$d मिनिटं" },
            { "तीन वाजले! आता फक्त वेळ बघू नको, एक प्रश्नही सोडव ⏳ %1$d मिनिटं बाकी", "मोबाइल खाली, लक्ष वर! पुढची दहा मिनिटं अभ्यासाला दे 🔥 %1$d मिनिटं" },
            { "चॅम्पियन, दिवस अजून हातात आहे! उरलेलं टार्गेट गाठूया 🔥 %1$d मिनिटं", "प्रेरणेची वाट नको; काम सुरू कर, जोश मागून येईल 💪 %1$d मिनिटं" },
            { "बहाण्यांचा अभ्यास झाला असेल तर आता पुस्तकाचा धडा उघड 😂 %1$d मिनिटं", "पाच वाजले बॉस! बहाण्यांची पाळी संपली, अभ्यासाची सुरू 😏 %1$d मिनिटं" },
            { "संध्याकाळ झाली बॉस! आजच्या टार्गेटची तपासणी करूया ⏳ %1$d मिनिटं", "आजची मेहनत उद्याच्या आत्मविश्वासाला बोनस देईल 😎 %1$d मिनिटं बाकी" },
            { "सात वाजले! आजचं काम आजच पूर्ण करण्याची वेळ आली 🔥 %1$d मिनिटं", "टार्गेट अजून बाकी? चल, आता कृती सुरू करूया 💪 %1$d मिनिटं" },
            { "साडेसात! आजच्या टार्गेटला उद्याचा पाहुणा बनवू नकोस 😏 %1$d मिनिटं", "थोडं लक्ष, थोडी मेहनत—आजचा शेवट दमदार करूया 🔥 %1$d मिनिटं" },
            { "रात्र येतेय महाराज! टार्गेटला अजून घरी पाठवायचं आहे 😂 %1$d मिनिटं", "आठ वाजून तीस! बहाणे बाजूला ठेव आणि अभ्यास सुरू कर 😎 %1$d मिनिटं" },
            { "नऊ वाजले! आता लक्ष विचलित नको—उरलेलं टार्गेट तपास ⏳ %1$d मिनिटं", "वेळ कमी होतोय; शक्य तितका अभ्यास आत्ताच पूर्ण कर 🔥 %1$d मिनिटं" },
            { "शेवटचा फेरा सुरू! आजची छोटी जिंक स्वतःला दे 🔥 %1$d मिनिटं", "साडेनऊ वाजले—आजचा शेवट दमदार कर, परिपूर्ण असणं गरजेचं नाही 💪 %1$d मिनिटं" },
            { "शेवटची 10 मिनिटं! अजून %1$d मिनिटांचा अभ्यास; दहा वाजेपर्यंत %2$d मिनिटं ⏳", "अंतिम काउंटडाउन! घड्याळात %2$d मिनिटं—शक्य तितकं टार्गेट पूर्ण कर 🔥 अजून %1$d मिनिटं" },
            { "आजचा शेवटचा रिमाइंडर! जमलं ते कौतुकास्पद—उद्याची सुरुवात नव्या जोमाने 🌙 अजून %1$d मिनिटं", "दहा वाजले—आजचे रिमाइंडर इथे थांबतात. उद्या पुन्हा नवी सुरुवात 💪 %1$d मिनिटं बाकी" },
        } : new String[][] {
            { "उठो चैंपियन! आज का टारगेट तुम्हारा इंतज़ार कर रहा है 🔥 अभी %1$d मिनट बाकी", "आज बहाने नहीं—सिर्फ़ प्रगति! बचे हुए %1$d मिनट शुरू कीजिए 💪" },
            { "मोबाइल जाग रहा है, इंटरनेट भी चालू है... अब पढ़ाई को जगाइए 😂 %1$d मिनट बाकी", "चैंपियन, टारगेट को सुप्रभात कहा? अब काम भी शुरू करिए 😏 %1$d मिनट बाकी" },
            { "ग्यारह बज गए! टारगेट को देखते रहने से वो पूरा नहीं होगा जनाब 😏 %1$d मिनट बाकी", "चित्र देखने का पहला दौर खत्म? अब पढ़ाई का दौर शुरू करिए 😂 %1$d मिनट बाकी" },
            { "खाने का वक्त हो गया, लेकिन टारगेट ने अभी नाश्ता भी नहीं किया 😂 %1$d मिनट बाकी", "खाने का विराम ठीक है जनाब, पढ़ाई को भी आज हाज़िरी लगाने दीजिए 😎 %1$d मिनट बाकी" },
            { "आज की पढ़ाई कल भेजने वाला कुरिअर रद्द कर दीजिए 😂 %1$d मिनट बाकी", "टारगेट और आपके बीच इतना फासला क्यों? छोटा दौर शुरू करें 🚀 %1$d मिनट बाकी" },
            { "दस मिनट ध्यान लगाइए; बहानों को भी थोड़ा आराम दीजिए 😂 %1$d मिनट बाकी", "छोटी शुरुआत करिए—बड़ा टारगेट भी कदमों से पूरा होता है 💪 %1$d मिनट बाकी" },
            { "तीन बज गए! सिर्फ़ घड़ी मत देखिए, एक सवाल भी हल करिए ⏳ %1$d मिनट बाकी", "मोबाइल नीचे, ध्यान ऊपर! अगले दस मिनट पढ़ाई को दीजिए 🔥 %1$d मिनट बाकी" },
            { "चैंपियन, दिन अभी हाथ में है! बाकी टारगेट पूरा करें 🔥 %1$d मिनट बाकी", "प्रेरणा का इंतज़ार मत कीजिए; काम शुरू करें, जोश बाद में आएगा 💪 %1$d मिनट बाकी" },
            { "बहानों का पाठ पूरा हो गया हो तो पढ़ाई का अध्याय खोलिए 😂 %1$d मिनट बाकी", "पाँच बज गए जनाब! बहानों की पारी खत्म, पढ़ाई की शुरू 😏 %1$d मिनट बाकी" },
            { "शाम हो गई जनाब! आज के टारगेट का हिसाब देख लें ⏳ %1$d मिनट बाकी", "आज की मेहनत कल के आत्मविश्वास को बोनस देगी 😎 %1$d मिनट बाकी" },
            { "सात बज गए! आज का काम आज ही पूरा करने का वक्त है 🔥 %1$d मिनट बाकी", "टारगेट बाकी है? चलिए, अब काम शुरू करते हैं 💪 %1$d मिनट बाकी" },
            { "साढ़े सात! आज के टारगेट को कल का मेहमान मत बनाइए 😏 %1$d मिनट बाकी", "थोड़ा ध्यान, थोड़ी मेहनत—आज का अंत दमदार करें 🔥 %1$d मिनट बाकी" },
            { "रात होने लगी जनाब! टारगेट को आज ही विदा करना है 😂 %1$d मिनट बाकी", "आठ बजकर तीस मिनट! बहाने किनारे रखिए, पढ़ाई शुरू 😎 %1$d मिनट बाकी" },
            { "नौ बज गए! ध्यान भटकने न दें—बाकी लक्ष्य देख लें ⏳ %1$d मिनट बाकी", "वक्त कम हो रहा है; जितनी पढ़ाई हो सके अभी पूरी करें 🔥 %1$d मिनट बाकी" },
            { "आखिरी दौर शुरू! आज खुद को एक छोटी जीत दीजिए 🔥 %1$d मिनट बाकी", "साढ़े नौ बज गए—आज का अंत दमदार करें, परिपूर्ण होना ज़रूरी नहीं 💪 %1$d मिनट बाकी" },
            { "आखिरी 10 मिनट! पढ़ाई के %1$d मिनट बाकी; दस बजे तक %2$d मिनट ⏳", "अंतिम काउंटडाउन! घड़ी में %2$d मिनट—जितना हो सके पूरा करें 🔥 %1$d मिनट बाकी" },
            { "आज का आखिरी रिमाइंडर! जो हुआ उसकी तारीफ़ करें; कल फिर नई शुरुआत 🌙 %1$d मिनट बाकी", "दस बजे हो गए—आज के रिमाइंडर यहीं रुकेंगे। कल नई शुरुआत 💪 %1$d मिनट बाकी" },
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
        int minutesToCutoff,
        int completedMinutes,
        int targetMinutes,
        int completionPercentage
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
        if (stageIndex >= 13) {
            title = useMarathi ? "⏳ आजची शेवटची फेरी!" : "⏳ आज का आखिरी दौर!";
        } else if (stageIndex >= 7) {
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
            body = String.format(Locale.getDefault(), candidate, remainingMinutes, minutesToCutoff, completedMinutes, targetMinutes, completionPercentage);
            selectedId = candidateId;
            prefs.edit().putString("lastMessageText", candidate).apply();
            break;
        }
        if (body == null) {
            for (int index = 0; index < messages.length(); index++) {
                String candidate = messages.optString(index, "");
                if (candidate.isEmpty() || candidate.equals(previousText)) continue;
                body = String.format(Locale.getDefault(), candidate, remainingMinutes, minutesToCutoff, completedMinutes, targetMinutes, completionPercentage);
                selectedId = language + ":" + stageIndex + ":" + index;
                prefs.edit().putString("lastMessageText", candidate).apply();
                break;
            }
        }
        if (body == null) {
            String fallback = useMarathi
                ? "आजचं लक्ष्य अजून बाकी आहे. पुन्हा सुरू करूया! अभ्यासाचे %1$d मिनिटं बाकी."
                : "आज का लक्ष्य अभी बाकी है। फिर से शुरू करें! पढ़ाई के %1$d मिनट बाकी।";
            body = String.format(Locale.getDefault(), fallback, remainingMinutes, minutesToCutoff, completedMinutes, targetMinutes, completionPercentage);
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
