-- PKG-025c: the bounded marketplace reader says what a task's price is for.
--
-- Status, decisions and evidence: docs/implementation/v5-ai-first/pkg025/PKG025A_PRICE_BASIS.md
--
-- pkg025a gave a task a price_basis and pkg025b taught the writer to price an application by it. A
-- person still cannot see it: public.rpc_list_open_tasks_v3 returns an allowlisted item, and the
-- basis is not in the list. So a task for six people at 3000 per person still reads "3.000 RSD" on
-- every card and every detail — which is the display the owner refused on 2026-09-19.
--
-- This adds one key, priceBasis, beside the priceMode and requesterPriceRsd that are already there.
-- It is the same class of fact as those two: a rule of a published task, naming no person, no place
-- and no amount that was not already public. Where the basis is null the key is null, which is every
-- task that exists today, so nothing any client reads today changes.
--
-- What stays out: nothing new. This adds one key and removes none, and the reader keeps standing on
-- RLS rather than on definer rights, exactly as pkg023d built it.
--
-- Live predecessor, read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-09-20:
--   public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)
--   body md5 71c0b732e9ebea8c7f791713324ffb55, 8359 chars, NOT security definer, stable,
--   search_path=pg_catalog, execute granted to authenticated and not to anon.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg025c_predecessor(source_digest text not null) on commit drop;

do $pre$
declare
  v_sig constant text := 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)';
  v_body text;
begin
  if to_regprocedure(v_sig) is null then raise exception 'PKG025C_MISSING_FUNCTION'; end if;
  select prosrc into strict v_body from pg_proc where oid = v_sig::regprocedure;

  if md5(v_body) is distinct from '71c0b732e9ebea8c7f791713324ffb55' then
    raise exception 'PKG025C_BODY_IS_NOT_THE_REVIEWED_ONE';
  end if;
  if position('priceBasis' in v_body) > 0 then
    raise exception 'PKG025C_ALREADY_APPLIED';
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'public.needs'::regclass
                   and attname = 'price_basis' and not attisdropped) then
    raise exception 'PKG025C_REQUIRES_PKG025A';
  end if;

  -- A reader that stands on RLS must keep standing on it.
  if (select count(*) from pg_proc p where p.oid = v_sig::regprocedure
        and not p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
    raise exception 'PKG025C_ENVELOPE_NOT_AS_REVIEWED';
  end if;
  if has_function_privilege('anon', v_sig, 'EXECUTE')
     or not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
    raise exception 'PKG025C_GRANTS_NOT_EXACT';
  end if;

  insert into pkg025c_predecessor values (private.closure_source_digest_v5());
end
$pre$;

do $change$
declare
  v_sig constant text := 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)';
  def text;
  anchor constant text := $a$'priceMode', n.mode, 'requesterPriceRsd', n.requester_price_rsd,$a$;
begin
  def := pg_get_functiondef(v_sig::regprocedure);
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then
    raise exception 'PKG025C_ANCHOR_NOT_UNIQUE';
  end if;
  execute replace(def, anchor, anchor || $a$ 'priceBasis', n.price_basis,$a$);
end
$change$;

do $post$
declare
  v_sig constant text := 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)';
  v_body text;
begin
  select prosrc into strict v_body from pg_proc where oid = v_sig::regprocedure;

  -- Exactly the one key, once, and the two it stands beside are still there. priceMode appears six
  -- times, not twice: it is also a filter this reader accepts, named in its allowlist and read from
  -- it. Counted on the live body rather than assumed.
  if (length(v_body) - length(replace(v_body, 'priceBasis', ''))) <> length('priceBasis')
     or (length(v_body) - length(replace(v_body, 'priceMode', ''))) <> length('priceMode') * 6
     or (length(v_body) - length(replace(v_body, 'requesterPriceRsd', ''))) <> length('requesterPriceRsd')
     or position('n.description' in v_body) > 0
     or position('requester_account_id' in v_body) > 0
     or position('exact_address' in v_body) > 0 then
    raise exception 'PKG025C_BODY_NOT_AS_REVIEWED';
  end if;

  if (select count(*) from pg_proc p where p.oid = v_sig::regprocedure
        and not p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
    raise exception 'PKG025C_ENVELOPE_CHANGED';
  end if;
  if has_function_privilege('anon', v_sig, 'EXECUTE')
     or not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
    raise exception 'PKG025C_GRANTS_CHANGED';
  end if;
  if (select source_digest from pkg025c_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG025C_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
