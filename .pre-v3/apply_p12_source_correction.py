"""One explicit owner-requested source correction; not a metadata-only admission.
No migration, live service, credentials, canonical ref, or other source path is changed.
The detached input source and current integration ref must match before a normal
(non-forced) commit/push. The resulting SHA is verified by the unchanged runner.
"""
import hashlib,json,os,re,subprocess
from pathlib import Path
config=json.loads(Path('../control/.pre-v3/run.json').read_text())
flag=config.get('applyP12OpenAIPrimary',False)
assert isinstance(flag,bool)
if not flag:
 raise SystemExit(0)
BRANCH='work/pre-v3-engine-integration-20260911'
FILE='supabase/functions/uskoci-ai-interview/index.ts'
BLOB='06b5b4079e7fefc5d3bc401a366a4b4d35781803'
def git(*args): return subprocess.check_output(['git',*args],text=True).strip()
expected=os.environ['SOURCE_SHA']
assert re.fullmatch('[a-f0-9]{40}',expected)
assert git('rev-parse','HEAD')==expected
assert git('rev-parse','HEAD^{tree}')==os.environ['SOURCE_TREE']
assert not git('status','--porcelain')
assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==expected,'INTEGRATION_HEAD_MOVED'
assert git('rev-parse','HEAD:'+FILE)==BLOB,'SOURCE_BLOB_CHANGED'
path=Path(FILE);old=path.read_bytes()
needle=b"? (geminiKey && geminiModel ? 'gemini' : openaiKey && openaiModel ? 'openai' : '') : selectedProvider;"
replacement=b"? (openaiKey && openaiModel ? 'openai' : geminiKey && geminiModel ? 'gemini' : '') : selectedProvider;"
assert old.count(needle)==1
new=old.replace(needle,replacement)
path.write_bytes(new)
assert git('diff','--name-only').splitlines()==[FILE]
subprocess.run(['git','diff','--check'],check=True)
git('config','user.name','USKOCI source continuation')
git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
subprocess.run(['git','add','--',FILE],check=True)
subprocess.run(['git','commit','-m','fix(pre-v3): prefer OpenAI before Gemini when provider is implicit','-m','Exact one-expression correction. Explicit provider settings remain authoritative. No runtime failover, repeated provider call, owned-turn architecture change, live deployment or migration.'],check=True)
assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==expected,'INTEGRATION_HEAD_MOVED'
subprocess.run(['git','push','origin','HEAD:refs/heads/'+BRANCH],check=True)
result={'inputSource':expected,'sourceCommit':git('rev-parse','HEAD'),'sourceTree':git('rev-parse','HEAD^{tree}'),'branch':BRANCH,'path':FILE,'beforeBlob':BLOB,'afterBlob':git('rev-parse','HEAD:'+FILE),'beforeSha256':hashlib.sha256(old).hexdigest(),'afterSha256':hashlib.sha256(new).hexdigest(),'metadataOnly':False,'liveChanged':False,'testVerdict':'PENDING'}
out=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';out.mkdir(exist_ok=True)
(out/'p12-source-correction.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
