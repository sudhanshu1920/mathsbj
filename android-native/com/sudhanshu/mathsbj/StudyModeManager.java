package com.sudhanshu.mathsbj;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.NotificationManager;
import android.app.admin.DevicePolicyManager;
import android.telecom.TelecomManager;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class StudyModeManager {
    private static final String PREFS = "math_master_study_mode";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_PACKAGES = "selectedPackages";
    private static final String KEY_STUDY_PACKAGES = "studyAppPackages";
    private static final String KEY_QUOTE_DECK = "motivationalQuoteDeck";
    private static final String KEY_LAST_QUOTE = "lastMotivationalQuote";
    private static final String KEY_POPUP_THEME = "popupTheme";
    private static final String KEY_POPUP_MODE = "popupMode";
    private static final String KEY_DAYS = "selectedDays";
    private static final String KEY_APPLIED = "appliedPackages";
    private static final String KEY_LAST_STATE = "lastAppliedState";
    private static final String ACTION_BOUNDARY = "com.sudhanshu.mathsbj.STUDY_MODE_BOUNDARY";
    private static final String ACTION_SESSION_BOUNDARY = "com.sudhanshu.mathsbj.STUDY_MODE_SESSION_BOUNDARY";
    private static final int ALARM_REQUEST_CODE = 9527;
    private static final int ALARM_BACKUP_REQUEST_CODE = 9528;
    private static final int SESSION_ALARM_REQUEST_CODE = 9529;
    private static final int FOCUS_NOTIFICATION_ID = 9528;

    private StudyModeManager() {}

    private static volatile StudyModeSessionStore sessionStoreInstance;
    private static final Object SESSION_STORE_LOCK = new Object();

    private static StudyModeSessionStore sessionStore(Context context) {
        StudyModeSessionStore current = sessionStoreInstance;
        if (current != null) return current;
        synchronized (SESSION_STORE_LOCK) {
            if (sessionStoreInstance == null) {
                sessionStoreInstance = new StudyModeSessionStore(context.getApplicationContext());
            }
            return sessionStoreInstance;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    public static int getStartHour(Context context) { return prefs(context).getInt("startHour", 9); }
    public static int getStartMinute(Context context) { return prefs(context).getInt("startMinute", 0); }
    public static int getEndHour(Context context) { return prefs(context).getInt("endHour", 18); }
    public static int getEndMinute(Context context) { return prefs(context).getInt("endMinute", 0); }

    public static Set<Integer> getSelectedDays(Context context) {
        Set<Integer> result = new HashSet<>();
        JSONArray values;
        try {
            values = new JSONArray(prefs(context).getString(KEY_DAYS, "[1,2,3,4,5,6]"));
            for (int i = 0; i < values.length(); i++) {
                int day = values.optInt(i, -1);
                if (day >= 1 && day <= 7) result.add(day);
            }
        } catch (JSONException ignored) {
            return result;
        }
        return result;
    }

    public static List<String> getSelectedPackages(Context context) {
        List<String> result = new ArrayList<>();
        JSONArray values;
        try {
            values = new JSONArray(prefs(context).getString(KEY_PACKAGES, "[]"));
            Set<String> seen = new HashSet<>();
            for (int i = 0; i < values.length(); i++) {
                String name = values.optString(i, "");
                if (!name.isEmpty() && seen.add(name) && isInstalledSelectablePackage(context, name)) {
                    result.add(name);
                }
            }
        } catch (JSONException ignored) {
            return result;
        }
        if (result.size() != valuesLength(prefs(context).getString(KEY_PACKAGES, "[]"))) {
            saveStringArray(prefs(context), KEY_PACKAGES, result);
        }
        Collections.sort(result);
        return result;
    }


    /**
     * Study Apps are a separate quick-launch collection. Blocked packages always
     * win if older/corrupt preferences contain the same package in both lists.
     */
    public static synchronized List<String> getSelectedStudyAppPackages(Context context) {
        SharedPreferences preferences = prefs(context);
        String raw = preferences.getString(KEY_STUDY_PACKAGES, "[]");
        List<String> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Set<String> blocked = new HashSet<>(getSelectedPackages(context));
        blocked.addAll(getEnforcedPackages(context));
        try {
            JSONArray values = new JSONArray(raw);
            for (int i = 0; i < values.length(); i++) {
                String packageName = values.optString(i, "");
                if (!packageName.isEmpty() && seen.add(packageName)
                    && !blocked.contains(packageName)
                    && isInstalledSelectablePackage(context, packageName)) {
                    result.add(packageName);
                }
            }
        } catch (JSONException ignored) {
            // A corrupt shortcut list must never affect the authoritative block list.
        }
        Collections.sort(result);
        if (!raw.equals(toJson(result))) {
            preferences.edit().putString(KEY_STUDY_PACKAGES, toJson(result)).commit();
        }
        return result;
    }

    public static synchronized void savePopupAppearance(Context context, String theme, String mode) {
        String[] allowedThemes = {
            "arctic-blue", "deep-space", "titanium-silver", "midnight-violet", "sapphire",
            "ocean-cyan", "emerald-glass", "aurora", "soft-rose", "sunset-gold",
            "graphite", "pearl-white", "indigo", "forest", "mint"
        };
        boolean validTheme = false;
        if (theme != null) {
            for (String value : allowedThemes) if (value.equals(theme)) validTheme = true;
        }
        if (!validTheme || !("dark".equals(mode) || "light".equals(mode))) return;
        prefs(context).edit()
            .putString(KEY_POPUP_THEME, theme)
            .putString(KEY_POPUP_MODE, mode)
            .apply();
    }

    public static synchronized String getNextMotivationalQuote(Context context) {
        String[] quotes = {
            "आज की मेहनत, कल की सफलता बनेगी।",
            "सपने पूरे करने हैं तो पढ़ाई से दोस्ती करो।",
            "हर मिनट की पढ़ाई तुम्हें मंज़िल के करीब ले जाती है।",
            "खुद पर विश्वास रखो, तुम कर सकते हो!",
            "आज थोड़ा और पढ़ लो, कल खुद पर गर्व होगा।",
            "मोबाइल नहीं, अपने सपनों पर ध्यान दो।",
            "सफलता का रास्ता अनुशासन से होकर जाता है।",
            "एकाग्रता ही सफलता की सबसे बड़ी ताकत है।",
            "हार मत मानो, तुम्हारी मेहनत रंग लाएगी।",
            "पढ़ाई आज की, सफलता कल की।",
            "हर छोटा प्रयास बड़े परिणाम की शुरुआत है।",
            "अपने लक्ष्य को याद करो और आगे बढ़ते रहो।",
            "समय की कदर करो, यही सफलता की चाबी है।",
            "आज का फोकस ही कल का भविष्य बनाएगा।",
            "तुम्हारा मुकाबला किसी और से नहीं, खुद से है।",
            "हर दिन थोड़ा बेहतर बनो, सफलता जरूर मिलेगी।",
            "मेहनत कभी बेकार नहीं जाती।",
            "अपने लक्ष्य पर ध्यान दो, मंज़िल करीब है।",
            "आज का समय तुम्हारे भविष्य की नींव है।",
            "रुकना नहीं है, बस लगातार आगे बढ़ते रहना है।"
        };
        SharedPreferences preferences = prefs(context);
        List<Integer> deck = new ArrayList<>();
        int last = preferences.getInt(KEY_LAST_QUOTE, -1);
        try {
            JSONArray saved = new JSONArray(preferences.getString(KEY_QUOTE_DECK, "[]"));
            Set<Integer> seen = new HashSet<>();
            for (int i = 0; i < saved.length(); i++) {
                int value = saved.optInt(i, -1);
                if (value >= 0 && value < quotes.length && value != last && seen.add(value)) deck.add(value);
            }
        } catch (JSONException ignored) {
            deck.clear();
        }
        if (deck.isEmpty()) {
            for (int i = 0; i < quotes.length; i++) if (i != last) deck.add(i);
            Collections.shuffle(deck);
        }
        int next = deck.remove(deck.size() - 1);
        JSONArray remaining = new JSONArray();
        for (Integer value : deck) remaining.put(value);
        preferences.edit()
            .putString(KEY_QUOTE_DECK, remaining.toString())
            .putInt(KEY_LAST_QUOTE, next)
            .commit();
        return quotes[next];
    }

    public static boolean launchStudyApp(Context context, String packageName) {
        if (packageName == null || !getSelectedStudyAppPackages(context).contains(packageName)) return false;
        if (getSelectedPackages(context).contains(packageName)
            || getEnforcedPackages(context).contains(packageName)
            || !isInstalledSelectablePackage(context, packageName)) return false;
        try {
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(packageName);
            if (launch == null || launch.getComponent() == null
                || !packageName.equals(launch.getComponent().getPackageName())) return false;
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            context.startActivity(launch);
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    private static int valuesLength(String raw) {
        try { return new JSONArray(raw).length(); }
        catch (JSONException ignored) { return -1; }
    }

    private static void saveStringArray(SharedPreferences preferences, String key, List<String> values) {
        JSONArray array = new JSONArray();
        for (String value : values) array.put(value);
        preferences.edit().putString(key, array.toString()).apply();
    }

    public static Set<String> getProtectedPackages(Context context) {
        Set<String> protectedPackages = new HashSet<>();
        Collections.addAll(protectedPackages,
            context.getPackageName(),
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.emergency",
            "com.android.settings",
            "com.android.systemui",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.android.packageinstaller",
            "com.google.android.packageinstaller",
            "com.google.android.dialer",
            "com.android.dialer",
            "com.google.android.gms");

        try {
            TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
            String defaultDialer = telecom == null ? null : telecom.getDefaultDialerPackage();
            if (defaultDialer != null) protectedPackages.add(defaultDialer);
        } catch (Exception ignored) {}

        try {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            android.content.pm.PackageManager pm = context.getPackageManager();
            android.content.pm.ResolveInfo home = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? pm.resolveActivity(homeIntent, android.content.pm.PackageManager.ResolveInfoFlags.of(0L))
                : pm.resolveActivity(homeIntent, 0);
            if (home != null && home.activityInfo != null) {
                protectedPackages.add(home.activityInfo.packageName);
            }
        } catch (Exception ignored) {}

        try {
            String inputMethod = android.provider.Settings.Secure.getString(
                context.getContentResolver(), android.provider.Settings.Secure.DEFAULT_INPUT_METHOD);
            if (inputMethod != null) {
                int separator = inputMethod.indexOf('/');
                if (separator > 0) protectedPackages.add(inputMethod.substring(0, separator));
            }
        } catch (Exception ignored) {}

        try {
            String defaultSms = android.provider.Telephony.Sms.getDefaultSmsPackage(context);
            if (defaultSms != null) protectedPackages.add(defaultSms);
        } catch (Exception ignored) {}
        return protectedPackages;
    }

    public static boolean isVisibleApplication(Context context, String packageName) {
        return packageName != null
            && packageName.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+")
            && !packageName.equals(context.getPackageName());
    }

    public static boolean isSelectableApplication(
        Context context, String packageName, Set<String> protectedPackages
    ) {
        return isVisibleApplication(context, packageName)
            && protectedPackages != null
            && !protectedPackages.contains(packageName);
    }

    public static boolean isInstalledSelectablePackage(Context context, String packageName) {
        if (!isSelectableApplication(context, packageName, getProtectedPackages(context))) return false;
        try {
            android.content.pm.PackageManager pm = context.getPackageManager();
            ApplicationInfo info = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? pm.getApplicationInfo(packageName, android.content.pm.PackageManager.ApplicationInfoFlags.of(0L))
                : pm.getApplicationInfo(packageName, 0);
            if (info == null || !info.enabled) return false;

            return hasLaunchableActivity(context, packageName);
        } catch (Exception ignored) {
            return false;
        }
    }

    public static boolean isSystemApplication(ApplicationInfo info) {
        return info != null && (info.flags
            & (ApplicationInfo.FLAG_SYSTEM | ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0;
    }

    public static boolean hasLaunchableActivity(Context context, String packageName) {
        if (!isVisibleApplication(context, packageName)) return false;
        android.content.pm.PackageManager pm = context.getPackageManager();
        String[] launcherCategories = {
            Intent.CATEGORY_LAUNCHER,
            Intent.CATEGORY_LEANBACK_LAUNCHER,
            Intent.CATEGORY_INFO
        };
        for (String category : launcherCategories) {
            try {
                Intent query = new Intent(Intent.ACTION_MAIN);
                query.addCategory(category);
                query.setPackage(packageName);
                List<android.content.pm.ResolveInfo> matches = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    ? pm.queryIntentActivities(query, android.content.pm.PackageManager.ResolveInfoFlags.of(0L))
                    : pm.queryIntentActivities(query, 0);
                for (android.content.pm.ResolveInfo match : matches) {
                    if (match.activityInfo != null && match.activityInfo.enabled
                        && match.activityInfo.applicationInfo != null
                        && match.activityInfo.applicationInfo.enabled) return true;
                }
            } catch (Exception ignored) {
                // Try the next launcher category supported by OEM and TV-style apps.
            }
        }
        return false;
    }

    private static boolean isInstalledPackage(Context context, String packageName) {
        try {
            context.getPackageManager().getApplicationInfo(packageName, 0);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    public static boolean hasUsageAccess(Context context) {
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), context.getPackageName());
            } else {
                mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), context.getPackageName());
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception ignored) {
            return false;
        }
    }

    public static boolean hasAccessibilityServiceEnabled(Context context) {
        return StudyModeAccessibilityService.isEnabled(context);
    }

    public static boolean hasAccessibilityServiceConnected() {
        return StudyModeAccessibilityService.isConnected();
    }

    public static boolean hasForegroundMonitoringPermission(Context context) {
        return hasForegroundMonitoringSource(context);
    }

    public static boolean hasForegroundMonitoringSource(Context context) {
        return hasUsageAccess(context) || hasAccessibilityServiceConnected();
    }

    public static boolean hasOverlayPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static boolean hasExactAlarmPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return manager != null && manager.canScheduleExactAlarms();
    }

    public static boolean isPolicyOwner(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;
        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (policy == null) return false;
        try {
            return policy.isDeviceOwnerApp(context.getPackageName())
                || policy.isProfileOwnerApp(context.getPackageName());
        } catch (Exception ignored) {
            return false;
        }
    }

    public static boolean isScheduleValid(Context context) {
        int startHour = getStartHour(context);
        int startMinute = getStartMinute(context);
        int endHour = getEndHour(context);
        int endMinute = getEndMinute(context);
        return startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23
            && startMinute >= 0 && startMinute <= 59 && endMinute >= 0 && endMinute <= 59
            && (startHour != endHour || startMinute != endMinute)
            && !getSelectedDays(context).isEmpty();
    }

    public static boolean isScheduleActive(Context context) {
        if (!isEnabled(context) || !isScheduleValid(context)) return false;
        Calendar now = Calendar.getInstance();
        int minuteOfDay = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int start = getStartHour(context) * 60 + getStartMinute(context);
        int end = getEndHour(context) * 60 + getEndMinute(context);
        int today = toIsoWeekday(now.get(Calendar.DAY_OF_WEEK));
        int yesterday = today == 1 ? 7 : today - 1;
        Set<Integer> days = getSelectedDays(context);

        if (start < end) return days.contains(today) && minuteOfDay >= start && minuteOfDay < end;
        return (days.contains(today) && minuteOfDay >= start)
            || (days.contains(yesterday) && minuteOfDay < end);
    }

    private static int toIsoWeekday(int calendarDay) {
        return calendarDay == Calendar.SUNDAY ? 7 : calendarDay - 1;
    }

    private static Calendar nextTransition(Context context, long afterMillis) {
        if (!isScheduleValid(context)) return null;
        int start = getStartHour(context) * 60 + getStartMinute(context);
        int end = getEndHour(context) * 60 + getEndMinute(context);
        boolean overnight = end < start;
        Set<Integer> days = getSelectedDays(context);
        Calendar base = Calendar.getInstance();
        base.setTimeInMillis(afterMillis);
        base.set(Calendar.HOUR_OF_DAY, 12);
        base.set(Calendar.MINUTE, 0);
        base.set(Calendar.SECOND, 0);
        base.set(Calendar.MILLISECOND, 0);
        Calendar next = null;

        for (int offset = -1; offset <= 8; offset++) {
            Calendar studyDay = (Calendar) base.clone();
            studyDay.add(Calendar.DAY_OF_MONTH, offset);
            if (!days.contains(toIsoWeekday(studyDay.get(Calendar.DAY_OF_WEEK)))) continue;

            Calendar startAt = (Calendar) studyDay.clone();
            startAt.set(Calendar.HOUR_OF_DAY, getStartHour(context));
            startAt.set(Calendar.MINUTE, getStartMinute(context));
            startAt.set(Calendar.SECOND, 0);
            startAt.set(Calendar.MILLISECOND, 0);

            Calendar endAt = (Calendar) studyDay.clone();
            if (overnight) endAt.add(Calendar.DAY_OF_MONTH, 1);
            endAt.set(Calendar.HOUR_OF_DAY, getEndHour(context));
            endAt.set(Calendar.MINUTE, getEndMinute(context));
            endAt.set(Calendar.SECOND, 0);
            endAt.set(Calendar.MILLISECOND, 0);

            if (startAt.getTimeInMillis() > afterMillis
                && (next == null || startAt.before(next))) next = startAt;
            if (endAt.getTimeInMillis() > afterMillis
                && (next == null || endAt.before(next))) next = endAt;
        }
        return next;
    }

    public static long getCurrentSessionEndMillis(Context context) {
        StudyModeSessionStore.Session session = sessionStore(context).getActiveSession(context);
        if (session != null) {
            if (session.durationSeconds <= 0) return 0L;
            long remaining = Math.max(0L, session.durationSeconds - session.elapsedSeconds);
            return System.currentTimeMillis() + remaining * 1000L;
        }
        if (!isScheduleActive(context)) return 0L;
        Calendar now = Calendar.getInstance();
        int minuteOfDay = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int start = getStartHour(context) * 60 + getStartMinute(context);
        int end = getEndHour(context) * 60 + getEndMinute(context);
        int today = toIsoWeekday(now.get(Calendar.DAY_OF_WEEK));
        Set<Integer> days = getSelectedDays(context);
        Calendar result = (Calendar) now.clone();
        if (start > end && days.contains(today) && minuteOfDay >= start) {
            result.add(Calendar.DAY_OF_MONTH, 1);
        }
        result.set(Calendar.HOUR_OF_DAY, getEndHour(context));
        result.set(Calendar.MINUTE, getEndMinute(context));
        result.set(Calendar.SECOND, 0);
        result.set(Calendar.MILLISECOND, 0);
        return result.getTimeInMillis();
    }

    public static long getCurrentSessionRemainingSeconds(Context context) {
        StudyModeSessionStore.Session session = sessionStore(context).getActiveSession(context);
        if (session != null) {
            if (session.durationSeconds <= 0) return -1L;
            return Math.max(0L, session.durationSeconds - session.elapsedSeconds);
        }
        long end = getCurrentSessionEndMillis(context);
        return end > 0L ? Math.max(0L, (end - System.currentTimeMillis()) / 1000L) : -1L;
    }

    public static synchronized void saveConfig(
        Context context,
        List<String> requestedPackages,
        List<String> requestedStudyApps,
        boolean resolveStudyAppConflicts,
        int startHour,
        int startMinute,
        int endHour,
        int endMinute,
        Set<Integer> days
    ) {
        if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23
            || startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
            throw new IllegalArgumentException("Choose valid start and end times.");
        }
        if (startHour == endHour && startMinute == endMinute) {
            throw new IllegalArgumentException("Start time and end time cannot be the same.");
        }
        if (days == null || days.isEmpty()) {
            throw new IllegalArgumentException("Select at least one repeat day.");
        }

        List<String> acceptedBlocked = new ArrayList<>();
        if (requestedPackages != null) {
            Set<String> seen = new HashSet<>();
            for (String name : requestedPackages) {
                if (name != null && seen.add(name) && isInstalledSelectablePackage(context, name)) {
                    acceptedBlocked.add(name);
                }
            }
        }
        if (acceptedBlocked.isEmpty()) {
            throw new IllegalArgumentException("Select at least one installed launchable app.");
        }
        Collections.sort(acceptedBlocked);

        List<String> requestedStudy = requestedStudyApps == null
            ? getSelectedStudyAppPackages(context) : requestedStudyApps;
        List<String> acceptedStudy = new ArrayList<>();
        Set<String> seenStudy = new HashSet<>();
        for (String name : requestedStudy) {
            if (name == null || name.isEmpty() || !seenStudy.add(name)) continue;
            if (acceptedBlocked.contains(name)) {
                if (resolveStudyAppConflicts) continue;
                throw new IllegalArgumentException(
                    "Blocked Apps take priority. Remove this app from one list before saving.");
            }
            if (isInstalledSelectablePackage(context, name)) acceptedStudy.add(name);
        }
        Collections.sort(acceptedStudy);

        JSONArray dayArray = new JSONArray();
        for (int day = 1; day <= 7; day++) if (days.contains(day)) dayArray.put(day);

        // Both package collections and the schedule are committed together so
        // concurrent UI state cannot leave a package in both active lists.
        boolean committed = prefs(context).edit()
            .putString(KEY_PACKAGES, toJson(acceptedBlocked))
            .putString(KEY_STUDY_PACKAGES, toJson(acceptedStudy))
            .putString(KEY_DAYS, dayArray.toString())
            .putInt("startHour", startHour)
            .putInt("startMinute", startMinute)
            .putInt("endHour", endHour)
            .putInt("endMinute", endMinute)
            .commit();
        if (!committed) throw new IllegalStateException("Study Mode settings could not be saved locally.");

        StudyModeSessionStore.Session activeSession = sessionStore(context).getActiveSession(context);
        if (activeSession != null) {
            sessionStore(context).updateActivePackages(activeSession.id, acceptedBlocked);
        }
        reconcile(context);
    }

    private static String toJson(List<String> values) {
        JSONArray array = new JSONArray();
        for (String value : values) array.put(value);
        return array.toString();
    }

    public static synchronized void setEnabled(Context context, boolean enabled) {
        if (enabled) {
            if (!isScheduleValid(context)) throw new IllegalArgumentException("Choose a valid schedule and at least one repeat day.");
            if (getSelectedPackages(context).isEmpty()) throw new IllegalArgumentException("Select at least one installed launchable app.");
        }
        if (!enabled) {
            StudyModeSessionStore.Session activeSession = sessionStore(context).getActiveSession(context);
            if (activeSession != null) {
                restoreSessionDnd(context, activeSession);
                sessionStore(context).finishSession(context, activeSession.id, "ended");
            }
            cancelSessionExpiry(context);
        }
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).commit();
        reconcile(context);
    }

    public static List<String> getEnforcedPackages(Context context) {
        Set<String> combined = new HashSet<>();
        if (isScheduleActive(context)) combined.addAll(getSelectedPackages(context));
        StudyModeSessionStore.Session session = sessionStore(context).getActiveSession(context);
        if (session != null && session.selectedPackages != null) {
            for (String packageName : session.selectedPackages) {
                if (isInstalledSelectablePackage(context, packageName)) combined.add(packageName);
            }
        }
        List<String> result = new ArrayList<>(combined);
        Collections.sort(result);
        return result;
    }

    public static boolean isSessionActive(Context context) {
        return sessionStore(context).getActiveSession(context) != null;
    }

    public static boolean shouldEnforceNow(Context context) {
        return isScheduleActive(context) || isSessionActive(context);
    }

    public static boolean isPackageSelected(Context context, String packageName) {
        return packageName != null && getEnforcedPackages(context).contains(packageName);
    }

    /**
     * Single Focus Shield decision path. The active session/schedule contributes
     * only Blocked Apps; Study Apps are quick-launch destinations, never a global
     * allow-list. Critical Android interfaces remain protected even if an old or
     * manually edited preference contains one of their package names.
     */
    public static boolean shouldBlockForegroundPackage(Context context, String packageName) {
        if (context == null || packageName == null
            || !packageName.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+")
            || packageName.equals(context.getPackageName())
            || !shouldEnforceNow(context)
            || !hasForegroundMonitoringSource(context)
            || !hasOverlayPermission(context)) return false;

        if (getProtectedPackages(context).contains(packageName)) return false;
        return getEnforcedPackages(context).contains(packageName);
    }

    public static boolean hasNotificationPolicyAccess(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.isNotificationPolicyAccessGranted();
    }

    public static synchronized JSObject startSession(
        Context context,
        String sessionType,
        int durationSeconds,
        boolean enforced,
        boolean shouldEnableDnd
    ) {
        if (durationSeconds < 0 || durationSeconds > 24 * 60 * 60) {
            throw new IllegalArgumentException("Focus duration must be between 0 and 24 hours.");
        }
        List<String> selected = getSelectedPackages(context);
        if (selected.isEmpty()) {
            throw new IllegalArgumentException("Select at least one app before starting a focus session.");
        }

        StudyModeSessionStore store = sessionStore(context);
        expireSessionIfNeeded(context);
        StudyModeSessionStore.Session active = store.getActiveSession(context);
        if (active == null) {
            active = store.startSession(context, sessionType, durationSeconds, selected, enforced, shouldEnableDnd);
            if (active == null) throw new IllegalStateException("The focus session could not be saved locally.");
            applySessionDndIfRequested(context, active);
        }
        scheduleSessionExpiry(context);
        reconcile(context);
        return getStatus(context);
    }

    public static synchronized JSObject endSession(Context context, String sessionId) {
        StudyModeSessionStore.Session active = sessionStore(context).getActiveSession(context);
        if (active != null && (sessionId == null || sessionId.isEmpty() || sessionId.equals(active.id))) {
            restoreSessionDnd(context, active);
            sessionStore(context).finishSession(context, active.id, "ended");
        }
        cancelSessionExpiry(context);
        reconcile(context);
        return getStatus(context);
    }

    public static JSArray getSessionHistory(Context context) {
        JSArray result = new JSArray();
        for (JSObject item : sessionStore(context).getHistory(30)) result.put(item);
        return result;
    }

    private static void expireSessionIfNeeded(Context context) {
        completeExpiredSession(context);
    }

    public static synchronized boolean completeExpiredSession(Context context) {
        StudyModeSessionStore store = sessionStore(context);
        StudyModeSessionStore.Session active = store.getActiveSession(context);
        if (active == null || active.durationSeconds <= 0 || active.elapsedSeconds < active.durationSeconds) return false;
        restoreSessionDnd(context, active);
        boolean completed = store.finishSession(context, active.id, "completed");
        cancelSessionExpiry(context);
        return completed;
    }

    public static String getSessionNotificationText(Context context) {
        if (!isPolicyOwner(context) && shouldEnforceNow(context)
            && (!hasForegroundMonitoringSource(context) || !hasOverlayPermission(context))) {
            return "App blocking paused · required permission is off";
        }
        StudyModeSessionStore.Session session = sessionStore(context).getActiveSession(context);
        if (session == null) return "Scheduled focus is active";
        long elapsed = Math.max(0L, session.elapsedSeconds);
        if (session.durationSeconds > 0) {
            long remaining = Math.max(0L, session.durationSeconds - elapsed);
            return "Focus session · " + formatDuration(remaining) + " remaining";
        }
        return "Focus session · " + formatDuration(elapsed) + " elapsed";
    }

    public static String getSessionNotificationTitle(Context context) {
        StudyModeSessionStore.Session session = sessionStore(context).getActiveSession(context);
        if (session == null) return "Study Mode is active";
        String label = session.type == null ? "Study" : session.type;
        return "Study Mode · " + label.substring(0, 1).toUpperCase(java.util.Locale.ROOT)
            + label.substring(1);
    }

    private static String formatDuration(long totalSeconds) {
        long hours = totalSeconds / 3600L;
        long minutes = (totalSeconds % 3600L) / 60L;
        if (hours > 0) return hours + "h " + minutes + "m";
        return minutes + "m";
    }

    private static void applySessionDndIfRequested(Context context, StudyModeSessionStore.Session session) {
        if (session == null || !session.shouldEnableDnd || Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || !hasNotificationPolicyAccess(context)) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        try {
            int original = manager.getCurrentInterruptionFilter();
            // Do not override an existing user-selected DND profile.
            if (original != NotificationManager.INTERRUPTION_FILTER_ALL) return;
            // Persist the intended restore state before changing the system setting.
            sessionStore(context).saveDndState(session.id, original, true);
            manager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
        } catch (Exception error) {
            sessionStore(context).saveDndState(session.id, -1, false);
        }
    }

    private static void restoreSessionDnd(Context context, StudyModeSessionStore.Session session) {
        if (session == null || !session.dndApplied || session.originalDndFilter < 0
            || Build.VERSION.SDK_INT < Build.VERSION_CODES.M || !hasNotificationPolicyAccess(context)) return;
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && manager.getCurrentInterruptionFilter() == NotificationManager.INTERRUPTION_FILTER_NONE) {
                // Restore only if the current filter is still the one set by this session.
                manager.setInterruptionFilter(session.originalDndFilter);
            }
        } catch (Exception ignored) {
            // A later explicit user action can restore DND; never fail session cleanup.
        }
        sessionStore(context).saveDndState(session.id, -1, false);
    }

    private static void scheduleSessionExpiry(Context context) {
        StudyModeSessionStore.Session session = sessionStore(context).getActiveSession(context);
        if (session == null || session.durationSeconds <= 0) {
            cancelSessionExpiry(context);
            return;
        }
        long remaining = Math.max(1L, session.durationSeconds - session.elapsedSeconds);
        long trigger = SystemClock.elapsedRealtime() + remaining * 1000L;
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pending = sessionBoundaryPendingIntent(context);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
                manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pending);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pending);
            } else {
                manager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pending);
            }
        } catch (Exception denied) {
            try {
                manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pending);
            } catch (Exception ignored) {}
        }
    }

    private static PendingIntent sessionBoundaryPendingIntent(Context context) {
        Intent intent = new Intent(context, StudyModeAlarmReceiver.class);
        intent.setAction(ACTION_SESSION_BOUNDARY);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, SESSION_ALARM_REQUEST_CODE, intent, flags);
    }

    private static void cancelSessionExpiry(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pending = sessionBoundaryPendingIntent(context);
        manager.cancel(pending);
        pending.cancel();
    }

    public static synchronized void reconcile(Context context) {
        Context app = context.getApplicationContext();
        expireSessionIfNeeded(app);

        boolean scheduleEnabled = isEnabled(app);
        boolean scheduleValid = scheduleEnabled && isScheduleValid(app) && !getSelectedPackages(app).isEmpty();
        boolean scheduleActive = scheduleValid && isScheduleActive(app);
        if (scheduleValid) scheduleNextBoundary(app);
        else cancelBoundaryAlarm(app);

        StudyModeSessionStore.Session activeSession = sessionStore(app).getActiveSession(app);
        if (activeSession != null) scheduleSessionExpiry(app);
        else cancelSessionExpiry(app);

        List<String> packages = getEnforcedPackages(app);
        boolean active = !packages.isEmpty() && (scheduleActive || activeSession != null);

        if (isPolicyOwner(app)) {
            if (!hasExactAlarmPermission(app) && active) {
                boolean released = releaseSuspendedPackages(app);
                stopFocusShield(app);
                setLastState(app, released ? "exact_alarm_required" : "policy_failed");
                return;
            }
            boolean success = applyPackageSuspension(app, packages, active);
            if (!active && success) {
                stopFocusShield(app);
                setLastState(app, scheduleEnabled ? "waiting_for_schedule" : "disabled");
            } else if (active && success) {
                // DevicePolicyManager keeps the selected packages suspended independently
                // of the foreground notification/service process.
                if (activeSession != null) {
                    if ((!StudyModeFocusService.isRunning() || StudyModeFocusService.isStopping())
                        && !StudyModeFocusService.isStarting()) {
                        StudyModeFocusService.markStarting();
                        startFocusShield(app);
                    }
                } else {
                    stopFocusShield(app);
                }
                setLastState(app, "system_suspension");
            }
            return;
        }

        if (!releaseSuspendedPackages(app)) {
            stopFocusShield(app);
            setLastState(app, "policy_failed");
            return;
        }
        if (!active) {
            stopFocusShield(app);
            setLastState(app, scheduleEnabled ? "waiting_for_schedule" : "disabled");
            return;
        }
        if (!hasForegroundMonitoringPermission(app) || !hasOverlayPermission(app)) {
            stopFocusShield(app);
            setLastState(app, "permission_required");
            return;
        }

        try {
            if ((!StudyModeFocusService.isRunning() || StudyModeFocusService.isStopping())
                && !StudyModeFocusService.isStarting()) {
                StudyModeFocusService.markStarting();
                Intent service = new Intent(app, StudyModeFocusService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) app.startForegroundService(service);
                else app.startService(service);
            }
            setLastState(app, StudyModeFocusService.hasOverlayFailure() ? "overlay_failed"
                : (StudyModeFocusService.isRunning() ? "focus_shield_running"
                    : (StudyModeFocusService.isStarting() ? "focus_shield_starting" : "service_stopped")));
        } catch (Exception error) {
            StudyModeFocusService.clearStarting();
            stopFocusShield(app);
            setLastState(app, "service_start_blocked");
        }
    }

    private static void setLastState(Context context, String state) {
        prefs(context).edit().putString(KEY_LAST_STATE, state).apply();
    }

    public static void setServiceState(Context context, String state) {
        setLastState(context, state);
    }

    private static boolean isActuallySuspended(DevicePolicyManager policy, Context context, String packageName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N || policy == null || packageName == null) return false;
        try {
            return policy.isPackageSuspended(getAdminComponent(context), packageName);
        } catch (Exception ignored) {
            return false;
        }
    }

    private static List<String> getActuallySuspendedPackages(
        DevicePolicyManager policy, Context context, List<String> packages
    ) {
        List<String> suspended = new ArrayList<>();
        for (String packageName : packages) {
            if (isActuallySuspended(policy, context, packageName)) suspended.add(packageName);
        }
        Collections.sort(suspended);
        return suspended;
    }

    private static boolean applyPackageSuspension(Context context, List<String> selected, boolean active) {
        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (policy == null || !isPolicyOwner(context)) {
            releaseSuspendedPackages(context);
            setLastState(context, "policy_failed");
            return false;
        }
        if (!active) return releaseSuspendedPackages(context);

        List<String> previouslyManaged = readAppliedPackages(context);
        Set<String> previouslyManagedSet = new HashSet<>(previouslyManaged);
        Set<String> wanted = new HashSet<>(selected);
        List<String> stillManaged = new ArrayList<>();
        List<String> obsolete = new ArrayList<>();
        for (String old : previouslyManaged) if (!wanted.contains(old)) obsolete.add(old);

        if (!obsolete.isEmpty()) {
            try {
                policy.setPackagesSuspended(getAdminComponent(context), obsolete.toArray(new String[0]), false);
            } catch (Exception ignored) {
                // Verify below and retain any package that still needs recovery.
            }
            for (String old : obsolete) {
                if (isActuallySuspended(policy, context, old)) stillManaged.add(old);
            }
        }

        List<String> toSuspend = new ArrayList<>();
        Set<String> suspendedOutsideThisFeature = new HashSet<>();
        for (String packageName : selected) {
            boolean suspended = isActuallySuspended(policy, context, packageName);
            if (previouslyManagedSet.contains(packageName)) {
                if (suspended) stillManaged.add(packageName);
                else toSuspend.add(packageName);
            } else if (suspended) {
                // Do not claim or later release a restriction applied by another administrator.
                suspendedOutsideThisFeature.add(packageName);
            } else {
                toSuspend.add(packageName);
            }
        }

        if (!toSuspend.isEmpty()) {
            try {
                policy.setPackagesSuspended(getAdminComponent(context), toSuspend.toArray(new String[0]), true);
            } catch (Exception ignored) {
                // Individual package state is verified below.
            }
        }

        List<String> verifiedSelected = getActuallySuspendedPackages(policy, context, selected);
        for (String packageName : toSuspend) {
            if (isActuallySuspended(policy, context, packageName)) stillManaged.add(packageName);
        }
        List<String> applied = new ArrayList<>(new HashSet<>(stillManaged));
        Collections.sort(applied);
        saveStringArray(prefs(context), KEY_APPLIED, applied);

        if (!selected.isEmpty() && verifiedSelected.containsAll(selected)) {
            setLastState(context, "system_suspension");
            return true;
        }
        if (!verifiedSelected.isEmpty() || !suspendedOutsideThisFeature.isEmpty()) {
            setLastState(context, "partial_suspension");
        } else {
            setLastState(context, "policy_failed");
        }
        return false;
    }

    private static List<String> readAppliedPackages(Context context) {
        List<String> result = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs(context).getString(KEY_APPLIED, "[]"));
            for (int i = 0; i < array.length(); i++) {
                String value = array.optString(i, "");
                if (!value.isEmpty()) result.add(value);
            }
        } catch (JSONException ignored) {}
        return result;
    }

    private static boolean releaseSuspendedPackages(Context context) {
        List<String> previous = readAppliedPackages(context);
        if (previous.isEmpty()) return true;

        List<String> installed = new ArrayList<>();
        for (String name : previous) {
            if (isInstalledPackage(context, name)) installed.add(name);
        }
        if (installed.isEmpty()) {
            saveStringArray(prefs(context), KEY_APPLIED, new ArrayList<>());
            return true;
        }

        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (policy == null || !isPolicyOwner(context)) {
            saveStringArray(prefs(context), KEY_APPLIED, installed);
            setLastState(context, "policy_unavailable");
            return false;
        }

        try {
            policy.setPackagesSuspended(getAdminComponent(context), installed.toArray(new String[0]), false);
        } catch (Exception ignored) {
            // Preserve any remaining suspension records so OFF can retry.
        }

        List<String> stillSuspended = getActuallySuspendedPackages(policy, context, installed);
        saveStringArray(prefs(context), KEY_APPLIED, stillSuspended);
        if (!stillSuspended.isEmpty()) {
            setLastState(context, "policy_failed");
            return false;
        }
        return true;
    }

    private static void startFocusShield(Context context) {
        Intent service = new Intent(context, StudyModeFocusService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
            else context.startService(service);
        } catch (Exception error) {
            StudyModeFocusService.clearStarting();
            setLastState(context, "service_start_blocked");
        }
    }

    private static void stopFocusShield(Context context) {
        if (StudyModeFocusService.isRunning()) StudyModeFocusService.markStopping();
        else StudyModeFocusService.clearStarting();
        try { context.stopService(new Intent(context, StudyModeFocusService.class)); }
        catch (Exception ignored) {}
    }

    private static void scheduleNextBoundary(Context context) {
        if (!isEnabled(context) || !isScheduleValid(context)) {
            cancelBoundaryAlarm(context);
            return;
        }
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        Calendar next = nextTransition(context, System.currentTimeMillis());
        if (next == null) {
            cancelBoundaryAlarm(context);
            return;
        }
        PendingIntent pending = boundaryPendingIntent(context, ALARM_REQUEST_CODE);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
                // Keep one inexact safety alarm for this same boundary. If exact-alarm
                // access is revoked, Android cancels exact alarms; this backup can still
                // wake the manager later and release any managed-device suspension.
                PendingIntent backup = boundaryPendingIntent(context, ALARM_BACKUP_REQUEST_CODE);
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), backup);
            } else {
                manager.setExact(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            }
        } catch (SecurityException denied) {
            try {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
                PendingIntent backup = boundaryPendingIntent(context, ALARM_BACKUP_REQUEST_CODE);
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), backup);
            } catch (Exception ignored) {
                setLastState(context, "schedule_error");
            }
        } catch (Exception error) {
            setLastState(context, "schedule_error");
        }
    }

    private static PendingIntent boundaryPendingIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, StudyModeAlarmReceiver.class);
        intent.setAction(ACTION_BOUNDARY);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, requestCode, intent, flags);
    }

    private static void cancelBoundaryAlarm(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager != null) {
            PendingIntent pending = boundaryPendingIntent(context, ALARM_REQUEST_CODE);
            PendingIntent backup = boundaryPendingIntent(context, ALARM_BACKUP_REQUEST_CODE);
            manager.cancel(pending);
            manager.cancel(backup);
            pending.cancel();
            backup.cancel();
        }
    }

    public static JSObject getStatus(Context context) {
        JSObject result = new JSObject();
        JSObject config = new JSObject();
        JSArray packages = new JSArray();
        for (String name : getSelectedPackages(context)) packages.put(name);
        JSArray days = new JSArray();
        List<Integer> orderedDays = new ArrayList<>(getSelectedDays(context));
        Collections.sort(orderedDays);
        for (Integer day : orderedDays) days.put(day);

        config.put("enabled", isEnabled(context));
        config.put("selectedPackageNames", packages);
        config.put("startHour", getStartHour(context));
        config.put("startMinute", getStartMinute(context));
        config.put("endHour", getEndHour(context));
        config.put("endMinute", getEndMinute(context));
        config.put("selectedDays", days);

        JSObject permissions = new JSObject();
        permissions.put("usageAccess", hasUsageAccess(context));
        permissions.put("accessibilityEnabled", hasAccessibilityServiceEnabled(context));
        permissions.put("accessibilityConnected", hasAccessibilityServiceConnected());
        permissions.put("overlay", hasOverlayPermission(context));
        permissions.put("exactAlarm", hasExactAlarmPermission(context));
        permissions.put("deviceOwner", isDeviceOwner(context));
        permissions.put("profileOwner", isProfileOwner(context));
        permissions.put("dndAccess", hasNotificationPolicyAccess(context));

        List<String> applied = readAppliedPackages(context);
        JSArray appliedArray = new JSArray();
        for (String name : applied) appliedArray.put(name);
        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        List<String> enforcedPackages = getEnforcedPackages(context);
        List<String> suspended = isPolicyOwner(context)
            ? getActuallySuspendedPackages(policy, context, enforcedPackages)
            : new ArrayList<>();
        JSArray enforcedArray = new JSArray();
        for (String name : enforcedPackages) enforcedArray.put(name);
        StudyModeSessionStore.Session activeSession = sessionStore(context).getActiveSession(context);
        JSObject sessionJson = sessionStore(context).getActiveSessionJson(context);
        JSArray suspendedArray = new JSArray();
        for (String name : suspended) suspendedArray.put(name);

        String state = prefs(context).getString(KEY_LAST_STATE, isEnabled(context) ? "waiting_for_schedule" : "disabled");
        boolean enabled = isEnabled(context);
        boolean sessionActive = activeSession != null;
        boolean active = !enforcedPackages.isEmpty() && (isScheduleActive(context) || sessionActive);
        boolean policyOwner = isPolicyOwner(context);
        boolean usageGranted = hasUsageAccess(context);
        boolean accessibilityConnected = hasAccessibilityServiceConnected();
        boolean overlayGranted = hasOverlayPermission(context);
        boolean foregroundSourceAvailable = usageGranted || accessibilityConnected;
        if (!enabled && !sessionActive) {
            if (!"policy_failed".equals(state) && !"policy_unavailable".equals(state)) state = "disabled";
        } else if (!active) {
            state = enabled ? "waiting_for_schedule" : "session_inactive";
        } else if (policyOwner && !hasExactAlarmPermission(context)) {
            state = "exact_alarm_required";
        } else if (policyOwner) {
            if (!enforcedPackages.isEmpty() && suspended.containsAll(enforcedPackages)) state = "system_suspension";
            else if (!suspended.isEmpty()) state = "partial_suspension";
            else if (!"policy_unavailable".equals(state)) state = "policy_failed";
        } else if (!foregroundSourceAvailable || !overlayGranted) {
            state = "permission_required";
        } else if (!usageGranted && accessibilityConnected
            && !StudyModeAccessibilityService.hasForegroundPackageEvent()
            && StudyModeFocusService.isRunning()) {
            state = "waiting_for_foreground_event";
        } else if (StudyModeFocusService.hasOverlayFailure()) {
            state = "overlay_failed";
        } else if (StudyModeFocusService.isRunning()) {
            state = StudyModeFocusService.hasOverlayFailure() ? "overlay_failed" : "focus_shield_running";
        } else if (StudyModeFocusService.isStarting()) {
            state = "focus_shield_starting";
        } else if (!"service_start_blocked".equals(state) && !"overlay_failed".equals(state)) {
            // A persisted ACTIVE label is never proof that the native monitor is alive.
            state = "service_stopped";
        }

        boolean exactFallback = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasExactAlarmPermission(context);
        JSArray studyAppsArray = new JSArray();
        for (String packageName : getSelectedStudyAppPackages(context)) studyAppsArray.put(packageName);
        result.put("studyAppPackages", studyAppsArray);
        result.put("config", config);
        result.put("permissions", permissions);
        result.put("scheduleActive", isScheduleActive(context));
        result.put("sessionActive", sessionActive);
        result.put("activeSession", sessionJson);
        result.put("enforcedPackages", enforcedArray);
        result.put("monitoringServiceRunning", StudyModeFocusService.isRunning());
        result.put("enforcementMode", isDeviceOwner(context) ? "device_owner"
            : (isProfileOwner(context) ? "profile_owner"
                : (hasForegroundMonitoringSource(context) && hasOverlayPermission(context) ? "focus_shield" : "unavailable")));
        result.put("enforcementState", state);
        result.put("appliedPackages", appliedArray);
        result.put("suspendedPackages", suspendedArray);
        result.put("exactAlarmFallback", exactFallback);
        return result;
    }

    private static ComponentName getAdminComponent(Context context) {
        return new ComponentName(context, StudyModeDeviceAdminReceiver.class);
    }

    public static boolean isDeviceOwner(Context context) {
        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        return policy != null && policy.isDeviceOwnerApp(context.getPackageName());
    }

    public static boolean isProfileOwner(Context context) {
        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        return policy != null && policy.isProfileOwnerApp(context.getPackageName());
    }
}
