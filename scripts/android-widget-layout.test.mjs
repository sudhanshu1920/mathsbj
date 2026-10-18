import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const provider = read("android-native/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java");
const nativePlugin = read("android-native/com/sudhanshu/mathsbj/DailyTargetReminderPlugin.java");
const bridge = read("src/lib/dailyTargetReminders.ts");
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
    "widget_study_time_text",
    "widget_remaining_text",
    "widget_streak_text",
    "widget_streak_container",
    "widget_week_strip",
    "widget_update_text",
    "widget_disabled_text",
  ];
  for (const layout of layouts) {
    for (const id of ids) assert.match(layout, new RegExp(`@\\+id/${id}\\b`), `missing ${id}`);
    for (let i = 0; i < 7; i++) {
      assert.match(layout, new RegExp(`@\\+id/widget_week_day_${i}\\b`));
      assert.match(layout, new RegExp(`@\\+id/widget_week_status_${i}\\b`));
    }
    assert.doesNotMatch(layout, /@mipmap\\/ic_launcher|widget_progress_text/);
  }
});

test("selected content is not silently suppressed at compact sizes", () => {
  assert.match(provider, /boolean showIdentity = widgetsEnabled && selected\.contains\("appIdentity"\);/);
  assert.match(provider, /boolean showRemaining = widgetsEnabled && selected\.contains\("remaining"\);/);
  assert.match(provider, /boolean showStreak = widgetsEnabled && selected\.contains\("streak"\);/);
  assert.match(provider, /boolean showUpdateStatus = widgetsEnabled && selected\.contains\("updateStatus"\);/);
  assert.match(provider, /setViewVisibility\(R\.id\.widget_progress_bar, showProgress \? View\.VISIBLE : View\.GONE\)/);
  assert.match(provider, /R\.layout\.math_master_home_widget_compact/);
  assert.match(provider, /R\.layout\.math_master_home_widget_wide/);
  assert.doesNotMatch(provider, /!smallWidget \? View\.GONE/);
  assert.doesNotMatch(provider, /selected\.contains\("remaining"\)\s*&&/);
});

test("weekly checkmarks use the existing daily streak data and validate native input", () => {
  assert.match(bridge, /streak\.days\[dateKey\]\?\.completed === true/);
  assert.match(bridge, /completedDaysJson: JSON\.stringify\(completedDays\)/);
  assert.match(nativePlugin, /completedDaysRaw\.length\(\) > 512/);
  assert.match(nativePlugin, /incomingDays\.length\(\) > 7/);
  assert.match(nativePlugin, /putString\("completedDaysJson", completedDays\.toString\(\)\)/);
  assert.match(provider, /getCompletedDays\(SharedPreferences preferences\)/);
  assert.match(provider, /views\.setTextViewText\(statusIds\[i\], done \? "✓" : "·"\)/);
});

test("glass colors are translucent and target completion uses a stable celebratory accent", () => {
  const dark = read("android-native/res/drawable/math_master_home_widget_background.xml");
  const light = read("android-native/res/drawable/math_master_home_widget_background_light.xml");
  assert.match(dark, /#B5211F35/);
  assert.match(light, /#C9F4F7FC/);
  assert.match(provider, /if \(targetComplete\) accentColor = completedAccentColor\(todayKey\(\), streak\)/);
  assert.match(provider, /targetComplete \? "✓ Daily target complete!"/);
});
