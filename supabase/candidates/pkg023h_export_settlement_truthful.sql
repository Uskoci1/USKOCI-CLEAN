-- PKG-023h (finding F2): the data export stops claiming that no charge was ever measured.
--
-- A CANDIDATE. NOT APPLIED ANYWHERE. The owner approved writing it on 2026-09-19 and asked for a stop before
-- any DEV application: "Ne sme više da tvrdi measuredProviderCharge: false ako postoje redovi sa izmerenom
-- potrošnjom/charge podacima ... Nemoj automatski izvoziti operator_note ili internu security metadata samo
-- zato što postoji."
--
-- What is wrong. private.data_export_snapshot builds each `testAllocations` row as
--   {'kind', 'allocatedMaximumMicrousd', 'measuredProviderCharge', false, 'createdAt'}
-- with false as a LITERAL. When that was written it was true of every row: a reservation was a worst-case
-- hold and nothing had ever been measured. Since dev_alpha_pkg019b (2026-09-17) a reservation can carry
-- settled_microusd with settlement_basis MEASURED - priced from the provider's own usage metadata - and
-- since pkg019d also AUDIO_DURATION_AT_PUBLISHED_RATE. The sentence the export would print about those rows
-- is no longer true.
--
-- What this changes, and nothing else:
--   1. private.data_export_snapshot: the `testAllocations` row gains settledMicrousd, settlementBasis and
--      settledAt, and measuredProviderCharge becomes what it says - true only where the settled amount came
--      from provider-reported usage (settlement_basis = 'MEASURED'), false otherwise, including a row that
--      is not settled at all.
--   2. private.data_export_dataset_catalog: the same three field names are admitted for that key, because
--      the binding refuses a policy field that the catalog does not list. The live catalog is the one eight
--      source migrations have extended, 51 keys, its JSON normalised by jsonb; the anchor is that text.
--
-- What it deliberately does NOT do. It exports no new kind of data by itself: an export contains a field
-- only when the active retention policy's export_delivery lists it, and on canonical DEV there is no policy
-- set at all, so private.data_export_policy_binding() is null and no export can run there today. It does not
-- add the measured token counts of private.ai_test_usage_v5, nor the measured audio byte and transcript
-- character counts of the reservation, nor anything from the PKG-015 lineage tables: whether a person's own
-- metering should become part of their export is the owner's decision, and an operator's note about them is
-- internal security metadata that is not theirs to receive. The proposals are in
-- docs/implementation/v5-ai-first/pkg023/F2_F4_CANDIDATES_20260919.md.
--
-- It changes no table, no policy, no grant and no other function, and it is not part of the closure source
-- digest, which it asserts on itself. It does change private.data_export_projection_sha_v5(), which is the
-- point: a policy written against the old projection must be written again against this one.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path to pg_catalog;

create temporary table pkg023h_predecessor(source_digest text not null, projection_sha text not null) on commit drop;

do $pre$
declare v_old_row constant text := $a$select 'testAllocations' as key,jsonb_build_object('kind',t.kind,'allocatedMaximumMicrousd',t.max_cost_microusd,'measuredProviderCharge',false,'createdAt',t.created_at) as value from private.ai_test_reservations_v5 t where t.account_id=p_account_id$a$;
  v_old_fields constant text := $a${"key": "testAllocations", "fields": ["allocatedMaximumMicrousd", "createdAt", "kind", "measuredProviderCharge"]$a$;
  v_snapshot text; v_catalog text;
begin
  if to_regprocedure('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)') is null
     or to_regprocedure('private.data_export_dataset_catalog()') is null then
    raise exception 'PKG023H_EXPORT_PROJECTION_ABSENT';
  end if;
  -- The two bodies this edits are the bodies it was written against, at the exact place it edits.
  if (select md5(prosrc) from pg_proc where oid = 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure) is distinct from '4c0c46e17da2dc13d6c52c70cb98486f'
     or (select md5(prosrc) from pg_proc where oid = 'private.data_export_dataset_catalog()'::regprocedure) is distinct from 'e7799bcec58f4a26b8cb63c12f0a3677' then
    raise exception 'PKG023H_A_BODY_IS_NOT_THE_REVIEWED_ONE';
  end if;
  select prosrc into strict v_snapshot from pg_proc where oid = 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure;
  select prosrc into strict v_catalog from pg_proc where oid = 'private.data_export_dataset_catalog()'::regprocedure;
  if (length(v_snapshot) - length(replace(v_snapshot, v_old_row, ''))) <> length(v_old_row)
     or (length(v_catalog) - length(replace(v_catalog, v_old_fields, ''))) <> length(v_old_fields) then
    raise exception 'PKG023H_ANCHOR_NOT_UNIQUE';
  end if;
  insert into pkg023h_predecessor values (private.closure_source_digest_v5(), private.data_export_projection_sha_v5());
end
$pre$;

do $change$
declare def text; anchor text;
begin
  def := pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
  anchor := $a$'measuredProviderCharge',false,'createdAt',t.created_at) as value from private.ai_test_reservations_v5 t$a$;
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then raise exception 'PKG023H_ANCHOR_NOT_UNIQUE snapshot'; end if;
  execute replace(def, anchor,
    $a$'measuredProviderCharge',coalesce(t.settlement_basis='MEASURED',false),'settledMicrousd',t.settled_microusd,'settlementBasis',t.settlement_basis,'settledAt',t.settled_at,'createdAt',t.created_at) as value from private.ai_test_reservations_v5 t$a$);

  def := pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure);
  anchor := $a${"key": "testAllocations", "fields": ["allocatedMaximumMicrousd", "createdAt", "kind", "measuredProviderCharge"]$a$;
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then raise exception 'PKG023H_ANCHOR_NOT_UNIQUE catalog'; end if;
  execute replace(def, anchor,
    $a${"key": "testAllocations", "fields": ["allocatedMaximumMicrousd", "createdAt", "kind", "measuredProviderCharge", "settledAt", "settledMicrousd", "settlementBasis"]$a$);
end
$change$;

do $post$
declare v_snapshot text; v_catalog jsonb; v_fields text[];
begin
  select prosrc into strict v_snapshot from pg_proc where oid = 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure;
  -- No row of this projection may claim, as a literal, that nothing was ever measured.
  if position($a$'measuredProviderCharge',false$a$ in v_snapshot) > 0
     or position($a$coalesce(t.settlement_basis='MEASURED',false)$a$ in v_snapshot) = 0 then
    raise exception 'PKG023H_SNAPSHOT_NOT_AS_REVIEWED';
  end if;
  v_catalog := private.data_export_dataset_catalog();
  select array_agg(value#>>'{}' order by value#>>'{}') into v_fields
    from jsonb_array_elements(v_catalog) e, jsonb_array_elements(e.value->'fields') value
   where e.value->>'key' = 'testAllocations';
  if v_fields is distinct from array['allocatedMaximumMicrousd','createdAt','kind','measuredProviderCharge','settledAt','settledMicrousd','settlementBasis']::text[] then
    raise exception 'PKG023H_CATALOG_NOT_AS_REVIEWED';
  end if;
  if (select count(*) from jsonb_array_elements(v_catalog)) <> 51 then raise exception 'PKG023H_CATALOG_KEY_SET_CHANGED'; end if;
  -- The projection identity must move, so a policy written against the old one has to be written again.
  if private.data_export_projection_sha_v5() is not distinct from (select projection_sha from pkg023h_predecessor) then
    raise exception 'PKG023H_PROJECTION_IDENTITY_DID_NOT_MOVE';
  end if;
  -- Nothing here belongs to the closure source, and no API role gains anything.
  if (select source_digest from pkg023h_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG023H_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
  if has_function_privilege('anon', 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'private.data_export_dataset_catalog()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.data_export_dataset_catalog()', 'EXECUTE') then
    raise exception 'PKG023H_GRANTS_NOT_EXACT';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
