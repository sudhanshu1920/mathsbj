import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  createFcmMessage,
  shouldSendNotification,
  validateReleaseManifest,
} from './release-notification-sender.mjs';

const manifest = {
  packageName: 'com.sudhanshu.mathsbj',
  versionCode: 104,
  versionName: '1.0.4',
  apkUrl: 'https://github.com/sudhanshu1920/mathsbj-updates/releases/download/latest/MathMaster-release.apk',
  sha256: 'a'.repeat(64),
  releaseNotes: 'Daily reminders and stability fixes',
  publishedAt: '2026-10-16T12:00:00.000Z',
};

test('validates release package, semantic version, trusted APK URL and checksum', () => {
  assert.equal(validateReleaseManifest(manifest).versionName, '1.0.4');
  assert.throws(() => validateReleaseManifest({ ...manifest, packageName: 'com.example.other' }), /packageName/);
  assert.throws(() => validateReleaseManifest({ ...manifest, apkUrl: 'https://attacker.example/update.apk' }), /trusted production release asset/);
  assert.throws(() => validateReleaseManifest({ ...manifest, sha256: 'not-a-checksum' }), /SHA-256/);
  assert.throws(() => validateReleaseManifest({ ...manifest, versionName: 'latest' }), /semantic X.Y.Z/);
});

test('deduplicates the same release and any already-notified version', () => {
  const release = validateReleaseManifest(manifest);
  assert.equal(shouldSendNotification(null, release, 'a'.repeat(40)), true);
  assert.equal(shouldSendNotification({ versionCode: 104, sourceCommit: 'b'.repeat(40) }, release, 'a'.repeat(40)), false);
  assert.equal(shouldSendNotification({ versionCode: 103, sourceCommit: 'a'.repeat(40) }, release, 'a'.repeat(40)), false);
  assert.equal(shouldSendNotification({ versionCode: 103, sourceCommit: 'b'.repeat(40) }, release, 'a'.repeat(40)), true);
});

test('creates a version-free update notification while retaining internal release metadata', () => {
  const release = validateReleaseManifest(manifest);
  const payload = createFcmMessage(release).message;
  assert.equal(payload.topic, 'math_app_updates');
  assert.equal(payload.data.title, 'New Update Available');
  assert.equal(payload.data.body, 'A new version of Math Master is ready. Update now to enjoy the latest improvements.');
  assert.doesNotMatch(payload.data.title, /\d/);
  assert.doesNotMatch(payload.data.body, /\d/);
  assert.equal(payload.data.versionCode, String(release.versionCode));
  assert.equal(payload.data.versionName, release.versionName);
  assert.equal(payload.data.mathmaster_update_version_code, String(release.versionCode));
  assert.equal(payload.data.mathmaster_update_version_name, release.versionName);
  assert.equal(payload.notification, undefined);
  assert.equal(payload.android.notification, undefined);
  assert.equal(payload.android.collapse_key, 'mathmaster-update');
  assert.equal(payload.data.mathmaster_notification_action, 'app-update');
  assert.equal(payload.data.apkUrl, manifest.apkUrl);
  assert.equal(payload.data.sha256, 'a'.repeat(64));
});

test('Android update notification and APK-save copy stay version-free and stale alerts are cleared safely', async () => {
  const [messaging, bootReceiver, releaseWorkflow] = await Promise.all([
    readFile(new URL('../android-native/com/sudhanshu/mathsbj/MathMasterMessagingService.java', import.meta.url), 'utf8'),
    readFile(new URL('../android-native/com/sudhanshu/mathsbj/DailyTargetReminderBootReceiver.java', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/android-release.yml', import.meta.url), 'utf8'),
  ]);

  assert.match(messaging, /UPDATE_NOTIFICATION_TITLE = "New Update Available"/);
  assert.match(messaging, /UPDATE_NOTIFICATION_BODY = "A new version of Math Master is ready\\. Update now to enjoy the latest improvements\\."/);
  assert.match(messaging, /setContentTitle\\(UPDATE_NOTIFICATION_TITLE\\)/);
  assert.match(messaging, /setContentText\\(UPDATE_NOTIFICATION_BODY\\)/);
  assert.match(messaging, /BigTextStyle\\(\\)\\.bigText\\(UPDATE_NOTIFICATION_BODY\\)/);
  assert.match(messaging, /manager\\.notify\\("mathmaster-update", NOTIFICATION_ID, notification\\)/);
  assert.doesNotMatch(messaging, /setContentTitle\\(.*versionName/);

  assert.match(bootReceiver, /ACTION_MY_PACKAGE_REPLACED\\.equals\\(action\\)[\\s\\S]*cancelStaleUpdateNotifications\\(context\\)/);
  assert.match(bootReceiver, /"mathmaster-update"\\.equals\\(tag\\) \\|\\| "mathapp-apk-saved"\\.equals\\(tag\\)/);
  assert.match(bootReceiver, /manager\\.cancel\\(tag, notification\\.getId\\(\\)\\)/);
  assert.doesNotMatch(bootReceiver, /cancelAll\\(/);

  assert.match(releaseWorkflow, /String publicName = "MathApp\\.apk"/);
  assert.doesNotMatch(releaseWorkflow, /String publicName = "MathApp-v" \\+ versionName/);
});
