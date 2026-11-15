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

const COMPOSITIONS = [
  'hero_wide', 'compact_green', 'square_math_bot', 'medium_study',
  'square_cosmic', 'extra_wide_weekly', 'minimal_progress',
];
const CONTENT_OPTIONS = [
  'appIdentity', 'target', 'progress', 'remaining', 'studyTime', 'streak', 'weekly', 'quiz', 'updateStatus',
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
  assert.deepEqual(
    quotedList(provider, /WIDGET_COMPOSITIONS = \{([\s\S]*?)\};/),
    ['auto', ...COMPOSITIONS],
  );
  for (const composition of COMPOSITIONS) {
    assert.ok(renderer.includes(`case "${composition}"`), `renderer is missing a case for ${composition}`);
  }
  for (const method of ['layoutHero', 'layoutGreen', 'layoutMathBot', 'layoutStudy', 'layoutCosmic', 'layoutWeekly', 'layoutMinimal']) {
    assert.ok(renderer.includes(`void ${method}()`), `renderer is missing ${method}`);
  }
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
  assert.match(provider, /CONTENT_SCHEMA_VERSION = 3/);
  assert.match(config, /_contentSchemaVersion", 3\)/);
  assert.match(backupTs, /item < 1 \|\| item > 3/);
  assert.match(backupPlugin, /intValue\(\) <= 3/);
});

test('older saved selections gain the quiz tile exactly once', () => {
  const provider = read(PROVIDER);
  assert.match(provider, /storedVersion < CONTENT_SCHEMA_VERSION/);
  assert.match(provider, /!jsonArrayContains\(migrated, "quiz"\)/);
  assert.match(provider, /storedVersion < 2 && !jsonArrayContains\(migrated, "weekly"\)/);
});

test('configuration screen previews the real renderer output', () => {
  const config = read(CONFIG);
  assert.match(config, /MathMasterHomeWidgetProvider\.renderConfigurationPreview\(/);
  assert.match(config, /AppWidgetManager\.OPTION_APPWIDGET_MIN_WIDTH/);
  assert.doesNotMatch(config, /getConfigurationPreviewArtwork|previewShade|previewMetric/);
  for (const composition of COMPOSITIONS) {
    assert.ok(config.includes(`{"${composition}",`), `configuration screen is missing ${composition}`);
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
    '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application>\n    </application>\n</manifest>\n',
  );
  await writeFile(
    path.join(javaDir, 'MainActivity.java'),
    'package com.sudhanshu.mathsbj;\npublic class MainActivity {\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n    }\n}\n',
  );

  const result = await configureAndroidWidgets(root);
  assert.equal(result.assetDirectories, 1);
  for (const file of [
    'MathMasterHomeWidgetProvider.java', 'MathMasterWidgetRenderer.java', 'MathMasterWidgetConfigActivity.java',
    'DailyTargetReminderPlugin.java', 'DailyTargetReminderReceiver.java', 'DailyTargetReminderBootReceiver.java',
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
  // Running it twice must not duplicate anything.
  await configureAndroidWidgets(root);
  const again = await readFile(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  assert.equal(again.match(/MathMasterHomeWidgetProvider/g).length, manifest.match(/MathMasterHomeWidgetProvider/g).length);
});
