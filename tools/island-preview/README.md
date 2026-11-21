# Screen Time Island desktop preview

This folder contains a desktop-JVM test harness for the pure usage aggregator,
spring math, and the production Canvas painter.

Run the pure logic checks:

```sh
sh tools/island-preview/run-tests.sh
```

Render nine actual-painter contact sheets:

```sh
sh tools/island-preview/render-previews.sh
```

The PNGs are written to `tools/island-preview/out/` (ignored build output).
Each sheet covers one display width (360, 412 or 480 dp) and one camera position
(centered, left/corner or none). Every sheet includes all six accent themes,
four usage values (0, 7 minutes, 1 hour 24 minutes and 11 hours 59 minutes),
short and long labels, zero-usage hours, and the 0/80/140/240/340/480/700 ms,
hold and dismiss frames. The renderer invokes `ScreenTimeIslandPainter`
directly and uses the same Java2D graphics shim as the widget preview tooling.

Java2D differs from Android Skia and cannot verify real display cutout insets,
system window hit testing, OEM compositor behavior, TalkBack or battery use.
Those remain real-device checks.
