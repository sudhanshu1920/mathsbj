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
            com.google.firebase.messaging.FirebaseMessaging.getInstance().subscribeToTopic("math_app_updates");
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        // Firebase renders notification payloads itself while the app is in the
        // background. This service surfaces the same alert when Math Master is
        // already foregrounded.
        String title = message.getNotification() != null ? message.getNotification().getTitle() : null;
        String body = message.getNotification() != null ? message.getNotification().getBody() : null;
        Map<String, String> data = message.getData();
        if (title == null || title.trim().isEmpty()) title = "🎉 New Math App Update Available!";
        if (body == null || body.trim().isEmpty()) {
            String version = data.get("versionName");
            body = version == null
                ? "A new version is available. Tap to view update details."
                : "Version " + version + " is now available. Tap to view the update.";
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
