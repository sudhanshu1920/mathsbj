# Background Notifications Setup

This feature uses the existing daily-streak record as the source of truth for study time. Daily reminders are scheduled locally on Android; new-version alerts are sent server-side through Firebase Cloud Messaging (FCM) after a signed APK and its public update manifest have been verified.

## Enable on an Android installation

Open **Settings → Background notifications** and enable it once. This requests Android notification permission at the point the user opts in. Turning it off cancels study reminders and unsubscribes the installation from the app-update topic.

Study reminders use the existing `math-app-streak-v1` record (target minutes and today's tracked seconds). Policy v3 schedules local reminders at 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 19:45, 20:30, 21:00, 21:30, 21:50 and 22:00 in the device's local time zone. Only one stable AlarmManager alarm is pending at a time. Each alarm validates the current local day, latest saved target progress, opt-in and notification permission, chooses one Marathi or Hindi stage message and schedules only the next future slot; missed slots are not replayed as a backlog. Once the target is complete, remaining reminders for that day are canceled and the next day's 09:00 slot is retained. At 22:00, the final reminder is the last slot; the receiver discards a delayed alarm after the cutoff. Android's inexact allow-while-idle alarm can be delayed by Doze/OEM power controls; the app does not request exact-alarm permission solely to promise minute-perfect delivery.

## Configure Firebase push for release alerts

Firebase Android configuration and privileged FCM credentials must be supplied through GitHub Actions secrets and are deliberately not committed to the repository. The existing release run 38992291241 logged that FCM accepted version 1.0.8/build 1143; that is evidence of server-side acceptance for that run, not proof that a particular Android device received or displayed it. Each future build can still skip push if required secrets/configuration are absent.

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

## Rebuild after enabling Firebase

Firebase Messaging is injected into the Android APK at build time; adding GitHub secrets does not enable FCM in an APK that has already been published or installed. Once both `MATHMASTER_FIREBASE_GOOGLE_SERVICES_JSON_BASE64` and `MATHMASTER_FIREBASE_SERVICE_ACCOUNT_JSON` are configured, trigger a new production release from a new `main` commit (with a commit message beginning `[BUILD_APK]`) or use the release workflow's manual dispatch. A new source commit is important: the version resolver deliberately reuses the same version for the same source commit, so simply rerunning the already-published commit would not produce an installable newer Firebase-enabled APK.
