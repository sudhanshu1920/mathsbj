# Math Master Android Home Screen Widgets

Math Master uses one native Android AppWidget provider with seven adaptive layout compositions. These are seven presentation/layout choices handled by the same provider, not seven duplicate Android providers.

## Visual redesign

Every widget now supports only two background effects:

- **Full Transparent** — the widget surface, inner panels and update badge have no fill or border. The home-screen wallpaper remains visible behind the widget.
- **Transparent Blur** — a rounded, translucent charcoal glass surface with a very light edge. This is a frosted-glass approximation.

The Android RemoteViews widget API does not let an app sample and dynamically blur the launcher wallpaper behind its widget. Therefore Transparent Blur uses an alpha-translucent surface, not a true live wallpaper blur. The final appearance can vary with the launcher, wallpaper and Android version.

The previous colorful artwork, tinted overlays, gradient card fills, palette themes and neon card treatment are not displayed. Progress uses one restrained cyan accent. Content and layout remain responsive.

## Layout compositions

The native configuration screen offers:

- Auto Responsive
- Wide Dashboard
- Compact Dashboard
- Square Dashboard
- Medium Dashboard
- Square Tracker
- Extra-Wide Weekly
- Minimal Progress

Each composition retains compact, regular and wide layout resources where appropriate. Android 12+ receives size-aware RemoteViews; older Android versions use the safest size fallback available.

## Available live content

The widget reads the existing Math Master study/streak record. It does not create a second study timer or a duplicate progress database.

Selectable fields:

- App Identity
- Today's Target
- Progress
- Remaining Target
- Study Time
- Streak
- Weekly Target Tracker
- Update Status

The weekly tracker uses saved daily completion records only. It never invents completed days. Update status uses the app's existing verified update-check flow; the widget does not install an APK by itself.

## Add a widget

1. Install an Android APK built from a source revision containing the native widget implementation.
2. Open Math Master once so the app can synchronize its current progress snapshot.
3. Long-press an empty area of the Android home screen and open **Widgets**.
4. Find **Math Master**, then drag it onto the home screen.
5. In **Customize Your Widget**, choose the content, layout composition and one of the two background effects.
6. Save the configuration, then resize the widget if the launcher supports resizing.

For a widget that was already pinned before this redesign, open its reconfiguration option when the launcher provides it. If reconfiguration is unavailable, remove and add that widget again, then select the new effect. Existing old style values migrate to Transparent Blur for readability.

## Per-instance configuration

Each Android AppWidget ID stores its own selected fields, background effect and composition. Multiple instances may therefore use different content, different layouts and different effects.

Changing or deleting one instance must not overwrite or delete another instance's settings. Global application progress remains shared across all instances.

## Refresh and lifecycle behavior

- Study progress is synchronized from the existing daily streak record.
- Target and streak changes refresh the pinned widgets.
- Active study tracking refreshes on the existing minute-boundary schedule.
- Date rollover uses the local day key and existing daily tracking rules.
- Package replacement refreshes existing pinned instances without replacing their saved per-instance settings.
- Android controls exact launcher refresh scheduling and size negotiation.
- The widget does not run an aggressive polling loop or install updates automatically.

## Verification

Source-level tests cover layout registration, selected fields, responsive variants, data validation, weekly completion and the two background modes. Android compilation verifies native resource and Java integration.

A successful CI build does not prove visual fidelity on every launcher. Capture and review screenshots on the target device at compact, regular, wide and tall sizes. In particular, verify wallpaper visibility, blur-surface opacity, text contrast, clipping and touch behavior after installing the release APK.
