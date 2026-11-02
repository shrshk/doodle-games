#!/usr/bin/env bash
# Build Doodle Games (the TV app) without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
# Needs JDK 17 and the Android command-line tools (build-tools 34, platform 34).
# Output: out/doodle-games-tv.apk. Install with cleanyourtv's tools/tv.py or adb install -r.
set -euo pipefail
cd "$(dirname "$0")"
SDK=${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
BT=$SDK/build-tools/34.0.0
JAR=$SDK/platforms/android-34/android.jar
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH=$JAVA_HOME/bin:$PATH

rm -rf out && mkdir -p out/classes out/gen
# A local signing key, made once and never committed (.gitignore). Updates must be signed with the same key.
if [ ! -f debug.keystore ]; then
    keytool -genkeypair -keystore debug.keystore -storepass android -keypass android \
        -alias debug -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Doodle Games" >/dev/null
fi

"$BT/aapt2" compile --dir res -o out/res.zip
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml -o out/base.apk out/res.zip --java out/gen
javac -nowarn -Xlint:-options -source 8 -target 8 -classpath "$JAR" -d out/classes $(find src out/gen -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 26 --output out $(find out/classes -name '*.class')
cp out/base.apk out/unsigned.apk
(cd out && zip -q unsigned.apk classes.dex)
"$BT/zipalign" -f 4 out/unsigned.apk out/aligned.apk
"$BT/apksigner" sign --ks debug.keystore --ks-pass pass:android --out out/doodle-games-tv.apk out/aligned.apk
echo "built $(pwd)/out/doodle-games-tv.apk"
