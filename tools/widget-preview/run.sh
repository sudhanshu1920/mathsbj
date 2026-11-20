#!/bin/sh
# Draws every Math Master widget design on a desktop JDK. No Android SDK or phone needed.
#   sh tools/widget-preview/run.sh [output-dir]
# Output: widget_preview.png (picker preview), <design>.png (each design at its own size),
#         e2e_*.png (the real provider + a fake Context: sizes, themes, styles, content, edge cases).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${1:-$HERE/out}"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
if command -v javac >/dev/null 2>&1; then JAVAC="javac"; else JAVAC="java -m jdk.compiler/com.sun.tools.javac.Main"; fi
NATIVE="$ROOT/android-native/com/sudhanshu/mathsbj"
$JAVAC -nowarn -Xlint:none -d "$BUILD" $(find "$HERE/shim" "$HERE/stubs" "$HERE/harness" -name '*.java') \
  "$NATIVE/MathMasterWidgetRenderer.java" "$NATIVE/MathMasterHomeWidgetProvider.java" "$NATIVE/MathMasterWidgetConfigActivity.java"
mkdir -p "$OUT"
RUN="java -Djava.awt.headless=true -Dwidget.assets=$ROOT/android-native/assets/ -cp $BUILD"
$RUN com.sudhanshu.mathsbj.Preview "$OUT"
$RUN com.sudhanshu.mathsbj.MakePreview "$OUT/widget_preview.png"
$RUN com.sudhanshu.mathsbj.E2E "$OUT"
echo "Done. Images are in $OUT"
