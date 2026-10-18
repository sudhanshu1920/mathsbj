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

            int targetMinutes = targetValue == null ? 5 : Math.max(1, targetValue);
            long elapsedSeconds = elapsedValue == null ? 0L : Math.max(0L, (long) Math.floor(elapsedValue));
            boolean completed = elapsedSeconds >= targetMinutes * 60L;
            boolean enabled = Boolean.TRUE.equals(enabledValue);

            SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            preferences.edit()
                .putBoolean("enabled", enabled)
                .putInt("targetMinutes", targetMinutes)
                .putLong("elapsedSeconds", elapsedSeconds)
                .putBoolean("completed", completed)
                .putString("dayKey", dayKey == null ? "" : dayKey)
                .putString("scheduleMinutesJson", schedule == null ? "[]" : schedule)
                .putInt("schedulePolicyVersion", 2)
                .putString("marathiMessagesJson", marathi == null ? "[]" : marathi)
                .putString("hindiMessagesJson", hindi == null ? "[]" : hindi)
                .apply();

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
    public void syncHomeWidget(PluginCall call) {
        try {
            Integer targetValue = call.getInt("targetMinutes");
            Double elapsedValue = call.getDouble("elapsedSeconds");
            String dayKey = call.getString("dayKey");
            Integer currentStreakValue = call.getInt("currentStreak");

            if (dayKey == null || !dayKey.matches("\\d{4}-\\d{2}-\\d{2}")) {
                call.reject("Home screen widget day key is invalid.");
                return;
            }

            int targetMinutes = targetValue == null ? 5 : Math.max(1, Math.min(1440, targetValue));
            long elapsedSeconds = elapsedValue == null ? 0L : Math.max(0L, Math.min(31536000L, (long) Math.floor(elapsedValue)));
            int currentStreak = currentStreakValue == null ? 0 : Math.max(0, Math.min(1000000, currentStreakValue));

            getContext().getSharedPreferences("math_master_home_widget", Context.MODE_PRIVATE)
                .edit()
                .putInt("targetMinutes", targetMinutes)
                .putLong("elapsedSeconds", elapsedSeconds)
                .putString("dayKey", dayKey)
                .putInt("currentStreak", currentStreak)
                .apply();

            MathMasterHomeWidgetProvider.updateWidgets(getContext());
            JSObject result = new JSObject();
            result.put("synced", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to update the Math Master home screen widget.", error);
        }
    }

    @PluginMethod
    public void setHomeWidgetPreferences(PluginCall call) {
        try {
            Boolean enabledValue = call.getBoolean("enabled");
            String contentJson = call.getString("contentJson");
            String styleValue = call.getString("style");
            String themeValue = call.getString("theme");
            String accentValue = call.getString("accentColor");
            String appAccentValue = call.getString("appAccentColor");
            String modeValue = call.getString("mode");

            java.util.Set<String> allowed = new java.util.HashSet<>(java.util.Arrays.asList(
                "appIdentity", "target", "progress", "remaining", "studyTime", "streak", "updateStatus"
            ));
            org.json.JSONArray input = contentJson == null ? new org.json.JSONArray() : new org.json.JSONArray(contentJson);
            org.json.JSONArray content = new org.json.JSONArray();
            java.util.Set<String> seen = new java.util.HashSet<>();
            for (int i = 0; i < Math.min(input.length(), 7); i++) {
                String field = input.optString(i, "");
                if (allowed.contains(field) && seen.add(field)) content.put(field);
            }
            if (content.length() == 0) content.put("progress");

            String style = "compact".equals(styleValue) || "minimal".equals(styleValue) ? styleValue : "glass";
            String theme = "violet".equals(themeValue) ? "violet" : "app";
            String mode = "light".equals(modeValue) ? "light" : "dark";
            String accentColor = accentValue != null && accentValue.matches("#[0-9A-Fa-f]{6}")
                ? accentValue : "#B8A0FF";
            String appAccentColor = appAccentValue != null && appAccentValue.matches("#[0-9A-Fa-f]{6}")
                ? appAccentValue : "#3B82F6";
            boolean enabled = enabledValue == null || enabledValue.booleanValue();

            getContext().getSharedPreferences("math_master_home_widget", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("enabled", enabled)
                .putString("contentJson", content.toString())
                .putString("style", style)
                .putString("theme", theme)
                .putString("accentColor", accentColor)
                .putString("appAccentColor", appAccentColor)
                .putString("mode", mode)
                .apply();

            MathMasterHomeWidgetProvider.updateWidgetPreferences(getContext());
            JSObject result = new JSObject();
            result.put("synced", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to save home screen widget preferences.", error);
        }
    }

    @PluginMethod
    public void syncHomeWidgetUpdateStatus(PluginCall call) {
        Integer installedCodeValue = call.getInt("installedVersionCode");
        Integer latestCodeValue = call.getInt("latestVersionCode");
        String installedName = call.getString("installedVersionName");
        String latestName = call.getString("latestVersionName");
        if (installedCodeValue == null || latestCodeValue == null
            || installedCodeValue < 1 || latestCodeValue < 1
            || !isValidWidgetVersion(installedName) || !isValidWidgetVersion(latestName)) {
            JSObject result = new JSObject();
            result.put("synced", false);
            call.resolve(result);
            return;
        }

        MathMasterHomeWidgetProvider.updateReleaseStatus(
            getContext(),
            installedCodeValue.longValue(),
            installedName,
            latestCodeValue.longValue(),
            latestName
        );
        JSObject result = new JSObject();
        result.put("synced", true);
        call.resolve(result);
    }

    private static boolean isValidWidgetVersion(String version) {
        return version != null && version.length() <= 40
            && version.matches("[0-9]+(?:\\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?");
    }

    @PluginMethod
    public void consumeNotificationAction(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();
        String action = intent == null ? null : intent.getStringExtra("mathmaster_notification_action");
        if (action != null) {
            result.put("action", action);
            result.put("versionName", intent.getStringExtra("mathmaster_update_version_name"));
            result.put("versionCode", intent.getStringExtra("mathmaster_update_version_code"));
            result.put("updateManifestUrl", intent.getStringExtra("mathmaster_update_manifest_url"));
            intent.removeExtra("mathmaster_notification_action");
            intent.removeExtra("mathmaster_update_version_name");
            intent.removeExtra("mathmaster_update_version_code");
            intent.removeExtra("mathmaster_update_manifest_url");
            intent.removeExtra("mathmaster_notification_day");
        }
        call.resolve(result);
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
