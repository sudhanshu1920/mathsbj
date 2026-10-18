# Practice feedback sounds

The supplied feedback clips are bundled locally under `public/sounds/` and used by the shared Practice / Quiz answer handler.

- `right-answer.mp3` plays when an answer is correct.
- `wrong-answer.mp3` plays when an answer is incorrect.
- `submit.mp3` plays once when a finite quiz reaches completion or an infinite session is explicitly submitted. It does not replace the per-answer feedback.
- All clips respect **Settings → Sound**. When Sound is off, no clip or fallback tone plays.
- A separate audio element is reused for each cue, and an active cue is not restarted by rapid repeated submissions.
- If media playback fails or is unavailable, the existing generated tone is used as a fallback.
- Rebuild/sync the native Android APK to bundle the updated sound assets.
