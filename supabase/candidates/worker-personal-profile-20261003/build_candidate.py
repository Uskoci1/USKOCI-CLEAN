"""Regenerate bounded function-only candidate from pinned live readback; never connects to DB."""
from pathlib import Path
import json, hashlib, difflib, argparse

HERE = Path(__file__).resolve().parent
rows = json.loads((HERE / "live-functions.json").read_text(encoding="utf-8"))
def sig(s):
    if not s.startswith("private."):
        s = "public." + s
    return s.replace("(needs,", "(public.needs,")
before = {sig(r["signature"]): r["body"] for r in rows}
def md5(x): return hashlib.md5(x.encode("utf-8")).hexdigest()
def sha(x): return hashlib.sha256(x.encode("utf-8")).hexdigest()
for r in rows:
    assert md5(r["body"].replace("\r\n", "\n")) == r["body_md5"]
    assert "\r" not in r["body"], "Expected exact LF predecessor bodies"
after = dict(before)
edits = []
def change(signature, old, new):
    assert after[signature].count(old) == 1, ("ANCHOR_DRIFT", signature, old)
    after[signature] = after[signature].replace(old, new, 1)
    edits.append({"signature": signature, "before": old, "after": new})
submit = "public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)"
select = "public.rpc_select_response(uuid,integer,uuid,integer,text,text)"
resolve = "public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)"
save = "public.rpc_save_worker_ai_review(uuid,text,uuid)"
match = "private.match_detail_without_calendar(uuid,uuid)"
cheap = "private.dispatch_cheap_candidate_admitted(uuid,uuid)"
change(submit, """  if p_covered_slots > v_profile.team_capacity then
    raise exception using
      errcode='22023',
      message='TEAM_CAPACITY_EXCEEDED',
      detail=format('covered=%s,teamCapacity=%s', p_covered_slots, v_profile.team_capacity);
  end if;
""", """  -- WPP01: people are committed per offer; the personal profile is not a team limit.
  -- Existing remaining-slot and pricing checks below remain authoritative.
""")
change(select, """  if v_ver.covered_slots > v_profile.team_capacity then
    raise exception 'TEAM_CAPACITY_EXCEEDED' using errcode = 'P0001',
      detail = format('covered=%s,teamCapacity=%s', v_ver.covered_slots, v_profile.team_capacity),
      hint = 'Prijava pokriva vise ljudi nego sto trenutni tim Uskocera podrzava.';
  end if;
""", """  -- WPP01: accept the people committed by this offer, subject to the
  -- existing task remaining-slot, calendar and price checks below.
""")
change(resolve, """    if v_covered > v_profile.team_capacity then
      raise exception 'TEAM_CAPACITY_EXCEEDED' using errcode='22023';
    end if;
""", """    -- WPP01: no personal-profile team limit; keep the task remaining-slot bound.
""")
for signature in ["private.need_candidate_states_v5(uuid)", "private.need_candidate_states_v5(uuid,uuid[])"]:
    change(signature, """        or cardinality(coalesce(c.skills,'{}'::text[]))<1 or c.team_capacity is null
        or c.version_slots is null or c.version_slots>c.team_capacity
""", """        or cardinality(coalesce(c.skills,'{}'::text[]))<1
        or c.version_slots is null
""")
change(cheap, """      and private.lower_arr(p.licenses) @> private.lower_arr(n.required_licenses)
""", """      -- WPP01: licenses are retired from task eligibility; historical arrays remain stored.
""")
change(match, "  svc boolean; toolsok boolean; licok boolean; vehok boolean; expok boolean;",
    "  svc boolean; toolsok boolean; vehok boolean; expok boolean;")
change(match, "  licok := private.lower_arr(p.licenses) @> private.lower_arr(n.required_licenses);\n",
    "  -- WPP01: licenses no longer participate in admission or resource ranking.\n")
change(match, "  if not licok  then hard := array_append(hard,'MISSING_REQUIRED_LICENSE'); end if;\n", "")
change(match, "  if toolsok and licok and vehok then reasons := array_append(reasons,'RESOURCES_MATCH'); rs := 15; end if;",
    "  if toolsok and vehok then reasons := array_append(reasons,'RESOURCES_MATCH'); rs := 15; end if;")
change(save, """ value:=r.envelope->'profile';
 if p.id is null then
""", """ value:=r.envelope->'profile';
 -- WPP01: legacy keys stay on the wire, but may not request a retired-field change.
 -- Compare the reviewed values exactly with the locked current profile (or bootstrap
 -- defaults). Never silently discard a change the owner just reviewed.
 if value->'licenses' is distinct from coalesce(to_jsonb(p.licenses),'[]'::jsonb)
  or value->'teamCapacity' is distinct from to_jsonb(coalesce(p.team_capacity,1))
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is null then
""")
change(save, """  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills,tools,vehicles,licenses)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills')),array(select jsonb_array_elements_text(value->'tools')),
   array(select jsonb_array_elements_text(value->'vehicles')),array(select jsonb_array_elements_text(value->'licenses'))) returning * into p;
""", """  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills,tools,vehicles)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills')),array(select jsonb_array_elements_text(value->'tools')),
   array(select jsonb_array_elements_text(value->'vehicles'))) returning * into p;
""")
change(save, """   vehicles=array(select jsonb_array_elements_text(value->'vehicles')),licenses=array(select jsonb_array_elements_text(value->'licenses')) where id=p.id;
""", """   vehicles=array(select jsonb_array_elements_text(value->'vehicles')) where id=p.id;
""")
change(save, """ perform public.rpc_save_worker_capacity(private.worker_capacity_document(p.id)->>'revision',value->'teamCapacity');
""", """ -- WPP01: preserve existing deprecated capacity; new profiles use the stored default.
""")
changed = sorted(s for s in before if before[s] != after[s])
dependencies = sorted(s for s in before if before[s] == after[s])
assert len(changed) == 8 and len(dependencies) == 4

def quote(s): return "'" + s.replace("'", "''") + "'"
def dollar(s):
    assert "$wpp_body$" not in s
    return "$wpp_body$" + s + "$wpp_body$"
def payload(reverse=False, transaction=True):
    source,target = (after,before) if reverse else (before,after)
    direction = "REVERT" if reverse else "CANDIDATE"
    prefix = f"""-- WPP01 {direction}: source-only. NOT APPLIED. Canonical DEV only after scoped approval/proof.
-- Eight function bodies; no table/trigger/ACL/schema changes, data rewrite or certificate rebind.
-- Preserve a serialized server-change window; callers already in flight may finish old bodies.
"""
    if transaction:
        prefix += "begin;\n"
    prefix += """set local lock_timeout='5s';
set local statement_timeout='180s';
set local search_path=pg_catalog;
do $wpp01$
declare
 r record; o oid; body text; expected text; def text; meta jsonb; comment_before text;
 cert text; erasure_program text;
begin
 cert:=private.closure_source_digest_v5();
 erasure_program:=private.closure_erasure_program_digest_v5();
 if cert is null or erasure_program is null
  or cert is distinct from (select sha256 from private.closure_source_v5 where singleton)
  or cert is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
  or private.retention_ai_source_ready() is distinct from true
 then raise exception 'WPP01_CERTIFICATE_NOT_READY' using errcode='55000'; end if;
 -- Read/prepare source-hash and price dependencies are deliberately unchanged.
 for r in select * from (values
"""
    prefix += ",\n".join("  ("+quote(s)+","+quote(md5(before[s]))+")" for s in dependencies)
    prefix += """) pins(signature,body_md5) loop
  if (select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure(r.signature)) is distinct from r.body_md5
  then raise exception 'WPP01_DEPENDENCY_DRIFT: %',r.signature using errcode='55000'; end if;
 end loop;
 for r in select * from (values
"""
    prefix += ",\n".join("  ("+quote(s)+","+quote(md5(source[s]))+","+quote(md5(target[s]))+","+dollar(target[s])+")" for s in changed)
    prefix += """) patches(signature,before_md5,after_md5,new_body) loop
  o:=to_regprocedure(r.signature);
  if o is null then raise exception 'WPP01_MISSING_FUNCTION: %',r.signature using errcode='55000'; end if;
  select p.prosrc,to_jsonb(p)-'prosrc',obj_description(p.oid,'pg_proc')
   into strict body,meta,comment_before from pg_proc p where p.oid=o;
  if md5(body) is distinct from r.before_md5 then
   raise exception 'WPP01_PREIMAGE_DRIFT: %',r.signature using errcode='55000'; end if;
  expected:=r.new_body;
  if md5(expected) is distinct from r.after_md5 then
   raise exception 'WPP01_PAYLOAD_DRIFT: %',r.signature using errcode='55000'; end if;
  def:=pg_get_functiondef(o);
  if (length(def)-length(replace(def,body,''))) / length(body) <> 1 then
   raise exception 'WPP01_BODY_ANCHOR_DRIFT: %',r.signature using errcode='55000'; end if;
  execute replace(def,body,expected);
  if (select p.prosrc from pg_proc p where p.oid=o) is distinct from expected
   or (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=o) is distinct from meta
   or obj_description(o,'pg_proc') is distinct from comment_before then
   raise exception 'WPP01_POSTIMAGE_OR_METADATA_DRIFT: %',r.signature using errcode='55000'; end if;
 end loop;
 if private.closure_source_digest_v5() is distinct from cert
  or private.closure_erasure_program_digest_v5() is distinct from erasure_program
  or (select sha256 from private.closure_source_v5 where singleton) is distinct from cert
  or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from cert
  or private.retention_ai_source_ready() is distinct from true
 then raise exception 'WPP01_CERTIFICATE_MOVED' using errcode='55000'; end if;
end
$wpp01$;
"""
    if transaction: prefix += "commit;\n"
    return prefix

files = {
 "candidate.sql": payload(),
 "revert.sql": payload(True),
 "candidate.in-transaction.sql": payload(transaction=False),
 "body.diff": "".join("".join(difflib.unified_diff(before[s].splitlines(True), after[s].splitlines(True), fromfile=s+" BEFORE",tofile=s+" AFTER")) for s in changed),
 "patches.json": json.dumps(edits,indent=2,ensure_ascii=False)+"\n",
 "postflight.readonly.sql": "-- Read-only metadata, no fixture data.\nselect pins.signature,pins.expected_md5,md5(p.prosrc) actual_md5,md5(p.prosrc)=pins.expected_md5 as matches\nfrom (values\n"+",\n".join(" ("+quote(s)+","+quote(md5(after[s]))+")" for s in changed)+""") pins(signature,expected_md5)
left join pg_proc p on p.oid=to_regprocedure(pins.signature);
select private.closure_source_digest_v5() as closure_digest,
 private.closure_erasure_program_digest_v5() as erasure_program_digest,
 (select sha256 from private.closure_source_v5 where singleton) as closure_certificate,
 (select sha256 from private.closure_erasure_source_v5 where singleton) as erasure_certificate,
 private.retention_ai_source_ready() as retention_ready;
"""
}
manifest = {"id":"WPP01","status":"SOURCE_ONLY_NOT_APPLIED","target":"leqcwgzvjsxugfgzdmth",
 "functions":[{"signature":s,"before_md5":md5(before[s]),"after_md5":md5(after[s])} for s in changed],
 "unchangedDependencies":[{"signature":s,"body_md5":md5(before[s])} for s in dependencies],
 "artifact_sha256":{k:sha(v) for k,v in files.items()}}
files["manifest.json"]=json.dumps(manifest,indent=2)+"\n"
parser=argparse.ArgumentParser();parser.add_argument("--check",action="store_true")
args=parser.parse_args()
for name,content in files.items():
    path=HERE/name
    if args.check:
        assert path.read_bytes()==content.encode("utf-8"), ("GENERATED_FILE_DRIFT",name)
    else:
        path.write_bytes(content.encode("utf-8"))
print("PASS WPP01 exact 8 body replacements, 4 dependencies; " + ("generated files checked" if args.check else "files generated"))

