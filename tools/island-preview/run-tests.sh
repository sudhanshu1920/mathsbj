#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
javac -source 8 -target 8 -d "$TMP" \
  "$ROOT/android-native/com/sudhanshu/mathsbj/StudyModeDayUsage.java" \
  "$ROOT/android-native/com/sudhanshu/mathsbj/ScreenTimeIslandSpring.java" \
  "$ROOT/tools/island-preview/StudyModeDayUsageTest.java"
java -cp "$TMP" com.sudhanshu.mathsbj.StudyModeDayUsageTest
