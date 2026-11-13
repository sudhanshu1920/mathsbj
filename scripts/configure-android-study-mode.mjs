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
  'StudyModeDeviceAdminReceiver.java',
  'DailyTargetReminderBootReceiver.java',
  'AppUsageAnalyticsStore.java',
  'AppUsageAnalyticsPlugin.java',
  'StudyModeSessionStore.java',
  'StudyModeWindowRegistry.java',
];

const REQUIRED_PERMISSIONS = [
  // Personal sideload Study Mode requires full installed-app discovery for its app picker.
  // Google Play distribution needs a separate QUERY_ALL_PACKAGES policy eligibility review.
  'android.permission.QUERY_ALL_PACKAGES',
  'android.permission.PACKAGE_USAGE_STATS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.ACCESS_NOTIFICATION_POLICY',
  'android.permission.POST_NOTIFICATIONS',
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

function ensureAccessibilityService(manifest) {
  const marker = 'android:name=".StudyModeAccessibilityService"';
  if (manifest.includes(marker)) return manifest;
  const applicationClose = manifest.lastIndexOf('</application>');
  if (applicationClose < 0) throw new Error('AndroidManifest.xml has no closing </application> tag.');
  const service = `        <service
            android:name=".StudyModeAccessibilityService"
            android:enabled="true"
            android:exported="true"
            android:label="@string/study_mode_accessibility_service_label"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/study_mode_accessibility" />
        </service>`;
  return manifest.slice(0, applicationClose) + '\\n' + service + '\\n' + manifest.slice(applicationClose);
}

function ensurePackageChangeReceiverActions(manifest) {
  const marker = 'android:name=".StudyModePackageChangeReceiver"';
  const markerIndex = manifest.indexOf(marker);
  if (markerIndex < 0) return manifest;
  const receiverStart = manifest.lastIndexOf('<receiver', markerIndex);
  const receiverEnd = manifest.indexOf('</receiver>', markerIndex);
  if (receiverStart < 0 || receiverEnd < 0) {
    throw new Error('StudyModePackageChangeReceiver manifest entry is malformed.');
  }

  let receiver = manifest.slice(receiverStart, receiverEnd + '</receiver>'.length);
  const actions = [
    'android.intent.action.PACKAGE_ADDED',
    'android.intent.action.PACKAGE_CHANGED',
    'android.intent.action.PACKAGE_REMOVED',
  ];
  const filterStart = receiver.indexOf('<intent-filter');
  const filterEnd = receiver.indexOf('</intent-filter>', filterStart);
  if (filterStart >= 0 && filterEnd >= 0) {
    let filter = receiver.slice(filterStart, filterEnd + '</intent-filter>'.length);
    const missingActions = actions
      .filter((action) => !filter.includes('android:name="' + action + '"'))
      .map((action) => '            <action android:name="' + action + '" />');
    if (missingActions.length > 0) {
      filter = filter.replace('</intent-filter>', missingActions.join('\n') + '\n        </intent-filter>');
    }
    if (!filter.includes('android:scheme="package"')) {
      filter = filter.replace('</intent-filter>', '            <data android:scheme="package" />\n        </intent-filter>');
    }
    receiver = receiver.slice(0, filterStart) + filter + receiver.slice(filterEnd + '</intent-filter>'.length);
  } else {
    const filter = '            <intent-filter>\n'
      + actions.map((action) => '                <action android:name="' + action + '" />').join('\n')
      + '\n                <data android:scheme="package" />\n            </intent-filter>\n        ';
    receiver = receiver.replace('</receiver>', filter + '</receiver>');
  }
  return manifest.slice(0, receiverStart) + receiver + manifest.slice(receiverEnd + '</receiver>'.length);
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
      marker: 'android:name=".StudyModeDeviceAdminReceiver"',
      xml: `        <receiver
            android:name=".StudyModeDeviceAdminReceiver"
            android:enabled="true"
            android:exported="true"
            android:permission="android.permission.BIND_DEVICE_ADMIN">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/study_mode_device_admin" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>`,
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

function configureUniversalBuild(buildGradle) {
  const marker = '/* MATHMASTER_UNIVERSAL_STUDY_MODE */';
  let result = buildGradle;
  const flavorMarker = '/* MATHMASTER_STUDY_MODE_FLAVORS */';
  const markerIndex = result.indexOf(flavorMarker);
  if (markerIndex >= 0) {
    const flavorOpen = result.indexOf('productFlavors {', markerIndex);
    if (flavorOpen < 0) throw new Error('Study Mode flavor block is malformed.');
    let depth = 0, flavorEnd = -1;
    for (let index = result.indexOf('{', flavorOpen); index < result.length; index++) {
      if (result[index] === '{') depth++;
      else if (result[index] === '}' && --depth === 0) { flavorEnd = index + 1; break; }
    }
    if (flavorEnd < 0) throw new Error('Study Mode flavor block is not closed.');
    result = result.slice(0, markerIndex) + result.slice(flavorEnd);
  } else if (result.includes('productFlavors {')) {
    throw new Error('Unexpected productFlavors block; refusing to remove unrelated variants.');
  }
  if (result.includes(marker)) return result;
  const configOpen = result.indexOf('defaultConfig {');
  if (configOpen < 0) throw new Error('Expected defaultConfig in app/build.gradle.');
  let depth = 0, close = -1;
  for (let index = result.indexOf('{', configOpen); index < result.length; index++) {
    if (result[index] === '{') depth++;
    else if (result[index] === '}' && --depth === 0) { close = index; break; }
  }
  if (close < 0) throw new Error('The defaultConfig block is not closed.');
  if (!result.slice(configOpen, close).includes('versionCode ')) {
    const addition = '\\n        versionCode 100001';
    result = result.slice(0, close) + addition + result.slice(close);
    close += addition.length;
  }
  return result.slice(0, close + 1) + '\\n\\n    ' + marker + result.slice(close + 1);
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
  const buildGradlePath = path.join(root, 'app/build.gradle');

  await mkdir(packageDir, { recursive: true });
  await rm(path.join(packageDir, 'StudyModeNotificationListenerService.java'), { force: true });
  for (const file of NATIVE_FILES) {
    await copyFile(path.join(NATIVE_DIR, file), path.join(packageDir, file));
  }
  const xmlTarget = path.join(root, 'app/src/main/res/xml');
  await mkdir(xmlTarget, { recursive: true });
  const valuesTarget = path.join(root, 'app/src/main/res/values');
  await mkdir(valuesTarget, { recursive: true });
  await copyFile(path.join(NATIVE_DIR, 'StudyModeAccessibilityService.java'),
    path.join(packageDir, 'StudyModeAccessibilityService.java'));
  await writeFile(path.join(xmlTarget, 'study_mode_accessibility.xml'), `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowsChanged|typeWindowStateChanged|typeViewFocused"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagRetrieveInteractiveWindows"
    android:canRetrieveWindowContent="true"
    android:description="@string/study_mode_accessibility_service_description"
    android:notificationTimeout="100" />
`);
  await writeFile(path.join(valuesTarget, 'study_mode_accessibility_strings.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="study_mode_accessibility_service_label">Math Master Multi-window App Blocking</string>
    <string name="study_mode_accessibility_service_description">When Study Mode is active, identifies package names of accessible interactive app windows, including supported split-screen and pop-up windows. It does not read on-screen text, messages, passwords, screenshots, or record gestures.</string>
</resources>
`);
  await rm(path.join(root, 'app/src/advanced/AndroidManifest.xml'), { force: true });
  await rm(path.join(root, 'app/src/advanced/java', PACKAGE_PATH, 'StudyModeAccessibilityService.java'), { force: true });
  await rm(path.join(root, 'app/src/advanced/res/xml/study_mode_accessibility.xml'), { force: true });
  await rm(path.join(root, 'app/src/advanced/res/values/study_mode_accessibility_strings.xml'), { force: true });
  for (const resource of [
    'study_mode_device_admin.xml',
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

  let buildGradle = await readFile(buildGradlePath, 'utf8');
  buildGradle = configureUniversalBuild(buildGradle);
  await writeFile(buildGradlePath, buildGradle);

  let manifest = await readFile(manifestPath, 'utf8');
  manifest = removeNotificationListenerService(manifest);
  manifest = ensureAccessibilityService(manifest);
  manifest = ensureManifestQueries(manifest);
  manifest = ensurePermissions(manifest);
  manifest = ensureStudyModeComponents(manifest);
  manifest = ensurePackageChangeReceiverActions(manifest);
  manifest = ensureBackupExclusions(manifest);
  await writeFile(manifestPath, manifest);

  return {
    javaFiles: NATIVE_FILES.length,
    packageVisibility: 'all-installed-packages',
    localUsageAnalytics: true,
    foregroundMonitoring: 'usage-access-plus-optional-accessibility',
    variants: ['universal'],
    accessibility: 'optional-user-consent',
  };
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
