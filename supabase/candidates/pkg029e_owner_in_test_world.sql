-- PKG-029e candidate. Deep read 12.11. Owner decision 2026-09-21, approved with "dozvoljavam sve" to the command
-- line "moje prave zadatke vide i test radnici dok testiramo".
-- Contract/proof: docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md
--
-- 12.11: test and real accounts never see each other (private.accounts_same_world, used by the public task policy,
--        dispatch and the re-queue), and the owner's own accounts are REAL while every worker on canonical DEV is a
--        test account, so nobody could ever see the owner's tasks. While testing, the owner's two accounts
--        (OWNER_PERSONAL and OWNER_BUSINESS) share the TEST world. Every other lineage keeps its world: a real
--        person who is not the owner stays apart from test accounts. This is temporary by the owner's own words and
--        must be taken out again before real users arrive.
-- Function body only: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg029e_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg029e_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg029e_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('OWNER_PERSONAL' in prosrc) from pg_proc
       where oid = to_regprocedure('private.account_visibility_world(uuid)')) > 0 then
    raise exception 'PKG029E_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.account_visibility_world(uuid)', 'f36a06ce91215655644f277d3ffa357a')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG029E_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg029e_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG029E_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg029e_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg029e_patch values
(1, 'private.account_visibility_world(uuid)',
$a$                in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR') then 'TEST' else 'REAL' end;$a$,
$b$                in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR',
                    -- PKG-029e, owner decision 2026-09-21 ("dok testiramo"): the owner's own accounts share the
                    -- test world while testing. Take these two out again before real users arrive.
                    'OWNER_PERSONAL','OWNER_BUSINESS') then 'TEST' else 'REAL' end;$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg029e_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG029E_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg029e_before loop
    expected := s.prosrc;
    for p in select * from pkg029e_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG029E_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG029E_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select source_digest from pkg029e_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG029E_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
