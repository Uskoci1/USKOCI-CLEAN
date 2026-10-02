#!/usr/bin/env bash
# EX-07 S03: build a separately identified x86_64 APK of the CURRENT source for the disposable emulator, bound to the disposable
# local Auth (10.0.2.2:54321). Not a store artifact, never talks to the canonical DEV project. The package is rs.uskoci.ex07s03proof
# so that nothing else on the emulator, and no real installation, is ever touched.
#
# Run by the native-apk job AFTER `npm ci` (which ran patch-package) and `node scripts/verify-native-patches.cjs`.
# EX07_S03_APK_VARIANT=release (default, the recipe of p6-native-apk.yml: assembleRelease) | debug (the recipe of W01: assembleDebug
# with JS bundled). Both are made DEBUGGABLE (android:debuggable) so the proof can read the app's private storage through `run-as`
# on the disposable emulator; whether that took effect is recorded in debuggable.txt and re-checked by the emulator step.
set -euo pipefail
[[ "${EXPO_PUBLIC_SUPABASE_URL:-}" == 'http://10.0.2.2:54321' ]] || { echo 'Non-local Auth refused'; exit 1; }
[[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]] || { echo 'Disposable public key missing'; exit 1; }
[[ "${EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL:-}" == 'uskociapp://oporavak' ]] || { echo 'Recovery redirect must be the native one'; exit 1; }
[[ "${EXPO_PUBLIC_SUPABASE_URL}" != *leqcwgzvjsxugfgzdmth* ]] || { echo 'Canonical DEV endpoint in a disposable proof build'; exit 1; }
VARIANT="${EX07_S03_APK_VARIANT:-release}"
OUT="${EX07_S03_APK_OUT:-/tmp/ex07-s03-apk}"
case "$VARIANT" in release|debug) ;; *) echo "EX07_S03_APK_VARIANT must be release or debug"; exit 1 ;; esac
mkdir -p "$OUT"
# These changes belong only to this disposable runner, never to the canonical app.json.
python3 - <<'PY'
import json, pathlib
path = pathlib.Path('app.json')
data = json.loads(path.read_text(encoding='utf-8'))
app = data['expo']
assert app['scheme'] == 'uskociapp'
app['name'] = 'USKOCI EX07 S03 TEST'
app['android']['package'] = 'rs.uskoci.ex07s03proof'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY
npx expo prebuild --platform android --no-install --clean
python3 - <<'PY'
import pathlib
manifest = pathlib.Path('android/app/src/main/AndroidManifest.xml')
text = manifest.read_text(encoding='utf-8')
assert '<application ' in text
added = []
for attribute in ('android:usesCleartextTraffic', 'android:debuggable'):
    if attribute + '=' not in text:
        added.append(attribute + '="true"')
if added:
    text = text.replace('<application ', '<application ' + ' '.join(added) + ' ', 1)
manifest.write_text(text, encoding='utf-8')
assert 'android:usesCleartextTraffic="true"' in manifest.read_text(encoding='utf-8')
props = pathlib.Path('android/gradle.properties')
lines = [l for l in props.read_text(encoding='utf-8').splitlines()
         if not l.startswith(('org.gradle.jvmargs=', 'reactNativeArchitectures=', 'org.gradle.daemon=', 'org.gradle.parallel=', 'org.gradle.workers.max='))]
lines += ['org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8', 'reactNativeArchitectures=x86_64',
          'org.gradle.daemon=false', 'org.gradle.parallel=false', 'org.gradle.workers.max=2']
props.write_text('\n'.join(lines) + '\n', encoding='utf-8')
PY
if [[ "$VARIANT" == 'debug' ]]; then
  python3 - <<'PY'
import pathlib
path = pathlib.Path('android/app/build.gradle')
text = path.read_text(encoding='utf-8')
assert 'react {' in text
path.write_text(text.replace('react {', 'react {\n    debuggableVariants = []', 1), encoding='utf-8')
PY
  (cd android && NODE_ENV=production ./gradlew :app:assembleDebug --no-daemon --max-workers=2 --console=plain)
  BUILT=android/app/build/outputs/apk/debug/app-debug.apk
else
  (cd android && NODE_ENV=production ./gradlew assembleRelease --no-daemon --max-workers=2 -x lintVitalAnalyzeRelease)
  BUILT=android/app/build/outputs/apk/release/app-release.apk
fi
test -f "$BUILT"
cp "$BUILT" "$OUT/USKOCI-EX07-S03-x86_64.apk"
(cd "$OUT" && sha256sum USKOCI-EX07-S03-x86_64.apk > USKOCI-EX07-S03-x86_64.apk.sha256)
git rev-parse HEAD > "$OUT/apk-source.txt"
echo "$VARIANT" > "$OUT/variant.txt"
AAPT="$(find "$ANDROID_HOME/build-tools" -type f -name aapt | sort | tail -1)"
"$AAPT" dump badging "$OUT/USKOCI-EX07-S03-x86_64.apk" > "$OUT/badging-full.txt"
head -1 "$OUT/badging-full.txt" | tee "$OUT/badging.txt"
grep -F "package: name='rs.uskoci.ex07s03proof'" "$OUT/badging.txt"
if grep -q '^application-debuggable' "$OUT/badging-full.txt"; then echo true > "$OUT/debuggable.txt"; else echo false > "$OUT/debuggable.txt"; echo '::warning::the proof APK is not debuggable: the emulator proof cannot read the app private storage (run-as) and will report those checks as UNAVAILABLE; retry with EX07_S03_APK_VARIANT=debug'; fi
unzip -l "$OUT/USKOCI-EX07-S03-x86_64.apk" | grep -F 'lib/x86_64/' > "$OUT/abi.txt"
if unzip -l "$OUT/USKOCI-EX07-S03-x86_64.apk" | grep -q -E 'lib/(arm64-v8a|armeabi-v7a|x86/)'; then echo 'x86_64-only APK expected'; exit 1; fi
# What the bundle really carries: the disposable endpoint, both redirects, and no canonical hostname.
BUNDLE="$(find android/app/build/generated/assets -type f -name 'index.android.bundle' | head -n 1)"
test -n "$BUNDLE"
grep -aF 'http://10.0.2.2:54321' "$BUNDLE" >/dev/null
grep -aF 'uskociapp://oporavak' "$BUNDLE" >/dev/null
grep -aF 'uskociapp://auth?form=login' "$BUNDLE" >/dev/null
grep -aF "$EXPO_PUBLIC_SUPABASE_ANON_KEY" "$BUNDLE" >/dev/null
if grep -aF 'leqcwgzvjsxugfgzdmth.supabase.co' "$BUNDLE" >/dev/null; then echo 'canonical hostname inside the proof bundle'; exit 1; fi
echo "PASS EX07_S03_APK_BOUND variant=$VARIANT package=rs.uskoci.ex07s03proof abi=x86_64 endpoint=http://10.0.2.2:54321 source=$(cat "$OUT/apk-source.txt") debuggable=$(cat "$OUT/debuggable.txt")"
