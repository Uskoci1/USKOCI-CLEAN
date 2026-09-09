#!/usr/bin/env bash
set -euo pipefail
[[ "${EXPO_PUBLIC_SUPABASE_URL:-}" == 'http://127.0.0.1:54321' ]] || { echo 'Non-local Auth refused'; exit 1; }
[[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]] || { echo 'Disposable public key missing'; exit 1; }
# These changes belong only to this disposable runner, never canonical app.json.
python3 - <<'PY'
import json,pathlib
path=pathlib.Path('app.json'); data=json.loads(path.read_text()); app=data['expo']
assert app['scheme']=='uskociapp'
app['name']='USKOČI W01 TEST'
app['android']['package']='rs.uskoci.w01proof'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
PY
export EXPO_PUBLIC_SUPABASE_URL='http://10.0.2.2:54321'
export EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL='uskociapp://oporavak'
npx expo prebuild --platform android --no-install --clean
python3 - <<'PY'
import pathlib
p=pathlib.Path('android/app/build.gradle'); text=p.read_text(); assert 'react {' in text
p.write_text(text.replace('react {', 'react {\n    debuggableVariants = []', 1))
p=pathlib.Path('android/app/src/main/AndroidManifest.xml'); text=p.read_text(); assert '<application ' in text
if 'android:usesCleartextTraffic=' not in text:
    text=text.replace('<application ', '<application android:usesCleartextTraffic="true" ', 1)
p.write_text(text)
p=pathlib.Path('android/gradle.properties')
with p.open('a') as f:
    f.write('\norg.gradle.daemon=false\norg.gradle.parallel=false\norg.gradle.workers.max=2\n')
    f.write('org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m\nreactNativeArchitectures=x86_64\n')
PY
(cd android && ./gradlew :app:assembleDebug --no-daemon --max-workers=2 --console=plain)
test -f android/app/build/outputs/apk/debug/app-debug.apk
mkdir -p artifacts/w01-auth-recovery-native
sha256sum android/app/build/outputs/apk/debug/app-debug.apk > artifacts/w01-auth-recovery-native/apk-sha256.txt
# Keep the exact public proof overrides; never retain keystores or Auth tokens.
cp app.json artifacts/w01-auth-recovery-native/proof-app-config.json
