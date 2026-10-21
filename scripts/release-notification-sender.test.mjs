import assert from 'node:assert/strict';
import test from 'node:test';
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

test('creates a title-only version update notification with trusted metadata and stable Android replacement tag', () => {
  const release = validateReleaseManifest(manifest);
  const payload = createFcmMessage(release).message;
  assert.equal(payload.topic, 'math_app_updates');
  assert.equal(payload.data.title, 'New Version 1.0.4 Available');
  // Invisible compatibility character avoids verbose body fallback in already-installed older APKs.
  assert.equal(payload.data.body, '\u200B');
  assert.equal(payload.notification, undefined);
  assert.equal(payload.android.notification, undefined);
  assert.equal(payload.android.collapse_key, 'mathmaster-update');
  assert.equal(payload.data.mathmaster_notification_action, 'app-update');
  assert.equal(payload.data.apkUrl, manifest.apkUrl);
  assert.equal(payload.data.sha256, 'a'.repeat(64));
});
