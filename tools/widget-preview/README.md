# Widget preview tool

Draws the Math Master home-screen widgets on a normal desktop JDK so a design can be checked (or changed) without an Android SDK or a phone.

```sh
sh tools/widget-preview/run.sh            # writes tools/widget-preview/out/*.png
```

Needs JDK 17+ with `java.desktop` (any normal JDK). The script compiles three things together:

| Folder | What it is |
|---|---|
| `shim/android/graphics` | A small Java2D-backed stand-in for `android.graphics` (Canvas, Paint, Path, gradients, blur, Typeface...). It lets the real `MathMasterWidgetRenderer.java` run unchanged. |
| `stubs/` | Compile-only stand-ins for the other Android classes the provider and configuration screen use (Context, RemoteViews, AppWidgetManager, widgets...). They also let the provider be run against a fake Context. |
| `harness/` | `Preview` (each design at its own size plus Screen-Time-OFF baselines), `MakePreview` (the picker preview), `E2E` (the real `createViews` path: several launcher sizes, every composition, themes, styles, content subsets, old-schema migration, update pill, disabled, 0 % / 100 %, and the 630-image Screen Time pairwise matrix). |


The Screen Time pairwise matrix writes `after_<composition>_<size>_<study|device|both>_<all|partial|none>_<state>_<style>.png` files across seven compositions, five launcher sizes, six data states and three background styles; source combinations and legacy-content selections are balanced across each composition/size slice. It also writes `before_baseline_<composition>.png` from the unchanged Screen-Time-OFF layouts. All generated PNGs live in `tools/widget-preview/out/` and must not be committed.

## What it proves, and what it does not

- The renderer, provider and configuration screen compile against the stubs, and every design is drawn through the real provider code path.
- Java2D is not Skia: blur kernels, gradient interpolation and text rendering differ slightly, so the pictures are a faithful preview of the drawing code, not a screenshot of a launcher. Check the real widget on a device after installing a build.
- The stubs are written from the Android API, not generated from the SDK; a real Gradle build is still the final compile check.

## Changing a design

Edit `android-native/com/sudhanshu/mathsbj/MathMasterWidgetRenderer.java` (palettes at the top, one `layoutXxx()` method per design), run the script, look at the PNGs. The reference sizes (`frame(width, height)`) are the device pixels of the original reference images at 2.75x density; text sizes (`labelRef`, `valueRef`, `numRef`) are pixel sizes at that reference and scale with the widget.

To refresh the widget-picker preview, convert `out/widget_preview.png` to WebP and replace `android-native/res/drawable-nodpi/math_master_widget_preview.webp`.
