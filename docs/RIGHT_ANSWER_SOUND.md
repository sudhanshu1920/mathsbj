# Right-answer feedback sound

The supplied right-answer audio is bundled at `public/sounds/right-answer.mp3` and is played by the shared Practice / Quiz answer handler whenever an answer is validated as correct.

- Uses the existing **Settings → Sound** preference; when Sound is off, it stays silent.
- Incorrect answers continue using the existing wrong-answer sound.
- Reuses one audio element and does not restart an active cue when answers are submitted rapidly.
- If media playback is unavailable or rejected by the device/browser, falls back to the existing generated success chime.
- The native Android APK must be rebuilt to include the new bundled sound asset.
