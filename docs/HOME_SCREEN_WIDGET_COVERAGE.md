# Math Master Widget Coverage Audit

## Confirmed inventory

The repository contains **one native launcher widget provider**: `MathMasterHomeWidgetProvider`. Its selected fields are configured independently for each Android AppWidget ID. Since the neon-glass redesign it draws every composition itself (`MathMasterWidgetRenderer`) into one bitmap per launcher size, instead of choosing between per-composition RemoteViews layouts. No Quick Timer, Stopwatch, standalone Weekly Tracker or second provider exists; do not treat the seven compositions as extra providers. The web Settings screen provides a compact Widget Studio entry. The Studio lists actual native instances and launches the existing Android Customize Your Widget editor; instance-specific rendering and preferences remain native.

| Component | Resource / implementation | Automated coverage | Real launcher visual status |
|---|---|---|---|
| Provider: data, preferences, size handling, tap, content description | `MathMasterHomeWidgetProvider.java` | `scripts/android-widget-layout.test.mjs` (source checks), Android build | **Unverified** |
| Renderer: seven compositions, ring, glass panels, icons, week strip | `MathMasterWidgetRenderer.java` | Source checks; the same code is compiled and drawn on desktop by `tools/widget-preview` | **Unverified on a launcher** |
| Single canvas layout | `res/layout/math_master_home_widget.xml` | Layout/id checks, resource-copy test, Android build | **Unverified** |
| Android 12+ picker preview and reconfigure | `res/xml-v31/math_master_home_widget_info.xml` | Metadata checks | **Unverified on a launcher** |
| Legacy metadata / preview image | `res/xml/math_master_home_widget_info.xml`, `drawable-nodpi/math_master_widget_preview.webp` | Metadata checks | **Unverified on a launcher** |
| Fonts | `android-native/assets/fonts/*` | Presence + licence + copy test | **Unverified** |
| Configure script | `scripts/configure-android-widgets.mjs` | Runs against a temporary Android project in the test | Covered by CI |

## Data and configuration preservation

- No new provider, progress tracker, timer engine or data store was introduced.
- Weekly completion still comes from the saved daily completion history; the renderer never fabricates ticks.
- Content schema is now 3 (adds the Upcoming Quiz tile). Older per-widget selections are migrated once; the backup/restore validators (TypeScript and Java) accept schema 3 and the `quiz` option.
- `syncProgressSnapshot`, `updateWidgetPreferences`, `updateReleaseStatus` and `onDeleted` are unchanged, so reminder sync, update status, backup/restore and per-widget clean-up behave as before.
- Saved composition values keep their meaning. Style values are now `neon` (default, the reference design), `blur` and `transparent`; the old `glass` / `compact` / `minimal` values map to `neon`, and a widget saved before the redesign is switched to `neon` once. The backup/restore validators accept all of these. The widget does not follow the app's accent colour or light/dark mode.

## Verification policy

A passing source test or APK build means the code compiles and the tested paths are present. It does not prove every launcher size renders without clipping. The desktop preview shows what the drawing code produces, but wallpaper transparency, launcher cell sizes, OEM fonts and tap behaviour still need screenshots from real devices.

## Composition coverage

| Composition | Designed for | Auto-selected when | Status |
|---|---|---|---|
| `hero_wide` | 4 x 2 | height >= 100 dp and aspect >= 1.8 | **Unverified** |
| `compact_green` | 3 x 2 | height >= 100 dp and aspect 1.3-1.8 | **Unverified** |
| `square_math_bot` | 2 x 2 | height >= 100 dp and aspect < 1.3 | **Unverified** |
| `medium_study` | 2 x 2 | manual choice only | **Unverified** |
| `square_cosmic` | 3 x 2 | manual choice only | **Unverified** |
| `extra_wide_weekly` | 4 x 1 | aspect >= 3.4 (or taller strips under 4.2 use `hero_wide`) | **Unverified** |
| `minimal_progress` | 2 x 1 | height < 100 dp | **Unverified** |
