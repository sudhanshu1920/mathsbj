# Screen Time Island desktop preview

This folder contains a desktop-JVM test harness for the pure usage aggregator,
the spring math, the Android-free motion timeline and the production Canvas
painter.

Run the pure logic checks (day usage, spring, motion timeline):

```sh
sh tools/island-preview/run-tests.sh
```

Render nine contact sheets with the real timeline and painter:

```sh
sh tools/island-preview/render-previews.sh
```

The PNGs are written to `tools/island-preview/out/` (ignored build output).
Each sheet covers one display width (360, 412 or 480 dp) and one camera position
(centered, left/corner or none). Every sheet has four scenarios (a short name
with under one minute, a 20 minute total, a very long app name with 1 hr 24 min
and 11 hr 59 min on a light background) and eight frames each: 60/120/190/280/420
ms, hold and two dismiss frames. `ScreenTimeIslandMotion` is stepped exactly like
the overlay does and `ScreenTimeIslandPainter` draws every frame, so the sheets
show what the device draws. Pass `-Disland.density=3` to the harness for sharper
sheets.

Java2D differs from Android Skia and cannot verify real display cutout insets,
system window hit testing, OEM compositor behavior, TalkBack or battery use.
Those remain real-device checks.
