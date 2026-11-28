import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { configureAndroidWidgets } from './configure-android-widgets.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, ROOT), 'utf8');
const exists = (relative) => existsSync(new URL(relative, ROOT));
const list = (relative) => readdirSync(new URL(relative, ROOT)).sort();

const PROVIDER = 'android-native/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java';
const RENDERER = 'android-native/com/sudhanshu/mathsbj/MathMasterWidgetRenderer.java';
const CONFIG = 'android-native/com/sudhanshu/mathsbj/MathMasterWidgetConfigActivity.java';
const BACKUP_PLUGIN = 'android-native/com/sudhanshu/mathsbj/BackupRestorePlugin.java';
const BOOT_RECEIVER = 'android-native/com/sudhanshu/mathsbj/DailyTargetReminderBootReceiver.java';
const REMINDER_PLUGIN = 'android-native/com/sudhanshu/mathsbj/DailyTargetReminderPlugin.java';

test('Screen Time Island keeps the expanded visual window non-touchable and isolates input to capsule bounds', () => {
  const overlay = read('android-native/com/sudhanshu/mathsbj/ScreenTimeIslandOverlay.java');
  assert.match(overlay, /FLAG_NOT_TOUCHABLE/);
  assert.match(overlay, /private final IslandTouchView touchView/);
  assert.match(overlay, /private final WindowManager\.LayoutParams touchParams/);
  assert.match(overlay, /private void updateTouchability\(boolean interactive\)/);
  assert.match(overlay, /if \(interactive\) attachTouchWindow\(\);\s+else removeTouchWindow\(\);/);
  assert.match(overlay, /private void updateTouchWindowGeometry\(\)/);
  assert.match(overlay, /touchParams\.width = width;[\s\S]*?touchParams\.height = height;/);
  assert.match(overlay, /touchParams\.x = screenWidth \/ 2 \+ cameraOffsetX - width \/ 2;/);
  assert.match(overlay, /touchParams\.y = anchorTop \+ Math\.round\(frame\.offsetY/);
  assert.match(overlay, /private void removeTouchWindow\(\)/);
  assert.match(overlay, /private boolean handleTouch\(MotionEvent event\)/);
  assert.match(overlay, /@Override public boolean onTouchEvent\(MotionEvent event\) \{\s+return false;\s+\}/);
  assert.match(overlay, /class IslandView extends View[\s\S]*?@Override public boolean performClick\(\)/,
    'the non-touchable visual view must retain its accessibility click action');
  assert.doesNotMatch(overlay, /params\.flags\s*=/, 'the visual window flags must never be toggled to touchable');
});


const COMPOSITIONS = [
  'hero_wide', 'compact_green', 'square_math_bot', 'medium_study',
  'square_cosmic', 'extra_wide_weekly', 'minimal_progress',
];
const CONTENT_OPTIONS = [
  'appIdentity', 'target', 'progress', 'remaining', 'studyTime', 'streak', 'weekly', 'quiz', 'updateStatus',
  'studyAppsScreenTime', 'deviceAppsScreenTime',
];

function quotedList(source, pattern) {
  const match = source.match(pattern);
  assert.ok(match, `Could not find ${pattern}`);
  return [...match[1].matchAll(/"([A-Za-z_]+)"|'([A-Za-z_]+)'/g)].map((item) => item[1] ?? item[2]);
}

test('renderer draws every composition and the provider offers the same set', () => {
  const renderer = read(RENDERER);
  const provider = read(PROVIDER);
  assert.deepEqual(
    quotedList(renderer, /static final String\[\] COMPOSITIONS = \{([\s\S]*?)\};/),
    COMPOSITIONS,
  );
  const providerOptions = provider.match(/WIDGET_COMPOSITIONS = \{([\s\S]*?)\};/);
  assert.ok(providerOptions, "provider must expose its single composition registry");
  assert.deepEqual(
    [...providerOptions[1].matchAll(/\{"([a-z_]+)",/g)].map((entry) => entry[1]),
    ['auto', ...COMPOSITIONS],
  );
  assert.match(provider, /static String\[\]\[\] getWidgetCompositionOptions\(\)/);
  for (const composition of COMPOSITIONS) {
    assert.ok(renderer.includes(`case "${composition}"`), `renderer is missing a case for ${composition}`);
  }
  for (const method of ['layoutHero', 'layoutGreen', 'layoutMathBot', 'layoutStudy', 'layoutCosmic', 'layoutWeekly', 'layoutMinimal']) {
    assert.ok(renderer.includes(`void ${method}()`), `renderer is missing ${method}`);
  }
  assert.match(renderer, /void layoutScreenTimeReflow\(float rw, float rh\)/);
  assert.match(renderer, /if \(o\.identity && !compactStrip\)/);
  assert.match(renderer, /if \(wideStrip\) \{[\s\S]*?header\(RU\(38f, 25f, 97f, 87f\), XU\(157f\), YU\(72f\), 22f \* su, YU\(105f\), 0f, X\(272f\)\)/);
  assert.match(renderer, /float panelLeft = o\.identity \? 286f : pad/);
  assert.match(renderer, /case "compact_green":[\s\S]*?case "hero_wide"/);
  assert.match(renderer, /float panelTop = 14f;[\s\S]*?studyAppsPanel\(panels\[0\], 1, true\)/);
  assert.doesNotMatch(renderer, /drawScreenTimeUpdated\(section/);
  assert.match(renderer, /void studyAppsPanel\(RectF panel, int requestedRows, boolean inline\)/);
  assert.match(renderer, /void deviceAppsPanel\(RectF panel, int requestedRows, boolean inline\)/);
  assert.match(renderer, /static Bitmap render\(/);
  assert.match(renderer, /static String autoComposition\(/);
});

test('renderer is Context-free and only uses plain android.graphics drawing', () => {
  const renderer = read(RENDERER);
  assert.doesNotMatch(renderer, /import android\.content\./);
  assert.doesNotMatch(renderer, /import android\.widget\./);
  assert.doesNotMatch(renderer, /import android\.view\./);
  assert.doesNotMatch(renderer, /BitmapFactory|decodeResource|R\.drawable/);
});

test('provider renders one bitmap per size and keeps its tap, preferences and sync hooks', () => {
  const provider = read(PROVIDER);
  assert.match(provider, /MathMasterWidgetRenderer\.render\(/);
  assert.match(provider, /R\.layout\.math_master_home_widget/);
  assert.match(provider, /R\.id\.widget_canvas/);
  assert.match(provider, /R\.id\.widget_root/);
  assert.match(provider, /setImageViewBitmap\(/);
  assert.match(provider, /setContentDescription\(/);
  assert.match(provider, /new RemoteViews\(viewsBySize\)/);
  assert.match(provider, /OPTION_APPWIDGET_SIZES/);
  assert.match(provider, /PendingIntent\.FLAG_IMMUTABLE/);
  assert.match(provider, /renderConfigurationPreview\(/);
  for (const hook of ['syncProgressSnapshot', 'updateWidgetPreferences', 'updateReleaseStatus', 'refreshWidgetInstances', 'onDeleted']) {
    assert.ok(provider.includes(hook), `provider lost ${hook}`);
  }
  // The old RemoteViews-per-composition layouts and artwork atlas are gone.
  assert.doesNotMatch(provider, /R\.layout\.math_master_widget_/);
  assert.doesNotMatch(provider, /R\.drawable\./);
  assert.doesNotMatch(provider, /BitmapRegionDecoder|math_master_widget_atlas|COMPLETION_BACKGROUND/);
});

test('bitmap memory stays inside the launcher budget', () => {
  const provider = read(PROVIDER);
  assert.match(provider, /variantCount/);
  assert.match(provider, /getDisplayMetrics\(\)/);
  assert.match(provider, /catch \(RuntimeException \| OutOfMemoryError ignored\)/);
});

test('bundled fonts load from assets and fall back to the system font', () => {
  const provider = read(PROVIDER);
  assert.match(provider, /Typeface\.createFromAsset\(context\.getAssets\(\), assetPath\)/);
  assert.match(provider, /catch \(RuntimeException ignored\)/);
  for (const weight of ['Regular', 'Medium', 'Bold']) {
    assert.ok(provider.includes(`fonts/MathMaster-${weight}.otf`));
    assert.ok(exists(`android-native/assets/fonts/MathMaster-${weight}.otf`), `missing ${weight} font`);
  }
  assert.ok(exists('android-native/assets/fonts/LICENSE-Inter.txt'), 'font licence must ship with the fonts');
});

test('content options and schema version agree in the provider, configuration screen and backup code', () => {
  const provider = read(PROVIDER);
  const config = read(CONFIG);
  const backupPlugin = read(BACKUP_PLUGIN);
  const backupTs = read('src/lib/backupRestore.ts');
  assert.deepEqual(quotedList(provider, /static final String\[\] CONTENT_OPTIONS = \{([\s\S]*?)\};/), CONTENT_OPTIONS);
  assert.deepEqual(quotedList(backupTs, /WIDGET_CONTENT_OPTIONS = new Set\(\[([\s\S]*?)\]\)/), CONTENT_OPTIONS);
  assert.deepEqual(quotedList(backupPlugin, /CONTENT_OPTIONS = new TreeSet<>\(Arrays\.asList\(([\s\S]*?)\)\);/), CONTENT_OPTIONS);
  for (const option of CONTENT_OPTIONS) {
    assert.ok(config.includes(`{"${option}",`), `configuration screen is missing ${option}`);
  }
  assert.match(provider, /CONTENT_SCHEMA_VERSION = 4/);
  assert.match(config, /String schemaKey = prefix \+ "contentSchemaVersion"/);
  assert.match(config, /putInt\(schemaKey, 4\)/);
  assert.match(backupTs, /item < 1 \|\| item > max/);
  assert.match(backupTs, /WIDGET_INSTANCE_BOOLEAN_KEYS/);
  assert.match(backupPlugin, /isIntegerInRange\(value, 1, 4\)/);
  assert.match(backupPlugin, /screenTimeMaxEntries/);
});



test('screen-time content is backed by local UsageStats and keeps Study Apps separate from device inventory', () => {
  const usage = read('android-native/com/sudhanshu/mathsbj/AppUsageAnalyticsPlugin.java');
  const repository = read('android-native/com/sudhanshu/mathsbj/WidgetScreenTimeRepository.java');
  const dataSource = read('android-native/com/sudhanshu/mathsbj/UsageDataSource.java');
  const provider = read(PROVIDER);
  const renderer = read(RENDERER);
  const config = read(CONFIG);
  const plugin = read('android-native/com/sudhanshu/mathsbj/MathMasterWidgetsPlugin.java');
  const index = read('src/pages/Index.tsx');
  const studyMode = read('android-native/com/sudhanshu/mathsbj/StudyModeManager.java');
  const packageReceiver = read('android-native/com/sudhanshu/mathsbj/StudyModePackageChangeReceiver.java');
  const setup = read('scripts/configure-android-widgets.mjs');

  assert.match(usage, /public static boolean hasUsageAccess\(Context context\)/);
  assert.match(repository, /UsageDataSource\.query\(context, manager, bounds\.start, bounds\.end\)/);
  assert.match(dataSource, /UsageStatsManager\.INTERVAL_DAILY/);
  assert.match(dataSource, /manager\.queryUsageStats\(/);
  assert.match(dataSource, /stat\.getTotalTimeInForeground\(\)/);
  assert.match(repository, /Executors\.newSingleThreadExecutor/);
  assert.match(repository, /CACHE_TTL_MS = 2L \* 60L \* 1000L/);
  assert.match(repository, /MAX_SNAPSHOTS = 9/);
  assert.match(repository, /ICON_SIZE_DP = 24/);
  assert.match(repository, /AppUsageAnalyticsPlugin\.hasUsageAccess\(/);
  assert.match(repository, /StudyModeManager\.getSelectedStudyAppPackages\(context\)/);
  assert.match(repository, /new HashSet<>\(usage\.keySet\(\)\)/);
  assert.match(repository, /candidatePackages\.addAll\(selectedStudy\)/);
  assert.doesNotMatch(repository, /getInstalledApplications/);
  assert.doesNotMatch(repository, /AppChoice|getStudyAppChoices|getDeviceAppChoices/);
  assert.match(repository, /pm\.getApplicationInfo\(packageName/);
  assert.match(repository, /if \(record != null\) allEligible\.add\(record\);/);
  assert.match(repository, /if \(!hidden\.contains\(record\.packageName\)\) ranked\.add\(record\);/);
  assert.match(repository, /record\.eligibleDeviceApp && record\.usageMillis > 0L/);
  assert.match(repository, /percentageTotalUsageMillis \+= Math\.max\(0L, record\.usageMillis\);/);
  assert.match(repository, /isEligibleDeviceApp\(pm, info\)/);
  assert.match(repository, /getLaunchIntentForPackage\(info\.packageName\)/);
  assert.match(repository, /"last_7_days"/);
  assert.match(repository, /Calendar\.DAY_OF_YEAR, -6/);
  assert.match(repository, /cacheGeneration != requestGeneration/);
  assert.match(repository, /REFRESH_CALLBACKS/);
  assert.match(repository, /loadIcon\(pm, packageName, info, iconSize\)/);
  assert.doesNotMatch(repository, /https?:\/\//);
  assert.match(provider, /studyAppsScreenTime/);
  assert.match(provider, /deviceAppsScreenTime/);
  assert.match(provider, /openUsageAccessOnly/);
  assert.match(provider, /openStudyAppsPickerOnly/);
  assert.match(provider, /else if \(options\.studyAppsScreenTime\s*&& data\.studyAppsScreenTime != null && "no_study_apps"\.equals\(data\.studyAppsScreenTime\.status\)\)/);
  assert.match(config, /Settings\.ACTION_USAGE_ACCESS_SETTINGS/);
  assert.match(config, /StudyModeManager\.openStudyAppsSelection\(this\)/);
  assert.match(provider, /options\.themeMatched = options\.studyAppsScreenTime \|\| options\.deviceAppsScreenTime/);
  assert.match(provider, /options\.themeAccent = Color\.parseColor\(accent\)/);
  assert.match(provider, /updateScreenTimeAppearance\(Context context\)/);
  assert.match(provider, /screenTimeHiddenStudyPackages/);
  assert.match(provider, /screenTimeHiddenDevicePackages/);
  assert.match(plugin, /public void syncAppearance\(PluginCall call\)/);
  assert.match(renderer, /this\.pal = paletteFor\(o\.composition, o\.themeAccent, o\.lightMode, o\.themeMatched\)/);
  assert.match(renderer, /if \(themeMatched\) applyAccent\(p, themeAccent, lightMode\)/);
  assert.match(renderer, /ensureTextContrast/);
  assert.match(renderer, /void layoutScreenTimeReflow\(float rw, float rh\)/);
  assert.match(renderer, /void drawAppsPanel\(/);
  assert.doesNotMatch(renderer, /screenTimePrimaryText|drawLegacyContentSummary|layoutScreenTimeCombined|void layoutScreenTime\(\)/);
  assert.match(index, /window\.addEventListener\('theme-updated', syncWidgetAppearance\)/);
  assert.match(index, /widget-appearance-updated/);
  assert.match(read('src/pages/WidgetStudioPage.tsx'), /window\.addEventListener\("widget-appearance-updated", renderPreview\)/);
  assert.match(provider, /refreshScreenTimeInstances\(Context context, String refreshedPeriod\)/);
  assert.match(provider, /screenTimeHiddenStudyPackages/);
  assert.match(provider, /screenTimeHiddenDevicePackages/);
  assert.match(provider, /readPackageSet\(/);
  assert.match(renderer, /void studyAppsPanel\(/);
  assert.match(renderer, /void deviceAppsPanel\(/);
  assert.match(renderer, /void drawLegacyMiniBlocks\(/);
  assert.match(renderer, /"permission_required"/);
  assert.match(renderer, /"no_study_apps"/);
  assert.match(renderer, /"no_usage"/);
  assert.match(config, /"Today", "Yesterday", "Last 7 Days"/);
  assert.match(config, /"Most Used First", "Least Used First", "Name A–Z", "Name Z–A"/);
  assert.match(config, /Source: Study Mode/);
  assert.match(config, /Source: Device App Usage/);
  assert.match(config, /No Study Apps Selected/);
  assert.doesNotMatch(config, /studyAppFilterChecks|deviceAppFilterChecks|populateAppFilters|getStudyAppChoices|getDeviceAppChoices|Manage Study Apps|getInstalledApplications/);
  assert.doesNotMatch(config, /remove\(prefix \+ legacyScreenTimeKeys\[0\]\)|remove\(prefix \+ legacyScreenTimeKeys\[1\]\)/);
  assert.match(config, /int contentOptionCount = CONTENT_OPTIONS\.length/);
  assert.match(config, /openStudyAppsButton\.setVisibility\(selectedStudyCount == 0 \? View\.VISIBLE : View\.GONE\)/);
  assert.match(config, /screenTimeShowTotalCheck/);
  assert.match(config, /screenTimeShowUsageCheck/);
  assert.match(config, /screenTimeShowPercentCheck/);
  assert.match(config, /screenTimeDetailedCheck/);
  assert.match(config, /SCREEN TIME SETTINGS/);
  assert.match(config, /settings saved to this instance/);
  assert.match(studyMode, /MathMasterHomeWidgetProvider\.refreshScreenTimeWidgets\(context\)/);
  assert.match(packageReceiver, /MathMasterHomeWidgetProvider\.refreshScreenTimeWidgets\(context\)/);
  assert.ok(setup.includes("'WidgetScreenTimeRepository.java'"));
});

test('screen-time dashboards use Emerald glass and derive ring and app bars from live usage', () => {
  const renderer = read(RENDERER);
  const provider = read(PROVIDER);

  assert.match(renderer, /applyScreenTimePalette\(this\.pal, o\.themeAccent, o\.themeMatched, o\.lightMode\)/);
  assert.match(renderer, /drawScreenTimeDashboard\(section, study != null/);
  const progressRing = renderer.match(/void ring\(float cx, float cy, float outerR, float sw, int progress, boolean label\) \{[\s\S]*?\n        }/);
  assert.ok(progressRing, 'progress-ring renderer must exist');
  assert.match(progressRing[0], /float numSize = diameter \* 0\.305f;/);
  assert.match(progressRing[0], /measure\(num, numSize, f\.bold\)/);
  assert.match(progressRing[0], /txt\.setTextSize\(numSize \* textScale\)/);
  assert.match(progressRing[0], /txt\.setTextSize\(pctSize \* textScale\)/);
  assert.doesNotMatch(progressRing[0], /float numSize = diameter \* 0\.305f \* textScale/);

  assert.match(renderer, /section\.totalUsageMillis \/ budget/);
  assert.match(renderer, /9d \* 3_600_000d/);
  for (const name of ['drawHeaderTile(', 'drawPeriodPill(', 'drawScreenTimeRing(', 'drawRichDuration(', 'drawGlassBubble(', 'drawGlassSwoosh(', 'rankBar(']) {
    assert.ok(renderer.includes(name), `renderer is missing ${name}`);
  }
  assert.match(renderer, /float ratio = clamp\(entry\.percent \/ 100f, 0f, 1f\)/);
  assert.match(renderer, /p\.bar0 = hex\("#39EEA0"\)/);
  assert.match(provider, /boolean showPercent = true/);
  assert.match(provider, /"screenTimeShowPercent", true/);
});

test('older saved selections gain the quiz tile exactly once', () => {
  const provider = read(PROVIDER);
  assert.match(provider, /storedVersion < CONTENT_SCHEMA_VERSION/);
  assert.match(provider, /!jsonArrayContains\(migrated, "quiz"\)/);
  assert.match(provider, /storedVersion < 2 && !jsonArrayContains\(migrated, "weekly"\)/);
});

test('desktop widget preview compiles provider/config with fatal errors and renders Screen Time matrix', () => {
  const runner = read('tools/widget-preview/run.sh');
  const bitmap = read('tools/widget-preview/shim/android/graphics/Bitmap.java');
  const canvas = read('tools/widget-preview/shim/android/graphics/Canvas.java');
  const path = read('tools/widget-preview/shim/android/graphics/Path.java');
  const fixture = read('tools/widget-preview/stubs/com/sudhanshu/mathsbj/WidgetScreenTimeRepository.java');
  const harness = read('tools/widget-preview/harness/com/sudhanshu/mathsbj/E2E.java');
  assert.match(runner, /MathMasterHomeWidgetProvider\.java/);
  assert.match(runner, /MathMasterWidgetConfigActivity\.java/);
  assert.doesNotMatch(runner, /\|\| true/);
  assert.match(bitmap, /isRecycled\(\)/);
  assert.match(bitmap, /getByteCount\(\)/);
  assert.match(canvas, /drawBitmap\(Bitmap bitmap, Rect src, RectF dst, Paint paint\)/);
  assert.match(path, /cubicTo\(/);
  assert.match(fixture, /setFixtureStatus\(/);
  assert.match(fixture, /Math Notes/);
  assert.match(harness, /renderScreenTimeMatrix\(ctx, p, mgr, outDir\)/);
  assert.match(harness, /verifyScreenTimeAppearanceAndPreview\(ctx, mgr, p, outDir\)/);
  assert.match(harness, /Widget Studio preview differs from the themed home-screen widget/);
  assert.match(harness, /App appearance changed a widget without Screen Time content/);
  assert.match(harness, /String\[\] states = \{"ok", "permission_required", "no_study_apps", "no_usage", "loading", "error"\}/);
  assert.match(harness, /String\[\] styles = \{"neon", "blur", "transparent"\}/);
  assert.match(harness, /before_baseline_/);
  assert.match(harness, /Screen Time pairwise preview matrix rendered/);
  assert.match(harness, /int expected = compositions\.length \* sizeNames\.length \* states\.length \* styles\.length/);
  assert.match(harness, /expected != 630/);
  assert.match(harness, /combinations\[\(compositionIndex \+ sizeIndex \+ stateIndex \+ styleIndex\)/);
  assert.match(harness, /legacy\[\(compositionIndex \* 2 \+ sizeIndex \+ stateIndex \+ styleIndex\)/);
});

test('configuration screen previews the real renderer output', () => {
  const config = read(CONFIG);
  assert.match(config, /MathMasterHomeWidgetProvider\.renderConfigurationPreview\(/);
  assert.match(config, /AppWidgetManager\.OPTION_APPWIDGET_MIN_WIDTH/);
  assert.doesNotMatch(config, /getConfigurationPreviewArtwork|previewShade|previewMetric/);
  assert.doesNotMatch(config, /PREMIUM_THEMES|Random Premium Theme|themeGroup/);
  assert.match(config, /"neon", "Neon Glass"/);
  assert.match(config, /"blur", "Transparent Blur"/);
  assert.match(config, /"transparent", "Full Transparent"/);
  for (const composition of COMPOSITIONS) {
    assert.ok(config.includes('MathMasterHomeWidgetProvider.getWidgetCompositionOptions()'), `configuration screen must reuse the provider registry for ${composition}`);
  }
});

test('widget resources are one canvas layout, one preview image and the info files', () => {
  assert.deepEqual(list('android-native/res/layout'), ['math_master_home_widget.xml']);
  assert.deepEqual(list('android-native/res/drawable-nodpi'), ['math_master_widget_preview.webp']);
  assert.deepEqual(list('android-native/res/values'), ['math_master_home_widget_strings.xml']);
  // An empty leftover folder is harmless (git does not track it); old drawable files are not.
  assert.deepEqual(exists('android-native/res/drawable') ? list('android-native/res/drawable') : [], [], 'old artwork drawables must be gone');
  assert.ok(!exists('public/math_master_widget_atlas.webp'), 'the old artwork atlas must be gone');
  const layout = read('android-native/res/layout/math_master_home_widget.xml');
  assert.match(layout, /android:id="@\+id\/widget_root"/);
  assert.match(layout, /android:id="@\+id\/widget_canvas"/);
  assert.match(layout, /@drawable\/math_master_widget_preview/);
  assert.match(layout, /android:contentDescription=/);
  for (const file of ['xml/math_master_home_widget_info.xml', 'xml-v31/math_master_home_widget_info.xml']) {
    const info = read(`android-native/res/${file}`);
    assert.match(info, /android:previewImage="@drawable\/math_master_widget_preview"/, file);
    assert.match(info, /android:configure="com\.sudhanshu\.mathsbj\.MathMasterWidgetConfigActivity"/, file);
    assert.match(info, /android:initialLayout="@layout\/math_master_home_widget"/, file);
    assert.match(info, /android:resizeMode="horizontal\|vertical"/, file);
  }
  assert.match(read('android-native/res/xml-v31/math_master_home_widget_info.xml'), /android:targetCellWidth="4"/);
  assert.match(read('android-native/res/xml-v31/math_master_home_widget_info.xml'), /android:widgetFeatures="reconfigurable"/);
});

test('configure script ships the renderer, fonts and resources into a generated Android project', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mathsbj-widget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const javaDir = path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj');
  await mkdir(javaDir, { recursive: true });
  await writeFile(
    path.join(root, 'app/src/main/AndroidManifest.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.sudhanshu.mathsbj">\n    <uses-permission android:name="android.permission.INTERNET" />\n    <application android:label="Math Master">\n        <activity android:name=".MainActivity">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n',
  );
  await writeFile(
    path.join(root, 'app/build.gradle'),
    `plugins { id 'com.android.application' }\n\nandroid {\n    namespace "com.sudhanshu.mathsbj"\n    defaultConfig { applicationId "com.sudhanshu.mathsbj" versionCode 1 }\n    /* MATHMASTER_STUDY_MODE_FLAVORS */\n    flavorDimensions "studyMode"\n    productFlavors {\n        standard { dimension "studyMode" }\n        advanced {\n            dimension "studyMode"\n            versionCode defaultConfig.versionCode + 100000\n        }\n    }\n}\n`,
  );
  await writeFile(
    path.join(javaDir, 'MainActivity.java'),
    'package com.sudhanshu.mathsbj;\n\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n    }\n}\n',
  );

  const result = await configureAndroidWidgets(root);
  assert.equal(result.assetDirectories, 1);
  for (const file of [
    'MathMasterHomeWidgetProvider.java', 'MathMasterWidgetRenderer.java', 'WidgetScreenTimeRepository.java',
    'MathMasterWidgetConfigActivity.java', 'DailyTargetReminderPlugin.java', 'DailyTargetReminderReceiver.java',
    'DailyTargetReminderBootReceiver.java',
  ]) {
    assert.ok(existsSync(path.join(javaDir, file)), `${file} was not copied`);
  }
  const fonts = await readdir(path.join(root, 'app/src/main/assets/fonts'));
  assert.deepEqual(fonts.sort(), ['LICENSE-Inter.txt', 'MathMaster-Bold.otf', 'MathMaster-Medium.otf', 'MathMaster-Regular.otf']);
  assert.deepEqual(await readdir(path.join(root, 'app/src/main/res/layout')), ['math_master_home_widget.xml']);
  assert.deepEqual(await readdir(path.join(root, 'app/src/main/res/drawable-nodpi')), ['math_master_widget_preview.webp']);
  const manifest = await readFile(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /MathMasterHomeWidgetProvider/);
  assert.match(manifest, /@xml\/math_master_home_widget_info/);
  assert.match(manifest, /<queries>\s*<intent>\s*<action android:name="android\.intent\.action\.MAIN" \/>[\s\S]*?<category android:name="android\.intent\.category\.LAUNCHER" \/>[\s\S]*?<\/intent>\s*<\/queries>/);
  // Running it twice must not duplicate anything.
  await configureAndroidWidgets(root);
  const again = await readFile(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  assert.equal(again.match(/MathMasterHomeWidgetProvider/g).length, manifest.match(/MathMasterHomeWidgetProvider/g).length);
  const queries = again.match(/<queries>[\s\S]*?<\/queries>/)?.[0] ?? '';
  assert.equal(queries.match(/android\.intent\.category\.LAUNCHER/g)?.length, 1);
  assert.equal(again.match(/android\.intent\.category\.LAUNCHER/g)?.length, 2);
});

test('background effects: neon is the default, blur and transparent stay available, legacy values mean neon', () => {
  const provider = read(PROVIDER);
  const renderer = read(RENDERER);
  const backupTs = read('src/lib/backupRestore.ts');
  const backupPlugin = read(BACKUP_PLUGIN);
  const widgetsPlugin = read('android-native/com/sudhanshu/mathsbj/MathMasterWidgetsPlugin.java');
  assert.match(provider, /static String normalizeWidgetStyle\(String value\)/);
  assert.match(provider, /"transparent"\.equals\(value\)/);
  assert.match(provider, /"blur"\.equals\(value\)/);
  assert.match(provider, /getInstanceString\(preferences, appWidgetId, "style", "neon"\)/);
  // Schema migration must preserve an existing widget's chosen appearance; only explicit Reset selects Neon.
  assert.doesNotMatch(provider, /\.putString\(prefix \+ "style", "neon"\)/);
  assert.match(widgetsPlugin, /\.putString\(prefix \+ "style", "neon"\)/);
  assert.match(provider, /private static void applyScreenTimeTheme\(/);
  assert.match(renderer, /this\.pal = paletteFor\(o\.composition, o\.themeAccent, o\.lightMode, o\.themeMatched\)/);
  assert.match(renderer, /Color\.argb\(102, 57, 67, 77\)/);
  assert.match(renderer, /if \(clear\) return;/);
  assert.match(renderer, /Color\.argb\(102, 57, 67, 77\)/);
  assert.match(backupTs, /WIDGET_STYLES = new Set\(\['neon', 'blur', 'transparent'/);
  assert.match(backupPlugin, /"neon", "blur", "transparent"/);
  assert.doesNotMatch(provider, /COMPLETION_ACCENTS|normalizeWidgetTheme/);
});

test('Widget Studio lists only real pinned IDs and uses the system add flow plus the existing renderer', () => {
  const plugin = read('android-native/com/sudhanshu/mathsbj/MathMasterWidgetsPlugin.java');
  const provider = read(PROVIDER);
  const config = read(CONFIG);
  const setup = read('scripts/configure-android-notifications.mjs');
  const widgetSetup = read('scripts/configure-android-widgets.mjs');
  const pinReceiver = read('android-native/com/sudhanshu/mathsbj/MathMasterWidgetPinReceiver.java');
  const configActivity = read(CONFIG);

  assert.match(plugin, /@CapacitorPlugin\(name = "MathMasterWidgets"\)/);
  assert.match(plugin, /public void getDesigns\(PluginCall call\)/);
  assert.match(plugin, /AppWidgetProviderInfo providerInfo = manager\.getAppWidgetInfo\(id\)/);
  assert.match(plugin, /requestPinAppWidget\([\s\S]*?successCallback\)/);
  assert.match(plugin, /PendingIntent\.getActivity\([\s\S]*?callbackIntent[\s\S]*?FLAG_IMMUTABLE\)/);
  assert.match(plugin, /new Intent\(context, MathMasterWidgetConfigActivity\.class\)/);
  assert.match(plugin, /putExtra\("initialComposition", composition\)/);
  assert.match(configActivity, /getIntExtra\(AppWidgetManager\.EXTRA_APPWIDGET_ID, INVALID_WIDGET_ID\)/);
  assert.match(configActivity, /widgetId == INVALID_WIDGET_ID \|\| !isActiveWidget\(widgetId\)/);
  assert.match(configActivity, /putString\(contentKey, selected\.toString\(\)\)/);
  assert.match(plugin, /getString\("composition"\)/);
  assert.match(plugin, /mathmaster-widget-pin:\/\//);
  assert.match(pinReceiver, /EXTRA_COMPOSITION/);
  assert.match(pinReceiver, /"instance_" \+ widgetId \+ "_composition"/);
  assert.match(pinReceiver, /\.commit\(\)/);
  assert.match(plugin, /FLAG_IMMUTABLE/);
  assert.match(plugin, /WIDGET_DISCOVERY_FAILED/);
  assert.match(pinReceiver, /ACTION_PIN_CONFIRMED/);
  assert.match(pinReceiver, /WIDGET_PIN_CONFIRMED/);
  assert.ok(widgetSetup.includes("'MathMasterWidgetsPlugin.java'"));
  assert.ok(widgetSetup.includes("'MathMasterWidgetPinReceiver.java'"));
  assert.ok(widgetSetup.includes('registerPlugin(MathMasterWidgetsPlugin.class);'));
  assert.ok(widgetSetup.includes("name: 'MathMasterWidgetPinReceiver'"));
  assert.match(plugin, /ComponentName provider = new ComponentName\(context, MathMasterHomeWidgetProvider\.class\);/);
  assert.match(plugin, /manager\.getAppWidgetIds\(provider\)/);
  assert.match(plugin, /requestPinAppWidget/);
  assert.match(plugin, /public void resetWidget\(PluginCall call\)/);
  assert.match(plugin, /contentSchemaVersion", 4\)/);
  assert.match(plugin, /isActiveWidgetId\(id\)/);
  assert.match(plugin, /MathMasterHomeWidgetProvider\.renderWidgetInstancePreview\(getContext\(\), id\)/);
  assert.match(plugin, /getWidgetCompositionOptions\(\)/);
  assert.match(provider, /public static Bitmap renderWidgetInstancePreview\(Context context, int appWidgetId\)/);
  assert.match(config, /getAppWidgetIds\(\s*new ComponentName\(this, MathMasterHomeWidgetProvider\.class\)\)/);
  assert.match(config, /initialComposition/);
  assert.ok(setup.includes("'MathMasterWidgetsPlugin.java'"));
  assert.ok(setup.includes('registerPlugin(MathMasterWidgetsPlugin.class);'));
});

test('weekly checkmarks keep using the existing daily streak data and validated native input', () => {
  const bridge = read('src/lib/dailyTargetReminders.ts');
  const nativePlugin = read(REMINDER_PLUGIN);
  const provider = read(PROVIDER);
  assert.match(bridge, /streak\.days\[dateKey\]\?\.completed === true/);
  assert.match(bridge, /const completedDaysJson = JSON\.stringify\(/);
  assert.match(nativePlugin, /sanitizeCompletedDaysJson\(completedDaysJson\)/);
  assert.match(nativePlugin, /raw\.length\(\) > 512/);
  assert.match(nativePlugin, /Math\.min\(incoming\.length\(\), 7\)/);
  assert.match(nativePlugin, /formatter\.setLenient\(false\)/);
  assert.match(nativePlugin, /MathMasterHomeWidgetProvider\.syncProgressSnapshot/);
  assert.match(provider, /getCompletedDays\(SharedPreferences preferences\)/);
  assert.match(provider, /fillWeek\(preferences, data\)/);
});

test('package updates refresh every pinned widget without replacing saved per-widget configuration', () => {
  const bootReceiver = read(BOOT_RECEIVER);
  const provider = read(PROVIDER);
  assert.ok(bootReceiver.includes('Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)'));
  assert.match(bootReceiver, /Intent\.ACTION_MY_PACKAGE_REPLACED\.equals\(action\)[\s\S]*?MathMasterHomeWidgetProvider\.updateWidgetPreferences\(context\)/);
  assert.ok(provider.includes('AppWidgetManager.getInstance(context)'));
  assert.ok(provider.includes('getAppWidgetIds(provider)'));
  assert.ok(provider.includes('for (int widgetId : widgetIds)'));
  assert.ok(provider.includes('getSelectedContent(preferences, appWidgetId)'));
  assert.ok(provider.includes('getInstanceString(preferences, appWidgetId, "style"'));
});

test('every native widget provider is copied and registered by the Android setup script', () => {
  const configureAndroid = read('scripts/configure-android-widgets.mjs');
  const files = list('android-native/com/sudhanshu/mathsbj').filter((name) => name.endsWith('WidgetProvider.java'));
  assert.ok(files.length > 0, 'native AppWidgetProvider inventory must not be empty');
  for (const filename of files) {
    const componentName = filename.replace('.java', '');
    assert.ok(configureAndroid.includes(`'${filename}'`), `${filename} must be copied to the generated Android app`);
    assert.ok(configureAndroid.includes(`name: '${componentName}'`), `${componentName} must be in the manifest component generator`);
    assert.ok(configureAndroid.includes('@xml/math_master_home_widget_info'));
  }
  assert.match(configureAndroid, /const RESOURCE_DIRS = \['drawable', 'drawable-nodpi', 'layout', 'values', 'xml', 'xml-v31'\]/);
  assert.match(configureAndroid, /normalizeRemoteViewsLayout\(xml\)/);
  const releaseWorkflow = read('.github/workflows/android-release.yml');
  assert.match(releaseWorkflow, /- name: Configure native Study Mode services\s+run: node scripts\/configure-android-study-mode\.mjs[\s\S]*?- name: Configure Android home-screen widgets\s+run: node scripts\/configure-android-widgets\.mjs/);
});


test('native widget editor uses compact responsive grids, real thumbnails and a persistent action bar', () => {
  const config = read(CONFIG);
  assert.match(config, /private int gridColumns\(\)/);
  assert.match(config, /widthDp >= 840 \? 4 : \(widthDp >= 600 \? 3 : 2\)/);
  assert.match(config, /private void addContentGrid\(/);
  assert.match(config, /private void addStyleGrid\(/);
  assert.match(config, /private void addCompositionGrid\(/);
  assert.match(config, /renderConfigurationPreview\(/);
  assert.match(config, /setMaxHeight\(dp\(124\)\)/);
  assert.match(config, /root\.addView\(scroll, new LinearLayout\.LayoutParams\([\s\S]*?0, 1f\)/);
  assert.match(config, /root\.addView\(actions, actionParams\)/);
  assert.match(config, /\.commit\(\)/);
  assert.match(config, /Previous settings are unchanged/);
  assert.match(config, /Previous settings were restored/);
  assert.match(config, /isActiveWidget\(widgetId\)/);
  assert.match(config, /styleChoices\.add\(choice\)/);
  assert.match(config, /appearanceChoices\.add\(choice\)/);
  assert.match(config, /compositionChoices\.add\(choice\)/);
  assert.match(config, /radio\.setOnClickListener\(view -> \{\s+List<RadioButton> choices = styleChoices\.contains\(radio\) \? styleChoices\s+:\s+\(appearanceChoices\.contains\(radio\) \? appearanceChoices : compositionChoices\);\s+selectChoice\(choices, radio\);/);
  assert.match(config, /private void selectChoice\(List<RadioButton> choices, RadioButton selected\) \{\s+for \(RadioButton choice : choices\) choice\.setChecked\(choice == selected\);/);
});
