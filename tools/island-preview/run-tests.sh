#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
javac -source 8 -target 8 -d "$TMP" \
  "$ROOT/android-native/com/sudhanshu/mathsbj/StudyModeDayUsage.java" \
  "$ROOT/android-native/com/sudhanshu/mathsbj/ScreenTimeIslandSpring.java" \
  "$ROOT/android-native/com/sudhanshu/mathsbj/ScreenTimeIslandMotion.java" \
  "$ROOT/tools/island-preview/StudyModeDayUsageTest.java" \
  "$ROOT/tools/island-preview/ScreenTimeIslandMotionTest.java"
java -cp "$TMP" com.sudhanshu.mathsbj.StudyModeDayUsageTest
java -cp "$TMP" com.sudhanshu.mathsbj.ScreenTimeIslandMotionTest
