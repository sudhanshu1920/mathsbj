import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRemoteViewsLayout } from './configure-android-notifications.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const NATIVE_ROOT = path.resolve(SCRIPT_DIR, '../android-native');
const PACKAGE_DIR = path.join(NATIVE_ROOT, 'com/sudhanshu/mathsbj');
const PACKAGE_PATH = 'com.sudhanshu.mathsbj';
const NATIVE_JAVA_FILES = [
  'MathMasterHomeWidgetProvider.java',
  'MathMasterWidgetPinReceiver.java',
  'MathMasterWidgetsPlugin.java',
  'MathMasterWidgetRenderer.java',
  'MathMasterWidgetConfigActivity.java',
  'WidgetScreenTimeData.java',
  'MathMasterWidgetActionReceiver.java',
  'DailyTargetReminderPlugin.java',
  'DailyTargetReminderReceiver.java',
  'DailyTargetReminderBootReceiver.java',
];
// 'drawable' no longer exists in the source tree; it is still listed so a checkout that kept old files copies them consistently.
const RESOURCE_DIRS = ['drawable', 'drawable-nodpi', 'layout', 'values', 'xml', 'xml-v31'];
// Bundled widget fonts (Inter, OFL) live in app/src/main/assets and are read with Typeface.createFromAsset.
const ASSET_DIRS = ['fonts'];

async function copyDirectory(source, destination, resourcePath = '') {
  let entries;
  try {
    entries = await readdir(source, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const relativePath = path.posix.join(resourcePath, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath, relativePath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (resourcePath === 'layout' && entry.name.endsWith('.xml')) {
      const xml = await readFile(sourcePath, 'utf8');
      await writeFile(destinationPath, normalizeRemoteViewsLayout(xml));
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

function ensurePermissions(manifest) {
  const permissions = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
    'android.permission.PACKAGE_USAGE_STATS',
    'android.permission.QUERY_ALL_PACKAGES',
  ];
  const missing = permissions
    .filter((permission) => !manifest.includes(`android:name="${permission}"`))
    .map((permission) => `    <uses-permission android:name="${permission}" />`);
  if (missing.length === 0) return manifest;
  const end = manifest.indexOf('>', manifest.indexOf('<manifest'));
  if (end < 0) throw new Error('AndroidManifest.xml has no valid <manifest> root.');
  let root = manifest.slice(manifest.indexOf('<manifest'), end + 1);
  if (!root.includes('xmlns:android=')) {
    root = root.slice(0, -1) + ' xmlns:android="http://schemas.android.com/apk/res/android">';
    manifest = manifest.slice(0, manifest.indexOf('<manifest')) + root + manifest.slice(end + 1);
  }
  const newEnd = manifest.indexOf('>', manifest.indexOf('<manifest'));
  return manifest.slice(0, newEnd + 1) + '\n' + missing.join('\n') + manifest.slice(newEnd + 1);
}

function ensureApplicationComponents(manifest) {
  const components = [
    {
      name: 'MathMasterHomeWidgetProvider',
      xml: `        <receiver android:name=".${'MathMasterHomeWidgetProvider'}" android:enabled="true" android:exported="true" android:label="@string/math_master_home_widget_label" android:permission="android.permission.BIND_APPWIDGET">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/math_master_home_widget_info" />
        </receiver>`,
    },
    {
      name: 'MathMasterWidgetConfigActivity',
      xml: `        <activity android:name=".${'MathMasterWidgetConfigActivity'}" android:enabled="true" android:exported="true" android:label="@string/math_master_home_widget_label" android:excludeFromRecents="true" />`,
    },
    {
      name: 'MathMasterWidgetPinReceiver',
      xml: `        <receiver android:name=".MathMasterWidgetPinReceiver" android:enabled="true" android:exported="false" />`,
    },
    {
      name: 'MathMasterWidgetActionReceiver',
      xml: '        <receiver android:name=".MathMasterWidgetActionReceiver" android:enabled="true" android:exported="false" />',
    },
    {
      name: 'DailyTargetReminderReceiver',
      xml: '        <receiver android:name=".DailyTargetReminderReceiver" android:enabled="true" android:exported="false" />',
    },
    {
      name: 'DailyTargetReminderBootReceiver',
      xml: `        <receiver android:name=".DailyTargetReminderBootReceiver" android:enabled="true" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>`,
    },
  ];
  const missing = components.filter(({ name }) => !manifest.includes(`android:name=".${name}"`));
  if (missing.length === 0) return manifest;
  const applicationClose = manifest.lastIndexOf('</application>');
  if (applicationClose < 0) throw new Error('AndroidManifest.xml has no closing </application> tag.');
  return manifest.slice(0, applicationClose)
    + '\n' + missing.map(({ xml }) => xml).join('\n') + '\n'
    + manifest.slice(applicationClose);
}

function ensureWidgetPluginRegistration(mainActivity) {
  const registrations = [
    'registerPlugin(DailyTargetReminderPlugin.class);',
    'registerPlugin(MathMasterWidgetsPlugin.class);',
  ];
  for (const registration of registrations) {
    if (mainActivity.includes(registration)) continue;
    const anchor = 'super.onCreate(savedInstanceState);';
    if (!mainActivity.includes(anchor)) {
      throw new Error('MainActivity.java is missing its onCreate setup point.');
    }
    mainActivity = mainActivity.replace(anchor, `${registration}\n        ${anchor}`);
  }
  return mainActivity;
}

function ensureWidgetResumeRefresh(mainActivity) {
  if (mainActivity.includes('WidgetScreenTimeData.onAppResumed(this);')) return mainActivity;
  const onResume = /@Override\s+(?:public|protected)\s+void onResume\(\)\s*\{([\s\S]*?)\n    \}/;
  if (onResume.test(mainActivity)) {
    return mainActivity.replace(onResume, (match, body) => {
      if (body.includes('WidgetScreenTimeData.onAppResumed(this);')) return match;
      return match.replace(body, body + '\n        WidgetScreenTimeData.onAppResumed(this);');
    });
  }
  const classEnd = mainActivity.lastIndexOf('}');
  if (classEnd < 0) throw new Error('MainActivity.java has no class closing brace.');
  return mainActivity.slice(0, classEnd)
    + '\n    @Override\n    protected void onResume() {\n        super.onResume();\n        WidgetScreenTimeData.onAppResumed(this);\n    }\n'
    + mainActivity.slice(classEnd);
}

export async function configureAndroidWidgets(androidRoot) {
  const root = path.resolve(androidRoot);
  const javaTarget = path.join(root, 'app/src/main/java', PACKAGE_PATH.replaceAll('.', '/'));
  const resourceTarget = path.join(root, 'app/src/main/res');
  await mkdir(javaTarget, { recursive: true });

  for (const filename of NATIVE_JAVA_FILES) {
    await copyFile(path.join(PACKAGE_DIR, filename), path.join(javaTarget, filename));
  }
  for (const resourceDirectory of RESOURCE_DIRS) {
    await copyDirectory(
      path.join(NATIVE_ROOT, 'res', resourceDirectory),
      path.join(resourceTarget, resourceDirectory),
      resourceDirectory,
    );
  }

  const assetTarget = path.join(root, 'app/src/main/assets');
  for (const assetDirectory of ASSET_DIRS) {
    await copyDirectory(
      path.join(NATIVE_ROOT, 'assets', assetDirectory),
      path.join(assetTarget, assetDirectory),
      assetDirectory,
    );
  }

  const activityPath = path.join(javaTarget, 'MainActivity.java');
  const mainActivity = await readFile(activityPath, 'utf8');
  const registeredActivity = ensureWidgetPluginRegistration(mainActivity);
  await writeFile(activityPath, ensureWidgetResumeRefresh(registeredActivity));

  const manifestPath = path.join(root, 'app/src/main/AndroidManifest.xml');
  let manifest = await readFile(manifestPath, 'utf8');
  manifest = ensurePermissions(manifest);
  manifest = ensureApplicationComponents(manifest);
  await writeFile(manifestPath, manifest);

  return {
    javaFiles: NATIVE_JAVA_FILES.length,
    resourceDirectories: RESOURCE_DIRS.length,
    assetDirectories: ASSET_DIRS.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const androidRoot = process.env.ANDROID_ROOT || path.resolve('android');
  configureAndroidWidgets(androidRoot)
    .then(() => console.log('Configured Math Master Android home-screen widgets.'))
    .catch((error) => {
      console.error(`Android widget configuration failed: ${error.message}`);
      process.exitCode = 1;
    });
}