# Changelog

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
