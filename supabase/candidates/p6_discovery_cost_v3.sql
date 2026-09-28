-- SOURCE ONLY: layer on the exact P6 original plus cost_v2. Not a live migration.
-- Avoid locality normalization only when no consumer needs it, retaining the
-- complete original concatenated-text fallback, including cross-field matches.
do $p6_cost_v3$
declare definition text; before_body text;
begin
 if current_user<>'postgres' or current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'
  then raise exception 'P6_COST_DISPOSABLE_ONLY'; end if;
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)');
 if md5(replace(before_body,E'\r\n',E'\n'))<>'008c92e33b8edfbe3cc7b5263b99dac8' then raise exception 'P6_COST_V2_SOURCE_DRIFT'; end if;
 if (length(definition)-length(replace(definition,$old$   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,$old$,'')))/length($old$   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,$old$,$new$   case when request_mode='PLACES' or locality is not null
     or query_text<>'' and strpos(lower(coalesce(n.title,'') collate pg_catalog."sr-Latn-RS-x-icu"),query_text)=0
    then public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::text end as area_text,$new$);
 if (length(definition)-length(replace(definition,$old$   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text$old$,'')))/length($old$   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text$old$,$new$   and (query_text='' or strpos(lower(coalesce(b.title,'') collate pg_catalog."sr-Latn-RS-x-icu"),query_text)>0
    or strpos(lower((coalesce(b.title,'')||' '||b.area_text$new$);
 execute definition;
end $p6_cost_v3$;
