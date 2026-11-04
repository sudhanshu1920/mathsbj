# Android Home Screen Widget

Math Master includes a native Android home-screen widget backed by the existing daily streak record. The widget displays today's target progress, elapsed/target study minutes, remaining minutes, current streak, and the latest known app-update status.

## Add it to the home screen

1. Install the latest Math Master Android APK and open the app once so it can sync the current progress.
2. Long-press an empty area of the Android home screen and choose **Widgets**.
3. Find **Math Master**, then drag the widget onto the home screen. Resize it if your launcher supports resizing.

Tap the widget to open Math Master. When an update is known to be available, tapping also asks the app to refresh its normal verified update check; it does not bypass package, checksum, or signing-certificate validation.

## Widget customization

Widget customization is intentionally owned by Android's launcher and the native **Customize Your Widget** activity; there is no duplicate **Settings → Home Screen Widgets** page in the current app. Long-press a pinned Math Master widget and choose **Configure/Edit** when the launcher supports reconfiguration. When adding a widget, the configuration activity is shown automatically.

Each Android AppWidget ID saves its own content selection, composition, style, and theme. Save commits the selection; Cancel leaves the previous configuration untouched. Multiple instances can therefore use different layouts and themes without overwriting one another. The available compositions are Hero Wide, Compact Green, Square Math Bot, Medium Study, Square Cosmic, Extra-Wide Weekly, and Minimal Progress. The selected composition routes through compact, regular, and wide RemoteViews layouts; **Auto** chooses a layout from launcher-reported dimensions. Styles are Glass, Compact, and Minimal. Themes include Match App Theme, Emerald, Ocean, Graphite, Rose Quartz, Midnight Violet, Sapphire, Aurora Glass, and Random Premium Theme. Random mode stores its resolved palette for that widget so refreshes do not reshuffle its appearance.

Available content fields are App Identity, Today's Target, Progress, Remaining Target, Study Time, Streak, Weekly Target Tracker, Update Status, and **Open Quiz (Practice)**. The quiz option is a truthful navigation shortcut to the existing Practice/Quiz section; it does not claim that a quiz is scheduled and does not invent a question count. The update line is only marked current or available after the app's normal verified update check succeeds. Tapping it opens that normal update-check flow; the widget never installs an APK or bypasses checksum, package, or signing-certificate validation.

The current UX has no global widget enable/disable or global default-design screen. Existing per-instance settings remain launcher-owned. Android 12+ advertises the reconfigure capability when the launcher supports it; on older launchers, remove and add the widget again to choose another configuration. Android decides the exact resize affordances and presentation of the configuration activity.

The seven-day tracker uses the app's established trailing-seven-local-calendar-days convention (not a synthetic Monday-to-Sunday aggregate). It displays only saved daily streak records marked completed; missing, malformed, future, or out-of-window dates remain incomplete. The provider keeps the content group compact and centered rather than distributing weighted empty space through the card. Typography scales to the reported width and height with bounded minimum/maximum sizes.
## Refresh and data behavior

- Progress is synchronized from the existing `getStreak()` daily record through the native `MathMasterNotifications` bridge. No second timer or progress database is created.
- Today's elapsed seconds are accepted only for a strictly valid local `yyyy-MM-dd` day key matching today. Target minutes are bounded to 1–1440; non-finite/negative elapsed values are rejected or clamped. A stale day key resets today's displayed elapsed value to zero.
- The current streak is copied from the existing streak engine. Weekly checkmarks are derived only from saved completion flags in the trailing seven local dates; native input rejects malformed JSON, oversized arrays, invalid calendar dates, duplicates, future dates, and records outside that window.
- The app syncs native widgets when the daily record changes and at active-session minute boundaries. Boot, package replacement, system date change, time change, and timezone change also request a refresh of all pinned widget IDs. Each ID is rendered from its own saved presentation settings.
- Only a successful `checkForAppUpdate()` result (`available` or `current`) updates the widget's release status. Offline/error/unknown results do not overwrite the last verified state or claim that the app is current.
- Android launchers control exact widget refresh timing. The periodic provider setting is a fallback, not an instant-update guarantee. The widget does not install updates automatically.

## Build requirement

This is a native Android AppWidget. Install an Android APK built with this source before looking for **Math Master** in the home-screen widget picker; updating only the web/PWA bundle cannot add a native widget to an older installed APK. Responsive widget layout, typography, and empty-container visibility changes are included in the merged home-screen widget update. After a release build succeeds, install that APK and verify the widget at compact, medium, wide, and tall sizes; CI compilation alone does not verify launcher-specific rendering.

## Premium composition previews

The native **Customize Your Widget** screen now shows an artwork-backed preview for the selected design, with a live sample percentage and the selected supporting metrics. Choose from Hero Wide, Compact Green, Square Math Bot, Medium Study, Square Cosmic, Extra-Wide Weekly, Minimal Progress, or Auto Responsive. The preview uses the same optimized artwork crop helper as the launcher renderer; it remains a configuration preview, not proof of pixel-perfect rendering on every launcher or screen size. Runtime artwork is region-decoded to a bounded rendition instead of allocating the entire high-resolution atlas as an ARGB bitmap. The packaged widget layouts normalize the self-closing artwork-overlay node to a RemoteViews-supported `FrameLayout` before Android resource compilation.


## Follow-up visual correction (v1.0.23 source)

The first device screenshots from v1.0.22 showed that the weighted vertical spacer could separate the primary progress row from study-time, streak, and weekly content. The provider now keeps that spacer hidden and centers the compact content group to prevent a large empty band through the card. Primary percentage/target typography has a stronger minimum hierarchy, artwork is no longer faded by a separate image alpha, and per-design tint overlays use lower opacity so the illustrations retain their color. Automated layout tests cover these rules. Physical-launcher rendering remains unverified until this build is installed and compared on-device.


## Premium visual system (Lwidget design-principle adaptation)

The native widget implementation uses an original Math Master visual system informed by high-level design principles from the separately licensed Lwidget reference (renderer/provider separation, per-instance preferences with global fallback, color resolution, opacity/outline controls, and font variants). No Lwidget source code, artwork, logos, or XML layouts are copied.

### Central theme and color engine

`android-native/com/sudhanshu/mathsbj/MathMasterWidgetStyle.java` resolves one palette for every RemoteViews composition. Available themes are:

- Minimal (transparent by default), Neon, Cockpit, Sunset, Monochrome, Snowfall, and Premium Deep Navy (new recommended default).
- System Dynamic uses Android's dynamic neutral/accent colors on Android 12+ and a deterministic fallback on older releases.
- Custom uses five validated six-digit hex colors: primary, secondary, accent, background, and outline.

Legacy per-widget theme identifiers (`emerald`, `ocean`, `graphite`, `rose`, `violet`, `sapphire`, `aurora`, and `app`) are normalized to equivalent new palettes rather than discarded. Each widget's theme and other appearance preferences are stored under its own AppWidget ID.

### Surface and outline

Each of the 21 compact/regular/wide layout resources now has independent `widget_surface` and `widget_outline` layers. The root uses a transparent rounded clipping shape; the tinted surface image receives alpha independently of text and controls. Surface selection supports Transparent (0%), Translucent (0–100% slider), and Solid (100%). Outline can be disabled or tinted with the custom outline color. The surface is placed above optional artwork and below live content; zero-opacity rendering hides the decorative artwork as well.

This is native translucent rendering only. Android RemoteViews does not provide a general launcher-wallpaper backdrop-blur API, so the widget does not claim to blur the wallpaper.

### Typography and responsive tuning

The per-widget appearance selector supports System, Light, and Dark. System follows the device's current night-mode configuration; when the System Dynamic palette is selected, Android 12+ dynamic neutral/accent colors are used and older devices receive a deterministic fallback. The appearance choice is stored under that AppWidget ID and does not change other pinned widgets.

The font selector supports Default/Sans Serif, Serif, Monospace, Cursive, Condensed, Condensed Light, Light, Medium, Black, Thin, and Small Caps. Text is passed to RemoteViews using Parcelable TypefaceSpan/StyleSpan instances, not by invoking a non-remotable TextView method. Weekly day labels and values use the selected family too. A 75–125% text scale and 0–24dp inner padding setting are stored per widget. Existing layout-based sp values and size classes remain in effect, so the chosen family/scale augments rather than replaces the existing responsive hierarchy.

### Customization and preview

The native launcher configuration now exposes theme, background surface/opacity, outline, font family, text scale, padding, and manual hex color fields alongside the existing content/style/composition settings. The preview uses the same palette resolver, actual persisted study snapshot, selected composition artwork, and the selected compact/medium/wide preview dimensions. Save writes only the current AppWidget ID; Cancel discards unsaved view state. The placed widget is refreshed after Save.

The preview is a focused native configuration preview rather than a byte-for-byte RemoteViews rendering engine. Device/launcher screenshots remain required to confirm actual font fallback, clipping, and contrast over user wallpapers.
