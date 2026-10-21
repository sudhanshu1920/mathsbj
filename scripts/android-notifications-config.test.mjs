import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { configureAndroidNotifications } from './configure-android-notifications.mjs';

async function createAndroidFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mathmaster-android-notifications-'));
  await mkdir(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj'), { recursive: true });
  await writeFile(path.join(root, 'build.gradle'), `buildscript {
    repositories { google(); mavenCentral() }
    dependencies { classpath 'com.android.tools.build:gradle:8.13.0' }
  }
  allprojects { repositories { google(); mavenCentral() } }
  `);
  await writeFile(path.join(root, 'app/build.gradle'), `apply plugin: 'com.android.application'
  android { namespace "com.sudhanshu.mathsbj" }
  dependencies { implementation project(':capacitor-android') }
  `);
  await writeFile(path.join(root, 'app/src/main/AndroidManifest.xml'), `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.sudhanshu.mathsbj">
      <uses-permission android:name="android.permission.INTERNET" />
      <application android:label="Math Master" />
  </manifest>
  `.replace('<application android:label="Math Master" />', '<application android:label="Math Master"></application>'));
  await writeFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/MainActivity.java'), `package com.sudhanshu.mathsbj;

  import android.os.Bundle;
  import com.getcapacitor.BridgeActivity;

  public class MainActivity extends BridgeActivity {
      @Override
      public void onCreate(Bundle savedInstanceState) {
          registerPlugin(AppUpdaterPlugin.class);
          super.onCreate(savedInstanceState);
      }
  }
  `);
  return root;
}

const firebaseConfig = {
  project_info: { project_id: 'mathmaster-notification-test', project_number: '123456789012' },
  client: [{
    client_info: {
      mobilesdk_app_id: '1:123456789012:android:fedcba987654',
      android_client_info: { package_name: 'com.sudhanshu.mathsbj' },
    },
    api_key: [{ current_key: 'test-client-api-key' }],
  }],
};

test('configures local notification permissions, plugin and reboot/time-change receivers without Firebase', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await configureAndroidNotifications(root);
  const manifest = await readFile(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  const activity = await readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/MainActivity.java'), 'utf8');
  const plugin = await readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/DailyTargetReminderPlugin.java'), 'utf8');
  assert.deepEqual(result, { firebaseEnabled: false, projectId: null });
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android\.permission\.RECEIVE_BOOT_COMPLETED/);
  assert.match(manifest, /\.DailyTargetReminderReceiver/);
  assert.match(manifest, /android\.intent\.action\.TIMEZONE_CHANGED/);
  assert.match(activity, /registerPlugin\(DailyTargetReminderPlugin\.class\)/);
  assert.match(activity, /void onNewIntent\(Intent intent\)/);
  assert.match(plugin, /syncDailyTarget/);
  assert.match(plugin, /requestPermission/);
  assert.doesNotMatch(plugin, /syncHomeWidget|setHomeWidgetPreferences|syncHomeWidgetUpdateStatus/);
  assert.doesNotMatch(manifest, /MathMasterHomeWidgetProvider|MathMasterWidgetConfigActivity|appwidget/);
  await assert.rejects(
    readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/MathMasterHomeWidgetProvider.java')),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    readFile(path.join(root, 'app/src/main/res/xml/math_master_home_widget_info.xml')),
    { code: 'ENOENT' },
  );
  assert.doesNotMatch(manifest, /MathMasterMessagingService/);
});

test('configures FCM only for a matching Firebase Android app and remains idempotent', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const encoded = Buffer.from(JSON.stringify(firebaseConfig)).toString('base64');

  const result = await configureAndroidNotifications(root, { firebaseJsonBase64: encoded });
  await configureAndroidNotifications(root, { firebaseJsonBase64: encoded });
  const manifest = await readFile(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  const rootGradle = await readFile(path.join(root, 'build.gradle'), 'utf8');
  const appGradle = await readFile(path.join(root, 'app/build.gradle'), 'utf8');
  const services = JSON.parse(await readFile(path.join(root, 'app/google-services.json'), 'utf8'));
  const mainActivity = await readFile(path.join(root, 'app/src/main/java/com/sudhanshu/mathsbj/MainActivity.java'), 'utf8');

  assert.deepEqual(result, { firebaseEnabled: true, projectId: firebaseConfig.project_info.project_id });
  assert.equal(services.project_info.project_id, firebaseConfig.project_info.project_id);
  assert.match(rootGradle, /com\.google\.gms:google-services:4\.4\.2/);
  assert.match(appGradle, /com\.google\.firebase:firebase-messaging/);
  assert.match(appGradle, /com\.google\.gms\.google-services/);
  assert.match(manifest, /MathMasterMessagingService/);
  assert.match(manifest, /default_notification_channel_id/);
  assert.match(mainActivity, /NotificationChannel updateChannel/);
  assert.match(mainActivity, /"app_updates"/);
  assert.match(mainActivity, /import android\.os\.Build;/);
  assert.equal((manifest.match(/android:name="\.DailyTargetReminderBootReceiver"/g) || []).length, 1);
  assert.equal((mainActivity.match(/registerPlugin\(DailyTargetReminderPlugin\.class\)/g) || []).length, 1);
  assert.equal((mainActivity.match(/NotificationChannel updateChannel/g) || []).length, 1);
});


test('native alarm rechecks completion and queues tomorrow at 9 AM after the 10 PM cutoff', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await configureAndroidNotifications(root);
  const receiver = await readFile(
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../android-native/com/sudhanshu/mathsbj/DailyTargetReminderReceiver.java'),
    'utf8',
  );
  assert.match(receiver, /if \(elapsedSeconds >= targetMinutes \* 60L\)/);
  assert.doesNotMatch(receiver, /prefs\.getBoolean\("completed", false\) \|\| elapsedSeconds/);
  assert.match(receiver, /scheduleTomorrow\(context, slots\)/);
  assert.match(receiver, /private static boolean scheduleTomorrow/);
  assert.match(receiver, /public static boolean scheduleNext/);
  assert.match(receiver, /AlarmManager is unavailable/);
  assert.match(receiver, /Calendar\.DAY_OF_YEAR, 1/);
  assert.match(receiver, /currentMinute > 22 \* 60/);
  assert.match(receiver, /REMINDER_POLICY_VERSION = 3/);
  assert.match(receiver, /540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1185, 1230, 1260, 1290, 1310, 1320/);
  assert.match(receiver, /ensureCurrentSchedulePolicy\(prefs\)/);
  assert.match(receiver, /schedulePolicyVersion/);
  assert.match(receiver, /getStageIndex\(slots, currentMinute\)/);
  assert.match(receiver, /allStages\.optJSONArray\(stageIndex\)/);
  assert.match(receiver, /getMinutesUntilCutoff\(\)/);
  assert.match(receiver, /putString\("lastMessageText", candidate\)/);
  assert.match(receiver, /cancelVisibleReminder\(context\)/);
  assert.match(receiver, /triggerAt <= nowMillis/);
  assert.match(receiver, /minuteOfDay < 9 \* 60/);
  assert.match(receiver, /candidateMinute < 9 \* 60/);
  assert.match(receiver, /candidate.equals\(previousText\)/);
  assert.match(receiver, /RANDOM.nextBoolean\(\)/);
  assert.match(receiver, /putString\("marathiMessagesJson", "\[\]"\)/);
  assert.match(receiver, /putString\("hindiMessagesJson", "\[\]"\)/);
  assert.match(receiver, /stageIndex >= 13/);
  assert.match(receiver, /scheduleNext\(context\)/);
});

test('rejects Firebase client configuration for a different application id', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const invalid = structuredClone(firebaseConfig);
  invalid.client[0].client_info.android_client_info.package_name = 'com.example.other';
  await assert.rejects(
    configureAndroidNotifications(root, { firebaseJsonBase64: Buffer.from(JSON.stringify(invalid)).toString('base64') }),
    /different Android package/,
  );
});


test('daily reminder bridge and native receiver agree on the 17-stage schedule policy', async (t) => {
  const root = await createAndroidFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await configureAndroidNotifications(root);
  const receiver = await readFile(
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../android-native/com/sudhanshu/mathsbj/DailyTargetReminderReceiver.java'),
    'utf8',
  );
  const plugin = await readFile(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../android-native/com/sudhanshu/mathsbj/DailyTargetReminderPlugin.java'), 'utf8');
  const bridge = await readFile(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/lib/dailyTargetReminders.ts'), 'utf8');
  assert.match(receiver, /REMINDER_POLICY_VERSION = 3/);
  assert.match(plugin, /DailyTargetReminderReceiver\.REMINDER_POLICY_VERSION/);
  assert.match(bridge, /DAILY_REMINDER_POLICY_VERSION = 3/);
  assert.match(bridge, /9 \* 60,[\s\S]*22 \* 60/);
  assert.match(receiver, /540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140/);
  assert.match(receiver, /1185, 1230, 1260, 1290, 1310, 1320/);
  assert.match(receiver, /candidate.equals\(previousText\)/);
  assert.match(receiver, /RANDOM.nextBoolean\(\)/);
});
