import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { configureAndroidStudyMode } from './configure-android-study-mode.mjs';

async function createAndroidFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mathmaster-study-mode-'));
  const packageDir = path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj');
  await mkdir(packageDir, { recursive: true });
  await writeFile(path.join(root, 'app/src/main/AndroidManifest.xml'), `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.sudhanshu.mathsbj">
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:label="Math Master">
      <service android:name=".StudyModeNotificationListenerService"
          android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
        <intent-filter>
          <action android:name="android.service.notification.NotificationListenerService" />
        </intent-filter>
      </service>
    </application>
  </manifest>`);
  await writeFile(path.join(root, 'app/build.gradle'), `plugins { id 'com.android.application' }

android {
    namespace "com.sudhanshu.mathsbj"
    defaultConfig { applicationId "com.sudhanshu.mathsbj" versionCode 1 }
}
`);
  await writeFile(path.join(packageDir, 'MainActivity.java'), `package com.sudhanshu.mathsbj;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
`);
  return root;
}

test('configures complete installed-app visibility, native services and Capacitor bridge idempotently', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await configureAndroidStudyMode(root);
  assert.equal(result.javaFiles, 11);
  assert.equal(result.foregroundMonitoring, 'usage-access-plus-optional-accessibility');
  assert.deepEqual(result.variants, ['universal']);
  assert.equal(result.accessibility, 'optional-user-consent');
  assert.equal(result.packageVisibility, 'all-installed-packages');
  assert.equal(result.localUsageAnalytics, true);

  const manifestPath = path.join(root, 'app/src/main/AndroidManifest.xml');
  const activityPath = path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/MainActivity.java');
  const manifest = await readFile(manifestPath, 'utf8');
  const activity = await readFile(activityPath, 'utf8');

  for (const permission of [
    'QUERY_ALL_PACKAGES', 'PACKAGE_USAGE_STATS', 'SYSTEM_ALERT_WINDOW', 'SCHEDULE_EXACT_ALARM',
    'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE', 'RECEIVE_BOOT_COMPLETED',
    'ACCESS_NOTIFICATION_POLICY', 'POST_NOTIFICATIONS',
  ]) assert.match(manifest, new RegExp(`android.permission.${permission}`));

  assert.match(manifest, /<queries>[\s\S]*android.intent.action.MAIN[\s\S]*android.intent.category.LAUNCHER[\s\S]*<\/queries>/);
  assert.ok(manifest.includes('android.intent.action.DIAL'));
  assert.ok(manifest.includes('android.intent.category.HOME'));
  assert.doesNotMatch(manifest, /android.provider.Telephony.SMS_DELIVER/);
  assert.match(manifest, /StudyModeFocusService[\s\S]*foregroundServiceType="specialUse"/);
  assert.match(manifest, /StudyModeFocusService[\s\S]*android:stopWithTask="false"/);
  assert.match(manifest, /StudyModeAccessibilityService[\\s\\S]*BIND_ACCESSIBILITY_SERVICE/);
  assert.match(manifest, /android.accessibilityservice/);
  assert.match(manifest, /android:resource="@xml\/study_mode_accessibility"/);
  assert.ok(manifest.includes("\n        <service\n            android:name=\".StudyModeAccessibilityService\""));
  const buildGradle = await readFile(path.join(root, 'app/build.gradle'), 'utf8');
  assert.doesNotMatch(buildGradle, /flavorDimensions|productFlavors|MATHMASTER_STUDY_MODE_FLAVORS/);
  assert.match(buildGradle, /MATHMASTER_UNIVERSAL_STUDY_MODE/);
  assert.match(buildGradle, /versionCode 1/);
  assert.doesNotMatch(buildGradle, /applicationIdSuffix/);
  const universalService = await readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/StudyModeAccessibilityService.java'), 'utf8');
  assert.match(universalService, /getWindowsOnAllDisplays\\(\\)/);
  const universalMetadata = await readFile(path.join(root, 'app/src/main/res/xml/study_mode_accessibility.xml'), 'utf8');
  assert.match(universalMetadata, /flagRetrieveInteractiveWindows/);
  assert.match(universalMetadata, /canRetrieveWindowContent="true"/);
  const accessibilityStrings = await readFile(path.join(root, 'app/src/main/res/values/study_mode_accessibility_strings.xml'), 'utf8');
  assert.match(accessibilityStrings, /does not read on-screen text/);
  await assert.rejects(readFile(path.join(root, 'app/src/advanced/AndroidManifest.xml'), 'utf8'), { code: 'ENOENT' });
  assert.match(manifest, /StudyModeDeviceAdminReceiver[\s\S]*BIND_DEVICE_ADMIN[\s\S]*device_admin/);
  assert.doesNotMatch(manifest, /StudyModeNotificationListenerService|BIND_NOTIFICATION_LISTENER_SERVICE|READ_SMS|RECEIVE_SMS/);
  await assert.rejects(
    readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/StudyModeNotificationListenerService.java'), 'utf8'),
    { code: 'ENOENT' },
  );
  assert.match(manifest, /DailyTargetReminderBootReceiver[\s\S]*BOOT_COMPLETED[\s\S]*TIMEZONE_CHANGED/);
  assert.match(manifest, /StudyModeAlarmReceiver/);
  const packageReceiverStart = manifest.indexOf('android:name=".StudyModePackageChangeReceiver"');
  const packageReceiverEnd = manifest.indexOf('</receiver>', packageReceiverStart);
  assert.ok(packageReceiverStart >= 0 && packageReceiverEnd > packageReceiverStart);
  const packageReceiver = manifest.slice(packageReceiverStart, packageReceiverEnd);
  for (const action of ['PACKAGE_ADDED', 'PACKAGE_CHANGED', 'PACKAGE_REMOVED']) {
    assert.ok(packageReceiver.includes('android.intent.action.' + action));
  }
  assert.match(manifest, /android.permission.QUERY_ALL_PACKAGES/);
  assert.equal((activity.match(/registerPlugin\(StudyModePlugin\.class\)/g) || []).length, 1);
  assert.equal((activity.match(/registerPlugin\(AppUsageAnalyticsPlugin\.class\)/g) || []).length, 1);
  assert.match(manifest, /android:fullBackupContent="@xml\/app_usage_backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/app_usage_data_extraction_rules"/);
  const legacyBackup = await readFile(path.join(root, 'app/src/main/res/xml/app_usage_backup_rules.xml'), 'utf8');
  const modernBackup = await readFile(path.join(root, 'app/src/main/res/xml/app_usage_data_extraction_rules.xml'), 'utf8');
  assert.match(legacyBackup, /exclude domain="sharedpref" path="app_usage_analytics_local.xml"/);
  assert.match(legacyBackup, /exclude domain="database" path="math_master_study_sessions.db"/);
  assert.match(modernBackup, /cloud-backup[\s\S]*exclude domain="sharedpref" path="app_usage_analytics_local.xml"/);
  assert.match(modernBackup, /device-transfer[\s\S]*exclude domain="sharedpref" path="app_usage_analytics_local.xml"/);
  assert.match(modernBackup, /cloud-backup[\s\S]*exclude domain="database" path="math_master_study_sessions.db"/);
  assert.match(modernBackup, /device-transfer[\s\S]*exclude domain="database" path="math_master_study_sessions.db"/);

  await configureAndroidStudyMode(root);
  const secondManifest = await readFile(manifestPath, 'utf8');
  const secondActivity = await readFile(activityPath, 'utf8');
  assert.equal((secondManifest.match(/android:name="\.StudyModeFocusService"/g) || []).length, 1);
  assert.match(secondManifest, /StudyModeFocusService[\s\S]*android:stopWithTask="false"/);
  assert.doesNotMatch(secondManifest, /StudyModeNotificationListenerService|BIND_NOTIFICATION_LISTENER_SERVICE/);
  assert.equal((secondManifest.match(/android:name=".StudyModeAccessibilityService"/g) || []).length, 1);
  assert.doesNotMatch(await readFile(path.join(root, 'app/build.gradle'), 'utf8'), /productFlavors|flavorDimensions/);
  assert.equal((secondManifest.match(/android.intent.category.LAUNCHER/g) || []).length, 1);
  assert.equal((secondActivity.match(/registerPlugin\(StudyModePlugin\.class\)/g) || []).length, 1);
  assert.equal((secondActivity.match(/registerPlugin\(AppUsageAnalyticsPlugin\.class\)/g) || []).length, 1);
  for (const action of ['PACKAGE_ADDED', 'PACKAGE_CHANGED', 'PACKAGE_REMOVED']) {
    const marker = 'android:name="android.intent.action.' + action + '"';
    assert.equal(secondManifest.split(marker).length - 1, 1);
  }
  for (const action of ['PACKAGE_ADDED', 'PACKAGE_CHANGED', 'PACKAGE_REMOVED']) {
    assert.equal((secondManifest.match(new RegExp('android.intent.action.' + action, 'g')) || []).length, 1);
  }
});
