from pathlib import Path

path = Path('supabase/proofs/ru3_b07_canonical_publish_runtime_proof.sql')
text = path.read_text(encoding='utf-8')

patched_marker = '$success_private_postconditions$'
if patched_marker in text:
    print('PASS patch_ru3_b07_proof_runtime already_patched')
    raise SystemExit(0)

old_first = """  if (select status from public.needs where id=v_need) <> 'PUBLISHED'\n     or (select count(*) from private.dispatch_schedule where need_id=v_need) <> 1\n     or (select count(*) from private.need_publish_commands where need_id=v_need) <> 1 then\n    raise exception 'RU3_B07_PROOF: publish did not create exact state/schedule/receipt';\n  end if;\n"""
new_first = """  if (select status from public.needs where id=v_need) <> 'PUBLISHED' then\n    raise exception 'RU3_B07_PROOF: authenticated caller did not observe PUBLISHED Need';\n  end if;\n"""

old_replay = """  if (select count(*) from private.dispatch_schedule where need_id=v_need) <> 1\n     or (select count(*) from private.need_publish_commands where need_id=v_need) <> 1 then\n    raise exception 'RU3_B07_PROOF: replay duplicated durable side effects';\n  end if;\n"""

marker = """end\n$success_and_replay$;\n\nreset role;\n\n-- Proof fixtures, including synthetic policy/ALLOW, must leave no rows.\n"""
replacement = """end\n$success_and_replay$;\n\nreset role;\n\ndo $success_private_postconditions$\ndeclare\n  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;\n  v_seq bigint := current_setting('uskoci.ru3_b07_final_allow')::bigint;\nbegin\n  if (select status from public.needs where id=v_need) <> 'PUBLISHED' then\n    raise exception 'RU3_B07_PROOF: publish did not persist PUBLISHED state';\n  end if;\n  if (select count(*) from private.dispatch_schedule where need_id=v_need) <> 1 then\n    raise exception 'RU3_B07_PROOF: publish/replay did not leave exactly one dispatch schedule';\n  end if;\n  if (select count(*) from private.need_publish_commands where need_id=v_need) <> 1 then\n    raise exception 'RU3_B07_PROOF: publish/replay did not leave exactly one command receipt';\n  end if;\n  if not exists (\n    select 1\n      from private.need_publish_commands c\n     where c.need_id=v_need\n       and c.decision_sequence=v_seq\n       and c.client_request_id='ru3-b07-publish-0001'\n  ) then\n    raise exception 'RU3_B07_PROOF: durable receipt not bound to exact final ALLOW decision';\n  end if;\nend\n$success_private_postconditions$;\n\n-- Proof fixtures, including synthetic policy/ALLOW, must leave no rows.\n"""

for label, old in [('authenticated private postcondition', old_first), ('replay private postcondition', old_replay), ('post-success marker', marker)]:
    if old not in text:
        raise SystemExit(f'B07 proof patch source drift: {label} not found')

text = text.replace(old_first, new_first, 1)
text = text.replace(old_replay, '', 1)
text = text.replace(marker, replacement, 1)
path.write_text(text, encoding='utf-8')
print('PASS patch_ru3_b07_proof_runtime privilege_boundary')
