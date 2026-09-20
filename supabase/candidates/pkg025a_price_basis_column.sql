-- PKG-025a: a task can say what its price is FOR, without changing what any existing price means.
--
-- Status, decisions and evidence: docs/implementation/v5-ai-first/pkg025/PKG025A_PRICE_BASIS.md
--
-- The gap. needs.mode is MY_PRICE or OFFERS, and needs.requester_price_rsd is one amount. For a task
-- for ONE person that amount is at once the total and the per-person price. For a task for six it is
-- neither, and nothing in the product says which — the ambiguity the owner named on 2026-09-19. What
-- he wants expressible: TOTAL (the whole task), PER_PERSON (one covered slot), OFFERS.
--
-- What this candidate does, and deliberately nothing more:
--
--   * one nullable column public.needs.price_basis
--   * one CHECK: it is null, or it is TOTAL / PER_PERSON and the task is MY_PRICE
--
-- NULL is the existing meaning, exactly as today. Nothing is backfilled and no existing row is
-- reinterpreted. `mode` keeps its two values, because the installed client rejects a receipt whose
-- pricingMode is anything else. No function body changes here: rpc_submit_response still applies
-- today's equality rule, because today every row's basis is null. The writer, the fingerprint, the
-- fact registry, the Edge prompt and the client are separate later steps, each with its own review.
--
-- Why it has to re-bind the closure digest. private.closure_schema_digest_v5_139() hashes every
-- column of every table, so a new column moves private.closure_source_digest_v5() and
-- private.retention_ai_source_ready() would go false — account erasure and AI retention would stop
-- reporting ready. The pin is therefore re-bound in this same transaction, in all three of its
-- places, and only from a predecessor this transaction first proves is already ready. That is the
-- technique of source migrations 145-147 and of pkg023f.
--
-- A re-bind from an unready predecessor would certify, in passing, schema changes this candidate did
-- not make. The first precondition refuses exactly that.
--
-- Read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-09-20, before writing:
--   private.retention_ai_source_ready() = true, live digest = certified = 9205c7df...
--   public.needs: 40 columns, 15 CHECK constraints, 17 rows, no price_basis
--   guard_need_write md5 314b93f7f89d3d52dbcf17a2a2552502 - its whole-row test SUBTRACTS keys
--     (to_jsonb(new) - array['urgent','updated_at']), so a column that is null on both sides is
--     invisible to it, and its material list names fields explicitly, so the new one is not material
--     yet. That is what section 8 of the plan says to add in a later step.
--   closure_guard_owned_write md5 f13117fd601dcb82de423b78f25acb4f
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg025a_predecessor(certified text not null) on commit drop;

do $pre$
declare v_certified text; v_live text; v_ready_def text;
begin
  -- 1. An honest predecessor. A re-bind is only truthful from a state that is already certified.
  if private.retention_ai_source_ready() is distinct from true then
    raise exception 'PKG025A_CLOSURE_SOURCE_NOT_READY';
  end if;

  -- 2. The certified value agrees in all three of its places, and the live digest matches it.
  select sha256 into strict v_certified from private.closure_source_v5 where singleton;
  if v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton) then
    raise exception 'PKG025A_CERTIFIED_VALUES_DISAGREE';
  end if;
  v_ready_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if position(v_certified in v_ready_def) = 0 then
    raise exception 'PKG025A_READINESS_CONSTANT_DISAGREES';
  end if;
  v_live := private.closure_source_digest_v5();
  if v_live is distinct from v_certified then
    raise exception 'PKG025A_DIGEST_HAS_DRIFTED';
  end if;

  -- 3. The column does not exist, so this is not a re-run.
  if exists (select 1 from pg_attribute where attrelid = 'public.needs'::regclass
               and attname = 'price_basis' and not attisdropped) then
    raise exception 'PKG025A_ALREADY_APPLIED';
  end if;

  -- 4. The two guards that read a whole needs row are the reviewed ones. If either changed, the
  --    reasoning above about a new column being invisible to them has not been checked.
  if (select md5(prosrc) from pg_proc where proname = 'guard_need_write')
       is distinct from '314b93f7f89d3d52dbcf17a2a2552502'
     or (select md5(prosrc) from pg_proc where proname = 'closure_guard_owned_write')
       is distinct from 'f13117fd601dcb82de423b78f25acb4f' then
    raise exception 'PKG025A_NEEDS_GUARDS_ARE_NOT_THE_REVIEWED_ONES';
  end if;

  -- 5. The table is the shape that was read.
  if (select count(*) from pg_attribute where attrelid = 'public.needs'::regclass
        and attnum > 0 and not attisdropped) <> 40
     or (select count(*) from pg_constraint where conrelid = 'public.needs'::regclass and contype = 'c') <> 15 then
    raise exception 'PKG025A_NEEDS_SHAPE_NOT_AS_REVIEWED';
  end if;

  insert into pkg025a_predecessor values (v_certified);
end
$pre$;

alter table public.needs add column price_basis text;

-- A basis only means something when the requester named a price. OFFERS has nothing to be a basis of.
alter table public.needs add constraint needs_price_basis_requires_my_price
  check (price_basis is null or (price_basis in ('TOTAL', 'PER_PERSON') and mode = 'MY_PRICE'));

comment on column public.needs.price_basis is
  'Sta cena znaci: TOTAL = ceo zadatak, PER_PERSON = jedno pokriveno mesto. NULL = postojece znacenje, nepromenjeno.';

-- The certified value, in its three places, for the state this transaction now holds.
do $rebind$
declare v_certified text; v_new text; v_def text;
begin
  select certified into strict v_certified from pkg025a_predecessor;
  v_new := private.closure_source_digest_v5();
  if v_new is null then raise exception 'PKG025A_SOURCE_DIGEST_UNAVAILABLE'; end if;
  -- A new column MUST move the digest. If it did not, the schema digest does not see this table the
  -- way this candidate assumes, and certifying would be a lie.
  if v_new = v_certified then raise exception 'PKG025A_COLUMN_NOT_IN_THE_DIGEST'; end if;
  v_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  update private.closure_source_v5 set sha256 = v_new where singleton and sha256 = v_certified;
  if not found then raise exception 'PKG025A_CERTIFIED_VALUES_DISAGREE'; end if;
  update private.closure_erasure_source_v5 set sha256 = v_new where singleton and sha256 = v_certified;
  if not found then raise exception 'PKG025A_CERTIFIED_VALUES_DISAGREE'; end if;
  execute replace(v_def, v_certified, v_new);
end
$rebind$;

do $post$
declare v_live text; v_def text; v_constraint text;
begin
  -- The column is exactly what was reviewed: text, nullable, no default, and null on every row.
  if not exists (select 1 from pg_attribute a where a.attrelid = 'public.needs'::regclass
                   and a.attname = 'price_basis' and not a.attisdropped
                   and format_type(a.atttypid, a.atttypmod) = 'text'
                   and not a.attnotnull and not a.atthasdef) then
    raise exception 'PKG025A_COLUMN_NOT_AS_REVIEWED';
  end if;
  if exists (select 1 from public.needs where price_basis is not null) then
    raise exception 'PKG025A_NOTHING_MAY_BE_BACKFILLED';
  end if;

  -- The rule is the reviewed one, and it names both halves.
  select pg_get_constraintdef(oid) into v_constraint from pg_constraint
    where conrelid = 'public.needs'::regclass and conname = 'needs_price_basis_requires_my_price';
  if v_constraint is null
     or position('price_basis' in v_constraint) = 0
     or position('TOTAL' in v_constraint) = 0
     or position('PER_PERSON' in v_constraint) = 0
     or position('MY_PRICE' in v_constraint) = 0 then
    raise exception 'PKG025A_CONSTRAINT_NOT_AS_REVIEWED';
  end if;
  if (select count(*) from pg_constraint where conrelid = 'public.needs'::regclass and contype = 'c') <> 16 then
    raise exception 'PKG025A_CONSTRAINT_COUNT_NOT_AS_REVIEWED';
  end if;

  -- Nothing else about the table moved: no column dropped, no guard rewritten.
  if (select count(*) from pg_attribute where attrelid = 'public.needs'::regclass
        and attnum > 0 and not attisdropped) <> 41 then
    raise exception 'PKG025A_COLUMN_COUNT_NOT_AS_REVIEWED';
  end if;
  if (select md5(prosrc) from pg_proc where proname = 'guard_need_write')
       is distinct from '314b93f7f89d3d52dbcf17a2a2552502'
     or (select md5(prosrc) from pg_proc where proname = 'closure_guard_owned_write')
       is distinct from 'f13117fd601dcb82de423b78f25acb4f' then
    raise exception 'PKG025A_GUARDS_CHANGED';
  end if;

  -- The pin is re-bound in all three places, and closure is ready again.
  v_live := private.closure_source_digest_v5();
  v_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (select sha256 from private.closure_source_v5 where singleton) is distinct from v_live
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_live
     or position(v_live in v_def) = 0 then
    raise exception 'PKG025A_REBIND_INCOMPLETE';
  end if;
  if private.retention_ai_source_ready() is distinct from true then
    raise exception 'PKG025A_SOURCE_NOT_READY_AFTER';
  end if;

  -- The readiness function stays private.
  if has_function_privilege('anon', 'private.retention_ai_source_ready()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.retention_ai_source_ready()', 'EXECUTE') then
    raise exception 'PKG025A_READINESS_GRANTS_CHANGED';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
