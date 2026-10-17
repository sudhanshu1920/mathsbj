# MathMaster (SBJ)

Source code for the MathMaster Android math-learning app.

## Android release APK

The signed release APK is built by the GitHub Actions workflow at `.github/workflows/android-release.yml`. The workflow verifies tests, APK identity, version, signature, and installability before publishing the release.

Release notifications are sent only after the public update manifest and the published APK asset pass checksum verification. See `docs/BACKGROUND_NOTIFICATIONS_SETUP.md` for the Firebase setup requirements.

<!-- [BUILD_APK] Release latest MathMaster Android APK after Periodic Table practice fix -->
