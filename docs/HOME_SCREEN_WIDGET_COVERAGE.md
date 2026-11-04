# Math Master Widget Coverage Audit

## Native implementation inventory

The repository contains one native Android launcher provider: `MathMasterHomeWidgetProvider`. Seven layout compositions are routed through that provider, with compact, regular and wide variants. Each pinned Android AppWidget ID retains its own selected content, composition and background effect.

## Visual redesign

All seven compositions now use the same two wallpaper-first background effects:

| Effect | Implementation | Expected appearance |
|---|---|---|
| Full Transparent | Root uses Android transparent color; inner panel and badge resources are also transparent | No widget card fill or border; wallpaper remains visible |
| Transparent Blur | Rounded `math_master_home_widget_background_blur.xml` with alpha charcoal fill and subtle white edge | Translucent frosted-glass approximation over wallpaper |

Android RemoteViews cannot sample and dynamically blur the launcher wallpaper behind a widget. Transparent Blur is therefore an alpha-translucent glass surface rather than a real live backdrop blur. Launcher-specific wallpaper treatment may vary.

Previous artwork is not rendered by the provider. Artwork overlays are hidden, inner panel and update badge resources no longer add opaque cards, and progress uses a restrained cyan accent. The old theme palette is no longer exposed in the native configuration UI. Legacy `glass`, `compact` and `minimal` style values resolve to Transparent Blur to preserve legibility for existing pinned widgets.

## Composition coverage

| Composition | Compact | Regular | Wide | Runtime artwork |
|---|---:|---:|---:|---|
| Auto Responsive | Routed by size | Routed by size | Routed by size | Hidden |
| Wide Dashboard | Present | Present | Present | Hidden |
| Compact Dashboard | Present | Present | Present | Hidden |
| Square Dashboard | Present | Present | Present | Hidden |
| Medium Dashboard | Present | Present | Present | Hidden |
| Square Tracker | Present | Present | Present | Hidden |
| Extra-Wide Weekly | Present | Present | Present | Hidden |
| Minimal Progress | Present | Present | Present | Hidden |

The native widget continues to expose the existing content fields: App Identity, Today's Target, Progress, Remaining Target, Study Time, Streak, Weekly Target Tracker and Update Status.

## Functional invariants

- Study progress continues to come from the existing daily streak record; no duplicate timer or progress store is added.
- Daily progress is clamped to the configured target for percentage calculation while actual elapsed study minutes remain visible.
- Weekly checkmarks come only from saved daily records marked completed.
- Per-widget settings remain independent across multiple widget IDs.
- Removing one widget deletes only that instance's preferences.
- Resizing selects the matching RemoteViews layout using launcher-provided dimensions.
- Package replacement refreshes existing pinned instances without discarding saved configuration.
- Main widget tap continues to open Math Master; the redesign does not introduce fake shortcuts.

## Automated verification coverage

`scripts/android-widget-layout.test.mjs` covers:
- Existence of all responsive layout resources.
- Widget provider registration and Android resource-copy wiring.
- Existing content field selection and migration.
- Real weekly-completion data validation.
- Transparent root/panel/badge assets.
- The two supported background effects.
- Artwork disabled in the widget renderer.
- Responsive typography and layout selection.
- Bounded artwork decoding code retained but not invoked in the redesigned widget surface.
- Independent per-instance configuration and package-replacement refresh.

The Android validation workflow compiles the generated native Android project after running the widget configuration script.

## Physical-device verification status

<mark>Not yet verified on a physical launcher.</mark>

CI/source checks do not establish that wallpaper visibility, opacity, rounded clipping, text contrast, or all 21 composition/size combinations render correctly on the user's launcher. Install the APK built from this revision and capture compact, regular, wide and tall screenshots for final visual review. Exact backdrop blur also depends on launcher behavior and is not guaranteed by Android RemoteViews.
