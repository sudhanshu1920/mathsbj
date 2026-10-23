# MathMaster (SBJ)

Source code for the MathMaster Android math-learning app.

## Game modes

Open **Quiz Mode → Answer Mode → MCQ with Game** to choose between two games:

- **3D Math Car Racing** — the existing 3D racing game with answer gates.
- **2D Math Jump Adventure** — a colorful platformer with movement, jumping, platform physics, checkpoints, and explicit answer tiles.

Both games use the existing quiz question generation, answer validation, scoring, progress tracking, timers, and result flow. Switching games during an active quiz returns to the selector without intentionally restarting the current question or resetting quiz progress.

## Personal-use signed Android APK

For a signed APK artifact without publishing a public release or update-feed entry, use the artifact-only workflow at `.github/workflows/android-apk.yml`. It runs lint and unit tests, builds the Android release APK, verifies its application ID, version and production signing certificate, calculates the APK SHA-256 checksum, and uploads the APK as the `math-master-android-release` artifact.

The artifact-only workflow can be triggered manually with `workflow_dispatch`, or by a commit to `main` whose message starts with `[BUILD_ANDROID_APK]`. Open that workflow run in GitHub Actions and download the `math-master-android-release` artifact ZIP; extract it to get the APK. Artifact retention is 14 days.

Keep the configured keystore and signing passwords in private GitHub Actions secrets. Do not commit signing credentials. Signature and package verification do not replace a real installation and gameplay test on a compatible Android device.

## Public release APK

The separate `.github/workflows/android-release.yml` workflow publishes a public release and update-feed entry. Do not use it when the goal is a personal-use APK artifact only.

Release notifications are sent only after the public update manifest and published APK asset pass checksum verification. See `docs/BACKGROUND_NOTIFICATIONS_SETUP.md` for Firebase setup requirements.
