# Background Notifications Setup

This feature uses the existing daily-streak record as the source of truth for study time. Daily reminders are scheduled locally on Android; new-version alerts are sent server-side through Firebase Cloud Messaging (FCM) after a signed APK and its public update manifest have been verified.

## Enable on an Android installation

Open **Settings → Background notifications** and enable it once. This requests Android notification permission at the point the user opts in. Turning it off cancels study reminders and unsubscribes the installation from the app-update topic.

Study reminders use the existing `math-app-streak-v1` record (target minutes and today's tracked seconds). The default local schedule is 12:00, 14:00, 16:00, 18:00, 20:00 and 22:00 in the device's local time zone. Each alarm checks the latest state saved by the app, picks a Marathi or Hindi message, and schedules the next eligible slot. Completing the target disables the pending study reminder. If there is no later slot today, the next alarm is set for tomorrow at noon.

## Configure Firebase push for release alerts

The repository currently has no committed Firebase Android configuration or privileged FCM sender credential. Release push is therefore **inactive until the following GitHub Actions secrets are set**.

1. In Firebase Console, create/select the Firebase project and register an Android app with application ID `com.sudhanshu.mathsbj`. Download its `google-services.json`, make sure it contains this exact Android package, then Base64-encode the file (for example, `base64 -w 0 google-services.json`).
2. Add repository secret **`MATHMASTER_FIREBASE_GOOGLE_SERVICES_JSON_BASE64`** with that Base64 text. The Android release workflow injects it into the generated Android project only during the build, adds the Firebase Messaging SDK and declares the topic subscription service.
3. In the same Firebase project, create a service account with permission to send Firebase Cloud Messaging messages. Store the full service-account JSON in repository secret **`MATHMASTER_FIREBASE_SERVICE_ACCOUNT_JSON`**. Never commit this JSON or place it in the APK.
4. The existing **`MATHMASTER_UPDATES_TOKEN`** secret must remain configured with Contents read/write access to `sudhanshu1920/mathsbj-updates`; the release workflow already needs it to publish the APK update manifest and uses it to store push deduplication state.

After setup, the Android release workflow sends a push to topic `math_app_updates` only after the signed APK is validated and the published `updates/update.json` is verified. Installation subscribes to the topic after background notifications are enabled. The sender validates package, version, the allowlisted APK URL and SHA-256, checks the previously notified version/source commit, and writes notification state after FCM accepts the message. A stable Android notification tag replaces a duplicate alert for the same app-update slot.

Users need to install a Firebase-enabled APK once and opt in before their installation can receive FCM update pushes; older already-installed APKs without Firebase cannot receive this new push feature. If either Firebase secret is missing, the APK build continues without FCM and Actions prints a warning rather than pretending a push was sent. Local study reminders do not depend on Firebase or network access.

## Delivery limitations

- Android 13+ requires the notification permission to be granted.
- Study alarms use `AlarmManager.setAndAllowWhileIdle` instead of restricted exact alarms. Doze/OEM power policies may delay their delivery.
- Android force-stop, revoked notifications, vendor battery restrictions, or a device that has not been unlocked after reboot can delay or prevent delivery. The app does not attempt to bypass these restrictions.
- FCM acceptance confirms the server accepted a push, not that every device displayed it. Devices must have a recent app build containing the Firebase client configuration and must have opted into notifications.
- The public release manifest is still checked by the existing in-app updater when the app opens/resumes; the push notification does not bypass APK signature/checksum validation or automatically install an APK.
