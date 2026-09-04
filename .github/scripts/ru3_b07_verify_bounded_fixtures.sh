#!/usr/bin/env bash
set -euo pipefail
: "${DB_URL:?DB_URL is required}"
q() { psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }

test "$(q "select count(*) from private.publication_policy_bundles;")" = "1"
test "$(q "select count(*) from private.publication_policy_bundles where policy_id='__RU3_B07_CONCURRENCY_POLICY__' and jurisdiction='__RU3_B07_CONCURRENCY_JURISDICTION__';")" = "1"
test "$(q "select count(*) from private.publication_policy_rule_refs;")" = "1"
test "$(q "select count(*) from private.need_publication_decisions where decision_source='B07_SYNTHETIC_DISPOSABLE_PROOF';")" = "3"
test "$(q "select count(*) from private.need_publish_commands where need_id in ('00000000-0000-4000-8000-00000000b0a1'::uuid,'00000000-0000-4000-8000-00000000b0b1'::uuid,'00000000-0000-4000-8000-00000000b0c1'::uuid);")" = "3"
test "$(q "select count(*) from private.dispatch_schedule where need_id in ('00000000-0000-4000-8000-00000000b0a1'::uuid,'00000000-0000-4000-8000-00000000b0b1'::uuid,'00000000-0000-4000-8000-00000000b0c1'::uuid);")" = "3"
test "$(q "select count(*) from public.needs where id in ('00000000-0000-4000-8000-00000000b0a1'::uuid,'00000000-0000-4000-8000-00000000b0b1'::uuid,'00000000-0000-4000-8000-00000000b0c1'::uuid) and status='PUBLISHED';")" = "3"

test "$(q "select has_function_privilege('authenticated','public.rpc_publish_need(uuid,timestamp with time zone)','EXECUTE');")" = "f"
test "$(q "select position('PACKAGE_4_NOT_READY' in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure));")" != "0"
test "$(q "select position('RU3_ALLOW_NOT_ENABLED' in pg_get_functiondef('public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure));")" != "0"
test "$(q "select has_function_privilege('authenticated','public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)','EXECUTE');")" = "t"
test "$(q "select has_function_privilege('service_role','public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)','EXECUTE');")" = "f"

echo "PASS RU3_B07_CONCURRENCY_FIXTURES_BOUNDED immutable_decisions_preserved_until_disposable_stack_destroy"
