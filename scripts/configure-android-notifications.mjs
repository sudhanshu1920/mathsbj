import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_NATIVE_DIR = path.resolve(SCRIPT_DIR, '../android-native/com/sudhanshu/mathsbj');
const PACKAGE_PATH = 'com/sudhanshu.mathsbj';
const GOOGLE_SERVICES_PLUGIN_VERSION = '4.4.2';
const FIREBASE_BOM_VERSION = '33.14.0';

async function readRequired(filePath, label) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Android notification setup requires ${label}: ${filePath}`, { cause: error });
  }
}

function ensureAndroidPermissions(manifest) {
  const rootStart = manifest.indexOf('<manifest');
  const rootEnd = manifest.indexOf('>', rootStart);
  if (rootStart < 0 || rootEnd < 0) throw new Error('AndroidManifest.xml has no valid <manifest> root');

  let root = manifest.slice(rootStart, rootEnd + 1);
  if (!root.includes('xmlns:android=')) {
    root = root.slice(0, -1) + ' xmlns:android="http://schemas.android.com/apk/res/android">';
    manifest = manifest.slice(0, rootStart) + root + manifest.slice(rootEnd + 1);
  }

  const permissions = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
  ];
  const insertions = permissions
    .filter((permission) => !manifest.includes(`android:name="${permission}"`))
    .map((permission) => `    <uses-permission android:name="${permission}" />`)
    .join('\n');
  if (insertions) {
    const applicationIndex = manifest.indexOf('<application');
    if (applicationIndex < 0) throw new Error('AndroidManifest.xml has no <application> element');
    manifest = manifest.slice(0, applicationIndex) + insertions + '\n\n    ' + manifest.slice(applicationIndex);
  }
  return manifest;
}

function ensureManifestReceivers(manifest, firebaseEnabled) {
  const entries = [];
  if (!manifest.includes('android:name=".DailyTargetReminderReceiver"')) {
    entries.push(`        <receiver
            android:name=".DailyTargetReminderReceiver"
            android:enabled="true"
            android:exported="false" />`);
  }
  if (!manifest.includes('android:name=".DailyTargetReminderBootReceiver"')) {
    entries.push(`        <receiver
            android:name=".DailyTargetReminderBootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>`);
  }
  if (firebaseEnabled && !manifest.includes('android:name=".MathMasterMessagingService"')) {
    entries.push(`        <service
            android:name=".MathMasterMessagingService"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>`);
  }
  if (entries.length) {
    const applicationClose = manifest.lastIndexOf('</application>');
    if (applicationClose < 0) throw new Error('AndroidManifest.xml has no closing </application> tag');
    manifest = manifest.slice(0, applicationClose) + '\n' + entries.join('\n') + '\n    ' + manifest.slice(applicationClose);
  }
  return manifest;
}

function registerNativePlugin(mainActivity) {
  const registration = 'registerPlugin(DailyTargetReminderPlugin.class);';
  if (!mainActivity.includes(registration)) {
    const updaterRegistration = 'registerPlugin(AppUpdaterPlugin.class);';
    if (!mainActivity.includes(updaterRegistration)) {
      throw new Error('MainActivity.java is missing the expected AppUpdater plugin registration');
    }
    mainActivity = mainActivity.replace(updaterRegistration, updaterRegistration + '\n        ' + registration);
  }
  if (!mainActivity.includes('void onNewIntent(Intent intent)')) {
    const finalBrace = mainActivity.lastIndexOf('}');
    if (finalBrace < 0) throw new Error('MainActivity.java has no closing class brace');
    mainActivity = mainActivity.slice(0, finalBrace) + `
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

` + mainActivity.slice(finalBrace);
  }
  if (!mainActivity.includes('import android.content.Intent;')) {
    const packageEnd = mainActivity.indexOf(';');
    mainActivity = mainActivity.slice(0, packageEnd + 1) + '\n\nimport android.content.Intent;' + mainActivity.slice(packageEnd + 1);
  }
  return mainActivity;
}

function validateGoogleServicesConfig(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.project_info?.project_id) {
    throw new Error('Firebase google-services.json has no project_info.project_id');
  }
  const matchingClient = Array.isArray(parsed.client) && parsed.client.some((client) =>
    client?.client_info?.android_client_info?.package_name === PACKAGE_PATH
    && typeof client?.client_info?.mobilesdk_app_id === 'string'
    && Array.isArray(client?.api_key) && typeof client.api_key[0]?.current_key === 'string',
  );
  if (!matchingClient) {
    throw new Error(`Firebase google-services.json must include Android package ${PACKAGE_PATH}`);
  }
  return parsed;
}

async function configureFirebase(root, encodedConfig) {
  let config;
  try {
    config = validateGoogleServicesConfig(JSON.parse(Buffer.from(encodedConfig, 'base64').toString('utf8')));
  } catch (error) {
    throw new Error('MATHMASTER_FIREBASE_GOOGLE_SERVICES_JSON_BASE64 is invalid or belongs to a different Android package.', { cause: error });
  }

  const rootGradlePath = path.join(root, 'build.gradle');
  let rootGradle = await readRequired(rootGradlePath, 'root Gradle build file');
  if (!rootGradle.includes('com.google.gms:google-services:')) {
    const dependenciesStart = rootGradle.indexOf('dependencies {');
    if (dependenciesStart < 0 || !rootGradle.includes('buildscript')) {
      throw new Error('Unable to find the Android buildscript dependencies block for Google Services');
    }
    rootGradle = rootGradle.slice(0, dependenciesStart + 'dependencies {'.length)
      + `\n        classpath 'com.google.gms:google-services:${GOOGLE_SERVICES_PLUGIN_VERSION}'`
      + rootGradle.slice(dependenciesStart + 'dependencies {'.length);
    await writeFile(rootGradlePath, rootGradle);
  }

  const appGradlePath = path.join(root, 'app/build.gradle');
  let appGradle = await readRequired(appGradlePath, 'app Gradle build file');
  if (!appGradle.includes('com.google.firebase:firebase-messaging')) {
    const dependenciesStart = appGradle.indexOf('dependencies {');
    if (dependenciesStart < 0) throw new Error('Unable to find Android app dependencies block for Firebase Messaging');
    appGradle = appGradle.slice(0, dependenciesStart + 'dependencies {'.length)
      + `\n    implementation platform('com.google.firebase:firebase-bom:${FIREBASE_BOM_VERSION}')\n    implementation 'com.google.firebase:firebase-messaging'`
      + appGradle.slice(dependenciesStart + 'dependencies {'.length);
  }
  if (!appGradle.includes("apply plugin: 'com.google.gms.google-services'")) {
    appGradle += `\n\napply plugin: 'com.google.gms.google-services'\n`;
  }
  await writeFile(appGradlePath, appGradle);
  await writeFile(path.join(root, 'app/google-services.json'), JSON.stringify(config, null, 2) + '\n');
  return { enabled: true, projectId: config.project_info.project_id };
}

export async function configureAndroidNotifications(androidRoot, { firebaseJsonBase64 = '' } = {}) {
  const root = path.resolve(androidRoot);
  const sourceFiles = [
    'DailyTargetReminderPlugin.java',
    'DailyTargetReminderReceiver.java',
    'DailyTargetReminderBootReceiver.java',
  ];
  const targetPackageDir = path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj');
  await mkdir(targetPackageDir, { recursive: true });
  for (const file of sourceFiles) {
    await copyFile(path.join(SOURCE_NATIVE_DIR, file), path.join(targetPackageDir, file));
  }

  const mainActivityPath = path.join(targetPackageDir, 'MainActivity.java');
  const mainActivity = registerNativePlugin(await readRequired(mainActivityPath, 'generated MainActivity.java'));
  await writeFile(mainActivityPath, mainActivity);

  let firebase = { enabled: false, projectId: null };
  if (firebaseJsonBase64.trim()) {
    firebase = await configureFirebase(root, firebaseJsonBase64.trim());
    await copyFile(
      path.join(SOURCE_NATIVE_DIR, 'MathMasterMessagingService.java'),
      path.join(targetPackageDir, 'MathMasterMessagingService.java'),
    );
  }

  const manifestPath = path.join(root, 'app/src/main/AndroidManifest.xml');
  let manifest = await readRequired(manifestPath, 'AndroidManifest.xml');
  manifest = ensureAndroidPermissions(manifest);
  manifest = ensureManifestReceivers(manifest, firebase.enabled);
  await writeFile(manifestPath, manifest);

  return { firebaseEnabled: firebase.enabled, projectId: firebase.projectId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const androidRoot = process.env.ANDROID_ROOT || path.resolve('android');
  const firebaseJsonBase64 = process.env.MATHMASTER_FIREBASE_GOOGLE_SERVICES_JSON_BASE64 || '';
  configureAndroidNotifications(androidRoot, { firebaseJsonBase64 })
    .then((result) => {
      console.log('Configured native Android background target reminders.');
      if (result.firebaseEnabled) {
        console.log(`Configured Firebase Messaging for project ${result.projectId}.`);
      } else {
        console.warn('Firebase Messaging is not configured: add MATHMASTER_FIREBASE_GOOGLE_SERVICES_JSON_BASE64 to enable background version push.');
      }
    })
    .catch((error) => {
      console.error(`Android notification configuration failed: ${error.message}`);
      process.exitCode = 1;
    });
}
