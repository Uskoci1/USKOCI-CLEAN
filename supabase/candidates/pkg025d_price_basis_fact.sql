-- PKG-025d: the interview can state what a price is for, and the draft keeps it.
--
-- Status, decisions and evidence: docs/implementation/v5-ai-first/pkg025/PKG025A_PRICE_BASIS.md
--
-- A CANDIDATE. NOT APPLIED. It edits the publication path, which is the one flow this product
-- cannot afford to break, and the house has an executable proof for exactly that which cannot be
-- run from here. See "What is not proven" at the end.
--
-- Where the chain stands. pkg025a gave a task a price_basis, pkg025b prices an application by it,
-- pkg025c carries it to the screen. Nobody can WRITE one: a review is a set of confirmed facts, and
-- there is no fact for the basis, so the column can only ever be null in practice.
--
-- This adds the fact and the two places that turn a review into a task:
--
--   1. the registry row, private.need_fact_registry. An ENUM, PUBLIC, not required for a draft
--      (a task without a basis is still a whole task), material like every other price fact, and
--      target_owner needs.price_basis, which is how that table names the column a fact belongs to.
--   2. the validator's rule for it: TOTAL or PER_PERSON and nothing else.
--   3. rpc_save_need_draft_from_review and rpc_confirm_need_edit_from_review write it beside the
--      amount it explains.
--
-- The basis is computed where it is written rather than in a new variable, so each writer takes one
-- edit instead of three. `case when v_mode = 'MY_PRICE' then ... end` yields null for OFFERS, which
-- is what the table's CHECK requires: a basis is only meaningful when the requester named a price.
--
-- What this does NOT do. The Edge prompt still never asks "ukupno ili po osobi", so the AI will not
-- propose the fact; a person reaching it through the review editor is the next step and a separate
-- review. rpc_ai_open_need_edit_conversation_v2 does not seed it yet, for the same reason.
--
-- Live predecessors, read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-09-20:
--   private.validate_need_v2_fact_pre_fastest_retirement  md5 e12a5ba0be1e0879f130fb4d5bed9d2b, 6730 chars
--   public.rpc_save_need_draft_from_review                md5 a334717a935cd00bc1cbdf4495bc6536, 10543 chars
--   public.rpc_confirm_need_edit_from_review              md5 2126c67488394a63a5cbbee0b7facffb, 13555 chars
--   private.need_fact_registry holds no need.price_basis row.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg025d_predecessor(source_digest text not null) on commit drop;

do $pre$
begin
  if not exists (select 1 from pg_attribute where attrelid = 'public.needs'::regclass
                   and attname = 'price_basis' and not attisdropped) then
    raise exception 'PKG025D_REQUIRES_PKG025A';
  end if;
  if exists (select 1 from private.need_fact_registry
               where fact_key = 'need.price_basis' and schema_version = 'NEED_FACT_V2') then
    raise exception 'PKG025D_ALREADY_APPLIED';
  end if;

  if (select md5(prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private' and p.proname = 'validate_need_v2_fact_pre_fastest_retirement')
       is distinct from 'e12a5ba0be1e0879f130fb4d5bed9d2b'
     or (select md5(prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rpc_save_need_draft_from_review')
       is distinct from 'a334717a935cd00bc1cbdf4495bc6536'
     or (select md5(prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rpc_confirm_need_edit_from_review')
       is distinct from '2126c67488394a63a5cbbee0b7facffb' then
    raise exception 'PKG025D_BODIES_ARE_NOT_THE_REVIEWED_ONES';
  end if;

  -- The registry names the column a fact belongs to, and that column must be the new one.
  if not exists (select 1 from private.need_fact_registry
                   where fact_key = 'need.price_mode' and target_owner = 'needs.mode') then
    raise exception 'PKG025D_REGISTRY_NOT_AS_REVIEWED';
  end if;

  -- Not one of the three bodies mentions the basis yet. This is what makes the postcondition's
  -- count of two an assertion about what THIS candidate wrote, rather than about what was there.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where position('price_basis' in p.prosrc) > 0
        and ((n.nspname = 'public' and p.proname in ('rpc_save_need_draft_from_review','rpc_confirm_need_edit_from_review'))
          or (n.nspname = 'private' and p.proname = 'validate_need_v2_fact_pre_fastest_retirement'))
  ) then
    raise exception 'PKG025D_BODIES_ALREADY_MENTION_PRICE_BASIS';
  end if;

  insert into pkg025d_predecessor values (private.closure_source_digest_v5());
end
$pre$;

-- 1. The key exists, and says which column it owns.
insert into private.need_fact_registry(fact_key, schema_version, value_type, required_for_draft, privacy_class, material, target_owner)
values ('need.price_basis', 'NEED_FACT_V2', 'ENUM', false, 'PUBLIC', true, 'needs.price_basis');

do $change$
declare def text;
  v_validator constant text := 'private.validate_need_v2_fact_pre_fastest_retirement(text,jsonb)';
  basis_expr constant text := $a$case when v_mode='MY_PRICE' then nullif(btrim(coalesce(v_facts->>'need.price_basis','')),'') end$a$;
  a_validator constant text := $a$    when 'need.price_rsd' then$a$;
  a_confirm constant text := $a$requester_price_rsd=v_price,$a$;
  a_save_cols constant text := $a$task_country_code,task_timezone$a$;
  a_save_vals constant text := $a$v_exec_mode,v_photos,v_country,v_timezone$a$;
  v_sig text;
begin
  -- 2. Its rule: two values, and nothing else is a basis.
  def := pg_get_functiondef(v_validator::regprocedure);
  if (length(def) - length(replace(def, a_validator, ''))) <> length(a_validator) then
    raise exception 'PKG025D_VALIDATOR_ANCHOR_NOT_UNIQUE';
  end if;
  execute replace(def, a_validator, $a$    when 'need.price_basis' then
      if v_text not in ('TOTAL','PER_PERSON') then raise exception 'V2_PRICE_BASIS_INVALID' using errcode='22023'; end if;
$a$ || a_validator);

  -- 3a. The edit writes it beside the amount it explains.
  select p.oid::regprocedure::text into strict v_sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rpc_confirm_need_edit_from_review';
  def := pg_get_functiondef(v_sig::regprocedure);
  if (length(def) - length(replace(def, a_confirm, ''))) <> length(a_confirm) then
    raise exception 'PKG025D_CONFIRM_ANCHOR_NOT_UNIQUE';
  end if;
  execute replace(def, a_confirm, a_confirm || 'price_basis=' || basis_expr || ',');

  -- 3b. The draft does too. Both lists are appended at their end, so nothing shifts position.
  select p.oid::regprocedure::text into strict v_sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rpc_save_need_draft_from_review';
  def := pg_get_functiondef(v_sig::regprocedure);
  if (length(def) - length(replace(def, a_save_cols, ''))) <> length(a_save_cols)
     or (length(def) - length(replace(def, a_save_vals, ''))) <> length(a_save_vals) then
    raise exception 'PKG025D_SAVE_ANCHOR_NOT_UNIQUE';
  end if;
  def := replace(def, a_save_cols, a_save_cols || ',price_basis');
  execute replace(def, a_save_vals, a_save_vals || ',' || basis_expr);
end
$change$;

do $post$
declare v_row record; v_body text;
begin
  select * into strict v_row from private.need_fact_registry
    where fact_key = 'need.price_basis' and schema_version = 'NEED_FACT_V2';
  if v_row.value_type <> 'ENUM' or v_row.required_for_draft or v_row.privacy_class <> 'PUBLIC'
     or not v_row.material or v_row.target_owner <> 'needs.price_basis' then
    raise exception 'PKG025D_REGISTRY_ROW_NOT_AS_REVIEWED';
  end if;

  select prosrc into strict v_body from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'validate_need_v2_fact_pre_fastest_retirement';
  if (length(v_body) - length(replace(v_body, 'V2_PRICE_BASIS_INVALID', ''))) <> length('V2_PRICE_BASIS_INVALID')
     or position($a$when 'need.price_basis' then$a$ in v_body) = 0 then
    raise exception 'PKG025D_VALIDATOR_NOT_AS_REVIEWED';
  end if;

  for v_body in
    select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('rpc_save_need_draft_from_review','rpc_confirm_need_edit_from_review')
  loop
    -- The fact is read once and the column written once, and the basis is only ever kept for a task
    -- that named a price, which is what the table's CHECK requires.
    --
    -- price_basis appears TWICE, not three times: once naming the column and once inside the fact
    -- key `need.price_basis`, which contains it as a substring. The precondition asserts the bodies
    -- start with zero, so two is the whole of what this candidate added.
    if (length(v_body) - length(replace(v_body, 'need.price_basis', ''))) <> length('need.price_basis')
       or (length(v_body) - length(replace(v_body, 'price_basis', ''))) <> length('price_basis') * 2
       or position($a$case when v_mode='MY_PRICE' then$a$ in v_body) = 0 then
      raise exception 'PKG025D_WRITER_NOT_AS_REVIEWED';
    end if;
  end loop;

  -- A registry row is data and a function body is not schema, so neither moves the digest.
  if (select source_digest from pkg025d_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG025D_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
  if private.retention_ai_source_ready() is distinct from true then
    raise exception 'PKG025D_SOURCE_NOT_READY_AFTER';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
