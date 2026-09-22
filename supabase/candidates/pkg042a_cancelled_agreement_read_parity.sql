-- PKG-042a: apply the already established PKG-029b cancelled-Agreement rule to all three remaining readers.
-- No command, row rewrite, privilege, schema, trigger or certificate change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temporary table pkg042a_patch(ord integer primary key, signature text, before_md5 text,
  after_md5 text, anchor text, replacement text) on commit drop;
create temporary table pkg042a_before(signature text, body text, acl aclitem[], owner_id oid,
  definer boolean, config text[], volatility "char", is_strict boolean) on commit drop;
create temporary table pkg042a_closure(digest text) on commit drop;
insert into pkg042a_patch values
(1, 'public.rpc_home_attention()', '239f2477ae58ec92254edfdeda0455e7', '8a8feab5eb2ba727c637322b0ef044c1', $a$exists(select 1 from public.agreements a where a.selected_response_id = r.id)$a$, $b$exists(select 1 from public.agreements a where a.selected_response_id = r.id and a.status <> 'CANCELLED')$b$),
(2, 'public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid)', 'bc4545fdef9b9c3dd26103693ee2605d', '0e0b1c3fc0cf0612d734c8b3071b1f44', $a$o.raw_need_status, o.agreement_id is not null) as application_state$a$, $b$o.raw_need_status, o.agreement_id is not null and not exists (select 1 from public.agreements ag
        where ag.id = o.agreement_id and ag.status = 'CANCELLED')) as application_state$b$),
(3, 'public.rpc_get_my_task_relations(uuid[])', '8bed3339b05eead6a02a3bd73bd9d514', 'dc7511fdda3a2265068131f5592e6d3c', $a$mine.need_status, mine.agreement_id is not null)$a$, $b$mine.need_status, mine.agreement_id is not null and not exists (select 1 from public.agreements ag
            where ag.id = mine.agreement_id and ag.status = 'CANCELLED'))$b$);

do $pre$
declare pin record; actual text;
begin
  if (select bool_and(md5(replace(p.prosrc,E'\r\n',E'\n')) = x.after_md5)
      from pkg042a_patch x join pg_proc p on p.oid = to_regprocedure(x.signature)) then
    raise exception 'PKG042A_ALREADY_APPLIED';
  end if;
  for pin in select signature, before_md5 from pkg042a_patch union all select * from (values
    ('public.rpc_list_my_applications()', 'fb0f3053c6b9d3cf0464c433f0504f3b'),
    ('private.my_application_state(text,integer,integer,text,boolean)', '236c6c9c9625e4fb92522c6c3a1bfe03')
  ) dependencies(signature,before_md5) loop
    select md5(replace(prosrc,E'\r\n',E'\n')) into actual from pg_proc where oid=to_regprocedure(pin.signature);
    if actual is distinct from pin.before_md5 then raise exception 'PKG042A_PREDECESSOR_DRIFT: %',pin.signature; end if;
  end loop;
  if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
      (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG042A_CLOSURE_NOT_READY'; end if;
  insert into pkg042a_closure values(private.closure_source_digest_v5());
  insert into pkg042a_before select x.signature,p.prosrc,p.proacl,p.proowner,p.prosecdef,p.proconfig,p.provolatile,p.proisstrict
    from pkg042a_patch x join pg_proc p on p.oid=to_regprocedure(x.signature);
end $pre$;

do $patch$
declare item record; def text;
begin
  for item in select * from pkg042a_patch order by ord loop
    def:=pg_get_functiondef(to_regprocedure(item.signature));
    if length(def)-length(replace(def,item.anchor,'')) <> length(item.anchor) then
      raise exception 'PKG042A_ANCHOR: %',item.signature;
    end if;
    execute replace(def,item.anchor,item.replacement);
  end loop;
end $patch$;

do $post$
declare item record; actual record; old record;
begin
  for item in select * from pkg042a_patch order by ord loop
    select prosrc,proacl,proowner,prosecdef,proconfig,provolatile,proisstrict into actual
      from pg_proc where oid=to_regprocedure(item.signature);
    select * into old from pkg042a_before where signature=item.signature;
    if md5(replace(actual.prosrc,E'\r\n',E'\n')) is distinct from item.after_md5
       or actual.prosrc is distinct from replace(old.body,item.anchor,item.replacement) then
      raise exception 'PKG042A_BODY_MISMATCH: %',item.signature;
    end if;
    if (actual.proacl,actual.proowner,actual.prosecdef,actual.proconfig,actual.provolatile,actual.proisstrict)
       is distinct from (old.acl,old.owner_id,old.definer,old.config,old.volatility,old.is_strict) then
      raise exception 'PKG042A_AUTHORITY_CHANGED';
    end if;
  end loop;
  if private.closure_source_digest_v5() is distinct from (select digest from pkg042a_closure)
     or not private.retention_ai_source_ready() then raise exception 'PKG042A_CHANGED_CLOSURE_SOURCE'; end if;
end $post$;
commit;
