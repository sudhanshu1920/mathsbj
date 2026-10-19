# Math Master Widget Coverage Audit

## Confirmed inventory

The native launcher picker now exposes **seven catalog provider entries** backed by the shared `MathMasterHomeWidgetProvider` renderer: Hero Wide (the legacy provider identity), Compact Green, Square Math Bot, Medium Study, Square Cosmic, Extra-Wide Weekly, and Minimal Progress. Six small provider classes give Android's launcher distinct labels/previews without duplicating the rendering engine, progress store, or timer logic. The legacy provider identity is retained to protect already-pinned widget instances. No separate Quick Timer or Stopwatch provider is introduced.

| Actual component / rendering path | Resource / implementation | Source audit | Changed in this audit | Build/automated coverage | Real launcher visual status |
|---|---|---|---|---|---|
| Hero Wide / legacy identity | `MathMasterHomeWidgetProvider.java`, `math_master_home_widget_info.xml` | Audited | New Hero Wide picker label/preview; legacy pinned-instance identity retained | Provider/layout/resource-copy regression tests plus Android build workflow | **Unverified** |
| Six additional catalog entries | `MathMaster*WidgetProvider.java` wrappers with their own `res/xml*/*_info.xml` metadata | Audited | Independent picker labels/previews; fixed composition per selected catalog entry | Provider/metadata manifest generation tests plus Android build workflow | **Unverified** |
| Legacy compact layout compatibility resource | `math_master_home_widget_compact.xml` | Audited | Retained for safe transition from older pinned RemoteViews; new catalog entries use composition-specific layouts | Covered by resource-copy checks; no longer exposed as a catalog choice | **Unverified** |
| Legacy regular layout compatibility resource | `math_master_home_widget.xml` | Audited | Retained during pinned-widget migration; all seven provider metadata records now point at composition-specific regular layouts | Covered by resource-copy checks; not a new-widget initial layout | **Unverified** |
| Legacy wide layout compatibility resource | `math_master_home_widget_wide.xml` | Audited | Retained so cached older widget views have a conservative transition resource; new views route to design-specific compact/regular/wide variants | Covered by resource-copy checks; not offered in the Add Widget catalog | **Unverified** |
| Android 12+ launcher picker previews | `res/xml-v31/*_info.xml` points each entry to its composition-specific `*_regular.xml` preview | Audited | Seven distinct translucent/tinted static previews plus catalog labels | Metadata and packaged-preview normalization are covered by source regression tests; Android resource compilation still awaits an available runner | **Unverified on a launcher** |
| Legacy Android widget metadata / size fallback | `res/xml/math_master_home_widget_info.xml` plus six `res/xml/*_info.xml` entries | Audited | All seven entries declare resize bounds and use composition-specific `initialLayout` resources | Metadata and layout-reference checks added; Android build could not start because the latest validation job ended before any runner steps | **Unverified on a launcher** |
| In-app Settings widget preview (not a separate Android AppWidget) | `src/components/SettingsPanel.tsx` | Audited | Translucent gradient/glass styling; style/theme-aware surface and metric size; target value shown independently of study time; empty primary/supporting rows no longer reserve space | React regression tests added | **In-app preview test only; not proof of launcher rendering** |

## Confirmed root causes / gaps

1. The original native manifest contained only `MathMasterHomeWidgetProvider`, so Android's Add Widget picker could not display seven independent design entries even though the code already contained seven composition families and 21 runtime layout variants.
2. The APK-generation script copied the legacy provider and its legacy metadata only. New catalog entries therefore require provider Java files, matching legacy and Android 12+ metadata, distinct labels/previews, and manifest registration all to be generated together.
3. The native boot/package-update receiver already received `MY_PACKAGE_REPLACED` but only rescheduled daily reminders. It did not explicitly re-render active launcher widget instances. The shared refresh path now enumerates all seven providers while each AppWidget ID still resolves its own preferences.
4. Android `RemoteViews` is not the in-app Settings preview. The native picker preview can use the selected artwork/layout, but actual wallpaper blending, clipping, touch behavior and launcher-specific resize results remain unverified until run on a device/emulator.

## Data and configuration preservation

- Package replacement refreshes IDs from all seven registered widget provider classes through `MathMasterHomeWidgetProvider.updateWidgetPreferences(context)`; each ID still renders with its own `instance_<id>_...` settings.
- The six new provider wrappers use the shared renderer and authoritative data; they do not introduce duplicate progress databases or timer engines.
- New catalog instances have their composition fixed to the design the user chose in Android's launcher picker, while older instances of the legacy provider preserve any already-saved custom composition.
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

The automated matrix confirms source routing and build/resource coverage only. It does not prove that all composition/size combinations are free of clipping, launcher-specific inflation errors, or stale pinned-widget rendering. Those remain device/emulator verification items.
