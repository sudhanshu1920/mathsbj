# Android Home Screen Widget

Math Master includes a native Android home-screen widget backed by the existing daily streak record. The widget displays today's target progress, elapsed/target study minutes, remaining minutes, current streak, and the latest known app-update status.

## Add it to the home screen

1. Install the latest Math Master Android APK and open the app once so it can sync the current progress.
2. Long-press an empty area of the Android home screen and choose **Widgets**.
3. Find **Math Master**, then drag the widget onto the home screen. Resize it if your launcher supports resizing.

Tap the widget to open Math Master. When an update is known to be available, tapping also asks the app to refresh its normal verified update check; it does not bypass package, checksum, or signing-certificate validation.

## Refresh and data behavior

- Progress is copied from the existing `math-app-streak-v1` daily record. It is not stored in a second target-tracking system.
- While the app is actively tracking study time, the widget refreshes at minute boundaries and when target/streak settings change. Android also refreshes the local presentation periodically and resets the displayed progress when the local date changes.
- A successful in-app update check refreshes the update line. A validated Firebase release push can also set the update badge while the app is closed, provided Firebase is configured in the installed APK and update notifications are enabled.
- Android launchers control widget sizing, exact refresh timing, and whether the widget is available on the lock screen. The widget does not install updates automatically.

## Build requirement

This is a native Android AppWidget. Install an Android APK built with this source before looking for **Math Master** in the home-screen widget picker; updating only the web/PWA bundle cannot add a native widget to an older installed APK.
