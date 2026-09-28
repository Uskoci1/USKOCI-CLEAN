-- SOURCE-ONLY P6 cost delta, layered on the exact Round44 candidate.
-- It changes only the newly introduced P6 functions, not existing authority.
-- Requires the same disposable marker; NOT a canonical DEV apply migration.
do $p6_cost_v2$
declare signature text; definition text; before_body text;
begin
 if current_user<>'postgres' or current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'
  then raise exception 'P6_COST_DISPOSABLE_ONLY'; end if;
 signature:='public.p6_discovery_unquote(text)';
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure(signature);
 if md5(replace(before_body,E'\r\n',E'\n'))<>'d9ab01e57fb2f667ee865f69aa246741' then raise exception 'P6_COST_SOURCE_DRIFT:%',signature; end if;
 if (length(definition)-length(replace(definition,$old$declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin$old$,'')))/length($old$declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin$old$,$new$declare t text; inner_text text; a text; b text;
begin
 if value is null or value='' then return null; end if;
 t:=public.p6_discovery_trim(value);$new$);
 execute definition;
 signature:='public.p6_discovery_area(text,text,boolean)';
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure(signature);
 if md5(replace(before_body,E'\r\n',E'\n'))<>'65f41c2ec10d1bb926f34ecf04b36ec4' then raise exception 'P6_COST_SOURCE_DRIFT:%',signature; end if;
 if (length(definition)-length(replace(definition,$old$declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;$old$,'')))/length($old$declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;$old$,$new$declare a text; c text;
begin
 if remote then return 'Na daljinu'; end if;
 a:=public.p6_discovery_unquote(area);
 if a is not null and (city is null or city='') then return a; end if;
 c:=public.p6_discovery_unquote(city);$new$);
 execute definition;
 signature:='public.rpc_discovery_v1(jsonb)';
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure(signature);
 if md5(replace(before_body,E'\r\n',E'\n'))<>'59dade053b40ebc72046c5397cc7622b' then raise exception 'P6_COST_SOURCE_DRIFT:%',signature; end if;
 if (length(definition)-length(replace(definition,$old$   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,$old$,'')))/length($old$   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,$old$,$new$   case when people>1 then public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) else null::integer end as covered_now,$new$);
 if (length(definition)-length(replace(definition,$old$   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,$old$,'')))/length($old$   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,$old$,$new$   case when request_mode in ('MAP','PLACES') and when_mode='any' then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,$new$);
 if (length(definition)-length(replace(definition,$old$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as ($old$,'')))/length($old$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as ($old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as ($old$,$new$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit),
 shown_covered as materialized (
  select s.*,coalesce(s.covered_now,public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',s.id)))) as projected_covered from shown s
 ), projected as ($new$);
 if (length(definition)-length(replace(definition,$old$'coveredSlots',s.covered_now,$old$,'')))/length($old$'coveredSlots',s.covered_now,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$'coveredSlots',s.covered_now,$old$,$new$'coveredSlots',s.projected_covered,$new$);
 if (length(definition)-length(replace(definition,$old$'acceptsApplications',s.required_slots>s.covered_now and$old$,'')))/length($old$'acceptsApplications',s.required_slots>s.covered_now and$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$'acceptsApplications',s.required_slots>s.covered_now and$old$,$new$'acceptsApplications',s.required_slots>s.projected_covered and$new$);
 if (length(definition)-length(replace(definition,$old$ as item from shown s
 ), map_points$old$,'')))/length($old$ as item from shown s
 ), map_points$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ as item from shown s
 ), map_points$old$,$new$ as item from shown_covered s
 ), map_points$new$);
 if (length(definition)-length(replace(definition,$old$ ), map_representatives as ($old$,'')))/length($old$ ), map_representatives as ($old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ ), map_representatives as ($old$,$new$ ), map_representatives as materialized ($new$);
 if (length(definition)-length(replace(definition,$old$ ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as ($old$,'')))/length($old$ ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as ($old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as ($old$,$new$ ), facet_keys as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
 ), facet_members as materialized (
  select * from facet_keys where key not in ('na daljinu','lokacija nije navedena') and (prefix_text='' or strpos(key,prefix_text)>0)
 ), facet_representatives as materialized ($new$);
 execute definition;
end $p6_cost_v2$;
