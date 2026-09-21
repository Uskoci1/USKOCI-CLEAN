-- PKG-027e candidate. Owner approval 2026-09-21 ("odobravam sve to"), after the deep read (ledger 12.2).
-- Contract/proof: docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md
--
-- Defect in the assistant's own pkg025 work: public.rpc_ai_open_need_edit_conversation_v2 seeds an edit from
-- the live task key by key and has no branch for need.price_basis, while the edit writer sets price_basis from
-- that fact or NULL; and private.need_material_snapshot (so need_full_edit_snapshot) omits price_basis, so an
-- edit whose only change is TOTAL <-> PER_PERSON is refused as NO_MATERIAL_CHANGE.
--
-- This candidate seeds need.price_basis into the edit exactly as the task holds it (confirmed, as every other
-- seeded fact), and makes the basis part of the material snapshot. It does NOT add the basis to the publication
-- fingerprint: that would invalidate every recorded publication decision and open edit; the basis reaches the
-- application price through rpc_submit_response, which already reads the live task.
-- Function bodies only: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg027e_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg027e_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg027e_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('''need.price_basis''' in prosrc) from pg_proc
       where oid = 'public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure) > 0 then
    raise exception 'PKG027E_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('public.rpc_ai_open_need_edit_conversation_v2(uuid)', '767002f0fc70c6277e8d4db64306bab7'),
    ('private.need_material_snapshot(uuid)', '7838967d0edc8a1ca1a497752efc189d')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG027E_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg027e_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  -- The fact this seeds is the one pkg025d registered, with the vocabulary the task column allows.
  if not exists (select 1 from private.need_fact_registry
                  where fact_key = 'need.price_basis' and schema_version = 'NEED_FACT_V2' and value_type = 'ENUM')
     or (select pg_get_constraintdef(oid) from pg_constraint
          where conrelid = 'public.needs'::regclass and conname = 'needs_price_basis_requires_my_price')
        is distinct from $c$CHECK (((price_basis IS NULL) OR ((price_basis = ANY (ARRAY['TOTAL'::text, 'PER_PERSON'::text])) AND (mode = 'MY_PRICE'::text))))$c$ then
    raise exception 'PKG027E_PRICE_BASIS_CONTRACT_DRIFT';
  end if;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG027E_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg027e_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg027e_patch values
(1, 'public.rpc_ai_open_need_edit_conversation_v2(uuid)',
$a$      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;$a$,
$b$      when 'need.price_basis' then
        -- PKG-027e: an edit keeps what the price is for; without this the edit writer clears it.
        if v_need.mode='MY_PRICE' and v_need.price_basis is not null then
          v_value:=to_jsonb(v_need.price_basis);
          v_display:=case v_need.price_basis when 'PER_PERSON' then 'Po osobi' else 'Ukupno' end;
        end if;
      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;$b$),
(2, 'private.need_material_snapshot(uuid)',
$a$    'requesterPriceRsd', n.requester_price_rsd,$a$,
$b$    'requesterPriceRsd', n.requester_price_rsd,
    'priceBasis', n.price_basis,$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg027e_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG027E_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg027e_before loop
    expected := s.prosrc;
    for p in select * from pkg027e_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG027E_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG027E_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select source_digest from pkg027e_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG027E_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
