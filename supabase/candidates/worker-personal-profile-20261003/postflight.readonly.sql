-- Read-only metadata, no fixture data.
select pins.signature,pins.expected_md5,md5(p.prosrc) actual_md5,md5(p.prosrc)=pins.expected_md5 as matches
from (values
 ('private.dispatch_cheap_candidate_admitted(uuid,uuid)','e51de37e0883fcd3cd4e6e3c42fb6ee1'),
 ('private.match_detail_without_calendar(uuid,uuid)','ef5de901069c1a8cfa729cfb6bbadde9'),
 ('private.need_candidate_states_v5(uuid)','112ed258e838b2cae22b248ac94ebe7c'),
 ('private.need_candidate_states_v5(uuid,uuid[])','20092ecb2a781776ddb0ce9c46ba8aa5'),
 ('public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)','9634b0333c3bd5dab208286f04d8e556'),
 ('public.rpc_save_worker_ai_review(uuid,text,uuid)','a4edfd4c708587bd4b57c0241d6b8cc8'),
 ('public.rpc_select_response(uuid,integer,uuid,integer,text,text)','6a8fd871a60779bc438119b21a900dca'),
 ('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)','66aab6df0d625e24e0073c27bfe2aa91')) pins(signature,expected_md5)
left join pg_proc p on p.oid=to_regprocedure(pins.signature);
select private.closure_source_digest_v5() as closure_digest,
 private.closure_erasure_program_digest_v5() as erasure_program_digest,
 (select sha256 from private.closure_source_v5 where singleton) as closure_certificate,
 (select sha256 from private.closure_erasure_source_v5 where singleton) as erasure_certificate,
 private.retention_ai_source_ready() as retention_ready;
