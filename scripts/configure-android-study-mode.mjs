import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const NATIVE_DIR = path.resolve(SCRIPT_DIR, '../android-native/com/sudhanshu/mathsbj');
const PACKAGE_PATH = 'com/sudhanshu/mathsbj';

const NATIVE_FILES = [
  'StudyModeManager.java',
  'StudyModePlugin.java',
  'StudyModeAlarmReceiver.java',
  'StudyModePackageChangeReceiver.java',
  'StudyModeFocusService.java',
  'DailyTargetReminderBootReceiver.java',
  'AppUsageAnalyticsStore.java',
  'AppUsageAnalyticsPlugin.java',
  'StudyModeSessionStore.java',
  'StudyModeAccessibilityService.java',
];

const REQUIRED_PERMISSIONS = [
  // Personal sideload Study Mode requires full installed-app discovery for its app picker.
  // Google Play distribution needs a separate QUERY_ALL_PACKAGES policy eligibility review.
  'android.permission.QUERY_ALL_PACKAGES',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.PACKAGE_USAGE_STATS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.ACCESS_NOTIFICATION_POLICY',
];

function ensureManifestQueries(manifest) {
  const queryIntents = [
    {
      marker: 'android.intent.category.LAUNCHER',
      xml: `        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>`,
    },
    {
      marker: 'android.intent.action.DIAL',
      xml: `        <intent>
            <action android:name="android.intent.action.DIAL" />
            <data android:scheme="tel" />
        </intent>`,
    },
    {
      marker: 'android.intent.category.HOME',
      xml: `        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.HOME" />
        </intent>`,
    },
  ];
  const missing = queryIntents.filter((query) => !manifest.includes(query.marker));
  if (missing.length === 0) return manifest;

  const openQueries = manifest.indexOf('<queries');
  if (openQueries >= 0) {
    const closeQueries = manifest.indexOf('</queries>', openQueries);
    if (closeQueries < 0) throw new Error('AndroidManifest.xml has an unclosed <queries> element.');
    return manifest.slice(0, closeQueries)
      + '\n' + missing.map((query) => query.xml).join('\n') + '\n'
      + manifest.slice(closeQueries);
  }

  const rootEnd = manifest.indexOf('>', manifest.indexOf('<manifest'));
  if (rootEnd < 0) throw new Error('AndroidManifest.xml has no valid manifest root.');
  const block = `\n    <queries>\n${missing.map((query) => query.xml).join('\n')}\n    </queries>`;
  return manifest.slice(0, rootEnd + 1) + block + manifest.slice(rootEnd + 1);
}

function ensurePermissions(manifest) {
  const missing = REQUIRED_PERMISSIONS
    .filter((permission) => !manifest.includes(`android:name="${permission}"`))
    .map((permission) => `    <uses-permission android:name="${permission}" />`);
  if (missing.length === 0) return manifest;
  const applicationStart = manifest.indexOf('<application');
  if (applicationStart < 0) throw new Error('AndroidManifest.xml has no <application> element.');
  return manifest.slice(0, applicationStart) + missing.join('\n') + '\n\n' + manifest.slice(applicationStart);
}

function removeNotificationListenerService(manifest) {
  // Remove stale declarations left by earlier generated Android projects.
  const listenerService = /\s*<service\b(?=[^>]*\bandroid:name=["']\.StudyModeNotificationListenerService["'])[^>]*(?:\/>|>[\s\S]*?<\/service>)/g;
  return manifest.replace(listenerService, '');
}

function removeDeviceAdminReceiver(manifest) {
  const receiver = /\s*<receiver\b(?=[^>]*\bandroid:name=["']\.StudyModeDeviceAdminReceiver["'])[^>]*(?:\/>|>[\s\S]*?<\/receiver>)/g;
  return manifest.replace(receiver, '');
}

function ensureStudyModeComponents(manifest) {
  const components = [
    {
      marker: 'android:name=".DailyTargetReminderBootReceiver"',
      xml: `        <receiver
            android:name=".DailyTargetReminderBootReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>`,
    },
    {
      marker: 'android:name=".StudyModeAlarmReceiver"',
      xml: `        <receiver
            android:name=".StudyModeAlarmReceiver"
            android:enabled="true"
            android:exported="false" />`,
    },
    {
      marker: 'android:name=".StudyModePackageChangeReceiver"',
      xml: `        <receiver
            android:name=".StudyModePackageChangeReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.PACKAGE_REMOVED" />
                <data android:scheme="package" />
            </intent-filter>
        </receiver>`,
    },
    {
      marker: 'android:name=".StudyModeAccessibilityService"',
      xml: \`        <service
            android:name=".StudyModeAccessibilityService"
            android:enabled="true"
            android:exported="true"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/study_mode_accessibility" />
        </service>\`,
    },
    {
      marker: 'android:name=".StudyModeFocusService"',
      xml: `        <service
            android:name=".StudyModeFocusService"
            android:enabled="true"
            android:exported="false"
            android:stopWithTask="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="User-enabled scheduled focus monitoring and a user-approved app blocking overlay" />
        </service>`,
    },
  ];
  const missing = components.filter((component) => !manifest.includes(component.marker));
  if (missing.length === 0) return manifest;
  const applicationClose = manifest.lastIndexOf('</application>');
  if (applicationClose < 0) throw new Error('AndroidManifest.xml has no closing </application> tag.');
  return manifest.slice(0, applicationClose)
    + '\n' + missing.map((component) => component.xml).join('\n') + '\n'
    + manifest.slice(applicationClose);
}

function registerStudyModePlugin(mainActivity) {
  const registration = 'registerPlugin(StudyModePlugin.class);';
  if (mainActivity.includes(registration)) return mainActivity;
  const anchor = 'super.onCreate(savedInstanceState);';
  if (!mainActivity.includes(anchor)) throw new Error('MainActivity.java is missing the super.onCreate setup point.');
  return mainActivity.replace(anchor, `registerPlugin(StudyModePlugin.class);\n        ${anchor}`);
}

function registerAppUsageAnalyticsPlugin(mainActivity) {
  const registration = 'registerPlugin(AppUsageAnalyticsPlugin.class);';
  if (mainActivity.includes(registration)) return mainActivity;
  const anchor = 'registerPlugin(StudyModePlugin.class);';
  if (!mainActivity.includes(anchor)) throw new Error('MainActivity.java must register StudyModePlugin before analytics.');
  return mainActivity.replace(anchor, `${anchor}\n        ${registration}`);
}

function ensureBackupExclusions(manifest) {
  const match = manifest.match(/<application\b[^>]*>/s);
  if (!match) throw new Error('AndroidManifest.xml has no <application> opening tag.');
  let tag = match[0];
  for (const [name, value] of [
    ['android:fullBackupContent', '@xml/app_usage_backup_rules'],
    ['android:dataExtractionRules', '@xml/app_usage_data_extraction_rules'],
  ]) {
    const marker = name + '="';
    const start = tag.indexOf(marker);
    if (start >= 0) {
      const valueStart = start + marker.length;
      const valueEnd = tag.indexOf('"', valueStart);
      if (valueEnd < 0) throw new Error('Invalid application backup attribute: ' + name);
      tag = tag.slice(0, valueStart) + value + tag.slice(valueEnd);
    } else {
      tag = tag.replace(/>$/, ' ' + name + '="' + value + '">');
    }
  }
  return manifest.replace(match[0], tag);
}

export async function configureAndroidStudyMode(androidRoot) {
  const root = path.resolve(androidRoot);
  const packageDir = path.join(root, 'app/src/main/java', PACKAGE_PATH);
  const manifestPath = path.join(root, 'app/src/main/AndroidManifest.xml');
  const activityPath = path.join(packageDir, 'MainActivity.java');

  await mkdir(packageDir, { recursive: true });
  await rm(path.join(packageDir, 'StudyModeNotificationListenerService.java'), { force: true });
  await rm(path.join(packageDir, 'StudyModeDeviceAdminReceiver.java'), { force: true });
  for (const file of NATIVE_FILES) {
    await copyFile(path.join(NATIVE_DIR, file), path.join(packageDir, file));
  }
  await copyFile(
    path.resolve(SCRIPT_DIR, '../android-native/res/values/study_mode_accessibility.xml'),
    path.join(valuesTarget, 'study_mode_accessibility.xml'),
  );
  const xmlTarget = path.join(root, 'app/src/main/res/xml');
  await mkdir(xmlTarget, { recursive: true });
  await rm(path.join(xmlTarget, 'study_mode_device_admin.xml'), { force: true });
  const valuesTarget = path.join(root, 'app/src/main/res/values');
  await mkdir(valuesTarget, { recursive: true });
  for (const resource of [
    'study_mode_accessibility.xml',
    'app_usage_backup_rules.xml',
    'app_usage_data_extraction_rules.xml',
  ]) {
    await copyFile(
      path.resolve(SCRIPT_DIR, `../android-native/res/xml/${resource}`),
      path.join(xmlTarget, resource),
    );
  }

  let mainActivity = await readFile(activityPath, 'utf8');
  mainActivity = registerStudyModePlugin(mainActivity);
  mainActivity = registerAppUsageAnalyticsPlugin(mainActivity);
  await writeFile(activityPath, mainActivity);

  let manifest = await readFile(manifestPath, 'utf8');
  manifest = removeNotificationListenerService(manifest);
  manifest = removeDeviceAdminReceiver(manifest);
  manifest = ensureManifestQueries(manifest);
  manifest = ensurePermissions(manifest);
  manifest = ensureStudyModeComponents(manifest);
  manifest = ensureBackupExclusions(manifest);
  await writeFile(manifestPath, manifest);

  return { javaFiles: NATIVE_FILES.length, packageVisibility: 'all-installed-packages', localUsageAnalytics: true, foregroundMonitoring: 'accessibility-primary-usage-fallback' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const androidRoot = process.env.ANDROID_ROOT || path.resolve('android');
  configureAndroidStudyMode(androidRoot)
    .then((result) => console.log(`Configured Study Mode (${result.javaFiles} native Java files; ${result.packageVisibility}).`))
    .catch((error) => {
      console.error(`Study Mode Android setup failed: ${error.message}`);
      process.exitCode = 1;
    });
}
