# Changelog

## 2026-11-20 — Screen Time widgets preserve neon-glass compositions

- Reflow Study Apps and Device Apps Screen Time inside the selected one of seven reference compositions instead of replacing legacy widget artwork with a text band.
- Add source-specific vector icons, period chips, full-source totals, compact launcher-icon rows and reserved duration columns; keep each composition's palette and white Inter typography independent of app theme/mode.
- Keep selected Study Mode apps visible at 0 min, derive Device Apps from installed inventory, exclude hidden packages from ranking and totals, and align widget aggregation with the App Usage Analytics UsageStats source.
- Repair the desktop preview compiler so Java failures are fatal, add the Android API stubs needed by the provider/configuration preview, and validate Screen Time states/styles in CI.
- Keep Screen Time opt-in under content schema 4, per-instance preferences, the single widget provider/bitmap renderer, and local-only usage data.

## 2026-11-15 — Neon-glass home-screen widgets matching the reference designs

- Redraw all seven widget compositions (Hero Wide, Compact Green, Square Math Bot, Medium Study, Square Cosmic, Extra-Wide Weekly, Minimal Progress) to follow the supplied Math Master reference images: dark glass cards with neon edge light, glowing gradient progress ring, target panel with progress bar, streak with flame, weekly Sunday-Saturday strip, and the Upcoming Quiz tile.
- Add `MathMasterWidgetRenderer`, which draws each composition with Canvas into one bitmap per launcher size, so blur, glow and gradient rings no longer depend on the launcher. The provider keeps its preferences, size handling, tap/update behaviour and sync hooks.
- Background effect choices are now Neon Glass (the reference design, default), Transparent Blur and Full Transparent; the older Glass / Compact / Minimal values map to Neon Glass, and widgets saved before the redesign switch to Neon Glass once.
- Replace the per-composition RemoteViews layouts, drawables and the 400 x 133 artwork atlas with one canvas layout and a rendered picker preview (`math_master_widget_preview.webp`); the widget now defaults to 4 x 2.
- Bundle Inter (OFL, Latin subset, with its licence) in `android-native/assets/fonts`; fall back to the system font if an asset cannot be loaded.
- The Customize Your Widget screen previews the real renderer output at the widget's own launcher size and adds an Upcoming Quiz option. Content schema is now 3 (older selections receive the tile once). The backup/restore validators (TypeScript and Java) accept the new key, schema 3 and the Neon / Blur / Transparent style values, which they previously rejected.
- Add `tools/widget-preview` (desktop Java2D stand-in for `android.graphics` plus a fake Context) to render every design and setting without a phone, and rewrite `scripts/android-widget-layout.test.mjs` for the new structure.
- Behaviour notes: the week strip shows the current calendar week instead of the last seven days; the Upcoming Quiz tile is a fixed shortcut label, not live data.

Verified here: the Node test files and the architecture regression check pass; the renderer, provider and configuration screen compile against Android API stubs, and every composition and style was drawn through the real provider on desktop. Not verified: a Gradle build, the TypeScript/vitest suites, and rendering on a physical launcher.

## 2026-10-25 — Math Space Shooter moving answer targets

- Replace the fixed answer row with independently animated answer targets that enter from above, drift and reverse horizontally within their lanes, and respawn before overlapping the player ship.
- Keep each target bound to its original answer option and active question; guide each fired laser toward that moving target while retaining the shared quiz validator.
- Improve question and answer readability with high-contrast text and a clearer question panel; preserve correct centering when reduced-motion accessibility is enabled.
- Add target-motion physics and moving-target answer-identity regression tests.
- Validate with TypeScript, architecture checks, lint, unit tests, web build, and native Android build checks.


## 2026-10-25 — Math Space Shooter mission gameplay

- Extend the existing canvas shooter with a mission briefing, persisted Easy/Medium/Hard selection, How to Play, sound setting, result screen, retry and game-selector navigation.
- Regenerate the question pool from the existing math generator using the chosen difficulty; keep the shared quiz answer validator, timer, question progression and submission callback authoritative.
- Add the 3–2–1–GO launch countdown, explicit Left/Fire/Boost/Right controls, independent Pointer Events, keyboard support, and release/cancel/focus-loss cleanup.
- Add bounded asteroid/enemy waves, ship collision damage with invulnerability, smoothed time-based boost response, score/combo/best-score saving, level transitions and boss attack/health progression.
- Add unit and interaction tests for generated difficulty pools, launch/countdown flow, projectile collision, pointer independence, duplicate rewards, shield damage, collision bounds, boost smoothing and saved settings.
- Preserve other game variants and shared quiz features. Automated CI checks are used for build and regression validation; physical-device multi-touch and measured FPS profiling remain unverified.

## 2026-10-25 — 3D Car Racing controls and multi-touch

- Replace invisible full-screen half-zone gestures with a dedicated left-side Speed hold button and right-side Left/Right steering buttons.
- Track each active pointer independently by role; release/cancel/lost-capture events affect only their own active pointer, and the latest held steering direction wins until it releases.
- Advance acceleration and continuous steering in the existing animation loop using bounded elapsed-time physics; retain coasting, max speed, road bounds and speed-driven visual effects.
- Cache screen-space control bounds to keep moving answer-gate labels from being obscured by buttons, and add alternating road-shoulder reflectors to the existing scrolling mesh without additional draw calls.
- Preserve the single 3D scene/render loop, answer-gate IDs and collision checks, current Quiz Engine answer callback, scoring, timer, progress, navigation and unrelated game modes.
- Add regressions for simultaneous Speed+steering, independent releases, stale pointer-capture events, steering priority/road bounds, speed coasting and rejected-collision recovery.

Validation passed in GitHub Actions: 57 test files / 420 tests, TypeScript typecheck, architecture regression, lint, web build, native Android debug APK compile and artifact upload. No physical-device or emulator multi-touch/FPS profiling was performed.

## 2026-10-25 — MCQ with Game completion reliability

- Automatically complete finite-question MCQ-with-Game sessions across Car Racing, Jump Adventure, Space Shooter, and Math Slice Ninja after the final non-timeout answer is accepted by the shared Quiz Engine and recorded.
- Preserve existing retry/repetition queue rules and timer behavior; timeout outcomes do not masquerade as a player-selected final answer.
- Keep Infinite sessions open until the whole-test Submit Test action is used, including when no answer has yet been recorded; do not fabricate an unanswered-question attempt.
- Add integration regression tests for finite Jump Adventure completion, Infinite mode beyond ten answers, and manual completion with zero attempts.

Validation passed: TypeScript typecheck, architecture regression checks, lint, unit tests, web build, and Android debug APK build in GitHub Actions.


## 2026-10-09 — Quiz startup and exit transition stability

- Hide the Floating Bar from the explicit quiz startup phase, before the Practice page mounts.
- Initialize Learning-origin quiz sessions before paint to prevent the setup screen from flashing.
- On confirmed exit from a Learning-origin quiz, clear session timers and navigate directly to the originating Learning context instead of rendering the Quiz Arena setup branch.
- Preserve exit confirmation cancellation, navigation history depth, and Floating Bar visibility rules.
- Add regression coverage for startup visibility, navigation phase and exit lifecycle.

Validation completed before release: TypeScript typecheck, architecture regression checks, lint, unit tests, and production web build.

## 2026-10-10 — Automatic in-app update alerts

- Check the published update manifest at app launch and again when the native app resumes or the web app returns to the foreground.
- Show installed and available version details and release notes in the existing update dialog.
- Scope “Later” dismissal to the current running session so the next launch can notify again if that build is still available.
- Recheck after returning from the Android installer, without suppressing an update if the user cancels installation.
- Keep Android package/version checks and manifest validation, and hash the downloaded APK off the UI thread before opening the Android installer.
- Add regression tests for version ordering, notification dismissal, displayed versions, and update initiation.

Background notifications while the app is fully closed are not enabled because this repository has no Firebase Cloud Messaging or equivalent push-notification configuration.


## 2026-10-24 — Game selector and math-game UI polish

- Replace the initial MCQ with Game dialog content with four compact choices: Car Racing, Jump Adventure, Space Shooter, and Math Slice Ninja; keep only Close and Start Quiz actions in the modal.
- Keep explicit game selection and guarded Start Quiz routing, preserve existing full-screen game gallery behavior, and support Escape dismissal.
- Increase math question and answer typography by 6% across the four game modes, with modest responsive question/option position adjustments.
- Add a slow, bounded five-palette Math Slice Ninja background crossfade that is independent of quiz-world state and respects reduced-motion preferences.
- Keep answer submission mapped to the existing quiz engine; shift the slice-target spawn origin within the same canvas coordinate system.
- Add regression coverage for modal contents and functional controls.
