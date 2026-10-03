"""Offline source/grammar proof; no database connection, no claim of runtime acceptance."""
from pathlib import Path
import json,hashlib,re,subprocess,sys
import pglast
from pglast.parser import parse_plpgsql_json
d=Path(__file__).resolve().parent
subprocess.run([sys.executable,str(d/'build_candidate.py'),'--check'],check=True)
rows=json.loads((d/'live-functions.json').read_text(encoding='utf-8'))
patches=json.loads((d/'patches.json').read_text(encoding='utf-8'))
manifest=json.loads((d/'manifest.json').read_text(encoding='utf-8'))
norm=lambda s: (s if s.startswith('private.') else 'public.'+s).replace('(needs,','(public.needs,')
before={norm(r['signature']):r for r in rows}
after={k:v['body'] for k,v in before.items()}
for p in patches:
 assert after[p['signature']].count(p['before'])==1
 after[p['signature']]=after[p['signature']].replace(p['before'],p['after'],1)
for f in manifest['functions']:
 s=f['signature'];v=before[s]
 assert hashlib.md5(after[s].encode()).hexdigest()==f['after_md5']
 assert v['definition'].count(v['body'])==1
 ddl=v['definition'].replace(v['body'],after[s],1)
 pglast.parse_sql(ddl)
 # Standalone parser lacks the product composite types. Replace DECLARE types with
 # record only in the declaration section; runtime proof remains type authority.
 if 'LANGUAGE plpgsql' in ddl:
  start=ddl.index('declare');end=ddl.index('\nbegin',start)
  dec=ddl[start:end]
  dec=re.sub(r'\b(?:public|private)\.[a-z_][a-z_0-9]*(?:%rowtype)?\b','record',dec,flags=re.I)
  parse_plpgsql_json(ddl[:start]+dec+ddl[end:])
for name in ['candidate.sql','revert.sql','candidate.in-transaction.sql','postflight.readonly.sql']:
 text=(d/name).read_text(encoding='utf-8')
 pglast.parse_sql(text)
 if name!='postflight.readonly.sql':
  do=re.search(r'do \$wpp01\$(.*?)\$wpp01\$;',text,re.S).group(1)
  parse_plpgsql_json('create function f() returns void language plpgsql as $syntax$'+do+'$syntax$')
# psql admission/meta commands are client-side; parse every actual fixture SQL
# statement and every PL/pgSQL function/DO body separately, with no DB execution.
proof=(d/'profile-review.proof.sql').read_text(encoding='utf-8')
proof=proof[proof.index('\nbegin;')+1:]
proof=re.sub(r'^\\.*$', '', proof, flags=re.M)
pglast.parse_sql(proof)
for found in re.finditer(r'do (\$[a-z_]+\$)(.*?)\1;',proof,re.S):
 parse_plpgsql_json('create function f() returns void language plpgsql as $syntax$'+found.group(2)+'$syntax$')
for found in re.finditer(r'create function pg_temp\..*?\$f\$;',proof,re.S):
 parse_plpgsql_json(found.group(0))
save=after['public.rpc_save_worker_ai_review(uuid,text,uuid)']
assert save.index("value->'licenses' is distinct") < save.index('insert into public.app_profiles')
assert "perform public.rpc_save_worker_capacity(" not in save
assert "licenses=array" not in save
assert "r.base_hash<>private.worker_ai_source_hash(auth.uid())" in save
assert save.index('if found then return cmd.receipt; end if;') < save.index("value->'licenses' is distinct")
for s in after:
 if 'rpc_submit_response' in s or 'rpc_resolve_stale_response' in s:
  assert 'NEED_REMAINING_CAPACITY_EXCEEDED' in after[s]
  assert 'TEAM_CAPACITY_EXCEEDED' not in after[s]
  assert 'private.assert_application_price_v5' in after[s]
 if 'need_candidate_states' in s:
  assert "then 'OVERFILL'" in after[s] and "then 'FULL'" in after[s]
  assert 'c.version_slots>c.team_capacity' not in after[s]
for s in ['private.match_detail_without_calendar(uuid,uuid)','private.dispatch_cheap_candidate_admitted(uuid,uuid)']:
 assert 'private.lower_arr(p.tools)' in after[s]
 assert 'private.lower_arr(p.vehicles)' in after[s]
 assert 'private.lower_arr(p.licenses)' not in after[s]
print('PASS WPP01 SQL/PLpgSQL grammar and retained behavioral/source-hash boundaries; runtime proof remains pending')
