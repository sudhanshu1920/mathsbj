# Changelog

## 2026-10-09 — Quiz startup and exit transition stability

- Hide the Floating Bar from the explicit quiz startup phase, before the Practice page mounts.
- Initialize Learning-origin quiz sessions before paint to prevent the setup screen from flashing.
- On confirmed exit from a Learning-origin quiz, clear session timers and navigate directly to the originating Learning context instead of rendering the Quiz Arena setup branch.
- Preserve exit confirmation cancellation, navigation history depth, and Floating Bar visibility rules.
- Add regression coverage for startup visibility, navigation phase and exit lifecycle.

Validation completed before release: TypeScript typecheck, architecture regression checks, lint, unit tests, and production web build.
