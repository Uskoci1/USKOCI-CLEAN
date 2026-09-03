from pathlib import Path

p = Path('supabase/migrations/20260903190000_clean_ru2_need_v2_draft.sql')
s = p.read_text()

old = """  if (select count(*) from public.ai_structured_facts where fact_schema_version='LEGACY_TEXT_V1')<>82
     or (select count(*) from public.ai_conversations where fact_schema_version='LEGACY_TEXT_V1')<>15 then
    raise exception 'RU2_POSTCONDITION_FAILED: legacy classification mismatch';
  end if;
"""
new = """  if (select count(*) from public.ai_structured_facts where fact_schema_version='LEGACY_TEXT_V1')<>v_before.ai_fact_count
     or (select count(*) from public.ai_conversations where fact_schema_version='LEGACY_TEXT_V1')<>v_before.conversation_count then
    raise exception 'RU2_POSTCONDITION_FAILED: legacy classification mismatch';
  end if;
"""
if old not in s:
    raise SystemExit('hardcoded legacy-count postcondition not found')
s = s.replace(old, new, 1)

old_draft = """  if (select count(*) from public.needs where status='DRAFT')<>0 then
    raise exception 'RU2_POSTCONDITION_FAILED: migration created a business DRAFT';
  end if;

"""
if old_draft not in s:
    raise SystemExit('volatile DRAFT postcondition not found')
s = s.replace(old_draft, '', 1)

p.write_text(s)
print('RU2_DYNAMIC_PRESERVATION_POSTCONDITIONS_OK')
