# Android Home Screen Widget

Math Master includes a native Android home-screen widget backed by the existing daily streak record. The widget displays today's target progress, elapsed/target study minutes, remaining minutes, current streak, and the latest known app-update status.

## Add it to the home screen

1. Install the latest Math Master Android APK and open the app once so it can sync the current progress.
2. Long-press an empty area of the Android home screen and choose **Widgets**.
3. Find **Math Master**, then drag the widget onto the home screen. Resize it if your launcher supports resizing.

Tap the widget to open Math Master. When an update is known to be available, tapping also asks the app to refresh its normal verified update check; it does not bypass package, checksum, or signing-certificate validation.

## Widget customization

Open **Settings → Home Screen Widgets** to toggle widget presentation and choose which progress fields, style, and theme are used as defaults. The Settings row stays compact when the option is off. Turning it off leaves pinned launcher widgets in place with a disabled-state display; it does not remove widgets or stop the app's normal study tracking and daily reminders.

When adding a widget through Android's launcher picker, the native **Customize Your Widget** screen saves selected content, style, and theme against that unique Android widget ID. Multiple instances can therefore use different fields and appearance. Android 12 and newer expose the reconfigure capability where the launcher supports it; on older launchers, remove and add a widget again to choose another configuration. Global default changes do not overwrite a previously saved instance-specific choice. The weekly target tracker is now an independent selectable field; it shows the last seven local calendar dates and uses ticks only for saved daily records marked completed. Existing widget instances receive this new field once during the content-schema migration, and it can then be switched off per instance. Random Premium Theme chooses an unused palette where possible, saves the resolved palette and random-mode selection per widget, and keeps that palette stable across refreshes. Available palettes include Emerald, Ocean, Graphite, Rose Quartz, Midnight Violet, Sapphire, and Aurora Glass. Android 12+ uses launcher-provided size options to send size-specific RemoteViews; older Android versions use the safest layout variant derivable from available options. The minimum widget height is increased to preserve readability when the weekly tracker and other fields are selected.

The widget chooses compact, regular, or wide layouts from the launcher's reported size. Typography scales with the resolved width and height (with safe minimums), and the primary metric, target, supporting labels, and weekly tracker use a clearer size hierarchy. When both primary and supporting fields are selected and there is enough vertical room, a weighted spacer distributes those sections through the available height; simpler selections are vertically centered rather than pinned to the top. Narrow/very short tiles retain the compact layout, while medium-height tiles keep the more readable regular layout. Selecting a field no longer makes it disappear merely because the widget is small. Selecting **Streak** also displays the last seven local days with a tick on each day whose existing streak record marks its target complete. Target completion applies a stable celebratory accent chosen from a small palette for that day, while the widget surface uses a translucent glass treatment. Android launchers still control placement, resizing bounds, and exact refresh scheduling.

## Refresh and data behavior

- Progress is copied from the existing `math-app-streak-v1` daily record. It is not stored in a second target-tracking system.
- While the app is actively tracking study time, the widget refreshes at minute boundaries and when target/streak settings change. Android also refreshes the local presentation periodically and resets the displayed progress when the local date changes.
- A successful in-app update check refreshes the update line. A validated Firebase release push can also set the update badge while the app is closed, provided Firebase is configured in the installed APK and update notifications are enabled.
- Android launchers control widget sizing, exact refresh timing, and whether the widget is available on the lock screen. The widget does not install updates automatically.

## Build requirement

This is a native Android AppWidget. Install an Android APK built with this source before looking for **Math Master** in the home-screen widget picker; updating only the web/PWA bundle cannot add a native widget to an older installed APK. Responsive widget layout, typography, and empty-container visibility changes are included in the merged home-screen widget update. After a release build succeeds, install that APK and verify the widget at compact, medium, wide, and tall sizes; CI compilation alone does not verify launcher-specific rendering.

## Premium composition previews

The native **Customize Your Widget** screen now shows an artwork-backed preview for the selected design, with a live sample percentage and the selected supporting metrics. Choose from Hero Wide, Compact Green, Square Math Bot, Medium Study, Square Cosmic, Extra-Wide Weekly, Minimal Progress, or Auto Responsive. The preview uses the same optimized artwork crop helper as the launcher renderer; it remains a configuration preview, not proof of pixel-perfect rendering on every launcher or screen size. Runtime artwork is region-decoded to a bounded rendition instead of allocating the entire high-resolution atlas as an ARGB bitmap. The packaged widget layouts normalize the self-closing artwork-overlay node to a RemoteViews-supported `FrameLayout` before Android resource compilation.


## Follow-up visual correction (v1.0.23 source)

The first device screenshots from v1.0.22 showed that the weighted vertical spacer could separate the primary progress row from study-time, streak, and weekly content. The provider now keeps that spacer hidden and centers the compact content group to prevent a large empty band through the card. Primary percentage/target typography has a stronger minimum hierarchy, artwork is no longer faded by a separate image alpha, and per-design tint overlays use lower opacity so the illustrations retain their color. Automated layout tests cover these rules. Physical-launcher rendering remains unverified until this build is installed and compared on-device.
