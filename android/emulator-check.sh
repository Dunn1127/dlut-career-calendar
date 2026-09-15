#!/usr/bin/env bash
gradle -p android connectedDebugAndroidTest --no-daemon
test_result=$?
mkdir -p android/app/build/reports/screenshots
adb pull /data/local/tmp/dlut-qa/. android/app/build/reports/screenshots/
adb logcat -d > android/app/build/reports/emulator-logcat.txt
exit "$test_result"
