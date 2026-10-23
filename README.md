# MathMaster (SBJ)

Source code for the MathMaster Android math-learning app.

## Game modes

Open **Quiz Mode → Answer Mode → MCQ with Game** and choose your game:

- **3D Math Car Racing** — the existing 3D racing game with answer gates.
- **2D Math Jump Adventure** — a colorful platformer with movement, jumping, platform physics, checkpoints, and explicit answer tiles.
- **Math Space Shooter** — pilot a spaceship, aim at a mathematical answer target, and fire a laser projectile to submit that answer.
- **Math Slice Ninja** — swipe through flying answer orbs; each valid cut splits the target and submits the selected option through the shared quiz callback.

All four games use the existing quiz question generation, answer validation, scoring, progress tracking, timers, and result flow. The Space Shooter uses the same guarded answer-submission path as the other games; aiming at a target does not itself submit an answer. A valid projectile hit submits the target's engine-mapped answer identity once. Switching games during an active quiz returns to the selector without intentionally restarting the current question or resetting quiz progress.

## Math Space Shooter controls and lifecycle

- Tap an answer target to aim, then press **FIRE** to launch a projectile. Only a projectile-target collision submits the answer.
- Hold **LEFT** or **RIGHT** to move the ship. Keyboard controls use the left/right arrows or **A/D**; **Space** fires at the selected target when the battlefield has keyboard focus.
- Active projectiles have bounded speed/lifetime and are cleaned up when they expire, leave the playfield, or the question/session changes. Swept collision checks prevent fast shots from tunnelling through answer targets.
- **Pause** freezes the simulation and configured quiz timer. Resume adjusts the timer deadline so the paused interval is not charged.
- **Restart quiz** starts a clean quiz session using the existing topic and timer configuration. It does not clear unrelated app progress.
- **Return to game selection** allows a game switch when answer processing is not in progress. The shared quiz result screen remains authoritative for completion, retry behavior, and score reporting.
- Backgrounding the app or losing window focus pauses gameplay and clears held movement. Canvas initialization failures show a retry/exit panel instead of silently leaving a blank game.

## 2D Jump Adventure controls and lifecycle

- Hold **Left** or **Right** to move; tap **Jump** to jump from a valid grounded state.
- Select one of the visible answer tiles to submit through the existing Quiz Engine. The correct/incorrect response, score and next question come from the shared quiz flow.
- **Pause** stops movement and the configured quiz timer. Resume adjusts the timer deadline so the paused interval is not charged.
- **Restart quiz** starts a clean quiz session using the existing topic and timer configuration. It does not clear unrelated app progress.
- **Return to game selector** lets you switch games when answer processing is not in progress. The completed result screen offers **Play Again** and **Back to Game Selection**.
- Falling returns the character to the last safe checkpoint. Canvas initialization failures show a retry/exit panel rather than silently leaving a blank game.
- Jump and landing cues reuse the app's existing Sound setting. Animation and sound effects do not determine answer correctness.

## Math Slice Ninja controls and lifecycle

- Swipe through a flying answer orb. Continuous collision checks account for the swipe path and target movement; a tap alone never submits.
- Each orb belongs to the active question and maps to its actual option identity. An accepted slice enters the shared Quiz Engine callback once.
- Original Canvas-rendered orb halves, bounded particles and a fading trail avoid bundling a separate Pygame runtime or assets with unclear redistribution rights.
- Pause freezes the game simulation and notifies the shared timer controller. Restart uses existing quiz configuration. Submit Test remains separate from slicing one answer.
- Sound respects the app's current Sound setting. Leaving the game cancels its animation loop and active pointer gesture.

## Personal-use signed Android APK

For a signed APK artifact without publishing a public release or update-feed entry, use the artifact-only workflow at `.github/workflows/android-apk.yml`. It runs lint and unit tests, builds the Android release APK, verifies its application ID, version and production signing certificate, calculates the APK SHA-256 checksum, and uploads the APK as the `math-master-android-release` artifact.

The artifact-only workflow can be triggered manually with `workflow_dispatch`, or by a commit to `main` whose message starts with `[BUILD_ANDROID_APK]`. Open that workflow run in GitHub Actions and download the `math-master-android-release` artifact ZIP; extract it to get the APK. Artifact retention is 14 days.

Keep the configured keystore and signing passwords in private GitHub Actions secrets. Do not commit signing credentials. Signature and package verification do not replace a real installation and gameplay test on a compatible Android device.

## Public release APK

The separate `.github/workflows/android-release.yml` workflow publishes a public release and update-feed entry. Do not use it when the goal is a personal-use APK artifact only.

Release notifications are sent only after the public update manifest and published APK asset pass checksum verification. See `docs/BACKGROUND_NOTIFICATIONS_SETUP.md` for Firebase setup requirements.
