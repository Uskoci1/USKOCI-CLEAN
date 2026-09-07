-- Forward admission of canonical N05; NOT LIVE until approved promotion.
-- Embedded candidate comments below are retained pre-admission provenance.
-- N05: existing bilateral change protocol -> counterpart durable events.
-- Guarded source candidate only. NOT a production migration or RU6 closure.
begin;
do $candidate$
declare
  v_proc regprocedure;
  v_body text;
  v_definition text;
  v_anchor text;
  v_addition text;
begin
  v_proc := 'public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure;
  select prosrc into v_body from pg_proc where oid=v_proc;
  if md5(v_body)<>'7972e42a84293de069a1ce4b159cd6fd' then raise exception 'N05_PROPOSE_PREDECESSOR_MISMATCH'; end if;
  v_anchor := E'  return v_id;\nend;\n';
  v_addition := $emit$  perform private.emit_event(
    case when v_uid=v_agreement.requester_account_id then v_agreement.worker_account_id else v_agreement.requester_account_id end,
    case when v_uid=v_agreement.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'AGREEMENT_CHANGE_PROPOSED','AGREEMENT',v_agreement.id,v_agreement.current_version,
    'Predložena je izmena Dogovora','Pogledajte predlog i odgovorite u Dogovoru.',
    'agreement_change_proposed:'||v_id::text,'NORMAL',jsonb_build_object('proposal_id',v_id)
  );
$emit$;
  if (length(v_body)-length(replace(v_body,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'N05_PROPOSE_ANCHOR_MISMATCH'; end if;
  v_definition := pg_get_functiondef(v_proc);
  execute replace(v_definition,v_anchor,v_addition||v_anchor);
  if (select prosrc from pg_proc where oid=v_proc)<>replace(v_body,v_anchor,v_addition||v_anchor) then raise exception 'N05_PROPOSE_BODY_MISMATCH'; end if;

  v_proc := 'public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure;
  select prosrc into v_body from pg_proc where oid=v_proc;
  if md5(v_body)<>'e0b2079739f81646f592a6575085401b' then raise exception 'N05_RESPOND_PREDECESSOR_MISMATCH'; end if;
  v_anchor := E'     where id=v_proposal.id;\n    return jsonb_build_object';
  v_addition := $emit$     where id=v_proposal.id;
    perform private.emit_event(
      v_proposal.proposed_by_account_id,
      case when v_proposal.proposed_by_account_id=v_agreement.requester_account_id then 'REQUESTER' else 'WORKER' end,
      'AGREEMENT_CHANGE_REJECTED','AGREEMENT',v_agreement.id,v_agreement.current_version,
      'Predlog izmene nije prihvaćen','Važeći uslovi Dogovora ostaju nepromenjeni.',
      'agreement_change_rejected:'||v_proposal.id::text,'NORMAL',jsonb_build_object('proposal_id',v_proposal.id)
    );
    return jsonb_build_object$emit$;
  if (length(v_body)-length(replace(v_body,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'N05_REJECT_ANCHOR_MISMATCH'; end if;
  v_definition := replace(pg_get_functiondef(v_proc),v_anchor,v_addition);
  v_body := replace(v_body,v_anchor,v_addition);
  v_anchor := E'  return jsonb_build_object(\'proposalId\',v_proposal.id,\'accepted\',true,\'agreementVersion\',v_new_version,\'authoritative\',true);';
  v_addition := $emit$  perform private.emit_event(
    v_proposal.proposed_by_account_id,
    case when v_proposal.proposed_by_account_id=v_agreement.requester_account_id then 'REQUESTER' else 'WORKER' end,
    'AGREEMENT_VERSION_CHANGED','AGREEMENT',v_agreement.id,v_new_version,
    'Izmena Dogovora je prihvaćena','Pogledajte važeće uslove u Dogovoru.',
    'agreement_version_changed:'||v_proposal.id::text,'NORMAL',jsonb_build_object('proposal_id',v_proposal.id)
  );
$emit$;
  if (length(v_body)-length(replace(v_body,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'N05_ACCEPT_ANCHOR_MISMATCH'; end if;
  execute replace(v_definition,v_anchor,v_addition||v_anchor);
  if (select prosrc from pg_proc where oid=v_proc)<>replace(v_body,v_anchor,v_addition||v_anchor) then raise exception 'N05_RESPOND_BODY_MISMATCH'; end if;
end
$candidate$;
commit;
