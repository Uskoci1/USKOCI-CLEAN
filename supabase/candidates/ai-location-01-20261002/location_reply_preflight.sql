-- READ ONLY. Fresh parent readback pins use md5(pg_get_functiondef).
select p.signature,p.expected_md5,md5(pg_get_functiondef(f.oid)) as actual_md5,
 md5(pg_get_functiondef(f.oid))=p.expected_md5 as matches from (values
 ('public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)','1b0ee1adeb41d9eed168b0aea4db934c'),
 ('private.ai_need_turn_status(uuid,uuid,uuid)','f3fd671c15642b37aa8c9d7182dcb3df'),
 ('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)','ff2be465f91497787558d9d1a5cecdba'),
 ('private.need_location_review_document(uuid)','244eaa9446dbf43b36d0b8fa7dfa7837')) p(signature,expected_md5) left join pg_proc f on f.oid=to_regprocedure(p.signature);
select count(*) filter(where state='PROCESSING') as in_flight_count,
 count(*) filter(where receipt ? 'location') as location_receipt_count from private.ai_need_turn_commands;
select private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton) as closure_inventory_matches,
 private.retention_ai_source_ready() as ai_retention_source_ready;
