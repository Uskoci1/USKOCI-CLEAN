-- Correct guard placement, not Agreement semantics: immutable successful command
-- replay must survive DONE/terminal transitions while every NEW change remains blocked.
-- Source113 follow-up; no earlier migration or immutable proposal is rewritten.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $fix$
declare d text; g text; anchor text; sig regprocedure;
begin
 sig:='public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure;
 if (select md5(prosrc) from pg_proc where oid=sig) is distinct from '679c070f0ae58765a5468bb551100bd3' then
  raise exception 'PRE_V3_AGREEMENT_REPLAY_PREDECESSOR_CHANGED'; end if;
 d:=pg_get_functiondef(sig);
 g:=$guard$  if not exists(select 1 from public.agreement_execution ex where ex.agreement_id=v_agreement.id
    and ex.agreement_version=v_agreement.current_version and ex.state='CONFIRMED' and ex.worker_marked_done_at is null) then
    raise exception 'AGREEMENT_CHANGE_AFTER_WORK_DONE' using errcode='P0001';
  end if;

$guard$;
 if (length(d)-length(replace(d,g,'')))/length(g)<>1 then raise exception 'PRE_V3_AGREEMENT_REPLAY_ANCHOR_MISSING'; end if;
 d:=replace(d,g,'');
 anchor:=$anchor$  if exists(select 1 from public.agreement_change_proposals where agreement_id=v_agreement.id and status='PENDING') then$anchor$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'PRE_V3_AGREEMENT_REPLAY_ANCHOR_MISSING'; end if;
 d:=replace(d,anchor,g||anchor);
 if position('return v_existing.id;' in d)=0 or position('return v_existing.id;' in d)>position(g in d) then
  raise exception 'PRE_V3_AGREEMENT_REPLAY_GUARD_ORDER'; end if;
 execute d;
 sig:='public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure;
 if (select md5(prosrc) from pg_proc where oid=sig) is distinct from '9c07d46b9a07a458966961c74dfb14fa' then
  raise exception 'PRE_V3_AGREEMENT_REPLAY_PREDECESSOR_CHANGED'; end if;
 d:=pg_get_functiondef(sig);
 if (length(d)-length(replace(d,g,'')))/length(g)<>1 then raise exception 'PRE_V3_AGREEMENT_REPLAY_ANCHOR_MISSING'; end if;
 d:=replace(d,g,'');
 anchor:=$anchor$  if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;$anchor$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'PRE_V3_AGREEMENT_REPLAY_ANCHOR_MISSING'; end if;
 d:=replace(d,anchor,g||anchor);
 if position($probe$elsif v_proposal.status <> 'PENDING'$probe$ in d)=0 or position($probe$elsif v_proposal.status <> 'PENDING'$probe$ in d)>position(g in d) then
  raise exception 'PRE_V3_AGREEMENT_REPLAY_GUARD_ORDER'; end if;
 execute d;
end;
$fix$;
commit;
