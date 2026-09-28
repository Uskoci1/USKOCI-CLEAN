from pathlib import Path
import hashlib
r=Path.cwd()
old=r/'supabase/candidates/p6_discovery_page.sql'
assert hashlib.sha256(old.read_bytes()).hexdigest()=='6a97e14451629dbd2fd02b11962f77c537932bf0ca83b5a12a882d876094ecdb'
s=old.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a));s=s.replace(a,b)
s=s.replace('-- Include inside the dedicated proof transaction; no existing authority is replaced.', '-- Complete PAGE/EXACT_PUBLIC/MAP/PLACES candidate. Include only inside the\n-- dedicated disposable proof transaction; no live or historical authority is replaced.')
rep(' range_from text; range_to text; iso_pattern text:=', ''' grid integer; grid_cells numeric; grid_w numeric; grid_e numeric; grid_s numeric; grid_n numeric; grid_width numeric;
 prefix_text text; facet_area jsonb; before_count bigint; before_text text; before_key text;
 range_from text; range_to text; iso_pattern text:=''')
rep(" else raise exception 'P6_MODE_NOT_IMPLEMENTED' using errcode='22023'; end if;", """ elsif request_mode='MAP' then
  if r-array['mode','filter','anchor','bounds','grid']<>'{}' or not(r?&array['mode','filter','anchor','bounds','grid'])
    or jsonb_typeof(r->'grid') is distinct from 'number' or (r->>'grid')::numeric<>trunc((r->>'grid')::numeric)
    or (r->>'grid')::numeric not between 1 and 24 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  grid:=(r->>'grid')::integer; f:=r->'filter'; scope:=jsonb_build_object('kind','AREA','bounds',r->'bounds'); page_limit:=1;
 elsif request_mode='PLACES' then
  if r-array['mode','filter','anchor','prefix','facetArea','limit','after']<>'{}'
    or not(r?&array['mode','filter','anchor','prefix','facetArea','limit','after'])
    or jsonb_typeof(r->'prefix') is distinct from 'string' or length(r->>'prefix')>500
    or jsonb_typeof(r->'limit') is distinct from 'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)
    or (r->>'limit')::numeric not between 1 and 30 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  prefix_text:=public.p6_discovery_key(r->>'prefix'); f:=r->'filter'; page_limit:=(r->>'limit')::integer;
  facet_area:=r->'facetArea';
  scope:=case when facet_area='null'::jsonb then '{"kind":"ALL"}'::jsonb else jsonb_build_object('kind','AREA','bounds',facet_area) end;
 else raise exception 'P6_MODE_NOT_IMPLEMENTED' using errcode='22023'; end if;""")
rep(" if location_mode='remote' then locality:=null; scope:='{\"kind\":\"ALL\"}'; end if;", """ if request_mode='PLACES' then query_text:=''; locality:=null; end if;
 if location_mode='remote' then
  locality:=null;
  if request_mode<>'MAP' then scope:='{"kind":"ALL"}'; facet_area:='null'::jsonb; end if;
 end if;""")
rep(" filter_key:=md5(f::text);\n if request_mode='PAGE' then", """ -- PLACES binds its prefix/area too; the documented count/text/key cursor
 -- cannot be reused under another facet context without a fresh anchor.
 filter_key:=md5(case when request_mode='PLACES' then jsonb_build_object('filter',f,'prefix',prefix_text,'facetArea',facet_area)::text else f::text end);
 if request_mode in ('PAGE','MAP','PLACES') then""")
rep("   if r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;", "   if request_mode<>'MAP' and r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;")
extra=""" if request_mode='PLACES' and cursor_doc<>'null'::jsonb then
  if jsonb_typeof(cursor_doc) is distinct from 'object' or cursor_doc-array['count','text','key']<>'{}'
    or not(cursor_doc?&array['count','text','key']) or jsonb_typeof(cursor_doc->'count') is distinct from 'number'
    or (cursor_doc->>'count')::numeric<>trunc((cursor_doc->>'count')::numeric)
    or (cursor_doc->>'count')::numeric not between 1 and 9007199254740991
    or jsonb_typeof(cursor_doc->'text') is distinct from 'string' or length(cursor_doc->>'text') not between 1 and 500
    or jsonb_typeof(cursor_doc->'key') is distinct from 'string' or length(cursor_doc->>'key') not between 1 and 500
    or public.p6_discovery_key(cursor_doc->>'text') is distinct from cursor_doc->>'key'
    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
  before_count:=(cursor_doc->>'count')::bigint; before_text:=cursor_doc->>'text'; before_key:=cursor_doc->>'key';
 end if;
 if request_mode='MAP' then
  -- World-anchored grid covers the whole box; never truncate the first N pins.
  loop
   grid_cells:=power(2::numeric,grid);
   grid_w:=least(grid_cells-1,floor((west+180)/360*grid_cells));
   grid_e:=least(grid_cells-1,floor((east+180)/360*grid_cells));
   grid_s:=least(grid_cells-1,floor((south+90)/180*grid_cells));
   grid_n:=least(grid_cells-1,floor((north+90)/180*grid_cells));
   grid_width:=case when west<=east then grid_e-grid_w+1 else least(grid_cells,grid_cells-grid_w+grid_e+1) end;
   exit when grid_width*(grid_n-grid_s+1)<=256;
   grid:=grid-1;
   if grid<1 then raise exception 'P6_GRID_BOUND_FAILED'; end if;
  end loop;
 end if;
"""
rep(' with base as materialized (',extra+' with base as materialized (')
rep("request_mode='PAGE' and n.published_at<=through_at", "request_mode in ('PAGE','MAP','PLACES') and n.published_at<=through_at")
rep("  select * from scoped where time_ok and (before_id is null", "  select * from scoped where request_mode in ('PAGE','EXACT_PUBLIC') and time_ok and (before_id is null")
rep(" ) select jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,", """ ), map_points as materialized (
  select q.id,q.published_at,q.approximate_lat as lat,q.approximate_lng as lng,
   least(grid_cells-1,floor((q.approximate_lng+180)/360*grid_cells)) as gx,
   least(grid_cells-1,floor((q.approximate_lat+90)/180*grid_cells)) as gy
  from qualified q where request_mode='MAP' and time_ok and has_point and in_area
 ), map_representatives as (
  select distinct on(gx,gy) gx,gy,id,lat,lng from map_points order by gx,gy,published_at desc,id desc
 ), map_groups as (
  select gx,gy,count(*) as tasks,count(distinct (lat,lng)) as points,
   min(lng) as left_edge,min(lat) as bottom_edge,max(lng) as right_edge,max(lat) as top_edge
  from map_points group by gx,gy
 ), map_buckets as (
  select g.gx,g.gy,
   case when g.tasks=1 then jsonb_build_object('kind','TASK','key','task:'||m.id,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),'taskId',m.id)
    when g.points=1 then jsonb_build_object('kind','PLACE','key','place:'||m.lat||':'||m.lng,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),'taskCount',g.tasks)
    else jsonb_build_object('kind','CLUSTER','key','cluster:'||grid||':'||g.gx||':'||g.gy,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),
      'taskCount',g.tasks,'distinctPointCount',g.points,'memberBounds',jsonb_build_array(g.left_edge,g.bottom_edge,g.right_edge,g.top_edge)) end as bucket
  from map_groups g join map_representatives m using(gx,gy)
 ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as (
  select distinct on(key) key,text from facet_members order by key,published_at desc,id desc
 ), facet_counts as (select key,count(*) as count from facet_members group by key), facets as (
  select c.key,r.text,c.count from facet_counts c join facet_representatives r using(key)
 ), facet_page as materialized (
  select * from facets where before_count is null or count<before_count or count=before_count and
   (text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C")>(before_text collate pg_catalog."sr-Latn-RS-x-icu",before_key collate pg_catalog."C")
  order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C" limit page_limit+1
 ), facet_shown as (
  select * from facet_page order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C" limit page_limit
 ) select case when request_mode='MAP' then jsonb_build_object(
  'version','DISCOVERY_V1','mode','MAP','asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'coverageBounds',scope->'bounds','effectiveGrid',grid,
  'wholeBounds',(select case when count(*)=0 then null else jsonb_build_array(min(approximate_lng),min(approximate_lat),max(approximate_lng),max(approximate_lat)) end from qualified where time_ok and has_point),
  'buckets',coalesce((select jsonb_agg(bucket order by gx,gy) from map_buckets),'[]'::jsonb),
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,'mapped',(select count(*) from qualified where time_ok),
   'withoutPoint',(select count(*) from qualified where time_ok and not has_point)))
 when request_mode='PLACES' then jsonb_build_object(
  'version','DISCOVERY_V1','mode','PLACES','asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'items',coalesce((select jsonb_agg(jsonb_build_object('key',key,'text',text,'count',count) order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C") from facet_shown),'[]'::jsonb),
  'hasMore',(select count(*)>page_limit from facet_page),
  'nextCursor',case when (select count(*)>page_limit from facet_page) then
   (select jsonb_build_object('count',count,'text',text,'key',key) from facet_shown
    order by count,text collate pg_catalog."sr-Latn-RS-x-icu" desc,key collate pg_catalog."C" desc limit 1) else null end,
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,'everywhere',(select count(*) from qualified where time_ok),
   'inArea',case when scope_mode='ALL' then null else (select count(*) from qualified where time_ok and has_point and in_area) end))
 else jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,""")
rep("from base) modes))) into result;", "from base) modes))) end into result;")
rep(" return result;\nexception", """ if request_mode='MAP' and jsonb_array_length(result->'buckets')>256 then raise exception 'P6_MAP_BOUND_FAILED'; end if;
 if request_mode='PLACES' and exists(select 1 from jsonb_array_elements(result->'items') x
   where length(x->>'text')>500 or length(x->>'key')>500) then raise exception 'P6_PLACE_LABEL_TOO_LONG' using errcode='22023'; end if;
 return result;
exception""")
outputs={r/'supabase/candidates/p6_discovery_all.sql':s}
p=r/'supabase/proofs/discovery/p6_discovery_page_proof.sql'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='02c41c0d0e3b3a9073b3ffe08dbe3096f761dd54534bc255379aba89e878eb28'
proof=p.read_text().replace('p6_discovery_page.sql','p6_discovery_all.sql').replace("perform pg_temp.p6_refuses('{\"mode\":\"MAP\"}','P6_MODE_NOT_IMPLEMENTED');", "perform pg_temp.p6_refuses('{\"mode\":\"MAP\"}','P6_INVALID_REQUEST');")
a="select set_config('request.jwt.claim.sub','',true);"
assert proof.count(a)==1
proof=proof.replace(a,(r/'supabase/proofs/discovery/p6_discovery_spatial_cases.sql').read_text()+a)
outputs[r/'supabase/proofs/discovery/p6_discovery_all_proof.sql']=proof
p=r/'supabase/proofs/discovery/p6_discovery_run.mjs'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='0445daca649b78e7893ebb331ea9e08b114373eaa2c26b951de32a773c37e94d'
runner=p.read_text().replace('p6_discovery_page.sql','p6_discovery_all.sql').replace('p6_discovery_page_proof.sql','p6_discovery_all_proof.sql').replace('p6_discovery_run.mjs','p6_discovery_all_run.mjs').replace('p6-discovery-page-proof.yml','p6-four-mode-proof.yml')
runner=runner.replace("'AUTH_AND_ANON_REFUSALS',", "'MAP_0_1_100_1000_3000_BOUNDED_COMPLETE_COVERAGE', 'MAP_DENSE_SPARSE_WRAPPED_REMOTE_AND_STRICT_REQUEST', 'PLACES_EXACT_COUNTS_COMPLETE_TUPLE_PAGING_AND_SCOPE_BINDING', 'AUTH_AND_ANON_REFUSALS',")
runner=runner.replace("const paths = [", "const paths = ['scripts/proofs/p6-four-mode-builder.py', 'supabase/proofs/discovery/p6_discovery_spatial_cases.sql', ")
runner=runner.replace("unit: 'P6_DISCOVERY_PAGE'", "unit: 'P6_DISCOVERY_FOUR_MODES_SQL'").replace('`${report.result} P6_DISCOVERY_PAGE`','`${report.result} P6_DISCOVERY_FOUR_MODES_SQL`')
outputs[r/'supabase/proofs/discovery/p6_discovery_all_run.mjs']=runner
for path,content in outputs.items():
 assert not path.exists(), 'Candidate path already exists: '+str(path)
 path.write_text(content)
 print(hashlib.sha256(path.read_bytes()).hexdigest(),path.relative_to(r))
