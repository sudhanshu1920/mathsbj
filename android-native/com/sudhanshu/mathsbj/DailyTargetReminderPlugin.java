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

            if (enabled && hasNotificationPermission(getContext())) {
                // scheduleNext cancels today's remaining alarms if the goal is
                // complete, but leaves the next day's noon alarm queued.
                DailyTargetReminderReceiver.scheduleNext(getContext());
            } else {
                DailyTargetReminderReceiver.cancelScheduled(getContext());
            }

            JSObject result = new JSObject();
            result.put("scheduled", enabled && hasNotificationPermission(getContext()));
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
        JSObject result = new JSObject();
        try {
            // Firebase is an optional build-time integration. Reflection keeps the
            // app buildable when a Firebase client configuration has not been added.
            Class<?> messagingClass = Class.forName("com.google.firebase.messaging.FirebaseMessaging");
            Object messaging = messagingClass.getMethod("getInstance").invoke(null);
            Method method = messagingClass.getMethod(enabled ? "subscribeToTopic" : "unsubscribeFromTopic", String.class);
            method.invoke(messaging, "math_app_updates");
            result.put("configured", true);
            result.put("subscribed", enabled);
        } catch (ClassNotFoundException missingFirebase) {
            result.put("configured", false);
            result.put("subscribed", false);
        } catch (Exception error) {
            result.put("configured", false);
            result.put("subscribed", false);
            result.put("message", "Firebase update notifications are not available on this build.");
        }
        call.resolve(result);
    }

    public static boolean hasNotificationPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
