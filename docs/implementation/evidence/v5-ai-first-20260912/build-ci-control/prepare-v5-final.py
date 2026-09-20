"""Prepare the explicitly supplied frozen147+ source; does not start Gradle."""
import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
from verify_final_build_config import parse_public_config, PUBLIC_NAMES, RECOVERY

BASE_SOURCE = '6d8f640f96f2034f56c2201a0b6082b82c50841b'
CERTIFICATE = 'df2edf3f91abcb1df10eac03802ba55caedc29aee3d7188846182e0e49015782'
HELPERS = ['prepare-v5-final.py','collect-v5-final-apk.py','verify_final_build_config.py','run-v5-final.ps1']
VERIFIERS = {'verify_android_source_map.py':'daa234dac2128dc84043ac7dbee0d815f67f26370e462df3e98b908353cce887',
             'verify_hermes_composed_map.py':'da898943f99dfa6dd1ff0bf0318a093f7e98ccb01d13ad5e6143c8b71b99e6bf'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--tree', required=True)
    args = parser.parse_args()
    if not all(re.fullmatch('[0-9a-f]{40}', x) for x in [args.source,args.tree]):
        raise ValueError('EXACT_FULL_SOURCE_AND_TREE_REQUIRED')
    here = Path(__file__).resolve().parent
    root = here.parents[4]
    snapshot = Path('C:/Users/user/AppData/Local/Temp/u50').resolve()
    def git(*values):
        return subprocess.check_output(['git','-C',str(snapshot),*values],stderr=subprocess.DEVNULL).decode().strip()
    tag = 'v5-final-' + args.source[:7]
    receipt_path = here / f'build-{tag}-start.json'
    if receipt_path.exists():
        raise ValueError('EXISTING_BUILD_EVIDENCE_MUST_NOT_BE_OVERWRITTEN')
    if git('rev-parse','HEAD') != BASE_SOURCE or git('status','--porcelain'):
        raise ValueError('EXPECTED_CLEAN_VALIDATED_6D_SNAPSHOT')
    if git('rev-parse',args.source+'^{tree}') != args.tree:
        raise ValueError('SOURCE_TREE_MISMATCH')
    native_inputs = ['package.json','package-lock.json','app.json','app.config.js','modules','plugins','config','metro.config.cjs']
    if git('diff','--name-only',BASE_SOURCE,args.source,'--',*native_inputs):
        raise ValueError('NATIVE_INPUT_CHANGED_REQUIRES_REVIEWED_PREBUILD')
    expected_lock = git('rev-parse',args.source+':package-lock.json')
    for directory in [root,snapshot]:
        lock = subprocess.check_output(['git','-C',str(directory),'hash-object','--path=package-lock.json','package-lock.json']).decode().strip()
        if lock != expected_lock:
            raise ValueError('SHARED_INSTALLED_DEPENDENCY_LOCK_MISMATCH')
    def blob(path):
        return subprocess.check_output(['git','-C',str(snapshot),'show',args.source+':'+path])
    provenance = json.loads(blob('supabase/migrations/MIGRATION_PROVENANCE.json'))
    manifest = dict(reversed(line.split('  ',1)) for line in blob('supabase/migrations/MD5_MANIFEST.txt').decode().splitlines())
    for name in ['20260913081147_clean_v5_event_bound_account_erasure.sql','20260913081242_clean_v5_qa_owner_product_activation.sql']:
        raw = blob('supabase/migrations/'+name)
        record = next(x for x in provenance['pending_forward_migrations'] if x['file']==name)
        if record['raw_sha256'] != hashlib.sha256(raw).hexdigest() or record['raw_bytes'] != len(raw) or manifest[name] != hashlib.md5(raw).hexdigest():
            raise ValueError('FINAL_146_147_SOURCE_REGISTRATION_MISMATCH')
    previous = json.loads((here/'build-v5-6d8f640-receipt.json').read_text(encoding='utf8'))
    if previous['sourceCommit'] != BASE_SOURCE or not previous['certificateVerified'] or previous['expectedCertificateSha256'] != CERTIFICATE:
        raise ValueError('PREVIOUS_SIGNER_EVIDENCE_MISMATCH')
    native = previous['cacheProvenance']['generatedNativeConfigSha256']
    for name,digest in native.items():
        if hashlib.sha256((snapshot/name).read_bytes()).hexdigest() != digest:
            raise ValueError('VALIDATED_NATIVE_CACHE_CHANGED')
    for name,digest in VERIFIERS.items():
        if hashlib.sha256((here/name).read_bytes()).hexdigest() != digest:
            raise ValueError('SOURCE_ATTESTATION_HELPER_CHANGED')
    config = parse_public_config((root/'.env.local').read_text(encoding='utf-8-sig'),add_recovery=True)
    init = root/'artifacts/v5-native-smoke/limit-native-parallelism-exact-source.gradle'
    if hashlib.sha256(init.read_bytes()).hexdigest() != '1e4f2b553f35134e1ce3de529622f47ef6ea5c806942c91bef01efb960ff92e3':
        raise ValueError('EXACT_NATIVE_PARALLELISM_INIT_CHANGED')
    spec = importlib.util.spec_from_file_location('final_collector',here/'collect-v5-final-apk.py')
    renderer = importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)
    collector = renderer.render_collector((here/'collect-v5-6d8f640-apk.py').read_bytes(),tag)
    subprocess.run(['git','-C',str(snapshot),'checkout','--detach',args.source],check=True,capture_output=True)
    if git('rev-parse','HEAD') != args.source or git('status','--porcelain'):
        raise ValueError('FINAL_SNAPSHOT_NOT_EXACT_AND_CLEAN')
    subprocess.run(['node',str(snapshot/'scripts/sync-entry-reference-assets.cjs')],cwd=snapshot,check=True,capture_output=True)
    if git('status','--porcelain'):
        raise ValueError('SOURCE_GENERATION_CHANGED_TRACKED_FILES')
    (snapshot/'.env.local').write_text(''.join(key+'='+config[key]+'\n' for key in sorted(PUBLIC_NAMES)),encoding='utf8',newline='\n')
    receipt = {key:previous[key] for key in ['package','versionCode','versionName','abis','expectedCertificateSha256']}
    receipt.update(kind='LOCAL_SIGNED_FINAL_CANDIDATE_BUILD_START',sourceCommit=args.source,sourceTree=args.tree,sourceDirty=False,
        detachedSnapshot=True,snapshotPath=str(snapshot),publicBuildConfigNames=sorted(PUBLIC_NAMES),fakeSource=False,
        providerCalls=False,authSubmitted=False,liveWrites=False,releasePublished=False,paidEasBuild=False,
        finalSourceRelease=False,finalPrivateTestReady=False,backendPromotionVerified=False,liveSourceCompatibilityClaimed=False,
        backendDesignation='CANONICAL_DEV_ALPHA',backendDesignationDecision='AF-D26',backendProjectRef='leqcwgzvjsxugfgzdmth',
        recoveryRedirect=RECOVERY,backendRedirectAllowlistVerified=False,confirmationSiteUrlVerified=False,
        previousSnapshotSource=BASE_SOURCE,nativeInputsUnchanged=native_inputs,retainedGeneratedNativeConfigSha256=native,
        buildCommand='assembleRelease --no-daemon --max-workers=1 --init-script limit-native-parallelism-exact-source.gradle',excludedTasks=[],
        metroResetCache=True,expoCiMode=False,jsGraphAlwaysRegenerated=True,metroConfigGitBlob=git('rev-parse',args.source+':metro.config.cjs'),
        sourceIncludes142And143=True,sourceIncludes144=True,sourceIncludes146And147=True,
        sourceMapVerifierSha256=VERIFIERS,finalBuildHelperPins={name:hashlib.sha256((here/name).read_bytes()).hexdigest() for name in HELPERS},
        generatedCollectorSha256=hashlib.sha256(collector.encode()).hexdigest(),
        result='PREPARED_NOT_BUILT',preparedAtUtc=datetime.datetime.now(datetime.timezone.utc).isoformat())
    receipt_path.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8',newline='\n')
    (here/f'collect-{tag}-rendered.py').write_text(collector,encoding='utf8',newline='\n')
    print(json.dumps({'result':receipt['result'],'sourceCommit':args.source,'sourceTree':args.tree,'startReceipt':str(receipt_path),
                      'publicConfigNames':sorted(PUBLIC_NAMES),'backendRedirectAllowlistVerified':False}))

if __name__ == '__main__':
    main()
