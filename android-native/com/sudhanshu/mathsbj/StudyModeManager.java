package com.sudhanshu.mathsbj;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.admin.DevicePolicyManager;
import android.telecom.TelecomManager;
import android.app.role.RoleManager;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
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
    private static final String KEY_DAYS = "selectedDays";
    private static final String KEY_APPLIED = "appliedPackages";
    private static final String KEY_LAST_STATE = "lastAppliedState";
    private static final String ACTION_BOUNDARY = "com.sudhanshu.mathsbj.STUDY_MODE_BOUNDARY";
    private static final int ALARM_REQUEST_CODE = 9527;
    private static final int FOCUS_NOTIFICATION_ID = 9528;

    private StudyModeManager() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    public static boolean isNotificationBlockingEnabled(Context context) {
        return prefs(context).getBoolean("notificationBlockingEnabled", true);
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

    private static int valuesLength(String raw) {
        try { return new JSONArray(raw).length(); }
        catch (JSONException ignored) { return -1; }
    }

    private static void saveStringArray(SharedPreferences preferences, String key, List<String> values) {
        JSONArray array = new JSONArray();
        for (String value : values) array.put(value);
        preferences.edit().putString(key, array.toString()).apply();
    }

    public static boolean isInstalledSelectablePackage(Context context, String packageName) {
        if (packageName == null || !packageName.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+")) return false;
        if (packageName.equals(context.getPackageName()) || isProtectedPackage(context, packageName)) return false;
        try {
            ApplicationInfo info = context.getPackageManager().getApplicationInfo(packageName, 0);
            // Only user-installed applications are selectable. Core/updated system
            // apps are intentionally excluded to keep emergency and OS controls safe.
            return (info.flags & ApplicationInfo.FLAG_SYSTEM) == 0;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static boolean isProtectedPackage(Context context, String packageName) {
        if (packageName.equals("com.android.phone")
            || packageName.equals("com.android.server.telecom")
            || packageName.equals("com.android.emergency")
            || packageName.equals("com.android.settings")
            || packageName.equals("com.android.systemui")
            || packageName.equals("com.google.android.dialer")
            || packageName.equals("com.android.dialer")
            || packageName.equals("com.google.android.gms")) return true;

        try {
            TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
            if (telecom != null && packageName.equals(telecom.getDefaultDialerPackage())) return true;
        } catch (Exception ignored) {}

        try {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            android.content.pm.ResolveInfo home = context.getPackageManager().resolveActivity(homeIntent, 0);
            if (home != null && home.activityInfo != null
                && packageName.equals(home.activityInfo.packageName)) return true;
        } catch (Exception ignored) {}

        try {
            String inputMethod = android.provider.Settings.Secure.getString(
                context.getContentResolver(), android.provider.Settings.Secure.DEFAULT_INPUT_METHOD);
            if (inputMethod != null && inputMethod.startsWith(packageName + "/")) return true;
        } catch (Exception ignored) {}

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                RoleManager roles = (RoleManager) context.getSystemService(Context.ROLE_SERVICE);
                if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_SMS)
                    && roles.getRoleHolders(RoleManager.ROLE_SMS).contains(packageName)) return true;
            } catch (Exception ignored) {}
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

    public static boolean hasOverlayPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static boolean hasNotificationAccess(Context context) {
        String enabled = Settings.Secure.getString(
            context.getContentResolver(), "enabled_notification_listeners");
        if (enabled == null) return false;
        String own = context.getPackageName() + "/" + StudyModeNotificationListenerService.class.getName();
        for (String component : enabled.split(":")) {
            if (own.equalsIgnoreCase(component)) return true;
        }
        return false;
    }

    public static boolean hasExactAlarmPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return manager != null && manager.canScheduleExactAlarms();
    }

    public static boolean isPolicyOwner(Context context) {
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

    public static void saveConfig(
        Context context,
        List<String> requestedPackages,
        int startHour,
        int startMinute,
        int endHour,
        int endMinute,
        Set<Integer> days,
        boolean notificationBlockingEnabled
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

        List<String> accepted = new ArrayList<>();
        if (requestedPackages != null) {
            Set<String> seen = new HashSet<>();
            for (String name : requestedPackages) {
                if (name != null && seen.add(name) && isInstalledSelectablePackage(context, name)) {
                    accepted.add(name);
                }
            }
        }
        if (accepted.isEmpty()) {
            throw new IllegalArgumentException("Select at least one installed user app.");
        }
        Collections.sort(accepted);
        JSONArray dayArray = new JSONArray();
        for (int day = 1; day <= 7; day++) if (days.contains(day)) dayArray.put(day);

        SharedPreferences.Editor editor = prefs(context).edit()
            .putString(KEY_PACKAGES, toJson(accepted))
            .putString(KEY_DAYS, dayArray.toString())
            .putInt("startHour", startHour)
            .putInt("startMinute", startMinute)
            .putInt("endHour", endHour)
            .putInt("endMinute", endMinute)
            .putBoolean("notificationBlockingEnabled", notificationBlockingEnabled);
        editor.apply();
        reconcile(context);
    }

    private static String toJson(List<String> values) {
        JSONArray array = new JSONArray();
        for (String value : values) array.put(value);
        return array.toString();
    }

    public static void setEnabled(Context context, boolean enabled) {
        if (enabled) {
            if (!isScheduleValid(context)) throw new IllegalArgumentException("Choose a valid schedule and at least one repeat day.");
            if (getSelectedPackages(context).isEmpty()) throw new IllegalArgumentException("Select at least one installed user app.");
        }
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
        reconcile(context);
    }

    public static boolean isPackageSelected(Context context, String packageName) {
        return packageName != null && getSelectedPackages(context).contains(packageName);
    }

    public static void reconcile(Context context) {
        Context app = context.getApplicationContext();
        if (!isEnabled(app)) {
            boolean released = releaseSuspendedPackages(app);
            stopFocusShield(app);
            cancelBoundaryAlarm(app);
            setLastState(app, released ? "disabled" : "policy_failed");
            return;
        }

        List<String> packages = getSelectedPackages(app);
        if (!isScheduleValid(app) || packages.isEmpty()) {
            boolean released = releaseSuspendedPackages(app);
            stopFocusShield(app);
            cancelBoundaryAlarm(app);
            setLastState(app, released ? "invalid_config" : "policy_failed");
            return;
        }

        scheduleNextBoundary(app);
        boolean active = isScheduleActive(app);
        if (isPolicyOwner(app)) {
            stopFocusShield(app);
            boolean success = applyPackageSuspension(app, packages, active);
            if (!active && success) setLastState(app, "waiting_for_schedule");
            else if (active && success) setLastState(app, "system_suspension");
            // applyPackageSuspension stores policy_failed or partial_suspension
            return;
        }

        if (!releaseSuspendedPackages(app)) {
            stopFocusShield(app);
            setLastState(app, "policy_failed");
            return;
        }
        if (!hasUsageAccess(app) || !hasOverlayPermission(app)) {
            stopFocusShield(app);
            setLastState(app, active ? "permission_required" : "waiting_for_schedule");
            return;
        }
        if (!active) {
            stopFocusShield(app);
            setLastState(app, "waiting_for_schedule");
            return;
        }

        try {
            if (!StudyModeFocusService.isRunning()) {
                Intent service = new Intent(app, StudyModeFocusService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) app.startForegroundService(service);
                else app.startService(service);
            }
            setLastState(app, StudyModeFocusService.isRunning() ? "focus_shield_running" : "focus_shield_starting");
        } catch (Exception error) {
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

    private static boolean applyPackageSuspension(Context context, List<String> selected, boolean active) {
        DevicePolicyManager policy = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (policy == null || !isPolicyOwner(context)) {
            releaseSuspendedPackages(context);
            setLastState(context, "policy_failed");
            return false;
        }

        List<String> previous = readAppliedPackages(context);
        if (!active) return releaseSuspendedPackages(context);

        Set<String> wanted = new HashSet<>(selected);
        List<String> stillSuspended = new ArrayList<>();
        List<String> obsolete = new ArrayList<>();
        for (String old : previous) if (!wanted.contains(old)) obsolete.add(old);

        if (!obsolete.isEmpty()) {
            try {
                String[] failedToRelease = policy.setPackagesSuspended(getAdminComponent(context), obsolete.toArray(new String[0]), false);
                if (failedToRelease != null) {
                    for (String name : failedToRelease) {
                        if (isInstalledPackage(context, name)) stillSuspended.add(name);
                    }
                }
            } catch (Exception error) {
                for (String name : obsolete) {
                    if (isInstalledPackage(context, name)) stillSuspended.add(name);
                }
            }
        }

        try {
            String[] failed = policy.setPackagesSuspended(null, selected.toArray(new String[0]), true);
            Set<String> rejected = new HashSet<>();
            if (failed != null) Collections.addAll(rejected, failed);
            for (String name : selected) if (!rejected.contains(name)) stillSuspended.add(name);
            List<String> applied = new ArrayList<>(new HashSet<>(stillSuspended));
            Collections.sort(applied);
            saveStringArray(prefs(context), KEY_APPLIED, applied);

            if (!stillSuspended.isEmpty() && !rejected.isEmpty()) {
                setLastState(context, "partial_suspension");
                return false;
            }
            if (stillSuspended.size() != selected.size()
                || !stillSuspended.containsAll(selected) || !rejected.isEmpty()) {
                setLastState(context, "partial_suspension");
                return false;
            }
            setLastState(context, "system_suspension");
            return true;
        } catch (SecurityException error) {
            saveStringArray(prefs(context), KEY_APPLIED, new ArrayList<>(new HashSet<>(previous)));
            setLastState(context, "policy_failed");
            return false;
        } catch (Exception error) {
            saveStringArray(prefs(context), KEY_APPLIED, new ArrayList<>(new HashSet<>(previous)));
            setLastState(context, "policy_failed");
            return false;
        }
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
            // Preserve the recovery list if Device Owner access disappeared; never
            // pretend that Android restrictions were released when no authority remains.
            saveStringArray(prefs(context), KEY_APPLIED, installed);
            setLastState(context, "policy_unavailable");
            return false;
        }

        try {
            String[] failed = policy.setPackagesSuspended(null, installed.toArray(new String[0]), false);
            List<String> stillSuspended = new ArrayList<>();
            if (failed != null) {
                for (String name : failed) {
                    if (isInstalledPackage(context, name)) stillSuspended.add(name);
                }
            }
            saveStringArray(prefs(context), KEY_APPLIED, stillSuspended);
            if (!stillSuspended.isEmpty()) {
                setLastState(context, "policy_failed");
                return false;
            }
            return true;
        } catch (Exception error) {
            saveStringArray(prefs(context), KEY_APPLIED, installed);
            setLastState(context, "policy_failed");
            return false;
        }
    }

    private static void startFocusShield(Context context) {
        Intent service = new Intent(context, StudyModeFocusService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
        else context.startService(service);
    }

    private static void stopFocusShield(Context context) {
        try { context.stopService(new Intent(context, StudyModeFocusService.class)); }
        catch (Exception ignored) {}
    }

    private static void scheduleNextBoundary(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        Calendar next = nextTransition(context, System.currentTimeMillis());
        if (next == null) {
            cancelBoundaryAlarm(context);
            return;
        }
        PendingIntent pending = boundaryPendingIntent(context);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            } else {
                manager.setExact(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            }
        } catch (SecurityException denied) {
            try {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            } catch (Exception ignored) {
                setLastState(context, "schedule_error");
            }
        } catch (Exception error) {
            setLastState(context, "schedule_error");
        }
    }

    private static PendingIntent boundaryPendingIntent(Context context) {
        Intent intent = new Intent(context, StudyModeAlarmReceiver.class);
        intent.setAction(ACTION_BOUNDARY);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags);
    }

    private static void cancelBoundaryAlarm(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager != null) {
            PendingIntent pending = boundaryPendingIntent(context);
            manager.cancel(pending);
            pending.cancel();
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
        config.put("notificationBlockingEnabled", isNotificationBlockingEnabled(context));

        JSObject permissions = new JSObject();
        permissions.put("usageAccess", hasUsageAccess(context));
        permissions.put("overlay", hasOverlayPermission(context));
        permissions.put("notificationAccess", hasNotificationAccess(context));
        permissions.put("exactAlarm", hasExactAlarmPermission(context));
        permissions.put("deviceOwner", isDeviceOwner(context));
        permissions.put("profileOwner", isProfileOwner(context));

        List<String> applied = readAppliedPackages(context);
        JSArray appliedArray = new JSArray();
        for (String name : applied) appliedArray.put(name);

        String state = prefs(context).getString(KEY_LAST_STATE, isEnabled(context) ? "waiting_for_schedule" : "disabled");
        if (isEnabled(context) && isScheduleActive(context)
            && !isPolicyOwner(context) && !hasUsageAccess(context)) state = "permission_required";
        if (isEnabled(context) && isScheduleActive(context)
            && !isPolicyOwner(context) && !hasOverlayPermission(context)) state = "permission_required";
        if (isEnabled(context) && isScheduleActive(context)
            && !isPolicyOwner(context) && hasUsageAccess(context) && hasOverlayPermission(context)
            && !StudyModeFocusService.isRunning()
            && ("focus_shield_running".equals(state) || "focus_shield_starting".equals(state))) {
            state = "service_stopped";
            setLastState(context, state);
        }

        boolean exactFallback = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasExactAlarmPermission(context);
        result.put("config", config);
        result.put("permissions", permissions);
        result.put("scheduleActive", isScheduleActive(context));
        result.put("monitoringServiceRunning", StudyModeFocusService.isRunning());
        result.put("enforcementMode", isPolicyOwner(context) ? "device_owner"
            : (hasUsageAccess(context) && hasOverlayPermission(context) ? "focus_shield" : "unavailable"));
        result.put("enforcementState", state);
        result.put("appliedPackages", appliedArray);
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
