package com.sudhanshu.mathsbj;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;

import java.text.SimpleDateFormat;
import java.text.ParsePosition;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.lang.reflect.Method;

@CapacitorPlugin(
    name = "MathMasterNotifications",
    permissions = {
        @Permission(alias = "postNotifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class DailyTargetReminderPlugin extends Plugin {
    private static final String PREFS = "math_master_background_notifications";

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("postNotifications", call, "notificationPermissionResult");
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void syncDailyTarget(PluginCall call) {
        try {
            Boolean enabledValue = call.getBoolean("enabled");
            Integer targetValue = call.getInt("targetMinutes");
            Double elapsedValue = call.getDouble("elapsedSeconds");
            String dayKey = call.getString("dayKey");
            String schedule = call.getString("scheduleMinutesJson");
            String marathi = call.getString("marathiMessagesJson");
            String hindi = call.getString("hindiMessagesJson");
            Integer currentStreak = call.getInt("currentStreak");
            String completedDaysJson = call.getString("completedDaysJson");

            int targetMinutes = targetValue == null ? 5 : Math.max(1, Math.min(1440, targetValue));
            long elapsedSeconds = elapsedValue == null || Double.isNaN(elapsedValue) || Double.isInfinite(elapsedValue)
                ? 0L : (long) Math.min(31536000d, Math.max(0d, Math.floor(elapsedValue)));
            String safeDayKey = isValidDateKey(dayKey) && todayKey().equals(dayKey) ? dayKey : "";
            if (safeDayKey.isEmpty()) elapsedSeconds = 0L;
            JSONArray completedDays = sanitizeCompletedDays(completedDaysJson);
            boolean completed = elapsedSeconds >= targetMinutes * 60L;
            boolean enabled = Boolean.TRUE.equals(enabledValue);

            SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            preferences.edit()
                .putBoolean("enabled", enabled)
                .putInt("targetMinutes", targetMinutes)
                .putLong("elapsedSeconds", elapsedSeconds)
                .putBoolean("completed", completed)
                .putString("dayKey", safeDayKey)
                .putString("scheduleMinutesJson", schedule == null ? "[]" : schedule)
                .putInt("schedulePolicyVersion", DailyTargetReminderReceiver.REMINDER_POLICY_VERSION)
                .putString("marathiMessagesJson", marathi == null ? "[]" : marathi)
                .putString("hindiMessagesJson", hindi == null ? "[]" : hindi)
                .apply();

            MathMasterHomeWidgetProvider.syncProgressSnapshot(
                getContext(), targetMinutes, elapsedSeconds,
                currentStreak == null ? 0 : currentStreak,
                safeDayKey, completedDays.toString()
            );

            boolean scheduled = false;
            if (enabled && hasNotificationPermission(getContext())) {
                // scheduleNext cancels today\'s remaining alarms if the goal is
                // complete, but leaves the next day\'s noon alarm queued.
                scheduled = DailyTargetReminderReceiver.scheduleNext(getContext());
            } else {
                DailyTargetReminderReceiver.cancelScheduled(getContext());
                DailyTargetReminderReceiver.cancelVisibleReminder(getContext());
            }

            JSObject result = new JSObject();
            boolean syncSucceeded = !enabled || (hasNotificationPermission(getContext()) && scheduled);
            result.put("synced", syncSucceeded);
            result.put("scheduled", enabled && hasNotificationPermission(getContext()) && scheduled);
            if (!syncSucceeded) android.util.Log.w("MathAppReminders", "Notification preference sync could not create a pending reminder alarm.");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to sync daily target reminders.", error);
        }
    }

    @PluginMethod
    public void syncWidgetUpdateStatus(PluginCall call) {
        Double installedCodeValue = call.getDouble("installedVersionCode");
        Double latestCodeValue = call.getDouble("latestVersionCode");
        String installedName = call.getString("installedVersionName");
        String latestName = call.getString("latestVersionName");
        if (installedCodeValue == null || latestCodeValue == null
            || Double.isNaN(installedCodeValue) || Double.isInfinite(installedCodeValue)
            || Double.isNaN(latestCodeValue) || Double.isInfinite(latestCodeValue)) {
            call.reject("Verified widget update versions are required.");
            return;
        }
        long installedCode = installedCodeValue.longValue();
        long latestCode = latestCodeValue.longValue();
        if (installedCode < 1L || installedCode > 2100000000L
            || latestCode < 1L || latestCode > 2100000000L
            || installedName == null || latestName == null) {
            call.reject("Verified widget update versions are invalid.");
            return;
        }
        boolean synced = MathMasterHomeWidgetProvider.updateReleaseStatus(
            getContext(), installedCode, installedName, latestCode, latestName);
        JSObject result = new JSObject();
        result.put("synced", synced);
        call.resolve(result);
    }

    @PluginMethod
    public void consumeNotificationAction(PluginCall call) {
        JSObject result = new JSObject();
        if (getActivity() == null) {
            call.resolve(result);
            return;
        }
        Intent intent = getActivity().getIntent();
        if (intent == null) {
            call.resolve(result);
            return;
        }

        String notificationAction = intent.getStringExtra("mathmaster_notification_action");
        if ("study-reminder".equals(notificationAction) || "app-update".equals(notificationAction)) {
            result.put("action", notificationAction);
            putOptional(result, "versionName", intent.getStringExtra("mathmaster_update_version_name"));
            putOptional(result, "versionCode", intent.getStringExtra("mathmaster_update_version_code"));
            putOptional(result, "updateManifestUrl", intent.getStringExtra("mathmaster_update_manifest_url"));
        }

        String widgetAction = intent.getStringExtra("mathmaster_widget_action");
        if (isAllowedWidgetAction(widgetAction)) result.put("widgetAction", widgetAction);

        intent.removeExtra("mathmaster_notification_action");
        intent.removeExtra("mathmaster_update_version_name");
        intent.removeExtra("mathmaster_update_version_code");
        intent.removeExtra("mathmaster_update_manifest_url");
        intent.removeExtra("mathmaster_widget_action");
        intent.removeExtra("mathmaster_widget_id");
        getActivity().setIntent(intent);
        call.resolve(result);
    }

    private static void putOptional(JSObject result, String key, String value) {
        if (value != null && value.length() <= 512) result.put(key, value);
    }

    private static boolean isAllowedWidgetAction(String action) {
        return "home".equals(action) || "progress".equals(action) || "target".equals(action)
            || "streak".equals(action) || "weekly".equals(action) || "quiz".equals(action)
            || "app-update".equals(action);
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    private static boolean isValidDateKey(String value) {
        return parseLocalDate(value) != null;
    }

    private static Date parseLocalDate(String value) {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) return null;
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setLenient(false);
        ParsePosition position = new ParsePosition(0);
        Date parsed = formatter.parse(value, position);
        if (parsed == null || position.getIndex() != value.length() || !value.equals(formatter.format(parsed))) {
            return null;
        }
        Calendar normalized = Calendar.getInstance();
        normalized.setTime(parsed);
        normalized.set(Calendar.HOUR_OF_DAY, 12);
        normalized.set(Calendar.MINUTE, 0);
        normalized.set(Calendar.SECOND, 0);
        normalized.set(Calendar.MILLISECOND, 0);
        return normalized.getTime();
    }

    private static JSONArray sanitizeCompletedDays(String completedDaysRaw) {
        JSONArray completedDays = new JSONArray();
        if (completedDaysRaw == null || completedDaysRaw.length() > 512) return completedDays;
        final JSONArray incomingDays;
        try {
            incomingDays = new JSONArray(completedDaysRaw);
        } catch (JSONException ignored) {
            return completedDays;
        }
        if (incomingDays.length() > 7) return completedDays;

        Calendar today = Calendar.getInstance();
        today.set(Calendar.HOUR_OF_DAY, 12);
        today.set(Calendar.MINUTE, 0);
        today.set(Calendar.SECOND, 0);
        today.set(Calendar.MILLISECOND, 0);
        Calendar firstAllowed = (Calendar) today.clone();
        firstAllowed.add(Calendar.DAY_OF_MONTH, -6);
        Set<String> seen = new HashSet<>();

        for (int i = 0; i < incomingDays.length(); i++) {
            Object rawDate = incomingDays.opt(i);
            if (!(rawDate instanceof String)) continue;
            String date = (String) rawDate;
            Date parsed = parseLocalDate(date);
            if (parsed == null || seen.contains(date)) continue;
            Calendar candidate = Calendar.getInstance();
            candidate.setTime(parsed);
            if (candidate.after(today) || candidate.before(firstAllowed)) continue;
            if (seen.add(date)) completedDays.put(date);
        }
        return completedDays;
    }

    @PluginMethod
    public void setUpdateAlerts(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled"));
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("updateAlertsEnabled", enabled).apply();
        try {
            // Firebase is optional for local reminders. Wait for the real async
            // topic result instead of reporting subscribed=true immediately.
            Class<?> messagingClass = Class.forName("com.google.firebase.messaging.FirebaseMessaging");
            Object messaging = messagingClass.getMethod("getInstance").invoke(null);
            java.lang.reflect.Method method = messagingClass.getMethod(
                enabled ? "subscribeToTopic" : "unsubscribeFromTopic", String.class);
            Object task = method.invoke(messaging, "math_app_updates");
            Class<?> listenerClass = Class.forName("com.google.android.gms.tasks.OnCompleteListener");
            java.lang.reflect.Method addListener = null;
            Class<?> taskClass = Class.forName("com.google.android.gms.tasks.Task");
            addListener = taskClass.getMethod("addOnCompleteListener", listenerClass);
            Object listener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.getClassLoader(),
                new Class<?>[] { listenerClass },
                (proxy, invoked, args) -> {
                    if ("onComplete".equals(invoked.getName()) && args != null && args.length == 1) {
                        Object completedTask = args[0];
                        boolean success = Boolean.TRUE.equals(
                            taskClass.getMethod("isSuccessful").invoke(completedTask));
                        JSObject result = new JSObject();
                        result.put("configured", true);
                        result.put("success", success);
                        result.put("subscribed", success && enabled);
                        if (!success) {
                            android.util.Log.w("MathAppNotifications",
                                "FCM topic subscription operation failed; update push may not be enabled.");
                            result.put("message", "Firebase topic subscription failed.");
                        } else {
                            android.util.Log.i("MathAppNotifications",
                                enabled ? "Subscribed to app update topic." : "Unsubscribed from app update topic.");
                        }
                        call.resolve(result);
                    }
                    return null;
                });
            addListener.invoke(task, listener);
        } catch (ClassNotFoundException missingFirebase) {
            JSObject result = new JSObject();
            result.put("configured", false);
            result.put("subscribed", false);
            result.put("message", "Firebase update notifications are not available on this build.");
            call.resolve(result);
        } catch (Exception error) {
            android.util.Log.w("MathAppNotifications", "Unable to configure FCM update topic.", error);
            JSObject result = new JSObject();
            result.put("configured", true);
            result.put("success", false);
            result.put("subscribed", false);
            result.put("message", "Firebase topic subscription could not be confirmed.");
            call.resolve(result);
        }
    }

    public static boolean hasNotificationPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
