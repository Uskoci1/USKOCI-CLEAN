#!/usr/bin/env bash
# B24 focused proof (registry blocker B24, docs/implementation/product-v1-closure-20260926/finalization-20260927/ROUND_74_P6_PHYSICAL_HONOR_CANDIDATE.md):
# does PostgREST re-execute a request when the called function raises SQLSTATE 40001 deterministically, and does that continue after the client has gone?
# A DISPOSABLE Postgres and a DISPOSABLE PostgREST in docker; no Supabase project, no secret, no canonical DEV access. It MEASURES and prints; it does not decide the fix.
# Order matters: the non-retryable code and the plain function run first, the 40001 function last, because a loop (if there is one) keeps running until the containers are removed.
set -uo pipefail

PGREST_TAG="${PGREST_TAG:-v14.5}"     # canonical DEV reports application_name "PostgREST 14.5" in pg_stat_activity
NET=b24net
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

say() { printf '%s\n' "$*" | tee -a "$SUMMARY"; }
psql_pg() { docker exec -i pg psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -At "$@"; }
rollbacks() { psql_pg -c "select xact_rollback from pg_stat_database where datname='postgres'"; }

cleanup() { docker rm -f rest pg >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker network create "$NET" >/dev/null
docker run -d --name pg --network "$NET" -e POSTGRES_PASSWORD=pw postgres:17 >/dev/null
for i in $(seq 1 60); do docker exec pg pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2

psql_pg <<'SQL'
create role authenticator noinherit login password 'pw';
create role anon nologin;
grant anon to authenticator;
create schema api;
create function api.b24_ok() returns text language sql as $$ select 'ok'::text $$;
create function api.b24_conflict_p0001() returns text language plpgsql as $$
begin raise exception 'B24_VERSION_CONFLICT' using errcode = 'P0001'; end $$;
create function api.b24_conflict_40001() returns text language plpgsql as $$
begin raise exception 'B24_VERSION_CONFLICT' using errcode = '40001'; end $$;
grant usage on schema api to anon;
grant execute on all functions in schema api to anon;
SQL

docker pull "postgrest/postgrest:${PGREST_TAG}" >/dev/null 2>&1 || { say "tag ${PGREST_TAG} not pullable, falling back to latest"; PGREST_TAG=latest; docker pull postgrest/postgrest:latest >/dev/null; }
docker run -d --name rest --network "$NET" -p 3000:3000 \
  -e PGRST_DB_URI="postgres://authenticator:pw@pg:5432/postgres" -e PGRST_DB_SCHEMAS=api -e PGRST_DB_ANON_ROLE=anon \
  "postgrest/postgrest:${PGREST_TAG}" >/dev/null

ready=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 2 -X POST http://127.0.0.1:3000/rpc/b24_ok || true)
  [ "$code" = "200" ] && ready=1 && break
  sleep 1
done
[ "$ready" = 1 ] || { say "PostgREST did not become ready"; docker logs rest | tail -20 | tee -a "$SUMMARY"; exit 1; }

say "## B24 - PostgREST and SQLSTATE 40001"
say "PostgREST image tag: ${PGREST_TAG}; version line: $(docker logs rest 2>&1 | grep -i -m1 'PostgREST' | head -c 160)"
say "Postgres: $(psql_pg -c 'show server_version')"
say ""

probe() {  # name, function
  local name="$1" fn="$2" r0 r1 r2 r3 code
  r0=$(rollbacks)
  code=$(curl -s -o /tmp/b24_body -w '%{http_code} in %{time_total}s' -m 3 -X POST "http://127.0.0.1:3000/rpc/${fn}" || echo "no answer within 3 s (curl exit $?)")
  r1=$(rollbacks); sleep 3
  r2=$(rollbacks); sleep 3
  r3=$(rollbacks)
  say "- ${name}: client saw: ${code}; body: $(head -c 140 /tmp/b24_body 2>/dev/null | tr '\n' ' ')"
  say "  database rollbacks: during the request +$((r1 - r0)); in the next 3 s (client gone) +$((r2 - r1)); in the 3 s after that +$((r3 - r2))"
}

probe "plain function (control)" b24_ok
probe "non-retryable code P0001" b24_conflict_p0001

# The 40001 case is watched second by second: the first run of this proof showed the client getting no answer within 3 s, no top-level rollbacks after the first
# one, and the PostgREST connection still "active" ten seconds later. What it is doing is the question: per second, the connection state and what it waits for,
# top-level commits/rollbacks, how many times the function's error was logged by Postgres, and the CPU of both containers.
errlines() { docker logs pg 2>&1 | grep -c 'B24_VERSION_CONFLICT' || true; }
say ""
say "### SQLSTATE 40001, watched (client times out after 3 s, then 15 more seconds are sampled)"
e0=$(errlines); r0=$(rollbacks); c0=$(psql_pg -c "select xact_commit from pg_stat_database where datname='postgres'")
curl -s -o /tmp/b24_body40001 -w 'client: %{http_code} after %{time_total}s\n' -m 3 -X POST http://127.0.0.1:3000/rpc/b24_conflict_40001 2>&1 | tee -a "$SUMMARY" || true
for s in $(seq 1 15); do
  act=$(psql_pg -c "select coalesce(state,'-')||' / '||coalesce(wait_event_type,'-')||':'||coalesce(wait_event,'-')||' / xact_age='||coalesce(round(extract(epoch from now()-xact_start)::numeric,1)::text,'-')||'s / query_age='||coalesce(round(extract(epoch from now()-query_start)::numeric,1)::text,'-')||'s' from pg_stat_activity where usename='authenticator' and query like 'WITH pgrst_source%' order by query_start desc limit 1")
  r=$(rollbacks); c=$(psql_pg -c "select xact_commit from pg_stat_database where datname='postgres'"); e=$(errlines)
  cpu=$(docker stats --no-stream --format '{{.Name}}={{.CPUPerc}}' pg rest 2>/dev/null | tr '\n' ' ')
  say "t+${s}s: connection: ${act:-none} | commits +$((c - c0)) rollbacks +$((r - r0)) | function errors logged +$((e - e0)) | cpu ${cpu}"
  sleep 1
done

say ""
say "PostgREST connections at the end:"
psql_pg -c "select pid, state, now()-backend_start as age, left(regexp_replace(query, '\s+', ' ', 'g'), 70) from pg_stat_activity where usename='authenticator'" | tee -a "$SUMMARY"
say ""
say "PostgREST log tail:"
docker logs rest 2>&1 | tail -12 | cut -c1-220 | tee -a "$SUMMARY"
say ""
say "Postgres log, last function errors:"
docker logs pg 2>&1 | grep 'B24_VERSION_CONFLICT' | tail -3 | cut -c1-200 | tee -a "$SUMMARY"
exit 0
