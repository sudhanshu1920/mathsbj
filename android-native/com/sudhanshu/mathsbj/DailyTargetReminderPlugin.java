package com.sudhanshu.mathsbj;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;

import java.lang.reflect.Method;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

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
            long elapsedSeconds = normalizeElapsedSeconds(elapsedValue);
            int streakDays = currentStreak == null ? 0 : Math.max(0, Math.min(1_000_000, currentStreak));
            String normalizedDayKey = normalizeDayKey(dayKey);
            JSONArray completedDays = sanitizeCompletedDays(completedDaysJson);
            boolean completed = elapsedSeconds >= targetMinutes * 60L;
            boolean enabled = Boolean.TRUE.equals(enabledValue);

            SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            preferences.edit()
                .putBoolean("enabled", enabled)
                .putInt("targetMinutes", targetMinutes)
                .putLong("elapsedSeconds", elapsedSeconds)
                .putBoolean("completed", completed)
                .putString("dayKey", normalizedDayKey)
                .putString("scheduleMinutesJson", schedule == null ? "[]" : schedule)
                .putInt("schedulePolicyVersion", DailyTargetReminderReceiver.REMINDER_POLICY_VERSION)
                .putString("marathiMessagesJson", marathi == null ? "[]" : marathi)
                .putString("hindiMessagesJson", hindi == null ? "[]" : hindi)
                .apply();

            MathMasterHomeWidgetProvider.syncProgressSnapshot(
                getContext(), targetMinutes, elapsedSeconds,
                streakDays,
                normalizedDayKey, completedDays.toString()
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

    private static long normalizeElapsedSeconds(Double value) {
        if (value == null || Double.isNaN(value) || value <= 0d) return 0L;
        if (Double.isInfinite(value) || value >= (double) Long.MAX_VALUE) return Long.MAX_VALUE;
        return (long) Math.floor(value);
    }

    private static String normalizeDayKey(String dayKey) {
        if (dayKey == null || !dayKey.matches("\\d{4}-\\d{2}-\\d{2}")) return "";
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setLenient(false);
        try {
            Date parsed = formatter.parse(dayKey);
            if (parsed == null) return "";
            Calendar candidate = Calendar.getInstance();
            candidate.setTime(parsed);
            setCalendarToNoon(candidate);
            Calendar today = Calendar.getInstance();
            setCalendarToNoon(today);
            return candidate.after(today) ? "" : dayKey;
        } catch (ParseException invalidDate) {
            return "";
        }
    }

    private static JSONArray sanitizeCompletedDays(String completedDaysRaw) {
        JSONArray completedDays = new JSONArray();
        if (completedDaysRaw == null || completedDaysRaw.length() > 512) return completedDays;
        try {
            JSONArray incomingDays = new JSONArray(completedDaysRaw);
            if (incomingDays.length() > 7) return completedDays;
            Set<String> seen = new HashSet<>();
            for (int i = 0; i < incomingDays.length(); i++) {
                String date = incomingDays.optString(i, "");
                if (isDateInTrailingSevenDays(date) && seen.add(date)) completedDays.put(date);
            }
        } catch (JSONException invalidJson) {
            // Malformed optional history is treated as an empty week.
        }
        return completedDays;
    }

    private static boolean isDateInTrailingSevenDays(String date) {
        if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}")) return false;
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        formatter.setLenient(false);
        final Date parsed;
        try {
            parsed = formatter.parse(date);
        } catch (ParseException invalidDate) {
            return false;
        }
        if (parsed == null) return false;

        Calendar candidate = Calendar.getInstance();
        candidate.setTime(parsed);
        setCalendarToNoon(candidate);
        Calendar today = Calendar.getInstance();
        setCalendarToNoon(today);
        if (candidate.after(today)) return false;

        Calendar firstAllowed = (Calendar) today.clone();
        firstAllowed.add(Calendar.DAY_OF_MONTH, -6);
        return !candidate.before(firstAllowed);
    }

    private static void setCalendarToNoon(Calendar calendar) {
        calendar.set(Calendar.HOUR_OF_DAY, 12);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
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

    @PluginMethod
    public void consumeNotificationAction(PluginCall call) {
        JSObject result = new JSObject();
        try {
            Intent launchIntent = getActivity() == null ? null : getActivity().getIntent();
            String action = launchIntent == null ? null : launchIntent.getStringExtra("mathmaster_notification_action");
            if (!isSupportedAction(action)) action = "";

            result.put("action", action);
            if (launchIntent != null && !action.isEmpty()) {
                putIfPresent(result, "versionName", launchIntent.getStringExtra("mathmaster_update_version_name"));
                putIfPresent(result, "versionCode", launchIntent.getStringExtra("mathmaster_update_version_code"));
                putIfPresent(result, "updateManifestUrl", launchIntent.getStringExtra("mathmaster_update_manifest_url"));
                putIfPresent(result, "dayKey", launchIntent.getStringExtra("mathmaster_notification_day"));

                // Consume the one-shot action so later resume events cannot replay it.
                launchIntent.removeExtra("mathmaster_notification_action");
                launchIntent.removeExtra("mathmaster_update_version_name");
                launchIntent.removeExtra("mathmaster_update_version_code");
                launchIntent.removeExtra("mathmaster_update_manifest_url");
                launchIntent.removeExtra("mathmaster_notification_day");
            }
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to read the pending Math Master notification action.", error);
        }
    }

    private static boolean isSupportedAction(String action) {
        if (action == null) return false;
        switch (action) {
            case "study-reminder":
            case "app-update":
                return true;
            default:
                return false;
        }
    }

    private static void putIfPresent(JSObject result, String key, String value) {
        if (value != null && !value.isEmpty()) result.put(key, value);
    }

    public static boolean hasNotificationPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
