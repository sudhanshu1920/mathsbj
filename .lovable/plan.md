# "Check for updates" → Online refresh, then works offline again

Right now the app already has a `vite-plugin-pwa` service worker (`src/pwa.ts`) that caches assets so the app opens offline. The "Check for updates" button in Settings (`src/components/SettingsPanel.tsx`) syncs cloud data and calls `registration.update()`, but it does not actually activate a downloaded new version — so users don't get the fresh build until they close and reopen the app. Also, HTML navigations are currently served cache-first from the fallback, which can make new deploys look "stuck".

Goal: pressing **Check for updates** should
1. Confirm the device is online.
2. Sync user data with the cloud.
3. Ask the service worker to fetch the newest app version.
4. If a new version is available, activate it and reload the app immediately.
5. If already current, just say "Up to date".
6. After the refresh, the app keeps working fully offline (same as before).

## Changes

### 1. `src/pwa.ts` — expose an update helper + a "reload on activation" hook
- Keep the existing guarded registration (no SW in dev/preview/iframe — unchanged).
- Store the `updateSW` function returned by `registerSW` on a module-level variable and export `triggerUpdate()`:
  - Calls `registration.update()` to fetch the newest SW.
  - If a `waiting` worker exists (or appears within a short window), calls `updateSW(true)` which posts `SKIP_WAITING` and reloads once the new SW takes control.
  - Returns one of: `'updated'` (new version activated, reload imminent), `'current'` (no new version), `'unsupported'` (no SW in this context — e.g. preview/dev), `'offline'`.
- Add a one-time `navigator.serviceWorker.addEventListener('controllerchange', …)` guard so the reload happens exactly once.
- Also export `isPWARegistered()` so the Settings button can tell whether SW-based updating is even possible.

### 2. `vite.config.ts` — make navigations NetworkFirst so updates actually land
- Add a `runtimeCaching` entry for `request.mode === 'navigate'` using `NetworkFirst` with a short network timeout (~3s) and a cache fallback named `pages`. This way:
  - Online → user always gets the latest `index.html` (which references the newest hashed JS/CSS).
  - Offline → falls back to the cached `index.html`, so offline still works.
- Keep `navigateFallback: "/index.html"` for hard offline first-loads.
- Leave `skipWaiting: false` (we activate on demand via the button), keep `clientsClaim: true`.
- Everything else (image CacheFirst, asset StaleWhileRevalidate, glob patterns) stays.

### 3. `src/components/SettingsPanel.tsx` — wire the button to the new helper
Replace the current `checkForUpdates` body with this flow (states already exist: `idle | checking | updating | done | offline`):
1. If `!navigator.onLine` → `offline` toast/label, return.
2. Set `checking`.
3. If signed in, run `pullFromCloud` + `pushToCloud` (unchanged).
4. Call `triggerUpdate()`:
   - `'updated'` → set `updating`, show "Downloading update…" label; the page will reload automatically once the new SW activates.
   - `'current'` → set `done` with label "Up to date", revert to `idle` after ~1.6s.
   - `'unsupported'` → treat like `'current'` (still show "Up to date" so the button gives feedback in preview/dev).
   - `'offline'` → set `offline` label.
5. Add a small safety timeout (~8s) so the button never stays stuck on "Downloading update…" if the SW never fires `controllerchange` — falls back to `done`.

Label map stays the same; only the "updating" copy changes to "Downloading update…".

### 4. No changes to auth, sync, streak, XP, theme, or any UI outside the Settings button.

## Result
- Online tap → cloud sync + latest HTML/JS pulled + new SW activated + one-time reload → user is on the newest version.
- Offline tap → clear "You are offline" message, no crash.
- After a successful update, the SW re-caches the new build, so closing the network still opens the app fine (offline preserved).
- No behavior change inside the Lovable preview iframe: SW stays unregistered there and the button reports "Up to date" instead of erroring.

## Out of scope
- No new manifest icons, no push notifications, no changes to the manifest fields (`start_url`, `scope`, `display`) since those are cached at install time on iOS/Android.
- No changes to how the app opens offline on first launch — that already works via the existing PWA setup.
