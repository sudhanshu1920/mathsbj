import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { normalizeRemoteViewsLayout } from "./configure-android-notifications.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const provider = read("android-native/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java");
const bootReceiver = read("android-native/com/sudhanshu/mathsbj/DailyTargetReminderBootReceiver.java");
const configureAndroid = read("scripts/configure-android-widgets.mjs");
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
    assert.doesNotMatch(normalizeRemoteViewsLayout(layout), /<View\b/, "packaged RemoteViews layouts must not use plain View classes");
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
  assert.match(config, /"transparent", "Full Transparent"/);
  assert.match(config, /"blur", "Transparent Blur"/);
  assert.match(provider, /normalizeWidgetStyle\(getInstanceString\(preferences, appWidgetId, "style", "blur"\)\)/);
  assert.doesNotMatch(config, /PREMIUM_THEMES|Random Premium Theme|themeGroup/);
});

test("weekly tracker is selectable through the native widget configuration", () => {
  assert.match(config, /\{\"weekly\", \"Weekly Target Tracker\"\}/);
  assert.match(config, /selected\.contains\("weekly"\)/);
  assert.match(provider, /selected\.contains\("weekly"\)/);
  assert.match(provider, /setViewVisibility\(R\.id\.widget_week_section, showWeekly \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /contentSchemaVersion/);
  assert.match(provider, /migratedContent\.put\("weekly"\)/);
});

test("weekly checkmarks use the existing daily streak data and validate native input", () => {
  assert.match(bridge, /streak\.days\[dateKey\]\?\.completed === true/);
  assert.match(bridge, /const completedDaysJson = JSON\.stringify\(/);
  assert.match(bridge, /return streak\.days\[dateKey\]\?\.completed === true \? dateKey : null/);
  assert.match(nativePlugin, /sanitizeCompletedDaysJson\(completedDaysJson\)/);
  assert.match(nativePlugin, /raw\.length\(\) > 512/);
  assert.match(nativePlugin, /Math\.min\(incoming\.length\(\), 7\)/);
  assert.match(nativePlugin, /formatter\.setLenient\(false\)/);
  assert.match(nativePlugin, /firstAllowed\.add\(Calendar\.DAY_OF_MONTH, -6\)/);
  assert.match(nativePlugin, /candidate\.before\(firstAllowed\) \|\| candidate\.after\(today\)/);
  assert.match(nativePlugin, /seen\.contains\(date\)/);
  assert.match(nativePlugin, /MathMasterHomeWidgetProvider\.syncProgressSnapshot/);
  assert.match(provider, /getCompletedDays\(SharedPreferences preferences\)/);
  assert.match(provider, /views\.setTextViewText\(statusIds\[i\], done \? "✓" : "·"\)/);
  assert.match(provider, /views\.setTextViewText\(dateIds\[i\], String\.valueOf\(day\.get\(Calendar\.DAY_OF_MONTH\)\)\)/);
  assert.match(provider, /date \+ ", " \+ label/);
});

test("widgets expose only full-transparent and translucent-glass background effects", () => {
  const transparent = read("android-native/res/drawable/math_master_home_widget_background.xml");
  const blur = read("android-native/res/drawable/math_master_home_widget_background_blur.xml");
  const panel = read("android-native/res/drawable/math_master_widget_panel.xml");
  const badge = read("android-native/res/drawable/math_master_home_widget_badge.xml");
  assert.match(transparent, /#00000000/);
  assert.match(blur, /#6639434D/);
  assert.match(blur, /#28FFFFFF/);
  assert.match(panel, /#00000000/);
  assert.match(badge, /#00000000/);
  assert.match(provider, /normalizeWidgetStyle\(getInstanceString\(preferences, appWidgetId, "style", "blur"\)\)/);
  assert.match(provider, /R\.drawable\.math_master_home_widget_background/);
  assert.doesNotMatch(provider, /android\.R\.color\.transparent/);
  assert.match(provider, /R\.drawable\.math_master_home_widget_background_blur/);
  assert.match(provider, /views\.setViewVisibility\(R\.id\.widget_artwork, View\.GONE\)/);
  assert.match(provider, /views\.setViewVisibility\(R\.id\.widget_artwork_overlay, View\.GONE\)/);
  assert.match(config, /"transparent", "Full Transparent"/);
  assert.match(config, /"blur", "Transparent Blur"/);
  assert.doesNotMatch(config, /PREMIUM_THEMES|Random Premium Theme|themeGroup/);
  assert.match(provider, /return "transparent".equals\(value\) \? "transparent" : "blur";/);
  assert.match(config, /return "transparent".equals\(style\) \? "transparent" : "blur";/);
  assert.match(provider, /targetComplete \? "✓ Daily target complete!"/);
});

test("responsive typography is more prominent and weighted spacers cannot split widget content", () => {
  assert.ok(provider.includes("responsiveTextSize(percentBase, fontScale"));
  assert.ok(provider.includes("measuredWidthDp / 220f, measuredHeightDp / 155f"));
  assert.ok(provider.includes("float percentBase = compactLayout ? 27f : (wideLayout ? 36f : 38f);"));
  assert.ok(provider.includes("responsiveTextSize(percentBase, fontScale"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_flex_spacer, View.GONE);"));
  assert.ok(provider.includes('views.setInt(R.id.widget_content, "setGravity", Gravity.CENTER_VERTICAL);'));
  assert.equal(provider.includes("boolean distributeVerticalSpace"), false);
  assert.equal(provider.includes("distributeVerticalSpace ? Gravity.TOP"), false);
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_primary_row,"));
  assert.ok(provider.includes("(showProgress || showTarget) ? View.VISIBLE : View.GONE);"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_study_remaining_row,"));
  assert.ok(provider.includes("(showStudyTime || showRemaining) ? View.VISIBLE : View.GONE);"));
  assert.ok(provider.includes("boolean showWideLowerRow = showStudyTime || showRemaining || showStreak || showWeekly;"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_lower_row,"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_side_column,"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_artwork, View.GONE);"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_artwork_overlay, View.GONE);"));
  assert.ok(provider.includes('views.setInt(R.id.widget_root, "setBackgroundResource", backgroundResource);'));
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
    assert.ok(configureAndroid.includes(`name: '${componentName}'`), `${componentName} must be included in the Android manifest component generator`);
    assert.ok(configureAndroid.includes("@xml/math_master_home_widget_info"), `${componentName} must reference widget metadata`);
  }

  assert.match(configureAndroid, /const RESOURCE_DIRS = \['drawable', 'drawable-nodpi', 'layout', 'values', 'xml', 'xml-v31'\]/);
  assert.match(configureAndroid, /await copyDirectory\(/);
  assert.match(configureAndroid, /normalizeRemoteViewsLayout\(xml\)/);
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
    for (const size of sizeVariants) {
      const path = `android-native/res/layout/math_master_widget_${composition}_${size}.xml`;
      const layout = read(path);
      for (const id of ["widget_root", "widget_content", "widget_artwork", "widget_artwork_overlay", "widget_progress_ring", "widget_progress_percent", "widget_target_value", "widget_progress_bar", "widget_week_strip"]) {
        assert.ok(layout.includes(`@+id/${id}`), `${path} must contain ${id}`);
      }
      assert.ok(layout.includes(`math_master_widget_art_overlay_${composition}`));
    }
  }
  assert.ok(configureAndroid.includes("'drawable-nodpi'"));
  assert.ok(existsSync(new URL("../android-native/res/drawable-nodpi/math_master_widget_atlas.webp", import.meta.url)));
  assert.ok(existsSync(new URL("../public/math_master_widget_atlas.webp", import.meta.url)));
  assert.ok(read("android-native/com/sudhanshu/mathsbj/MathMasterWidgetConfigActivity.java").includes('"instance_" + widgetId + "_composition"'));
  assert.ok(provider.includes("createProgressRing(context, progress, accentColor)"));
  assert.ok(provider.includes("views.setViewVisibility(R.id.widget_artwork, View.GONE);"));
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

test("native widget configuration preview uses the selected background effect and live metrics", () => {
  assert.ok(config.includes('String style = normalizeWidgetStyle(selectedRadioValue(styleGroup, "blur"));'));
  assert.ok(config.includes('int previewBackground = "transparent".equals(style)'));
  assert.ok(config.includes('Color.argb(102, 57, 67, 77)'));
  assert.ok(config.includes('previewSummary.setBackgroundColor(Color.TRANSPARENT)'));
  assert.ok(config.includes("previewMetric.setText(primaryMetric)"));
  assert.ok(config.includes("previewDesignTitle.setText("));
  assert.ok(config.includes("previewSubtitle.setText(android.text.TextUtils.join"));
  assert.ok(config.includes('Background: " + effectLabel'));
});

test("package updates refresh all existing pinned widget instances without replacing their saved configuration", () => {
  assert.ok(bootReceiver.includes("Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)"));
  assert.match(bootReceiver, /Intent\.ACTION_MY_PACKAGE_REPLACED\.equals\(action\)[\s\S]*?MathMasterHomeWidgetProvider\.updateWidgetPreferences\(context\)/);
  assert.ok(provider.includes("AppWidgetManager.getInstance(context)"));
  assert.ok(provider.includes("getAppWidgetIds(provider)"));
  assert.ok(provider.includes("for (int widgetId : widgetIds)"));
  assert.ok(provider.includes("getSelectedContent(preferences, appWidgetId)"));
  assert.ok(provider.includes('getInstanceString(preferences, appWidgetId, "style"'));
});
