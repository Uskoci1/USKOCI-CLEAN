"""Verify the standalone APK's exact source, existing signer and public identity."""
import hashlib
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import zipfile
from PIL import Image
from verify_hermes_composed_map import verify_composed_source_map

here = pathlib.Path(__file__).resolve().parent
root = here.parents[4]
receipt = json.loads((here / 'build-v5-6d8f640-start.json').read_text(encoding='utf-8'))
snapshot = pathlib.Path(receipt['snapshotPath'])
apk = snapshot / 'android/app/build/outputs/apk/release/app-release.apk'
log = root / 'artifacts/v5-native-smoke/v5-6d8f640-gradle.log'
body = log.read_text(encoding='utf-8-sig', errors='replace')
assert receipt['fullGradleExitCode'] == 0
assert 'BUILD SUCCESSFUL in ' in body and 'BUILD FAILED' not in body
assert subprocess.check_output(['git', '-C', str(snapshot), 'status', '--porcelain']).decode().strip() == ''
for revision, expected in [('HEAD', receipt['sourceCommit']), ('HEAD^{tree}', receipt['sourceTree'])]:
    assert subprocess.check_output(['git', '-C', str(snapshot), 'rev-parse', revision]).decode().strip() == expected
composition = verify_composed_source_map(snapshot, receipt['sourceCommit'], root / 'vendor/decode-uri-component-compat')
source_map_evidence = [composition.pop('packagerAttestation'), composition]
os.environ['JAVA_HOME'] = 'C:/Program Files/Microsoft/jdk-17.0.20.8-hotspot'
build_tools = pathlib.Path('C:/Users/user/AppData/Local/Android/Sdk/build-tools/36.0.0')
verified = subprocess.check_output(['cmd.exe', '/d', '/c', str(build_tools / 'apksigner.bat'), 'verify', '--print-certs', str(apk)], stderr=subprocess.STDOUT).decode()
certificate = re.findall(r'certificate SHA-256 digest: ([0-9a-f]+)', verified)
assert certificate == [receipt['expectedCertificateSha256']]
badging = subprocess.check_output([str(build_tools / 'aapt.exe'), 'dump', 'badging', str(apk)]).decode()
assert "name='rs.uskoci.preview'" in badging and "versionCode='35'" in badging and "versionName='1.0.0'" in badging
assert "sdkVersion:'24'" in badging and "targetSdkVersion:'36'" in badging
with zipfile.ZipFile(apk) as archive:
    config = json.loads(archive.read('assets/app.config'))
    identity = config['extra']['uskociBuild']
    assert identity['sourceCommit'] == receipt['sourceCommit'] and identity['sourceDirty'] is False
    assert identity['backendTarget'] == 'canonical'
    bundle = archive.read('assets/index.android.bundle')
    assert bundle[:8] == bytes.fromhex('c61fbc03c103191f')
    assert bundle == (snapshot / 'android/app/build/generated/assets/react/release/index.android.bundle').read_bytes()
    # AAPT optimizes resource names. Match the original pixels instead of assuming
    # descriptive filenames survive release resource processing.
    images = [name for name in archive.namelist() if name.endswith(('.webp', '.png', '.jpg', '.jpeg')) and not name.endswith('.9.png')]
    portrait_evidence = []
    original_assets = snapshot / 'assets/brand/entry-v49'
    provenance = json.loads((original_assets / 'provenance.json').read_text(encoding='utf-8'))
    for original in provenance['assets'][:2]:
        source_bytes = (original_assets / original['name']).read_bytes()
        assert hashlib.sha256(source_bytes).hexdigest() == original['sha256']
        source_pixels = Image.open(io.BytesIO(source_bytes)).convert('RGBA')
        matched = []
        for name in images:
            candidate_bytes = archive.read(name)
            candidate = Image.open(io.BytesIO(candidate_bytes))
            if candidate.size == source_pixels.size and candidate.convert('RGBA').tobytes() == source_pixels.tobytes():
                matched.append((name, candidate_bytes))
        assert len(matched) == 1, f'Exactly one pixel-preserved original must be packaged: {original["name"]}'
        packaged_path, packaged_bytes = matched[0]
        portrait_evidence.append({'source': original['name'], 'sourceSha256': original['sha256'],
            'packagedPath': packaged_path, 'packagedSha256': hashlib.sha256(packaged_bytes).hexdigest(),
            'samePixels': True, 'sameBytes': source_bytes == packaged_bytes, 'dimensions': source_pixels.size})
destination = root.parent / 'USKOCI-V5-AI-FIRST-6d8f640.apk'
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
if destination.exists(): assert hashlib.sha256(destination.read_bytes()).hexdigest() == digest
tasks = re.search(r'(\d+) actionable tasks: ([^\r\n]+)', body)
assert tasks, 'Gradle must report its final task totals.'
task_counts = {'actionable': int(tasks[1])}
for label, phrase in [('executed', 'executed'), ('upToDate', 'up-to-date'), ('fromCache', 'from cache')]:
    found = re.search(r'(\d+) ' + phrase, tasks[2])
    task_counts[label] = int(found[1]) if found else 0
assert sum(task_counts[key] for key in ['executed', 'upToDate', 'fromCache']) == task_counts['actionable']
receipt.update(kind='LOCAL_SIGNED_COMPLETE_SOURCE_CHECKPOINT_APK', result='BUILD_VERIFIED_PENDING_NATIVE_AUDIT', apkPath=str(destination),
    apkSha256=digest, apkBytes=apk.stat().st_size, certificateVerified=True,
    buildElapsed=re.search(r'BUILD SUCCESSFUL in ([^\r\n]+)', body)[1],
    gradleTasks=task_counts, fullGradleExitCode=0, rawBuildLogSha256=hashlib.sha256(log.read_bytes()).hexdigest(),
    embeddedSourceIdentity=identity, embeddedHermesBundle=True, sourceMaps=source_map_evidence,
    embeddedHermesSha256=hashlib.sha256(bundle).hexdigest(), bundledOriginalPortraits=portrait_evidence,
    nativeMinSdk=24, nativeTargetSdk=36, physicalMicrophoneProven=False, physicalGpsProven=False,
    supersededBuildAttempts=[
        {'sourceCommit': 'd6d19a95ae03e8c17ee02551bde614d7e19c0fcf', 'result': 'WINDOWS_NINJA_PATH_FAILURE',
         'elapsed': '4m2s', 'tasks': 174, 'log': 'artifacts/v5-native-smoke/entry-d6d19a9-gradle.log'},
        {'sourceCommit': 'd6d19a95ae03e8c17ee02551bde614d7e19c0fcf', 'result': 'INTERRUPTED_FOR_RESOURCE_CONTENTION',
         'log': 'artifacts/v5-native-smoke/entry-d6d19a9-gradle-attempt2.log',
         'recovery': 'New reviewed source, fresh short snapshot and bounded Ninja pools. No tasks excluded.'},
        {'sourceCommit': '4a06c9cd5b169d029f6a085f1a809e80aa8c28c1', 'result': 'REJECTED_MIXED_ROUTER_SOURCE',
         'fullGradleExit': 0, 'elapsed': '1h34m24s', 'actionableTasks': 717,
         'evidence': 'artifacts/v5-native-smoke/rejected-4a06c9c-mixed-router-source/receipt.json',
         'recovery': 'Same source/path/native inputs. Reset Metro transform cache and verify both complete first-party source maps against exact Git blobs.'},
        {'sourceCommit': '4a06c9cd5b169d029f6a085f1a809e80aa8c28c1', 'result': 'REJECTED_CI_DISABLED_REQUESTED_CACHE_RESET',
         'fullGradleExit': 0, 'elapsed': '7m21s', 'actionableTasks': 717,
         'evidence': 'artifacts/v5-native-smoke/rejected-4a06c9c-ci-reset-disabled/receipt.json',
         'recovery': 'Expo CI mode false, verified via installed env parser; force JS graph regeneration while preserving native inputs.'}])
receipt['supersededBuildAttempts'].append({'sourceCommit':'4a06c9cd5b169d029f6a085f1a809e80aa8c28c1', 'result':'FAILED_AAPT_INVALID_ASSET_EXTENSION', 'evidence':'artifacts/v5-native-smoke/rejected-4a06c9c-invalid-asset/receipt.json', 'installed':False})
init = root / 'artifacts/v5-native-smoke/limit-native-parallelism-exact-source.gradle'
pool_evidence = []
native_roots = [snapshot / 'android/app/.cxx'] + [root / 'node_modules' / name / 'android/.cxx' for name in
    ['expo-modules-core', 'react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler', 'react-native-screens']]
for native_root in native_roots:
    observed_abis = set()
    for build in native_root.rglob('build.ninja'):
        content = build.read_text(encoding='utf-8')
        if 'pool = uskoci_compile' not in content: continue
        rules = (build.parent / 'CMakeFiles/rules.ninja').read_text(encoding='utf-8')
        assert re.search(r'pool uskoci_compile\s+depth = 2', rules)
        assert re.search(r'pool uskoci_link\s+depth = 1', rules)
        observed_abis.add(build.parent.name)
        pool_evidence.append({'file': str(build), 'sha256': hashlib.sha256(build.read_bytes()).hexdigest(),
                              'compilePoolBindings': content.count('pool = uskoci_compile'),
                              'linkPoolBindings': content.count('pool = uskoci_link')})
    assert {'arm64-v8a', 'x86_64'} <= observed_abis, f'Both bounded native ABIs must be observed: {native_root}'
assert len(pool_evidence) >= 12, 'All six local native builds must expose both bounded ABI pools.'
receipt['localParallelism'] = {'gradleWorkers': 1, 'cmakeBuildParallelLevel': 2, 'compilePoolDepth': 2, 'linkPoolDepth': 1,
    'metroWorkers': 2, 'metroResetCache': True, 'expoCiMode': False, 'jsGraphAlwaysRegenerated': True,
    'initialNativeInitSha256': '99efc968c3cc1058313e02d203190a4a67eb3ecff1a2aaa49854e48e9db4ff0e',
    'initSha256': hashlib.sha256(init.read_bytes()).hexdigest(), 'effectiveGeneratedNinjaPools': pool_evidence}
receipt['cacheProvenance'] = {
    'snapshotPath': str(snapshot),
    'dependencyDirectory': str((snapshot / 'node_modules').resolve()),
    'gitInputObjects': {path: subprocess.check_output(['git', '-C', str(snapshot), 'rev-parse',
        receipt['sourceCommit'] + ':' + path]).decode().strip() for path in
        ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'modules/uskoci-voice']},
    'generatedNativeConfigSha256': {path: hashlib.sha256((snapshot / path).read_bytes()).hexdigest()
        for path in ['android/build.gradle', 'android/app/build.gradle', 'android/gradle.properties',
                     'android/settings.gradle', 'android/app/src/main/AndroidManifest.xml']},
    'normalGradleTasksExecuted': True,
    'excludedTasks': [],
    'cacheReuseForFutureSourceRequiresNewGitIdentityAndBundleVerification': True,
}
if not destination.exists(): shutil.copy2(apk, destination)
(here / 'build-v5-6d8f640-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: receipt[key] for key in ['result', 'sourceCommit', 'sourceTree', 'apkPath', 'apkSha256', 'apkBytes', 'certificateVerified', 'buildElapsed', 'gradleTasks', 'bundledOriginalPortraits']}))
