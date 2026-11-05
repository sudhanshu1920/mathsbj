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

test('configures launcher-only package visibility, native services and Capacitor bridge idempotently', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await configureAndroidStudyMode(root);
  assert.equal(result.javaFiles, 7);
  assert.equal(result.packageVisibility, 'launcher-intents-only');

  const manifestPath = path.join(root, 'app/src/main/AndroidManifest.xml');
  const activityPath = path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/MainActivity.java');
  const manifest = await readFile(manifestPath, 'utf8');
  const activity = await readFile(activityPath, 'utf8');

  for (const permission of [
    'PACKAGE_USAGE_STATS', 'SYSTEM_ALERT_WINDOW', 'SCHEDULE_EXACT_ALARM',
    'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE', 'RECEIVE_BOOT_COMPLETED',
  ]) assert.match(manifest, new RegExp(`android.permission.${permission}`));

  assert.match(manifest, /<queries>[\s\S]*android.intent.action.MAIN[\s\S]*android.intent.category.LAUNCHER[\s\S]*<\/queries>/);
  assert.ok(manifest.includes('android.intent.action.DIAL'));
  assert.ok(manifest.includes('android.intent.category.HOME'));
  assert.doesNotMatch(manifest, /android.provider.Telephony.SMS_DELIVER/);
  assert.match(manifest, /StudyModeFocusService[\s\S]*foregroundServiceType="specialUse"/);
  assert.match(manifest, /StudyModeDeviceAdminReceiver[\s\S]*BIND_DEVICE_ADMIN[\s\S]*device_admin/);
  assert.doesNotMatch(manifest, /StudyModeNotificationListenerService|BIND_NOTIFICATION_LISTENER_SERVICE|READ_SMS|RECEIVE_SMS|AccessibilityService/);
  await assert.rejects(
    readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/StudyModeNotificationListenerService.java'), 'utf8'),
    { code: 'ENOENT' },
  );
  assert.match(manifest, /DailyTargetReminderBootReceiver[\s\S]*BOOT_COMPLETED[\s\S]*TIMEZONE_CHANGED/);
  assert.match(manifest, /StudyModeAlarmReceiver/);
  assert.match(manifest, /StudyModePackageChangeReceiver[\s\S]*PACKAGE_REMOVED/);
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES/);
  assert.equal((activity.match(/registerPlugin\(StudyModePlugin\.class\)/g) || []).length, 1);

  await configureAndroidStudyMode(root);
  const secondManifest = await readFile(manifestPath, 'utf8');
  const secondActivity = await readFile(activityPath, 'utf8');
  assert.equal((secondManifest.match(/android:name="\.StudyModeFocusService"/g) || []).length, 1);
  assert.doesNotMatch(secondManifest, /StudyModeNotificationListenerService|BIND_NOTIFICATION_LISTENER_SERVICE/);
  assert.equal((secondManifest.match(/android.intent.category.LAUNCHER/g) || []).length, 1);
  assert.equal((secondActivity.match(/registerPlugin\(StudyModePlugin\.class\)/g) || []).length, 1);
});
