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

## Widget customization

Widget settings live in the native **Customize Your Widget** screen that Android shows when you add the widget; the app's own Settings screen has no widget controls. The screen saves content, background effect and design against that unique Android widget ID, so several widgets can look different. Its preview is the real renderer output at this widget's launcher size. Android 12+ launchers can reconfigure a placed widget; on older launchers remove and add it again. If the saved "widgets enabled" flag is ever off (for example from a restored backup), widgets show a small "Math Master widgets are off" card instead of the data.

- **Content** - App Identity (logo + title), Today's Target, Progress (ring), Remaining Target, Study Time, Streak, Weekly Target Tracker, Upcoming Quiz, Update Status. A design only draws the blocks it has; unselected blocks free their space for the others. Today's Target shows "25 / 35 min" with its label; when it is off, Study Time and Remaining Target fill the same panel ("25 min / Studied today", "10 min / Left today").
- **Background effect** - *Neon Glass* is the reference design (dark glass card, neon edge light) and the starting point. *Transparent Blur* keeps a frosted slate card so the wallpaper shows through, and *Full Transparent* draws no card at all, only the panels, ring and text. Older Glass / Compact / Minimal choices all mean Neon Glass; widgets saved before this redesign switch to Neon Glass once and can be changed back in the Customize screen. The widget no longer follows the app's colour theme or light/dark mode.
- **Weekly strip** - Sunday to Saturday of the current week. A green tick means the saved daily record for that date is complete; today and past days without a record, and future days, show an empty circle. Only the last seven saved days exist, so earlier weeks are never invented.
- **Upcoming Quiz tile** - a fixed shortcut label ("Upcoming Quiz, 5 Questions"), not live data; tapping anywhere on the widget opens the app. Widgets saved before this tile existed receive it once through the content-schema migration (schema 3) and can switch it off.
- **Update Status** - a small "UPDATE" pill in the top-right corner while an update is available.

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
- Android launchers control widget sizing, exact refresh timing, and whether the widget is available on the lock screen. The widget does not install updates automatically.

## Previewing designs without a phone

`tools/widget-preview` renders the real renderer with a desktop Java2D stand-in for `android.graphics`, and runs the provider against a fake Context. See its README. The images it produces are a faithful preview of the drawing code, not a screenshot from a launcher.

## Build requirement

This is a native Android AppWidget. Install an Android APK built with this source before looking for **Math Master** in the picker; updating only the web/PWA bundle cannot add or change a native widget. CI compilation does not verify launcher-specific rendering, so check the widget at 4 x 2, 3 x 2, 2 x 2, 4 x 1 and 2 x 1 on the device after installing.
