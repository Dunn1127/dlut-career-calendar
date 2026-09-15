#!/usr/bin/env bash
gradle -p android connectedDebugAndroidTest --no-daemon
test_result=$?
mkdir -p android/app/build/reports/screenshots
adb pull /sdcard/Android/data/io.github.dunn1127.dlutcalendar/files/. android/app/build/reports/screenshots/
adb logcat -d > android/app/build/reports/emulator-logcat.txt
exit "$test_result"
