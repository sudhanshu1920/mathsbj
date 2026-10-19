import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { normalizeRemoteViewsLayout } from "./configure-android-notifications.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const provider = read("android-native/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java");
const bootReceiver = read("android-native/com/sudhanshu/mathsbj/DailyTargetReminderBootReceiver.java");
const configureAndroid = read("scripts/configure-android-notifications.mjs");
const artworkPreparation = read("scripts/prepare-widget-artwork.mjs");
const artworkSvg = read("public/math_master_widget_atlas.svg");
const legacyWidgetInfo = read("android-native/res/xml/math_master_home_widget_info.xml");
const android31WidgetInfo = read("android-native/res/xml-v31/math_master_home_widget_info.xml");
const widgetProviderFiles = readdirSync(new URL("../android-native/com/sudhanshu/mathsbj/", import.meta.url))
  .filter((name) => name.endsWith("WidgetProvider.java"));
const nativePlugin = read("android-native/com/sudhanshu/mathsbj/DailyTargetReminderPlugin.java");
const bridge = read("src/lib/dailyTargetReminders.ts");
const config = read("android-native/com/sudhanshu/mathsbj/MathMasterWidgetConfigActivity.java");
const settings = read("src/lib/settings.ts");
const settingsPanel = read("src/components/SettingsPanel.tsx");
const compositionIds = [
  "hero_wide", "compact_green", "square_math_bot", "medium_study",
  "square_cosmic", "extra_wide_weekly", "minimal_progress",
];
const sizeVariants = ["compact", "regular", "wide"];
const compositionLayoutPaths = compositionIds.flatMap((composition) =>
  sizeVariants.map((size) => `android-native/res/layout/math_master_widget_${composition}_${size}.xml`));
const legacyLayoutPaths = [
  "android-native/res/layout/math_master_home_widget.xml",
  "android-native/res/layout/math_master_home_widget_compact.xml",
  "android-native/res/layout/math_master_home_widget_wide.xml",
];
const layouts = [...legacyLayoutPaths, ...compositionLayoutPaths].map(read);

test("all responsive layouts preserve selectable fields and remove the launcher logo", () => {
  const ids = [
    "widget_header_row",
    "widget_target_label",
    "widget_target_value",
    "widget_progress_percent",
    "widget_progress_bar",
    "widget_flex_spacer",
    "widget_artwork",
    "widget_artwork_overlay",
    "widget_progress_ring",
    "widget_content",
    "widget_study_time_text",
    "widget_remaining_text",
    "widget_streak_text",
    "widget_streak_container",
    "widget_week_section",
    "widget_week_title",
    "widget_week_strip",
    "widget_update_text",
    "widget_disabled_text",
  ];
  for (const layout of layouts) {
    for (const id of ids) assert.match(layout, new RegExp(`@\\+id/${id}\\b`), `missing ${id}`);
    for (let i = 0; i < 7; i++) {
      assert.match(layout, new RegExp(`@\\+id/widget_week_day_${i}\\b`));
      assert.match(layout, new RegExp(`@\\+id/widget_week_date_${i}\\b`));
      assert.match(layout, new RegExp(`@\\+id/widget_week_status_${i}\\b`));
    }
    assert.equal(layout.includes("@mipmap/ic_launcher"), false);
    const packagedLayout = normalizeRemoteViewsLayout(layout);
    assert.doesNotMatch(packagedLayout, /<View\\b/, "packaged RemoteViews layouts must not use plain View classes");
    assert.doesNotMatch(packagedLayout, /android:scaleType="fitXY"/, "packaged artwork must not stretch when launcher dimensions differ");
    assert.match(packagedLayout, /android:scaleType="centerCrop"/, "packaged artwork must preserve its aspect ratio");
    assert.equal(layout.includes("widget_progress_text"), false);
  }
  assert.match(layouts[2], /widget_lower_row[\s\S]*android:orientation="horizontal"/);
  assert.match(layouts[2], /widget_study_remaining_row[\s\S]*widget_side_column/);
});

test("selected content is not silently suppressed at compact sizes", () => {
  assert.match(provider, /boolean showIdentity = widgetsEnabled && selected\.contains\("appIdentity"\);/);
  assert.match(provider, /boolean showRemaining = widgetsEnabled && selected\.contains\("remaining"\);/);
  assert.match(provider, /boolean showStreak = widgetsEnabled && selected\.contains\("streak"\);/);
  assert.match(provider, /boolean showWeekly = widgetsEnabled && selected\.contains\("weekly"\);/);
  assert.match(provider, /boolean showUpdateStatus = widgetsEnabled && selected\.contains\("updateStatus"\);/);
  assert.match(provider, /setViewVisibility\(R\.id\.widget_week_section, showWeekly \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /setViewVisibility\(R\.id\.widget_progress_bar, showProgress && !useProgressRing \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /setViewVisibility\(R\.id\.widget_progress_ring, useProgressRing \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /R\.layout\.math_master_widget_minimal_progress_compact/);
  assert.match(provider, /R\.layout\.math_master_widget_hero_wide_wide/);
  assert.equal(provider.includes("showProgress && !smallWidget"), false);
  assert.equal(provider.includes('selected.contains("remaining") &&'), false);
  assert.match(provider, /OPTION_APPWIDGET_SIZES/);
  assert.match(provider, /new RemoteViews\(viewsBySize\)/);
  assert.match(provider, /getWidgetLayoutForDimensions\(widthDp, heightDp, composition\)/);
  assert.match(provider, /heightDp > 0 && heightDp < 135/);
  assert.match(provider, /isTallWidget\(widthDp, heightDp\) \|\| isWideWidget\(widthDp, heightDp\)/);
  assert.match(config, /"random", "Random Premium Theme"/);
  assert.match(config, /putString\("instance_" \+ widgetId \+ "_themeMode", themeMode\)/);
  assert.match(config, /chooseRandomTheme\(preferences, widgetId\)/);
});

test("weekly tracker is selectable and legacy selections migrate only once", () => {
  assert.match(settings, /HomeWidgetContent = .*'weekly'/);
  assert.match(settings, /HOME_WIDGET_CONTENT_SCHEMA_KEY = 'math-app-home-widget-content-schema-v2'/);
  assert.match(settings, /contentSchemaNeedsMigration && Array\.isArray\(value\.homeWidgetContent\)/);
  assert.match(settings, /widgetContent = \[\.\.\.widgetContent, 'weekly'\]/);
  assert.match(settingsPanel, /id: 'weekly', label: 'Weekly Target Tracker'/);
  assert.match(settingsPanel, /streak\.days\[dateKey\]\?\.completed === true/);
  assert.match(settingsPanel, /dateLabel: String\(day\.getDate\(\)\)/);
});

test("weekly checkmarks use the existing daily streak data and validate native input", () => {
  assert.match(bridge, /streak\.days\[dateKey\]\?\.completed === true/);
  assert.match(bridge, /completedDaysJson: JSON\.stringify\(completedDays\)/);
  assert.match(nativePlugin, /completedDaysRaw\.length\(\) > 512/);
  assert.match(nativePlugin, /incomingDays\.length\(\) > 7/);
  assert.match(nativePlugin, /isDateInTrailingSevenDays\(date\)/);
  assert.match(nativePlugin, /formatter\.setLenient\(false\)/);
  assert.match(nativePlugin, /candidate\.after\(today\)/);
  assert.match(nativePlugin, /firstAllowed\.add\(java\.util\.Calendar\.DAY_OF_MONTH, -6\)/);
  assert.match(nativePlugin, /putString\("completedDaysJson", completedDays\.toString\(\)\)/);
  assert.match(provider, /getCompletedDays\(SharedPreferences preferences\)/);
  assert.match(provider, /views\.setTextViewText\(statusIds\[i\], done \? "✓" : "·"\)/);
  assert.match(provider, /views\.setTextViewText\(dateIds\[i\], String\.valueOf\(day\.get\(Calendar\.DAY_OF_MONTH\)\)\)/);
  assert.match(provider, /date \+ ", " \+ label/);
});

test("glass colors are translucent and target completion uses a stable celebratory accent", () => {
  const dark = read("android-native/res/drawable/math_master_home_widget_background.xml");
  const light = read("android-native/res/drawable/math_master_home_widget_background_light.xml");
  const completionBackgrounds = Array.from({ length: 7 }, (_, index) => ({
    dark: read(`android-native/res/drawable/math_master_home_widget_background_complete_${index}.xml`),
    light: read(`android-native/res/drawable/math_master_home_widget_background_complete_light_${index}.xml`),
  }));
  assert.match(dark, /#B5211F35/);
  assert.match(light, /#C9F4F7FC/);
  assert.match(provider, /getPaletteThemeIndex\(widgetTheme\)/);
  assert.match(provider, /COMPLETION_BACKGROUND_DARK\[themeIndex\]/);
  assert.match(provider, /COMPLETION_BACKGROUND_LIGHT\[themeIndex\]/);
  assert.match(config, /instance_" \+ widgetId \+ "_themeMode/);
  assert.match(config, /"random".equals\(previousThemeMode\) && isPaletteTheme\(previousTheme\)/);
  assert.equal(completionBackgrounds.length, 7);
  for (const background of completionBackgrounds) {
    assert.match(background.dark, /#B5[0-9A-Fa-f]{6}/);
    assert.match(background.light, /#D9[0-9A-Fa-f]{6}/);
  }
  assert.match(provider, /targetComplete \? "✓ Daily target complete!"/);
});

test("responsive typography and weighted spacing adapt to selected fields and available height", () => {
  assert.ok(provider.includes("responsiveTextSize(percentBase, fontScale"));
  assert.ok(provider.includes("float widthScale = measuredWidthDp / (compactLayout ? 125f : (wideLayout ? 220f : 190f))"));
  assert.ok(provider.includes("Math.max(1.0f, Math.min(1.42f, widthScale))"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_primary_row,"));
  assert.ok(provider.includes("(showProgress || showTarget) ? View.VISIBLE : View.GONE);"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_study_remaining_row,"));
  assert.ok(provider.includes("(showStudyTime || showRemaining) ? View.VISIBLE : View.GONE);"));
  assert.ok(provider.includes("boolean showWideLowerRow = showStudyTime || showRemaining || showStreak || showWeekly;"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_lower_row,"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_side_column,"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_flex_spacer,"));
  assert.ok(provider.includes('views.setInt(R.id.widget_content, "setGravity",'));
  assert.ok(provider.includes('views.setInt(R.id.widget_content, "setGravity", Gravity.CENTER_VERTICAL);'));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_flex_spacer, View.GONE)"));
  assert.equal(provider.includes("distributeVerticalSpace"), false);
  for (const layout of layouts) {
    assert.ok(layout.includes('android:id="@+id/widget_flex_spacer"'));
    assert.ok(layout.includes('android:layout_height="0dp"'));
    assert.ok(layout.includes('android:layout_weight="1"'));
    assert.ok(layout.includes('android:visibility="gone"'));
    assert.ok(layout.includes('android:minWidth="50dp"') || layout.includes('android:minWidth="62dp"'));
  }
});

test("every native widget provider and responsive layout is registered and copied into Android builds", () => {
  assert.ok(widgetProviderFiles.length > 0, "native AppWidgetProvider inventory must not be empty");
  for (const filename of widgetProviderFiles) {
    const componentName = filename.replace(".java", "");
    assert.ok(configureAndroid.includes(`'${filename}'`), `${filename} must be copied to the generated Android app`);
    assert.ok(configureAndroid.includes(`android:name=".${componentName}"`), `${componentName} must be registered in AndroidManifest`);
    assert.ok(configureAndroid.includes("@xml/math_master_home_widget_info"), `${componentName} must reference widget metadata`);
  }

  const variantFiles = [
    "math_master_home_widget.xml",
    "math_master_home_widget_compact.xml",
    "math_master_home_widget_wide.xml",
  ];
  for (const filename of variantFiles) {
    assert.ok(configureAndroid.includes(`'layout/${filename}'`), `${filename} must be copied for every release/debug build`);
  }
  assert.ok(legacyWidgetInfo.includes('android:initialLayout="@layout/math_master_home_widget"'));
  assert.ok(legacyWidgetInfo.includes('android:resizeMode="horizontal|vertical"'));
  assert.ok(android31WidgetInfo.includes('android:initialLayout="@layout/math_master_home_widget"'));
  assert.ok(android31WidgetInfo.includes('android:previewLayout="@layout/math_master_home_widget"'));
  assert.ok(android31WidgetInfo.includes('android:widgetFeatures="reconfigurable"'));
  assert.ok(provider.includes("OPTION_APPWIDGET_SIZES"));
  assert.ok(provider.includes("new RemoteViews(viewsBySize)"));
  assert.ok(provider.includes("getWidgetLayoutForDimensions(widthDp, heightDp, composition)"));
});

test("all seven design compositions have three responsive XML variants and packaged art resources", () => {
  assert.equal(compositionLayoutPaths.length, 21);
  for (const composition of compositionIds) {
    assert.ok(provider.includes(`case "${composition}":`), `provider must route ${composition}`);
    assert.ok(configureAndroid.includes(`drawable/math_master_widget_art_overlay_${composition}.xml`));
    for (const size of sizeVariants) {
      const path = `android-native/res/layout/math_master_widget_${composition}_${size}.xml`;
      assert.ok(configureAndroid.includes(`'layout/math_master_widget_${composition}_${size}.xml'`), `${path} must be copied`);
      const layout = read(path);
      for (const id of ["widget_root", "widget_content", "widget_artwork", "widget_artwork_overlay", "widget_progress_ring", "widget_progress_percent", "widget_target_value", "widget_progress_bar", "widget_week_strip"]) {
        assert.ok(layout.includes(`@+id/${id}`), `${path} must contain ${id}`);
      }
      assert.ok(layout.includes(`math_master_widget_art_overlay_${composition}`));
    }
  }
  assert.ok(configureAndroid.includes("'drawable-nodpi/math_master_widget_atlas.png'"));
  assert.match(artworkPreparation, /"-w", "3840",\s*"-h", "1280"/);
  assert.match(artworkPreparation, /math_master_widget_atlas\.png/);\n  assert.ok(existsSync(new URL("../public/math_master_widget_atlas.svg", import.meta.url)));
  assert.match(artworkSvg, /width="1536" height="512" viewBox="0 0 1536 512"/);\n  assert.equal((artworkSvg.match(/clip-path="url\(#panel\)"/g) || []).length, 6, "six art scenes should be clipped to the atlas tile grid");
  assert.ok(read("src/lib/settings.ts").includes("HOME_WIDGET_COMPOSITIONS"));
  assert.ok(read("android-native/com/sudhanshu/mathsbj/MathMasterWidgetConfigActivity.java").includes('"instance_" + widgetId + "_composition"'));
  assert.ok(provider.includes("createProgressRing(context, progress, accentColor)"));
  assert.ok(provider.includes("getWidgetArtwork(context, composition, widthDp, heightDp)"));
});

test("widget artwork uses sampled region decoding and bounded output renditions", () => {
  assert.ok(provider.includes("BitmapRegionDecoder"));
  assert.ok(provider.includes("decoder.decodeRegion(new Rect(left, top, right, bottom), options)"));
  assert.ok(provider.includes("options.inSampleSize = sampleSize"));
  assert.ok(provider.includes("outputWidth = Math.max(1, Math.min(desiredWidth"));
  assert.ok(provider.includes("outputHeight = Math.max(1, Math.min(300"));
  assert.ok(provider.includes("WIDGET_ARTWORK_CACHE"));
  assert.ok(provider.includes("catch (IOException | RuntimeException exception)"));
  assert.equal(
    provider.includes("BitmapFactory.decodeResource(context.getResources(), R.drawable.math_master_widget_atlas)"),
    false,
    "the full-resolution artwork atlas must not be decoded into one ARGB bitmap",
  );
});

test("4K vector artwork, contrast, width-based typography, and compact spacing are regression protected", () => {
  assert.match(artworkPreparation, /rsvg-convert/);
  assert.match(artworkPreparation, /3840/);
  assert.match(artworkPreparation, /1280/);
  assert.match(artworkPreparation, /math_master_widget_atlas\.png/);
  assert.match(artworkSvg, /width="1536" height="512" viewBox="0 0 1536 512"/);
  assert.equal((artworkSvg.match(/clip-path="url\(#panel\)"/g) || []).length, 6);
  assert.match(provider, /setAlpha", 1\.0f/);
  assert.doesNotMatch(provider, /setAlpha", 0\.86f/);
  assert.match(provider, /float widthScale = measuredWidthDp \/ \(compactLayout \? 125f/);
  assert.match(provider, /Math.max\(1\.0f, Math.min\(1\.42f, widthScale\)\)/);
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_flex_spacer, View.GONE)"));
  assert.ok(provider.includes('views.setInt(R.id.widget_content, "setGravity", Gravity.CENTER_VERTICAL);'));
  assert.match(provider, /Color\.WHITE/);

  const overlayPaths = [
    "android-native/res/drawable/math_master_widget_art_overlay_hero_wide.xml",
    "android-native/res/drawable/math_master_widget_art_overlay_compact_green.xml",
    "android-native/res/drawable/math_master_widget_art_overlay_square_math_bot.xml",
    "android-native/res/drawable/math_master_widget_art_overlay_medium_study.xml",
    "android-native/res/drawable/math_master_widget_art_overlay_square_cosmic.xml",
    "android-native/res/drawable/math_master_widget_art_overlay_extra_wide_weekly.xml",
    "android-native/res/drawable/math_master_widget_art_overlay_minimal_progress.xml",
  ];
  for (const overlayPath of overlayPaths) {
    const overlay = read(overlayPath);
    const colors = [...overlay.matchAll(/#([0-9A-Fa-f]{8})/g)].map((match) => parseInt(match[1].slice(0, 2), 16));
    assert.ok(colors.length >= 4, overlayPath + " must retain a tinted surface and border");
    assert.ok(colors.every((alpha) => alpha <= 0x66), overlayPath + " must not hide the background artwork");
  }
});


test("native widget configuration preview uses the selected composition artwork and live metrics", () => {
  assert.match(provider, /public static Bitmap getConfigurationPreviewArtwork/);
  assert.ok(config.includes("MathMasterHomeWidgetProvider.getConfigurationPreviewArtwork("));
  assert.ok(config.includes("previewArtwork.setImageBitmap(artwork)"));
  assert.ok(config.includes("previewMetric.setText(primaryMetric)"));
  assert.ok(config.includes("previewDesignTitle.setText("));
  assert.ok(config.includes("previewSubtitle.setText(android.text.TextUtils.join"));
});

test("package updates refresh all existing pinned widget instances without replacing their saved configuration", () => {
  assert.ok(bootReceiver.includes("Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)"));
  assert.ok(bootReceiver.includes("MathMasterHomeWidgetProvider.updateWidgetPreferences(context)"));
  assert.ok(provider.includes("AppWidgetManager.getInstance(context)"));
  assert.ok(provider.includes("getAppWidgetIds(provider)"));
  assert.ok(provider.includes("for (int widgetId : widgetIds)"));
  assert.ok(provider.includes("getSelectedContent(preferences, appWidgetId)"));
  assert.ok(provider.includes('getInstanceString(preferences, appWidgetId, "theme"'));
});
