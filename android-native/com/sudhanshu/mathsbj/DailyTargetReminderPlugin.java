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
            Boolean completedValue = call.getBoolean("completed");
            Integer targetValue = call.getInt("targetMinutes");
            Double elapsedValue = call.getDouble("elapsedSeconds");
            String dayKey = call.getString("dayKey");
            String schedule = call.getString("scheduleMinutesJson");
            String marathi = call.getString("marathiMessagesJson");
            String hindi = call.getString("hindiMessagesJson");

            int targetMinutes = targetValue == null ? 5 : Math.max(1, targetValue);
            long elapsedSeconds = elapsedValue == null ? 0L : Math.max(0L, (long) Math.floor(elapsedValue));
            boolean completed = Boolean.TRUE.equals(completedValue) || elapsedSeconds >= targetMinutes * 60L;
            boolean enabled = Boolean.TRUE.equals(enabledValue);

            SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            preferences.edit()
                .putBoolean("enabled", enabled)
                .putInt("targetMinutes", targetMinutes)
                .putLong("elapsedSeconds", elapsedSeconds)
                .putBoolean("completed", completed)
                .putString("dayKey", dayKey == null ? "" : dayKey)
                .putString("scheduleMinutesJson", schedule == null ? "[]" : schedule)
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
            for (java.lang.reflect.Method candidate : task.getClass().getMethods()) {
                if ("addOnCompleteListener".equals(candidate.getName())
                    && candidate.getParameterTypes().length == 1
                    && candidate.getParameterTypes()[0].equals(listenerClass)) {
                    addListener = candidate;
                    break;
                }
            }
            if (addListener == null) throw new NoSuchMethodException("Firebase Task listener is unavailable");
            Object listener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.getClassLoader(),
                new Class<?>[] { listenerClass },
                (proxy, invoked, args) -> {
                    if ("onComplete".equals(invoked.getName()) && args != null && args.length == 1) {
                        Object completedTask = args[0];
                        boolean success = Boolean.TRUE.equals(
                            completedTask.getClass().getMethod("isSuccessful").invoke(completedTask));
                        JSObject result = new JSObject();
                        result.put("configured", success);
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
            result.put("configured", false);
            result.put("subscribed", false);
            result.put("message", "Firebase update notifications are not available on this build.");
            call.resolve(result);
        }
    }

    public static boolean hasNotificationPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
