"""Exact readable patch admission. No live data and no branch updates here."""
import hashlib,json,os,subprocess
from pathlib import Path,PurePosixPath
CONTROL=Path(__file__).resolve().parents[1]
BASE='1138d4f727735519b15d9b834bf261954e8013fe'
def git(*args):return subprocess.check_output(['git',*args],encoding='utf8').strip()
def sha(data):return hashlib.sha256(data).hexdigest()
manifest=json.loads((CONTROL/'.pre-v3/manifest.json').read_text())
assert os.environ['GITHUB_REPOSITORY']=='Uskoci1/USKOCI-CLEAN'
assert manifest['destination']=='work/pre-v3-engine-closure-20260911'
assert git('rev-parse','HEAD')==manifest['base']
assert git('merge-base',BASE,manifest['base'])==BASE
assert not git('status','--porcelain')
# Opaque bundle carriers are deliberately never read or executed.
for row in manifest['patches']:
    p=PurePosixPath(row['path'])
    assert str(p).startswith('.pre-v3/patches/') and '..' not in p.parts and str(p).endswith('.patch')
    data=(CONTROL/p).read_bytes();assert sha(data)==row['sha256'],'PATCH_HASH:'+str(p)
    subprocess.run(['git','apply','--check','--index',str(CONTROL/p)],check=True)
    subprocess.run(['git','apply','--index',str(CONTROL/p)],check=True)
changed=git('diff','--cached','--name-only').splitlines()
assert sorted(changed)==sorted(manifest['files']),'PATCH_FILE_SET'
for file,expected in manifest['files'].items():
    assert file.startswith(('src/','supabase/')) and '..' not in PurePosixPath(file).parts
    assert not Path(file).is_symlink()
    assert sha(Path(file).read_bytes())==expected,'FILE_HASH:'+file
for file in git('ls-tree','-r','--name-only',BASE,'supabase/migrations').splitlines():
    if file.endswith('.sql'):
        assert Path(file).read_bytes()==subprocess.check_output(['git','show',f'{BASE}:{file}']),file
for file in ['package.json','package-lock.json']:
    assert Path(file).read_bytes()==subprocess.check_output(['git','show',f'{BASE}:{file}']),file
mdir=Path('supabase/migrations');mp=mdir/'MIGRATION_PROVENANCE.json';m=json.loads(mp.read_text())
old=json.loads(subprocess.check_output(['git','show',f'{BASE}:{mp}']))
assert m==old
for f in sorted(mdir.glob('2026091117*.sql')):
    data=f.read_bytes();assert f.name in manifest['newMigrations']
    m['pending_forward_migrations'].append({'version':f.name[:14],'name':f.name[15:-4],'file':f.name,
      'classification':'PENDING_FORWARD_MIGRATION','raw_md5':hashlib.md5(data).hexdigest(),'sha256':sha(data),'bytes':len(data),
      'live_applied':False,'predecessor_live_migration_count':m['live_history_snapshot']['migration_count'],
      'predecessor_live_head':m['live_history_snapshot']['last']['version'],
      'note':'PRE-V3 candidate; historic87 field is the existing replay manifest, NOT current live108 observation. Apply only after exact108 admission and per-package rollout gates.'})
mp.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
(mdir/'MD5_MANIFEST.txt').write_text(''.join(hashlib.md5(f.read_bytes()).hexdigest()+'  '+f.name+'\n' for f in sorted(mdir.glob('*.sql'))))
subprocess.run(['git','add',str(mp),str(mdir/'MD5_MANIFEST.txt')],check=True)
subprocess.run(['git','diff','--cached','--check'],check=True)
git('config','user.name','USKOCI owner-authorized candidate runner');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
subprocess.run(['git','commit','-m','P01-P03: converge Worker fact writers and add owned capacity\n\nExact readable patch hashes and existing migration bytes verified before commit. SQL runtime and source CI verdicts are separate run artifacts. No live migration, canonical merge or V3 redesign.'],check=True)
head=git('rev-parse','HEAD')
with open(os.environ['GITHUB_ENV'],'a') as out:out.write('PRE_V3_SOURCE_SHA='+head+'\n')
evidence=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';evidence.mkdir(exist_ok=True)
(evidence/'candidate.json').write_text(json.dumps({'sourceSha':head,'sourceTree':git('rev-parse','HEAD^{tree}'),'base':manifest['base'],
 'pr101':BASE,'files':manifest['files'],'liveChanged':False,'deviceProven':False,'providerProven':False},indent=2)+'\n')
print('PRE_V3_SOURCE_SHA='+head)
