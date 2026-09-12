"""Explicit, exact-blob P12 corrections. Never a metadata-only admission.
Only the selected allowlisted path changes. No SQL, credentials, live service,
canonical ref or force push. Both operations default off and are mutually exclusive.
"""
import hashlib,json,os,re,subprocess
from pathlib import Path
config=json.loads(Path('../control/.pre-v3/run.json').read_text())
primary=config.get('applyP12OpenAIPrimary',False)
fixtures=config.get('alignP12ProviderTests',False)
assert isinstance(primary,bool) and isinstance(fixtures,bool)
assert not (primary and fixtures)
if not (primary or fixtures): raise SystemExit(0)
BRANCH='work/pre-v3-engine-integration-20260911'
if primary:
 FILE='supabase/functions/uskoci-ai-interview/index.ts'
 BLOB='06b5b4079e7fefc5d3bc401a366a4b4d35781803'
 changes=[("? (geminiKey && geminiModel ? 'gemini' : openaiKey && openaiModel ? 'openai' : '') : selectedProvider;","? (openaiKey && openaiModel ? 'openai' : geminiKey && geminiModel ? 'gemini' : '') : selectedProvider;")]
 message='fix(pre-v3): prefer OpenAI before Gemini when provider is implicit'
 detail='Exact one-expression correction. Explicit settings remain authoritative. No runtime failover, repeated provider call, owned-turn architecture change or deployment.'
else:
 FILE='supabase/proofs/ai/ai_edge_context.test.mjs'
 BLOB='1b816cec8a88edc30ac3fbff3e531648bee6cf16'
 changes=[
  ("const calls=[],logs=[],env={SUPABASE_URL:","const calls=[],logs=[],env={AI_PROVIDER:provider,SUPABASE_URL:"),
  ("test('absent selector preserves legacy Gemini-first selection and rejects client provider fields',async()=>{\n  const f=fixture();assert.equal(f.env.AI_PROVIDER,undefined);", "test('absent selector uses owner-approved OpenAI primary and rejects client provider fields',async()=>{\n  const f=fixture();delete f.env.AI_PROVIDER;assert.equal(f.env.AI_PROVIDER,undefined);"),
  ("assert.equal(new URL(providerCalls(f)[0].url).hostname,hostFor.gemini);", "assert.equal(new URL(providerCalls(f)[0].url).hostname,hostFor.openai);"),
  ("test(`legacy selection uses OpenAI when ${missing} is absent`,async()=>{\n  const f=fixture();delete f.env[missing];", "test(`implicit selection uses OpenAI when ${missing} is absent`,async()=>{\n  const f=fixture();delete f.env.AI_PROVIDER;delete f.env[missing];"),
  ("const f=fixture();delete f.env.GEMINI_MODEL;delete f.env.OPENAI_MODEL;", "const f=fixture();delete f.env.AI_PROVIDER;delete f.env.GEMINI_MODEL;delete f.env.OPENAI_MODEL;")]
 message='test(pre-v3): preserve explicit Gemini coverage and align implicit OpenAI contract'
 detail='Run34704510369 failed four historical tests tied to the superseded Gemini-first default. All26 new provider tests passed. Select the named fixture provider explicitly; implicit-selector tests remove that selector. Preserve every ownership, schema, chronology, error, no-failover and materialization assertion.'
def git(*args): return subprocess.check_output(['git',*args],text=True).strip()
expected=os.environ['SOURCE_SHA']
assert re.fullmatch('[a-f0-9]{40}',expected)
assert git('rev-parse','HEAD')==expected
assert git('rev-parse','HEAD^{tree}')==os.environ['SOURCE_TREE']
assert not git('status','--porcelain')
assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==expected,'INTEGRATION_HEAD_MOVED'
assert git('rev-parse','HEAD:'+FILE)==BLOB,'SOURCE_BLOB_CHANGED'
path=Path(FILE);old=path.read_bytes();new=old
for needle,replacement in changes:
 assert new.count(needle.encode())==1,needle
 new=new.replace(needle.encode(),replacement.encode())
path.write_bytes(new)
assert git('diff','--name-only').splitlines()==[FILE]
subprocess.run(['git','diff','--check'],check=True)
git('config','user.name','USKOCI source continuation')
git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
subprocess.run(['git','add','--',FILE],check=True)
subprocess.run(['git','commit','-m',message,'-m',detail],check=True)
assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==expected,'INTEGRATION_HEAD_MOVED'
subprocess.run(['git','push','origin','HEAD:refs/heads/'+BRANCH],check=True)
result={'inputSource':expected,'sourceCommit':git('rev-parse','HEAD'),'sourceTree':git('rev-parse','HEAD^{tree}'),'branch':BRANCH,'path':FILE,'beforeBlob':BLOB,'afterBlob':git('rev-parse','HEAD:'+FILE),'beforeSha256':hashlib.sha256(old).hexdigest(),'afterSha256':hashlib.sha256(new).hexdigest(),'metadataOnly':False,'liveChanged':False,'testVerdict':'PENDING'}
out=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';out.mkdir(exist_ok=True)
(out/'p12-source-correction.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
