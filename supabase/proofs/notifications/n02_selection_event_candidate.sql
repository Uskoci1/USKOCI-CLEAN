-- N02: successful Selection -> selected Worker's durable RESPONSE_SELECTED.
-- PROOF-ONLY CANDIDATE. Not an applied or production-admitted migration.
-- Exact current P0D03 predecessor; no historical backfill or replay-side effects.
-- Production requires a separately reviewed forward migration and promotion.
begin;
do $n02_candidate$
declare
  v_oid regprocedure := to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)');
  v_def text;
  v_body text;
  v_anchor text := E'\n  return v_agreement_id;\nend;\n';
  v_event text := $n02_event$
  -- N02: domain event shares the Selection/Agreement/activation transaction.
  -- Preferences, suppression and channel dedupe remain owned by emit_event.
  perform private.emit_event(
    v_resp.worker_account_id, 'WORKER', 'RESPONSE_SELECTED',
    'RESPONSE', v_resp.id, v_ver.version,
    'Vaša prijava je izabrana', 'Otvorite Dogovor za detalje zadatka.',
    'response_selected:' || v_selection_id::text,
    'NORMAL', jsonb_build_object('agreement_id', v_agreement_id, 'need_id', v_need.id)
  );
$n02_event$;
begin
  if v_oid is null or to_regprocedure('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)') is null then
    raise exception 'N02_PREDECESSOR_MISSING' using errcode='55000';
  end if;
  select prosrc into v_body from pg_catalog.pg_proc where oid=v_oid;
  if md5(v_body) <> '867b280d4131188db3906c1ced7f4c11' then
    raise exception 'N02_SELECTION_PREDECESSOR_MISMATCH' using errcode='55000';
  end if;
  if (length(v_body)-length(replace(v_body,v_anchor,''))) / length(v_anchor) <> 1 then
    raise exception 'N02_SELECTION_ANCHOR_MISMATCH' using errcode='55000';
  end if;
  v_def := pg_get_functiondef(v_oid);
  -- Keep signature, search_path, grants, all business guards and early returns.
  execute replace(v_def,v_anchor,v_event || v_anchor);
  if (select prosrc from pg_catalog.pg_proc where oid=v_oid)
      is distinct from replace(v_body,v_anchor,v_event || v_anchor) then
    raise exception 'N02_SELECTION_POSTCONDITION_MISMATCH' using errcode='55000';
  end if;
end
$n02_candidate$;
commit;
