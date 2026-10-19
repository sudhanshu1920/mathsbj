import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const provider = read("android-native/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java");
const nativePlugin = read("android-native/com/sudhanshu/mathsbj/DailyTargetReminderPlugin.java");
const bridge = read("src/lib/dailyTargetReminders.ts");
const config = read("android-native/com/sudhanshu/mathsbj/MathMasterWidgetConfigActivity.java");
const settings = read("src/lib/settings.ts");
const settingsPanel = read("src/components/SettingsPanel.tsx");
const layouts = [
  "android-native/res/layout/math_master_home_widget.xml",
  "android-native/res/layout/math_master_home_widget_compact.xml",
  "android-native/res/layout/math_master_home_widget_wide.xml",
].map(read);

test("all responsive layouts preserve selectable fields and remove the launcher logo", () => {
  const ids = [
    "widget_header_row",
    "widget_target_label",
    "widget_target_value",
    "widget_progress_percent",
    "widget_progress_bar",
    "widget_flex_spacer",
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
  assert.match(provider, /setViewVisibility\(R\.id\.widget_progress_bar, showProgress \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /R\.layout\.math_master_home_widget_compact/);
  assert.match(provider, /R\.layout\.math_master_home_widget_wide/);
  assert.equal(provider.includes("showProgress && !smallWidget"), false);
  assert.equal(provider.includes('selected.contains("remaining") &&'), false);
  assert.match(provider, /OPTION_APPWIDGET_SIZES/);
  assert.match(provider, /new RemoteViews\(viewsBySize\)/);
  assert.match(provider, /getWidgetLayoutForDimensions\(widthDp, heightDp\)/);
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
  assert.match(provider, /responsiveTextSize\(percentBase, fontScale/);
  assert.match(provider, /measuredWidthDp \/ 240f, measuredHeightDp \/ 175f/);
  assert.match(provider, /boolean hasPrimaryContent = showProgress \|\| showTarget;/);
  assert.match(provider, /boolean hasSupportingContent = showStudyTime \|\| showRemaining \|\| showStreak \|\| showWeekly \|\| showUpdateStatus;/);
  assert.match(provider, /supportingGroupCount >= 2 && effectiveHeightDp >= 145/);
  assert.match(provider, /setViewVisibility\(R\\.id\\.widget_primary_row,[\\s\\S]*?showProgress \\|\\| showTarget/);
  assert.match(provider, /setViewVisibility\(R\\.id\\.widget_study_remaining_row,[\\s\\S]*?showStudyTime \\|\\| showRemaining/);
  assert.match(provider, /if \(wideLayout\) \{[\\s\\S]*?widget_lower_row[\\s\\S]*?widget_side_column/);
  assert.match(provider, /effectiveHeightDp >= 145/);
  assert.match(provider, /setViewVisibility\(R\.id\.widget_flex_spacer,[\s\S]*?distributeVerticalSpace \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /setInt\(R\.id\.widget_root, "setGravity",[\s\S]*?distributeVerticalSpace \? Gravity\.TOP : Gravity\.CENTER_VERTICAL\)/);
  for (const layout of layouts) {
    assert.match(layout, /widget_flex_spacer[\s\S]*?android:layout_height="0dp"[\s\S]*?android:layout_weight="1"[\s\S]*?android:visibility="gone"/);
    assert.match(layout, /android:minWidth="(?:50|62)dp"/);
  }
});
