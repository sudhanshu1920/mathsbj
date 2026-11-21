#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
HERE="$ROOT/tools/island-preview"
WIDGET="$ROOT/tools/widget-preview"
OUT="${1:-$HERE/out}"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT INT TERM
if command -v javac >/dev/null 2>&1; then JAVAC="javac"; else JAVAC="java -m jdk.compiler/com.sun.tools.javac.Main"; fi
$JAVAC -nowarn -Xlint:none -d "$BUILD" \
  $(find "$WIDGET/shim" "$WIDGET/stubs" "$HERE/shim" -name '*.java') \
  "$ROOT/android-native/com/sudhanshu/mathsbj/ScreenTimeIslandSpring.java" \
  "$ROOT/android-native/com/sudhanshu/mathsbj/ScreenTimeIslandPainter.java" \
  "$HERE/IslandPainterPreview.java"
mkdir -p "$OUT"
java -Djava.awt.headless=true \
  -Disland.assets="$ROOT/android-native/assets/" \
  -cp "$BUILD" com.sudhanshu.mathsbj.IslandPainterPreview "$OUT"
