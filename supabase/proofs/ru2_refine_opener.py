from pathlib import Path

p = Path('supabase/migrations/20260903190000_clean_ru2_need_v2_draft.sql')
s = p.read_text()

start_marker = 'create or replace function public.rpc_ai_open_conversation(p_purpose text)'
end_marker = 'grant execute on function public.rpc_ai_open_conversation(text) to authenticated, service_role;'
if start_marker not in s or end_marker not in s:
    raise SystemExit('legacy opener block not found')
start = s.index(start_marker)
end = s.index(end_marker, start) + len(end_marker)

replacement = '''create or replace function public.rpc_ai_open_need_conversation_v2()
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  insert into public.ai_conversations(account_id,purpose,fact_schema_version)
  values(v_uid,'NEED_INTAKE','NEED_FACT_V2')
  returning id into v_id;

  return v_id;
end
$function$;

revoke all on function public.rpc_ai_open_need_conversation_v2()
from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_open_need_conversation_v2()
to authenticated;'''

s = s[:start] + replacement + s[end:]

needle = "  if not has_function_privilege('authenticated','public.rpc_ai_correct_fact_v2(uuid,jsonb,text)','EXECUTE')\n"
insert = """  if has_function_privilege('anon','public.rpc_ai_open_need_conversation_v2()','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_ai_open_need_conversation_v2()','EXECUTE')
     or position('fact_schema_version' in pg_get_functiondef('public.rpc_ai_open_conversation(text)'::regprocedure)) > 0 then
    raise exception 'RU2_POSTCONDITION_FAILED: backward-compatible V2 opener mismatch';
  end if;

"""
if needle not in s:
    raise SystemExit('postcondition insertion point not found')
s = s.replace(needle, insert + needle, 1)

p.write_text(s)
print('RU2_ADDITIVE_OPENER_PATCHED')
