import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/sudhanshu1920/mathsbj-updates/main/updates/update.json';
const TRUSTED_APK_URL = 'https://github.com/sudhanshu1920/mathsbj-updates/releases/download/latest/MathMaster-release.apk';
const UPDATES_REPOSITORY = 'sudhanshu1920/mathsbj-updates';
const STATE_PATH = 'updates/notification-state.json';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export function validateReleaseManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Published update manifest must be a JSON object.');
  }
  if (manifest.packageName !== 'com.sudhanshu.mathsbj') {
    throw new Error('Update manifest packageName is not the Math Master Android package.');
  }
  if (!Number.isSafeInteger(manifest.versionCode) || manifest.versionCode < 1 || manifest.versionCode > 2100000000) {
    throw new Error('Update manifest versionCode is invalid.');
  }
  if (typeof manifest.versionName !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.versionName)) {
    throw new Error('Update manifest versionName must be semantic X.Y.Z.');
  }
  if (manifest.apkUrl !== TRUSTED_APK_URL) {
    throw new Error('Update manifest APK URL is not the trusted production release asset.');
  }
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
    throw new Error('Update manifest APK SHA-256 is invalid.');
  }
  return {
    packageName: manifest.packageName,
    versionCode: manifest.versionCode,
    versionName: manifest.versionName,
    apkUrl: manifest.apkUrl,
    sha256: manifest.sha256.toLowerCase(),
    releaseNotes: typeof manifest.releaseNotes === 'string'
      ? manifest.releaseNotes.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
      : '',
  };
}

export function shouldSendNotification(previous, release, sourceCommit) {
  if (!previous || typeof previous !== 'object') return true;
  const previousCode = Number(previous.versionCode) || 0;
  if (previousCode >= release.versionCode) return false;
  if (typeof previous.sourceCommit === 'string' && previous.sourceCommit === sourceCommit) return false;
  return true;
}

export function createFcmMessage(release) {
  const notes = release.releaseNotes ? ` ${release.releaseNotes}` : '';
  const body = `Version ${release.versionName} (build ${release.versionCode}) is now available.${notes} Tap to update.`.slice(0, 240);
  const data = {
    type: 'app_update',
    mathmaster_notification_action: 'app-update',
    versionCode: String(release.versionCode),
    versionName: release.versionName,
    mathmaster_update_version_code: String(release.versionCode),
    mathmaster_update_version_name: release.versionName,
    updateManifestUrl: UPDATE_MANIFEST_URL,
    mathmaster_update_manifest_url: UPDATE_MANIFEST_URL,
    apkUrl: release.apkUrl,
    sha256: release.sha256,
    releaseNotes: release.releaseNotes,
  };
  return {
    message: {
      topic: 'math_app_updates',
      notification: {
        title: '🎉 New Math App Update Available!',
        body,
      },
      data,
      android: {
        priority: 'HIGH',
        collapse_key: 'mathmaster-update',
        notification: {
          channel_id: 'app_updates',
          tag: 'mathmaster-update',
          sound: 'default',
          click_action: 'MAIN',
        },
      },
    },
  };
}

const b64url = (value) => Buffer.from(value).toString('base64url');

async function getGoogleAccessToken(serviceAccount) {
  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error('Firebase service-account JSON is missing client_email, private_key, or project_id.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.access_token !== 'string') {
    throw new Error(`Google OAuth token exchange failed (HTTP ${response.status}).`);
  }
  return result.access_token;
}

async function githubRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404 && options.allowNotFound) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub update-notification state request failed (HTTP ${response.status}).`);
  return result;
}

async function readNotificationState(token) {
  const url = `https://api.github.com/repos/${UPDATES_REPOSITORY}/contents/${STATE_PATH}?ref=main`;
  const response = await githubRequest(token, url, { allowNotFound: true });
  if (!response) return { state: null, sha: null };
  if (typeof response.content !== 'string' || typeof response.sha !== 'string') {
    throw new Error('Saved notification state has an unexpected format.');
  }
  try {
    return { state: JSON.parse(Buffer.from(response.content, 'base64').toString('utf8')), sha: response.sha };
  } catch {
    throw new Error('Saved notification state is not valid JSON.');
  }
}

async function writeNotificationState(token, state, sha) {
  const url = `https://api.github.com/repos/${UPDATES_REPOSITORY}/contents/${STATE_PATH}`;
  const payload = {
    message: `Record Math Master push notification ${state.versionName} (build ${state.versionCode})`,
    content: Buffer.from(JSON.stringify(state, null, 2) + '\n').toString('base64'),
    branch: 'main',
  };
  if (sha) payload.sha = sha;
  await githubRequest(token, url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function postFcmMessage(projectId, accessToken, payload) {
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) return response.json().catch(() => ({}));
    lastStatus = response.status;
    // Don't echo raw server errors or any authorization material into CI logs.
    if (response.status < 500 && response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`Firebase Cloud Messaging send failed (HTTP ${lastStatus}).`);
}

export async function sendReleaseNotification({
  manifest,
  serviceAccount,
  clientConfig,
  sourceCommit,
  githubToken,
  expectedVersionCode,
  expectedVersionName,
}) {
  const release = validateReleaseManifest(manifest);
  if (release.versionCode !== Number(expectedVersionCode) || release.versionName !== expectedVersionName) {
    throw new Error('Published manifest version does not match this verified Android release build.');
  }
  if (typeof sourceCommit !== 'string' || !/^[a-f0-9]{40}$/i.test(sourceCommit)) {
    throw new Error('Release source commit SHA is invalid.');
  }
  if (!clientConfig?.project_info?.project_id || clientConfig.project_info.project_id !== serviceAccount.project_id) {
    throw new Error('Firebase Android client config and service account must belong to the same project.');
  }
  const hasAndroidClient = Array.isArray(clientConfig.client) && clientConfig.client.some((client) =>
    client?.client_info?.android_client_info?.package_name === release.packageName,
  );
  if (!hasAndroidClient) throw new Error('Firebase client config is not registered for the Math Master Android package.');
  if (!githubToken) throw new Error('MATHMASTER_UPDATES_TOKEN is required for release-notification deduplication.');

  const { state: previous, sha } = await readNotificationState(githubToken);
  if (!shouldSendNotification(previous, release, sourceCommit)) {
    return { skipped: true, reason: 'version or source commit already notified', versionCode: release.versionCode };
  }

  const accessToken = await getGoogleAccessToken(serviceAccount);
  const sendResult = await postFcmMessage(serviceAccount.project_id, accessToken, createFcmMessage(release));
  const state = {
    versionCode: release.versionCode,
    versionName: release.versionName,
    sourceCommit,
    projectId: serviceAccount.project_id,
    messageId: typeof sendResult.name === 'string' ? sendResult.name : null,
    notifiedAt: new Date().toISOString(),
  };
  await writeNotificationState(githubToken, state, sha);
  return { skipped: false, versionCode: release.versionCode, messageId: state.messageId };
}

async function main() {
  const required = [
    'MATHMASTER_FIREBASE_SERVICE_ACCOUNT_JSON',
    'MATHMASTER_FIREBASE_CLIENT_CONFIG_PATH',
    'MATHMASTER_UPDATES_TOKEN',
    'VERSION_CODE',
    'VERSION_NAME',
    'GITHUB_SHA',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Release notification configuration is missing: ${missing.join(', ')}.`);

  const manifestPath = process.env.MATHMASTER_UPDATE_MANIFEST_PATH || 'dist/updates/update.json';
  const [manifestText, serviceAccountText, clientConfigText] = await Promise.all([
    readFile(path.resolve(manifestPath), 'utf8'),
    Promise.resolve(process.env.MATHMASTER_FIREBASE_SERVICE_ACCOUNT_JSON),
    readFile(path.resolve(process.env.MATHMASTER_FIREBASE_CLIENT_CONFIG_PATH), 'utf8'),
  ]);
  const result = await sendReleaseNotification({
    manifest: JSON.parse(manifestText),
    serviceAccount: JSON.parse(serviceAccountText),
    clientConfig: JSON.parse(clientConfigText),
    sourceCommit: process.env.GITHUB_SHA,
    githubToken: process.env.MATHMASTER_UPDATES_TOKEN,
    expectedVersionCode: process.env.VERSION_CODE,
    expectedVersionName: process.env.VERSION_NAME,
  });
  if (result.skipped) {
    console.log(`Skipped duplicate/outdated release push for build ${result.versionCode}.`);
  } else {
    console.log(`FCM release notification accepted for version ${process.env.VERSION_NAME} (build ${process.env.VERSION_CODE}).`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Release push notification was not sent: ${error.message}`);
    process.exitCode = 1;
  });
}
