# Math Master Widget Coverage Audit

## Confirmed inventory

The current repository contains **one native launcher widget provider**: `MathMasterHomeWidgetProvider`. It is an adaptive dashboard whose selected fields are configured independently for each Android AppWidget ID. No separate Quick Timer, Stopwatch, standalone Weekly Tracker, or second native progress-widget provider was found in the current native source tree; do not treat Settings preview cards or layout variants as extra providers.

| Actual component / rendering path | Resource / implementation | Source audit | Changed in this audit | Build/automated coverage | Real launcher visual status |
|---|---|---|---|---|---|
| Math Master home-screen dashboard | `MathMasterHomeWidgetProvider.java` | Audited | Refresh all pinned instances on package replacement; keep per-ID configuration lookup | Covered by widget regression test and Android build workflow | **Unverified** |
| Compact / narrow / short dashboard variant | `math_master_home_widget_compact.xml` | Audited | Existing responsive layout retained; added release-copy/registration assertions | Covered by widget layout/resource-copy tests and Android build workflow | **Unverified** |
| Regular / tall dashboard variant | `math_master_home_widget.xml` | Audited | Existing responsive layout retained; used as safe regular/tall fallback | Covered by widget layout/resource-copy tests and Android build workflow | **Unverified** |
| Wide / short dashboard variant | `math_master_home_widget_wide.xml` | Audited | Existing horizontal lower-row layout retained; resource-copy assertions added | Covered by widget layout/resource-copy tests and Android build workflow | **Unverified** |
| Android 12+ launcher picker preview | `res/xml-v31/math_master_home_widget_info.xml` references `math_master_home_widget.xml` | Audited | Preview-resource wiring now has regression coverage | Metadata inspected by automated tests; Android build validates resource compilation | **Unverified on a launcher** |
| Legacy Android widget metadata / size fallback | `res/xml/math_master_home_widget_info.xml` | Audited | Resize metadata and fallback layout wiring have regression coverage | Automated metadata/layout-selection checks and Android build | **Unverified on a launcher** |
| In-app Settings widget preview (not a separate Android AppWidget) | `src/components/SettingsPanel.tsx` | Audited | Translucent gradient/glass styling; style/theme-aware surface and metric size; target value shown independently of study time; empty primary/supporting rows no longer reserve space | React regression tests added | **In-app preview test only; not proof of launcher rendering** |

## Confirmed root causes / gaps

1. The native boot/package-update receiver already received `MY_PACKAGE_REPLACED` but only rescheduled daily reminders. It did not explicitly re-render active launcher widget instances. After an APK update, a pinned widget could therefore continue showing its prior `RemoteViews` until another widget update path ran.
2. The Android dashboard already had three separate XML runtime layouts. A fix to one XML file alone cannot prove all three resources are packaged and used. The build configuration copies these resources from `android-native/res`; regression tests now check the provider registration, all three copied variants, both widget metadata resources, and the size-aware renderer.
3. The Settings preview is a separate web UI rather than an Android `RemoteViews` renderer. Before this audit it used an almost opaque surface, tiny fixed labels, did not honor the selected preview style/theme consistently, tied the target value to the study-time field, and rendered an empty primary row when only supporting fields were selected. It now better reflects the global content/style/theme settings, while remaining a visual preview rather than an exact device-size simulation.

## Data and configuration preservation

- Package replacement refreshes existing widget IDs through `MathMasterHomeWidgetProvider.updateWidgetPreferences(context)`; that path renders each ID separately and reads its own `instance_<id>_...` settings.
- No new provider, progress tracker, timer engine, or data store was introduced.
- Weekly completion remains backed by saved daily completion history; the redesign does not create synthetic completion ticks.
- Removing a widget continues to clean only that widget ID's preferences through the existing `onDeleted` implementation.
- Actual wallpaper transparency, launcher-specific aspect-ratio selection, old pinned-instance rebinding, and touch behavior still require device/emulator screenshots to verify.

## Verification policy

A passing source test or APK build means the implementation compiles and the tested source/resource paths are present. It does **not** prove that every launcher size renders without clipping. The table intentionally leaves real-launcher verification unverified until screenshots from supported Android launchers/devices are captured and reviewed.
