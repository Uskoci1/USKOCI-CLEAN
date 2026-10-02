-- RC02 REVERT: source-only, NOT APPLIED. Owner's explicit named approval required.
-- Baseline is PKG046a + B24 PT409 conversion, tied to EX05-S02 pins.
-- Changes only public.rpc_cancel_media_upload(uuid,uuid); no DML/schema/ACL/certificate rebind.
-- Run under a serialized server-change window: no other function/schema writer concurrently.
-- In-flight callers may still be executing the old function body; this is not instant runtime acceptance.
-- Reverts the exact candidate; refuses drift and restores the old lock inversion.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
set local search_path = pg_catalog;

do $rc02$
declare
  v_sig constant text := 'public.rpc_cancel_media_upload(uuid,uuid)';
  v_expected_before constant text := '043f8cfb2cbe68e6f791e1be23ca14cc';
  v_expected_after constant text := 'bf8c24310252386d06de269fe7bc385a';
  v_from constant text := $anchor$ perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||v_uid::text||':'||p_client_request_id::text,130));
 -- RC02: preserve claim's advisory-first order, then lock conversation before asset.
 -- Re-read ownership under the lock; cancellation still does not require an editable draft.
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=v_uid for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;$anchor$;
  v_to constant text := $anchor$ perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||v_uid::text||':'||p_client_request_id::text,130));$anchor$;
  v_oid oid; v_body text; v_def text; v_expected text; v_seen text;
  v_meta jsonb; v_comment text; v_certified text; r record;
begin
  v_oid := to_regprocedure(v_sig);
  if v_oid is null then raise exception 'RC02_PREDECESSOR_MISSING' using errcode='55000'; end if;
  select p.prosrc, to_jsonb(p) - 'prosrc', obj_description(p.oid, 'pg_proc')
    into strict v_body, v_meta, v_comment from pg_proc p where p.oid=v_oid;
  if md5(v_body) is distinct from v_expected_before then
    raise exception 'RC02_REVERT_PREIMAGE_DRIFT' using errcode='55000';
  end if;
  -- Refuse changed neighboring lock/guard implementations; do not relax these pins on drift.
  for r in select * from (values
      ('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', '4f522b3df65e00f6985e50e66d388bbc'),
      ('public.rpc_remove_task_photo(uuid,uuid)', '314790f3d64a23dad70c6944896aef4e'),
      ('public.rpc_complete_media_upload_service(uuid,uuid,text)', '4526db14bb026056bc98a269330fd6ed'),
      ('private.media_assert_task_edit(uuid,uuid)', 'bc3a1a1134c4f9e9ddb1a39c2bb96cd1'),
      ('private.media_write_task_refs(public.ai_conversations,text[])', 'fc5cdbf6500529daa8e9d694360f2ec9'),
      ('private.closure_assert_open(uuid,uuid)', 'dc9bc4c718593850da4fdb49e612dbd2')
  ) as pins(signature, body_md5) loop
    select p.prosrc into v_seen from pg_proc p where p.oid=to_regprocedure(r.signature);
    if md5(v_seen) is distinct from r.body_md5 then
      raise exception 'RC02_DEPENDENCY_DRIFT: %', r.signature using errcode='55000';
    end if;
  end loop;
  v_certified := private.closure_source_digest_v5();
  if v_certified is null
    or v_certified is distinct from (select sha256 from private.closure_source_v5 where singleton)
    or v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'RC02_CERTIFICATE_NOT_READY' using errcode='55000';
  end if;
  if (length(v_body)-length(replace(v_body,v_from,''))) / length(v_from) <> 1 then
    raise exception 'RC02_ANCHOR_DRIFT' using errcode='55000';
  end if;
  v_expected := replace(v_body,v_from,v_to);
  if md5(v_expected) is distinct from v_expected_after then
    raise exception 'RC02_EXPECTED_BODY_DRIFT' using errcode='55000';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if (length(v_def)-length(replace(v_def,v_from,''))) / length(v_from) <> 1 then
    raise exception 'RC02_DEFINITION_ANCHOR_DRIFT' using errcode='55000';
  end if;
  execute replace(v_def,v_from,v_to);
  -- Byte-exact body and complete pg_proc non-body tuple + comment are preserved as specified.
  if (select p.prosrc from pg_proc p where p.oid=v_oid) is distinct from v_expected
    or (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=v_oid) is distinct from v_meta
    or obj_description(v_oid,'pg_proc') is distinct from v_comment then
    raise exception 'RC02_POSTIMAGE_OR_ATTRIBUTES_DRIFT' using errcode='55000';
  end if;
  if private.closure_source_digest_v5() is distinct from v_certified
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from v_certified
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_certified
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'RC02_CERTIFICATE_MOVED' using errcode='55000';
  end if;
end
$rc02$;
commit;
