# Android Home Screen Widget

Math Master includes a native Android home-screen widget backed by the existing daily streak record. It shows today's target progress, elapsed/target study minutes, the current streak, this week's days and a quiz shortcut, all in a "neon glass" style with seven designs.

## Add it to the home screen

1. Install the latest Math Master Android APK and open the app once so it can sync the current progress.
2. Long-press an empty area of the Android home screen and choose **Widgets**.
3. Find **Math Master**, then drag the widget onto the home screen. It is placed as 4 x 2 by default; resize it if your launcher supports resizing.

Tap the widget to open Math Master. When an update is known to be available, tapping also asks the app to refresh its normal verified update check; it does not bypass package, checksum, or signing-certificate validation.

## The seven designs

Every design is drawn at runtime by `MathMasterWidgetRenderer` (see "How it is drawn"). The sizes below are the launcher sizes each design was laid out for; any other size scales smoothly.

| Composition | Look | Designed for | Blocks |
|---|---|---|---|
| `hero_wide` | Deep blue with violet edge light | 4 x 2 | Header, progress ring, target + progress bar, streak, week strip, quiz tile |
| `compact_green` | Emerald | 3 x 2 | Header, ring, target, streak |
| `square_math_bot` | Indigo with magenta glow | 2 x 2 | Header, ring, target, streak, quiz tile |
| `medium_study` | Violet / magenta | 2 x 2 | Header, ring, target, streak |
| `square_cosmic` | Midnight blue | 3 x 2 | Header, ring, target, streak, week strip |
| `extra_wide_weekly` | Cyan strip | 4 x 1 | Header, "This Week" strip, target, streak |
| `minimal_progress` | Mini green | 2 x 1 | Header, percentage + minutes, streak |
| `auto` | Picks one of the above from the launcher's size | any | - |

## Widget Studio in app Settings

The app Settings screen now provides a compact **Widgets** entry that opens a dedicated **Widget Studio** page. On Android, the Studio reads the real pinned instance IDs from Android's widget manager, displays each instance's saved composition/content/background, and requests an Android system pin confirmation when the user adds another instance. It does not create pretend widget entries.

The Studio preview is rendered by the same MathMasterWidgetRenderer used for the home-screen widget, with that instance's saved settings and current progress data. **Customize this widget** opens the existing native editor for the validated active widget ID; saved changes remain scoped to that instance. **Reset to default** restores only the selected instance to Auto, Neon Glass and the supported default content, without changing other instances, app settings or progress. The Android setup step registers the MathMasterWidgets Capacitor plugin alongside the existing backup and notification plugins.

**Add Widget** calls Android's real `AppWidgetManager.requestPinAppWidget()` API. A successful API return means the launcher accepted the request, not that the user has pinned it yet. After the user confirms, Android sends the newly allocated `EXTRA_APPWIDGET_ID` to an explicit Activity `PendingIntent`; this opens the native customization editor with the selected design preselected. Saving writes content, background style and Screen Time options to that exact ID, then updates the actual `AppWidgetManager` instance. Android does not automatically launch `android:configure` for an in-app pin request, so the success callback explicitly opens the editor. If the launcher declines/does not support pinning or the user cancels, Widget Studio verifies that no new ID appeared and provides the Home screen → Widgets → Math Master manual steps. A pending request is guarded against repeat taps and cleared on callback or return from the launcher.

Android launcher ownership is intentional: resizing and positioning/reordering are performed on the home screen, and removing a pinned widget requires the launcher's Remove action. Android does not provide a supported in-app unpin API. The Studio reports the launcher-selected dimensions and refreshes its active-instance list when the app resumes. In non-Android/PWA builds it explains that native home-screen widgets require the Android app.

## Widget customization

The Settings screen includes a **Widgets** entry to open Widget Studio. The Studio lists real pinned instances and opens the native **Customize Your Widget** editor for the selected Android widget ID. The editor saves content, background effect and design against that unique ID, so several widgets can look different. Its preview is the real renderer output at this widget's launcher size. Android 12+ launchers can reconfigure a placed widget; on older launchers remove and add it again. If the saved "widgets enabled" flag is ever off (for example from a restored backup), widgets show a small "Math Master widgets are off" card instead of the data.

- **Content** - App Identity (logo + title), Today's Target, Progress (ring), Remaining Target, Study Time, Streak, Weekly Target Tracker, Upcoming Quiz, Update Status, Study Apps Screen Time and Device Apps Screen Time. A design only draws the blocks it has; unselected blocks free their space for the others. Today's Target shows "25 / 35 min" with its label; when it is off, Study Time and Remaining Target fill the same panel ("25 min / Studied today", "10 min / Left today").
- **Background effect** - *Neon Glass* is the reference design (dark glass card, neon edge light) and the starting point. *Transparent Blur* keeps a frosted slate card so the wallpaper shows through, and *Full Transparent* draws no card at all, only the panels, ring and text. Older Glass / Compact / Minimal choices all mean Neon Glass; widgets saved before this redesign switch to Neon Glass once and can be changed back in the Customize screen. The widget no longer follows the app's colour theme or light/dark mode.
- **Weekly strip** - Sunday to Saturday of the current week. A green tick means the saved daily record for that date is complete; today and past days without a record, and future days, show an empty circle. Only the last seven saved days exist, so earlier weeks are never invented.
- **Upcoming Quiz tile** - a fixed shortcut label ("Upcoming Quiz, 5 Questions"), not live data; tapping anywhere on the widget opens the app. Widgets saved before this tile existed receive it once through the content-schema migration. Screen Time is opt-in and is not added to existing widgets by migration (content schema 4).
- **Update Status** - a small "UPDATE" pill in the top-right corner while an update is available.
- **Study Apps Screen Time** - reads exactly the canonical `StudyModeManager.getSelectedStudyAppPackages()` allowlist saved by Study Mode. Every selected installed app stays eligible for the panel, including apps with no recorded time (shown as `0 min`); the total includes all selected, non-hidden apps, not only the visible top-N rows. Adding, removing or uninstalling a Study App invalidates the local cache and refreshes the widget from that same canonical selection; the widget keeps no duplicate selection list.
- **Device Apps Screen Time** - independently ranks eligible installed apps with positive UsageStats foreground time. User-installed apps and updated system apps are eligible; non-launchable core system packages are excluded. The query resolves package metadata only for packages reported by UsageStats, plus selected Study Apps; it does not enumerate the full installed-app inventory. Device usage is independent of Study Apps selection, and the total covers the full eligible source rather than only the visible top-N rows.
- **Compact 2×1 behavior** - the short widget uses a data-first layout without the large composition wordmark; enabled Screen Time sources share the available glass card and show their total plus the top app without overlapping the original header. Larger widgets retain the exact header geometry for the selected composition. The redundant per-panel update timestamp is omitted; the existing widget-level update indicator remains.
- **Screen Time settings** - Today, Yesterday or Last 7 Days; Most Used, Least Used or Name A–Z/Z–A; visible app count (3/5/8/12); show/hide total, individual durations and usage bars; detailed or compact rows. Preferences are per widget and shared by both Screen Time sections when both are enabled. Customize Your Widget does not load or render package inventories or per-app checkboxes; it shows only the selected data source and the number of Study Mode selections. Per-instance hidden-package preferences remain backup-compatible and are applied to both ranking and totals. When Screen Time is enabled, the selected composition is retained and reflows around dedicated Study Apps / Device Apps glass panels; selected legacy blocks continue to use their existing ring, target, streak, week and quiz drawing helpers. The panels use that composition's original palette, logo and neon edge, regardless of app theme/mode.
- **Usage Access** - Android requires the user to enable Usage Access manually. Without it, the widget shows "Usage Access Required" and opens Android settings; no sample values are substituted. Returning from settings rechecks the AppOps permission and requests fresh data.
- **App theme matching** - Home-screen widgets deliberately ignore the app accent colour and Light/Dark mode. Screen Time panels use the same composition-owned neon palette, white Inter typography, glass treatment, glow and cyan/green usage bars as the existing blocks. Neon Glass, Transparent Blur and Full Transparent keep the same widget ink/palette rules; only the outer card treatment changes.

## How it is drawn

`MathMasterHomeWidgetProvider` reads the saved data and preferences, picks the design, and asks `MathMasterWidgetRenderer` for one bitmap per launcher size. The bitmap goes into a single `ImageView` (`res/layout/math_master_home_widget.xml`), so blur, glow, gradient rings and glass panels look the same on every launcher and Android version, which `RemoteViews` layouts cannot do.

- Android 12+ sends one bitmap for each size the launcher reports; older versions send one. The combined bitmap size is capped well below Android's per-widget limit, and if drawing ever fails the static preview image stays on screen.
- Text uses Inter (OFL) from `android-native/assets/fonts`, falling back to the system font if an asset is missing. The licence is shipped next to the fonts.
- Each widget carries a content description with the live numbers, for TalkBack.
- `res/drawable-nodpi/math_master_widget_preview.webp` is the picker preview and the placeholder before the first update. It is rendered by the same renderer.
- There is no per-design XML any more, and the old artwork atlas is gone.

## Refresh and data behavior

- Progress is copied from the existing `math-app-streak-v1` daily record. It is not stored in a second target-tracking system.
- While the app is actively tracking study time, the widget refreshes at minute boundaries and when target/streak settings change. Android also refreshes the widget periodically and resets the displayed progress when the local date changes.
- A successful in-app update check refreshes the update pill. A validated Firebase release push can also set it while the app is closed, provided Firebase is configured in the installed APK and update notifications are enabled.
- Screen Time uses `UsageStatsManager.queryUsageStats(INTERVAL_DAILY)` and Android's per-package `getTotalTimeInForeground()` duration on a worker thread, matching the source and local-calendar period boundaries used by App Usage Analytics. Today is local midnight through query time; Yesterday is the previous local calendar day; Last 7 Days begins at local midnight six days before today and ends at query time. Calendar boundaries use the device timezone.
- Usage results are cached for up to two minutes in process memory (at most nine period snapshots are retained), and compact app icons are cached locally by package. Android package install/update/remove broadcasts invalidate the app/usage cache so the installed inventory, updated icons and names are reloaded. Widgets keep Android's existing 30-minute AppWidget update period; opening Math Master triggers a throttled local refresh. There is no continuous polling or new foreground service.
- Android reports aggregate foreground usage, not precise per-window time. Multi-window usage can be attributed to more than one visible app, so totals may not equal wall-clock device time. System package visibility, work profiles and OEM reporting policies can restrict inventory or usage results. Session counts are omitted because per-session events are not reliably available from this aggregate query.
- Screen-time history is not uploaded. UsageStats and app metadata are read locally; the render snapshot and icon cache stay on-device.
- Android launchers control widget sizing, exact refresh timing, and whether the widget is available on the lock screen. The widget does not install updates automatically.

## Previewing designs without a phone

`tools/widget-preview` renders the real renderer with a desktop Java2D stand-in for `android.graphics`, and runs the provider against a fake Context. See its README. The images it produces are a faithful preview of the drawing code, not a screenshot from a launcher.

## Build requirement

This is a native Android AppWidget. Install an Android APK built with this source before looking for **Math Master** in the picker; updating only the web/PWA bundle cannot add or change a native widget. CI compilation does not verify launcher-specific rendering, so check the widget at 4 x 2, 3 x 2, 2 x 2, 4 x 1 and 2 x 1 on the device after installing.
