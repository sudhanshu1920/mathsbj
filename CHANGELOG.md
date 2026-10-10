# Changelog

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
