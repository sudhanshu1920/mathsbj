# Android widget collection: reference-matched neon glass

## Outcome
Refine the existing Android home-screen widget collection to follow the two uploaded visual references, while keeping real progress data, saved widget settings, and existing pinned-widget compatibility intact.

## Current baseline
- The app has one registered `MathMasterHomeWidgetProvider`, not seven separate providers.
- Seven compositions already exist, each with compact, regular, and wide layouts; each widget ID keeps its own selected composition, content, and theme.
- The native configuration screen already has a live-metric preview, but its design options are a plain radio list rather than a browsable collection of actual previews.
- Android `RemoteViews` does not provide general live wallpaper backdrop blur; layered translucent native backgrounds and the existing optimized artwork are the safe glass effect.

## Work
1. Keep the existing provider identity and the seven composition IDs; audit each composition’s three size variants, theme artwork/background, metadata, and Android packaging before editing.
2. Update the native widget configuration experience so users can browse the seven compositions with clearly distinct, live-data previews and select one for that widget instance. Retain content/style/theme controls and old saved selections.
3. Refine the composition-specific compact, regular, and wide layouts and shared native drawables to match the references’ silhouettes, color accents, ring/bar emphasis, target/streak panels, and weekly tracker without hiding selected fields or inventing data.
4. Preserve instance-specific configuration, resize routing, current progress/streak/history sources, click behavior, update status, package-replacement refresh, and safe fallbacks. Do not remove providers, change stored progress, or claim a live blur effect.
5. Extend widget regression coverage for all seven compositions, all 21 size variants, preview selection, real-data bindings, and package resource wiring. Run the widget test and available Android resource/package build; report physical-launcher checks as unverified unless device screenshots are available.

## Technical details
- Primary native paths: `android-native/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java`, `MathMasterWidgetConfigActivity.java`, `android-native/res/layout/`, `android-native/res/drawable/`, and `scripts/android-widget-layout.test.mjs`.
- Continue using the existing `RemoteViews` size-aware renderer and per-widget preference keys; no new provider, data store, polling loop, or bitmap-only widget.
- Treat each composition as a distinct design, not as a separate registered provider. Keep the existing fallback when optional artwork cannot be decoded.
