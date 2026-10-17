package com.sudhanshu.mathsbj;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MathMasterMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "app_updates";
    private static final int NOTIFICATION_ID = 8703;

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        boolean enabled = getSharedPreferences("math_master_background_notifications", Context.MODE_PRIVATE)
            .getBoolean("updateAlertsEnabled", false);
        if (enabled) {
            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .subscribeToTopic("math_app_updates")
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        android.util.Log.i("MathAppNotifications", "FCM topic subscription restored after token refresh.");
                    } else {
                        android.util.Log.w("MathAppNotifications", "FCM topic subscription restore failed after token refresh.");
                    }
                });
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        boolean enabled = getSharedPreferences("math_master_background_notifications", Context.MODE_PRIVATE)
            .getBoolean("updateAlertsEnabled", false);
        if (!enabled) {
            android.util.Log.i("MathAppNotifications", "Update push ignored because the user has disabled background notifications.");
            return;
        }
        if (!"app_update".equals(data.get("type"))) {
            android.util.Log.w("MathAppNotifications", "Ignoring an update push with an unknown message type.");
            return;
        }
        String versionName = data.get("versionName");
        String versionCode = data.get("versionCode");
        String apkUrl = data.get("apkUrl");
        String checksum = data.get("sha256");
        String manifestUrl = data.get("updateManifestUrl");
        if (versionName == null || !versionName.matches("[0-9]+\\.[0-9]+\\.[0-9]+")
            || versionCode == null || !versionCode.matches("[1-9][0-9]{0,9}")
            || !"https://github.com/sudhanshu1920/mathsbj-updates/releases/download/latest/MathMaster-release.apk".equals(apkUrl)
            || checksum == null || !checksum.matches("(?i)[a-f0-9]{64}")
            || !"https://raw.githubusercontent.com/sudhanshu1920/mathsbj-updates/main/updates/update.json".equals(manifestUrl)) {
            android.util.Log.w("MathAppNotifications", "Ignoring update push with invalid release metadata.");
            return;
        }
        String title = data.get("title");
        String body = data.get("body");
        if (title == null || title.trim().isEmpty()) title = "🎉 New Math App Update Available!";
        if (body == null || body.trim().isEmpty()) {
            body = "Version " + versionName + " is now available. Tap to view update details.";
        }
        showUpdateNotification(title, body, data);
    }

    private void showUpdateNotification(String title, String body, Map<String, String> data) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "App Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("New Math Master release notifications.");
            manager.createNotificationChannel(channel);
        }

        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setAction("com.sudhanshu.mathsbj.OPEN_APP_UPDATE");
        openApp.putExtra("mathmaster_notification_action", "app-update");
        openApp.putExtra("mathmaster_update_version_name", data.get("versionName"));
        openApp.putExtra("mathmaster_update_version_code", data.get("versionCode"));
        openApp.putExtra("mathmaster_update_manifest_url", data.get("updateManifestUrl"));
        openApp.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        Notification notification = builder
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setWhen(System.currentTimeMillis())
            .build();
        manager.notify("mathmaster-update", NOTIFICATION_ID, notification);
    }
}
