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
| Screen Time data | `WidgetScreenTimeRepository.java`, `AppUsageAnalyticsPlugin.java` | UsageStats source, local cache, period, package filtering and permission source checks | **Requires device Usage Access test** |
| Screen Time renderer/config | `MathMasterWidgetRenderer.java`, `MathMasterWidgetConfigActivity.java` | Real renderer preview, native option and persistence checks | **Unverified on a launcher** |
| Configure script | `scripts/configure-android-widgets.mjs` | Copies the repository and renderer into a temporary Android project in the test | Covered by CI |

## Data and configuration preservation

- No new provider, progress tracker, timer engine or data store was introduced.
- Weekly completion still comes from the saved daily completion history; the renderer never fabricates ticks.
- Content schema is now 4. The migration remains additive: it preserves existing widget content and appearance and does not opt existing widgets into Screen Time. The TypeScript and Java backup/restore validators accept both Screen Time keys and their per-instance preferences.
- `syncProgressSnapshot`, `updateWidgetPreferences`, `updateReleaseStatus` and `onDeleted` are unchanged, so reminder sync, update status, backup/restore and per-widget clean-up behave as before.
- Saved composition values keep their meaning. Style values are `neon`, `blur` and `transparent`; the old `glass` / `compact` / `minimal` values map to `neon`. Screen Time follows the active app accent and Light/Dark mode through the existing native plugin; its palette and frosted/transparent surfaces switch without changing the seven legacy widget compositions.

## Verification policy

A passing source test or APK build means the code compiles and the tested paths are present. It does not prove every launcher size renders without clipping. The desktop preview shows what the drawing code produces, but wallpaper transparency, launcher cell sizes, OEM fonts and tap behaviour still need screenshots from real devices.

## Screen Time data boundaries

- Study Apps comes from `StudyModeManager.getSelectedStudyAppPackages()`; Device Apps comes from the installed-app inventory. Neither list is used as the other's source.
- Both are joined to `UsageStatsManager.queryUsageStats(INTERVAL_DAILY, start, end)`. Duplicate identical package/day aggregate rows are discarded; package foreground duration is aggregated over the requested local-calendar range. The per-package duration is bounded by the query window.
- Device Apps currently includes eligible user-installed applications and updated system apps; core system packages are excluded. The Android package visibility policy and work-profile boundary still apply.
- Usage Access is checked through AppOps, not inferred from an empty result. Without access, a permission-required state is rendered. The widget tap opens Android Usage Access settings via a small app-owned proxy that refreshes on return.
- Android's usage APIs provide aggregate foreground duration, not foreground-window or per-session certainty. Multi-window attribution and OEM reporting behavior can make totals differ from wall-clock time.
- Data remains local; no usage history is sent to a remote endpoint. The two-minute snapshot cache is process-local; Android's existing widget update cadence remains the periodic fallback.

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
