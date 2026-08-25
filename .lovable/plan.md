# Full Offline Pre-Cache on First Launch + Auto-Update Online

Goal: on the very first visit, quietly download and cache everything the app needs (all screens, formula/trig content, fonts, icons), so every later launch opens instantly with zero network calls. When the internet is available, a newer version is fetched and applied automatically in the background.

## What you'll notice

- First launch: app works right away, and a background pre-cache finishes within a few seconds.
- After that: opening the app offline shows every screen — Learning, Formulas, Trigonometry, Percentage, Practice, Progress, Settings — with correct fonts and math symbols, no blank areas.
- When you're online, the app silently picks up the newest version and uses it on the next open (no manual "Check for updates" needed, that button stays).

## Work items

### 1. Precache everything the build produces
- Extend the service worker precache list so all built chunks are included, not just the initially loaded ones: lazy screens (Practice, Progress), Formulas/Trigonometry/Percentage sub-views, and the KaTeX bundle and its CSS.
- Raise the precache file-size limit so the KaTeX chunk isn't silently skipped.
- Include icons, manifest, and favicon.

### 2. Self-host / cache the fonts
- Google Fonts are loaded from a remote stylesheet today, so offline first paint falls back to system fonts.
- Add runtime caching rules (CacheFirst, long expiry) for `fonts.googleapis.com` and `fonts.gstatic.com`, plus KaTeX font files if any are fetched separately, so fonts survive offline.

### 3. Warm the lazy chunks on first launch
- After first paint (idle callback), preload the lazy route/component chunks in the background so they land in the precache/HTTP cache even if the user never opens those screens in session one.
- Keep it non-blocking; skip entirely when the device is offline or on a metered/save-data connection.

### 4. Automatic update when online
- Keep `registerType: "autoUpdate"` with NetworkFirst HTML so a new deploy is detected.
- On app start, on regaining focus, and on the `online` event, check for a new service worker; when one is ready, activate it and reload once (existing `controllerchange` logic).
- Show a small non-blocking toast when an update is applied; nothing changes for offline users.

### 5. Verify
- Build, then run a scripted browser check: load once, go offline, reload, and navigate every screen (including Formulas/Trig) confirming no failed requests and correct fonts/math rendering.

## Technical notes

- `vite.config.ts` → `VitePWA.workbox`: widen `globPatterns` to include `woff`/`woff2`/`json`, set `maximumFileSizeToCacheInBytes` (~5 MB), add `runtimeCaching` entries for the two Google Fonts origins.
- New `src/lib/precache.ts`: idle-time dynamic `import()` warmers for the lazy modules; called from `src/main.tsx` after `setupPWA()`.
- `src/pwa.ts`: reuse existing `triggerUpdate()`; add the automatic check on `online`/`focus` (partly present) and keep the single-reload guard.
- Offline behavior only works in the published app, not the editor preview (service workers are disabled there by design).
- No backend, schema, or game-logic changes.
