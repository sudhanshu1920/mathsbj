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
| Native launcher configuration activity (per AppWidget ID) | `MathMasterWidgetConfigActivity.java` | Audited | Content, composition, style, and theme save independently with explicit Save/Cancel | Covered by widget source regression tests and Android build workflow | **Launcher rendering unverified** |

## Confirmed root causes / gaps

1. The native boot/package-update receiver already received `MY_PACKAGE_REPLACED` but only rescheduled daily reminders. It did not explicitly re-render active launcher widget instances. After an APK update, a pinned widget could therefore continue showing its prior `RemoteViews` until another widget update path ran.
2. The Android dashboard already had three separate XML runtime layouts. A fix to one XML file alone cannot prove all three resources are packaged and used. The build configuration copies these resources from `android-native/res`; regression tests now check the provider registration, all three copied variants, both widget metadata resources, and the size-aware renderer.
3. The current app does not provide a separate global widget settings page or web preview. Per-instance configuration is launcher-owned through the native `MathMasterWidgetConfigActivity`; the preview shown there is a configuration preview, not an exact launcher-size simulation.

## Data and configuration preservation

- Package replacement refreshes existing widget IDs through `MathMasterHomeWidgetProvider.updateWidgetPreferences(context)`; that path renders each ID separately and reads its own `instance_<id>_...` settings.
- No new provider, progress tracker, timer engine, or data store was introduced.
- Weekly completion remains backed by saved daily completion history; the redesign does not create synthetic completion ticks.
- Removing a widget continues to clean only that widget ID's preferences through the existing `onDeleted` implementation.
- Actual wallpaper transparency, launcher-specific aspect-ratio selection, old pinned-instance rebinding, and touch behavior still require device/emulator screenshots to verify.

## Verification policy

A passing source test or APK build means the implementation compiles and the tested source/resource paths are present. It does **not** prove that every launcher size renders without clipping. The table intentionally leaves real-launcher verification unverified until screenshots from supported Android launchers/devices are captured and reviewed.

## Premium design and layout coverage

| Composition | Intended appearance | Native layout variants | Artwork | Automated source/resource coverage | Physical launcher status |
|---|---|---|---|---|---|
| `hero_wide` | Blue/cyan scenic hero dashboard | compact, regular, wide | Atlas panel 1 | Provider routing, resource-copy and layout checks | **Unverified** |
| `compact_green` | Emerald botanical glass with progress ring | compact, regular, wide | Atlas panel 2 | Provider routing, ring visibility and layout checks | **Unverified** |
| `square_math_bot` | Navy educational/technical dashboard | compact, regular, wide | Atlas panel 3 | Provider routing, ring visibility and layout checks | **Unverified** |
| `medium_study` | Rose/violet scenic study composition | compact, regular, wide | Atlas panel 4 | Provider routing and layout checks | **Unverified** |
| `square_cosmic` | Midnight/cyan cosmic glass with ring | compact, regular, wide | Atlas panel 5 | Provider routing, ring visibility and layout checks | **Unverified** |
| `extra_wide_weekly` | Panoramic seven-day tracker | compact, regular, wide | Atlas panel 6 | Provider routing, weekly-data and layout checks | **Unverified** |
| `minimal_progress` | Graphite/emerald minimal metric surface | compact, regular, wide | No decorative bitmap by design | Provider routing and layout checks | **Unverified** |
| `auto` | Select composition from actual reported dimensions | Maps to compact/regular/wide composition layouts | Composition-dependent | Responsive resolver and resource routing checks | **Unverified** |

### Loading-error investigation and safe fallback

The source resources contain a self-closing plain `View` used only as the artwork tint overlay. Plain generic `View` is not a safe choice in a launcher `RemoteViews` hierarchy. The Android resource-generation step normalizes that overlay to `FrameLayout` before packaging, and regression tests assert that normalized layouts have no remaining plain `View` tags. This is a source-level compatibility fix and is covered by CI resource compilation; actual device Logcat evidence for the user's original launcher failure is not available, so the specific runtime crash is **not yet device-confirmed**. Missing/corrupt optional art safely falls back to the native glass background and live metrics. Artwork now uses sampled region decoding with bounded output sizes to reduce full-atlas memory pressure.

The feature branch also wires immutable, per-instance PendingIntents for progress, target, streak, weekly, Practice, and update actions; connects the widget action extras to the app's existing Progress/Practice tabs; refreshes pinned instances after package replacement and local date/time changes; validates native date/progress payloads; and syncs widget update status only after a successful verified release check. These source changes are committed on the feature branch and remain subject to PR/CI validation.

The automated matrix confirms source routing and build/resource coverage only. It does not prove that all composition/size combinations are free of clipping, launcher-specific inflation errors, or stale pinned-widget rendering. Those remain device/emulator verification items.


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

The font selector supports Default/Sans Serif, Serif, Monospace, Cursive, Condensed, Condensed Light, Light, Medium, Black, Thin, and Small Caps. Text is passed to RemoteViews using Parcelable TypefaceSpan/StyleSpan instances, not by invoking a non-remotable TextView method. A 75–125% text scale and 0–24dp inner padding setting are stored per widget. Existing layout-based sp values and size classes remain in effect, so the chosen family/scale augments rather than replaces the existing responsive hierarchy.

### Customization and preview

The native launcher configuration now exposes theme, background surface/opacity, outline, font family, text scale, padding, and manual hex color fields alongside the existing content/style/composition settings. The preview uses the same palette resolver, actual persisted study snapshot, selected composition artwork, and the selected compact/medium/wide preview dimensions. Save writes only the current AppWidget ID; Cancel discards unsaved view state. The placed widget is refreshed after Save.

The preview is a focused native configuration preview rather than a byte-for-byte RemoteViews rendering engine. Device/launcher screenshots remain required to confirm actual font fallback, clipping, and contrast over user wallpapers.
