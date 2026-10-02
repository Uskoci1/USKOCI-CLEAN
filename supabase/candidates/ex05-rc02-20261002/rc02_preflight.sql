-- Read-only metadata preflight. NOT executed by this source-preparation task.
-- Every baseline_matches must be true before candidate application; a false pin is a STOP.
-- After candidate, target should match 043f8cfb2cbe68e6f791e1be23ca14cc; every dependency stays at its old pin.
-- Revert accepts ONLY the candidate body, not an arbitrary later fix.
begin read only;
set local statement_timeout = '30s';
set local search_path = pg_catalog;
select pins.signature, pins.expected_md5, md5(p.prosrc) as actual_md5,
       md5(p.prosrc) = pins.expected_md5 as baseline_matches,
       p.prosecdef, p.proconfig, p.proowner::regrole::text as owner, p.proacl,
       md5((to_jsonb(p)-'prosrc')::text) as non_body_catalog_md5,
       obj_description(p.oid,'pg_proc') as function_comment
from (values
  ('public.rpc_cancel_media_upload(uuid,uuid)', 'bf8c24310252386d06de269fe7bc385a'),
  ('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', '4f522b3df65e00f6985e50e66d388bbc'),
  ('public.rpc_remove_task_photo(uuid,uuid)', '314790f3d64a23dad70c6944896aef4e'),
  ('public.rpc_complete_media_upload_service(uuid,uuid,text)', '4526db14bb026056bc98a269330fd6ed'),
  ('private.media_assert_task_edit(uuid,uuid)', 'bc3a1a1134c4f9e9ddb1a39c2bb96cd1'),
  ('private.media_write_task_refs(public.ai_conversations,text[])', 'fc5cdbf6500529daa8e9d694360f2ec9'),
  ('private.closure_assert_open(uuid,uuid)', 'dc9bc4c718593850da4fdb49e612dbd2')
) as pins(signature,expected_md5)
left join pg_proc p on p.oid=to_regprocedure(pins.signature);
select private.closure_source_digest_v5() as current_digest,
       (select sha256 from private.closure_source_v5 where singleton) as closure_certificate,
       (select sha256 from private.closure_erasure_source_v5 where singleton) as erasure_certificate,
       private.retention_ai_source_ready() as retention_source_ready;
select pg_get_functiondef(to_regprocedure('public.rpc_cancel_media_upload(uuid,uuid)')) as exact_live_definition;
rollback;
