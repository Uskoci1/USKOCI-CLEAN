-- PKG-025b: an application is priced by the basis its task declares.
--
-- Status, decisions and evidence: docs/implementation/v5-ai-first/pkg025/PKG025A_PRICE_BASIS.md
--
-- pkg025a added public.needs.price_basis and changed no behaviour, because every row's basis is
-- null. This is the step that gives the column meaning, in the one place that decides what an
-- application may cost: public.rpc_submit_response.
--
--   basis NULL         today's rule, untouched: the application's price equals the task's price,
--                      whatever it covers. That is every task written before 2026-09-20 and every
--                      task written since without a basis.
--   basis PER_PERSON   the price is the per-person amount times what THIS application covers.
--                      Six people at 3000: one slot 3000, three slots 9000, all six 18000.
--   basis TOTAL        the price of the whole task. One application must cover ALL required slots
--                      and its price equals the total. Owner's decision, 2026-09-19: no
--                      proportional split and no rounding. A requester who wants to hire people
--                      independently uses PER_PERSON.
--
-- The installed APK needs no change to stay safe. It locks its price field to the task's amount, so
-- under PER_PERSON covering one slot it sends exactly the right number and is accepted; covering
-- three it sends a third of the right number and is REFUSED. Under TOTAL it is refused unless it
-- covers everything. Every wrong combination is refused, none is silently accepted — which is the
-- compatibility requirement section 8 states, met by the arithmetic rather than by a feature flag.
--
-- It replaces one function body and nothing else: no table, column, policy, grant, index or trigger,
-- and it asserts on itself that the closure source digest does not move.
--
-- Live predecessor, read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-09-20:
--   public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)
--   body md5 e955af4025387f1b70b9ad3f3a7b4c6c, 11296 chars, security definer, volatile,
--   search_path=pg_catalog. The need row is loaded with `select * into n`, so it already carries
--   price_basis and required_slots.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg025b_predecessor(source_digest text not null) on commit drop;

do $pre$
declare
  v_sig constant text := 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)';
  v_body text;
begin
  if to_regprocedure(v_sig) is null then
    raise exception 'PKG025B_MISSING_FUNCTION';
  end if;
  select prosrc into strict v_body from pg_proc where oid = v_sig::regprocedure;

  if md5(v_body) is distinct from 'e955af4025387f1b70b9ad3f3a7b4c6c' then
    raise exception 'PKG025B_BODY_IS_NOT_THE_REVIEWED_ONE';
  end if;
  if position('price_basis' in v_body) > 0 then
    raise exception 'PKG025B_ALREADY_APPLIED';
  end if;

  -- pkg025a must be in place, or this body would reference a column that does not exist.
  if not exists (select 1 from pg_attribute where attrelid = 'public.needs'::regclass
                   and attname = 'price_basis' and not attisdropped) then
    raise exception 'PKG025B_REQUIRES_PKG025A';
  end if;

  -- The rule this edits occurs exactly once, and so does the message it keeps.
  if (length(v_body) - length(replace(v_body, 'FIXED_PRICE_MISMATCH', ''))) <> length('FIXED_PRICE_MISMATCH')
     or (length(v_body) - length(replace(v_body, 'FIXED_PRICE_NOT_READY', ''))) <> length('FIXED_PRICE_NOT_READY') then
    raise exception 'PKG025B_BODY_SHAPE_NOT_AS_REVIEWED';
  end if;

  -- The security envelope of a definer writer is not a detail.
  if (select count(*) from pg_proc p where p.oid = v_sig::regprocedure
        and p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
    raise exception 'PKG025B_ENVELOPE_NOT_AS_REVIEWED';
  end if;
  if has_function_privilege('anon', v_sig, 'EXECUTE')
     or not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
    raise exception 'PKG025B_GRANTS_NOT_EXACT';
  end if;

  insert into pkg025b_predecessor values (private.closure_source_digest_v5());
end
$pre$;

do $change$
declare
  v_sig constant text := 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)';
  def text;
  anchor constant text := $a$    if p_price_rsd <> n.requester_price_rsd then
      raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
    end if;$a$;
  replacement constant text := $a$    -- pkg025b. A null basis is the rule this product has always had: the application's price is
    -- the task's price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      -- The price of the whole task, so one application carries the whole task. No split, no
      -- rounding: owner's decision of 2026-09-19. Hiring people separately is what PER_PERSON is for.
      if p_covered_slots <> n.required_slots then
        raise exception using
          errcode='22023',
          message='TOTAL_PRICE_REQUIRES_ALL_SLOTS',
          detail=format('required=%s,covered=%s', n.required_slots, p_covered_slots);
      end if;
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,sent=%s', n.requester_price_rsd, p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;$a$;
begin
  def := pg_get_functiondef(v_sig::regprocedure);
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then
    raise exception 'PKG025B_ANCHOR_NOT_UNIQUE';
  end if;
  execute replace(def, anchor, replacement);
end
$change$;

do $post$
declare
  v_sig constant text := 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)';
  v_body text;
begin
  select prosrc into strict v_body from pg_proc where oid = v_sig::regprocedure;

  -- All three arms are present and the old unconditional rule is gone. PER_PERSON appears three
  -- times: the branch, the detail it formats, and the comment that says why TOTAL is not it. The
  -- first attempt asserted two and this postcondition refused the whole transaction, which is what
  -- it is for — the count is part of the review, not decoration.
  if (length(v_body) - length(replace(v_body, 'PER_PERSON', ''))) <> length('PER_PERSON') * 3
     or (length(v_body) - length(replace(v_body, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', ''))) <> length('TOTAL_PRICE_REQUIRES_ALL_SLOTS')
     or (length(v_body) - length(replace(v_body, 'UNKNOWN_PRICE_BASIS', ''))) <> length('UNKNOWN_PRICE_BASIS')
     or (length(v_body) - length(replace(v_body, 'FIXED_PRICE_MISMATCH', ''))) <> length('FIXED_PRICE_MISMATCH') * 3
     or position('n.price_basis is null' in v_body) = 0 then
    raise exception 'PKG025B_BODY_NOT_AS_REVIEWED';
  end if;

  -- Nothing about who may run it, or how, changed.
  if (select count(*) from pg_proc p where p.oid = v_sig::regprocedure
        and p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
    raise exception 'PKG025B_ENVELOPE_CHANGED';
  end if;
  if has_function_privilege('anon', v_sig, 'EXECUTE')
     or not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
    raise exception 'PKG025B_GRANTS_CHANGED';
  end if;

  -- A function body is not part of the schema digest, and this candidate touches nothing else.
  if (select source_digest from pkg025b_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG025B_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
  if private.retention_ai_source_ready() is distinct from true then
    raise exception 'PKG025B_SOURCE_NOT_READY_AFTER';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
