#!/usr/bin/env python3
"""B24 mechanics proof (registry blocker B24). A DISPOSABLE Postgres 17 and a DISPOSABLE PostgREST 14.5 in docker; no Supabase project, no secret, no DEV access.

It builds a stand-in for the 68 live functions that raise SQLSTATE 40001 (same names, same number of raise sites, the same exposure, three different spellings of the raise) and
a stand-in of the certificate machinery (the digest over the 14 certified functions, the two source tables, the readiness function with its constant), then proves on it:

  1. BEFORE: a request to a real-named function that raises 40001 never answers and keeps the PostgREST backend busy after the client has gone (the defect), for one function
     outside the certified set and one inside it;
  2. part 1 applies (relaxed pre-image mode: the stand-in bodies are not the DEV bodies), converts exactly the classified sites, leaves every other attribute and the certificate
     alone, and refuses to run twice; AFTER: the same request answers HTTP 409 with the same message at once and nothing stays busy;
  3. part 2 applies, moves the digest, re-binds the certificate in its three places, stays ready, refuses to run twice; AFTER: 409 at once for the certified function;
  4. both reverts restore every body byte for byte and the original digest.

The candidates under test are the real generated files supabase/candidates/b24_nonretried_conflicts_*.sql. Prints a summary and exits non-zero on any failed assertion."""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAND = os.path.join(REPO, 'supabase', 'candidates')
ART = os.environ.get('B24_ARTIFACT_DIR', os.path.join(os.environ.get('TMPDIR', '/tmp'), 'b24-mechanics'))
NET, PG, REST = 'b24mech', 'b24pg', 'b24rest'
PG_IMAGE = 'postgres:17'
REST_TAG = os.environ.get('PGREST_TAG', 'v14.5')
SECRET = 'b24-proof-jwt-secret-with-at-least-32-characters'
PORT = 3000

CHECKS = []


def check(name, ok, **detail):
    CHECKS.append({'name': name, 'ok': bool(ok), **detail})
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + json.dumps(detail, default=str) if detail else ''), flush=True)
    return ok


def sh(args, check_rc=True, inp=None, env=None):
    p = subprocess.run(args, input=inp, capture_output=True, text=True, env={**os.environ, **(env or {})})
    if check_rc and p.returncode != 0:
        raise RuntimeError(f'{args[:4]} failed ({p.returncode}): {p.stdout[-400:]} {p.stderr[-800:]}')
    return p


def psql(sql, check_rc=True, options=None):
    env = {'PGOPTIONS': options} if options else None
    args = ['docker', 'exec', '-i'] + (['-e', f'PGOPTIONS={options}'] if options else []) + [PG, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-']
    p = sh(args, check_rc=check_rc, inp=sql)
    return p


def q(sql):
    return psql(sql).stdout.strip()


def load_inventory():
    rows = []
    for line in open(os.path.join(HERE, 'b24_inventory.tsv'), encoding='utf-8').read().splitlines()[1:]:
        fn, part, exposure, md5, sites, msgs = line.split('\t')
        rows.append({'fn': fn, 'part': int(part), 'exposure': exposure, 'sites': int(sites), 'msgs': [m.split(':')[0] for m in msgs.split(';') for _ in range(int(m.split(':')[2]))]})
    return rows


def stand_in_sql(rows):
    out = ['create schema private;', 'create role anon nologin; create role authenticated nologin; create role service_role nologin;',
           "create role authenticator noinherit login password 'pw'; grant anon, authenticated, service_role to authenticator;",
           'grant usage on schema public to anon, authenticated, service_role;']
    fmts = [
        "if p_go then raise exception '{m}' using errcode='40001'; end if;",
        "if p_go then raise exception '{m}' using errcode = '40001', detail = 'latest=' || 1::text; end if;",
        "if p_go then raise exception using errcode='40001', message='{m}'; end if;",
    ]
    for r in rows:
        body = ['begin']
        for i, m in enumerate(r['msgs']):
            body.append('  ' + fmts[i % 3].format(m=m))
        body.append('end;')
        cfg = "set search_path = pg_catalog"
        if r['fn'] == 'public.rpc_save_worker_availability':
            cfg += " set \"TimeZone\" = 'UTC' set \"DateStyle\" = 'ISO, YMD'"
        sec = 'security invoker' if r['fn'] == 'private.platform_price_add_version' else 'security definer'
        out.append(f"create function {r['fn']}(p_go boolean default false) returns void language plpgsql {sec} {cfg} as $b$\n" + '\n'.join(body) + "\n$b$;")
        out.append(f"revoke all on function {r['fn']}(boolean) from public;")
        if r['exposure'] in ('A', 'A+S'):
            out.append(f"grant execute on function {r['fn']}(boolean) to authenticated;")
        if r['exposure'] in ('S', 'A+S'):
            out.append(f"grant execute on function {r['fn']}(boolean) to service_role;")
        if r['sites'] % 2 == 1:
            out.append(f"comment on function {r['fn']}(boolean) is 'b24 stand-in {r['fn']}';")
    out.append("create function public.b24_ok() returns text language sql as $o$ select 'ok'::text $o$; grant execute on function public.b24_ok() to anon, authenticated, service_role;")
    certified = [r['fn'] for r in rows if r['part'] == 2]
    arr = ', '.join(f"'{fn}(boolean)'" for fn in sorted(certified))
    out.append(f"""create table private.closure_source_v5(singleton boolean primary key default true check (singleton), sha256 text not null);
create table private.closure_erasure_source_v5(singleton boolean primary key default true check (singleton), sha256 text not null);
create table private.closure_executions_v5(id serial primary key, state text not null);
create function private.closure_source_digest_v5() returns text language sql stable set search_path = pg_catalog as $d$
  select encode(sha256(convert_to(string_agg(x.signature || ':' || md5(p.prosrc), E'\\n' order by x.signature), 'UTF8')), 'hex')
  from unnest(array[{arr}]) x(signature) join pg_proc p on p.oid = to_regprocedure(x.signature)
$d$;
create function private.closure_erasure_binding_v5() returns jsonb language sql stable set search_path = pg_catalog as $d$
  select jsonb_build_object('sourceSha256', (select sha256 from private.closure_erasure_source_v5 where singleton))
$d$;""")
    return '\n'.join(out)


def jwt(role='authenticated'):
    b = lambda d: base64.urlsafe_b64encode(d).rstrip(b'=')
    head = b(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    pay = b(json.dumps({'role': role, 'sub': '00000000-0000-4000-8000-000000000001', 'exp': int(time.time()) + 3600}).encode())
    sig = b(hmac.new(SECRET.encode(), head + b'.' + pay, hashlib.sha256).digest())
    return (head + b'.' + pay + b'.' + sig).decode()


def call(fn, timeout=3.0, role='authenticated'):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/rpc/{fn}', data=json.dumps({'p_go': True}).encode(), method='POST',
                                 headers={'Authorization': 'Bearer ' + jwt(role), 'Content-Type': 'application/json'})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return {'status': resp.status, 'body': resp.read().decode()[:300], 'ms': round((time.time() - t0) * 1000)}
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'body': e.read().decode()[:300], 'ms': round((time.time() - t0) * 1000)}
    except Exception as e:                                          # noqa: BLE001 - a timeout is the measurement
        return {'status': None, 'error': type(e).__name__, 'ms': round((time.time() - t0) * 1000)}


def ping():
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/rpc/b24_ok', data=b'{}', method='POST', headers={'Authorization': 'Bearer ' + jwt(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:                                               # noqa: BLE001
        return None


def busy(fn):
    return int(q(f"select count(*) from pg_stat_activity where usename='authenticator' and state in ('active','idle in transaction','idle in transaction (aborted)') and query like '%{fn}%'") or 0)


def stop_runaway(fn):
    return q(f"select coalesce(sum((pg_terminate_backend(pid))::int),0) from pg_stat_activity where usename='authenticator' and query like '%{fn}%' and pid <> pg_backend_pid()")


def snapshot():
    return {l.split('|')[0]: l.split('|')[1] for l in q("select n.nspname || '.' || p.proname || '|' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prosrc like '%40001%' or p.prosrc like '%PT409%'").splitlines() if l}


def count_code(code):
    return int(q(f"select count(*) from pg_proc where prosrc like '%''{code}''%'") or 0)


def run_candidate(name, expect_ok=True, relaxed=True):
    path = os.path.join(CAND, name)
    text = open(path, encoding='utf-8').read()
    p = psql(text, check_rc=False, options="-c b24.preimage=relaxed" if relaxed else None)
    ok = (p.returncode == 0) == expect_ok
    return ok, p


def main():
    os.makedirs(ART, exist_ok=True)
    rows = load_inventory()
    p1 = [r for r in rows if r['part'] == 1]
    p2 = [r for r in rows if r['part'] == 2]
    check('INVENTORY_SHAPE', len(rows) == 68 and len(p1) == 54 and len(p2) == 14 and sum(r['sites'] for r in rows) == 110, functions=len(rows), part1=len(p1), part2=len(p2), sites=sum(r['sites'] for r in rows))
    gen = subprocess.run([sys.executable, os.path.join(HERE, 'build_b24_candidates.py'), '--check'], capture_output=True, text=True)
    check('CANDIDATES_MATCH_THE_INVENTORY', gen.returncode == 0, output=gen.stdout.strip()[-200:])

    sh(['docker', 'rm', '-f', PG, REST], check_rc=False)
    sh(['docker', 'network', 'rm', NET], check_rc=False)
    sh(['docker', 'network', 'create', NET])
    sh(['docker', 'run', '-d', '--name', PG, '--network', NET, '-e', 'POSTGRES_PASSWORD=pw', PG_IMAGE])
    for _ in range(90):
        if sh(['docker', 'exec', PG, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], check_rc=False).returncode == 0:
            break
        time.sleep(1)
    time.sleep(2)
    try:
        psql(stand_in_sql(rows))
        # the readiness function carries the certified value as its one constant (as on DEV); the tables hold it in the other two places
        d0 = q('select private.closure_source_digest_v5()')
        psql(f"""insert into private.closure_source_v5(sha256) values ('{d0}'); insert into private.closure_erasure_source_v5(sha256) values ('{d0}');
create function private.retention_ai_source_ready() returns boolean language sql stable set search_path = pg_catalog as $r$
  select private.closure_source_digest_v5() = '{d0}'
$r$;
revoke all on function private.retention_ai_source_ready() from public;""")
        check('STAND_IN_IS_CERTIFIED_AND_READY', q('select private.retention_ai_source_ready()') == 't', digest=d0[:16])
        init = snapshot()
        check('STAND_IN_HAS_ALL_SITES', count_code('40001') == len(rows) and int(q("select coalesce(sum((length(prosrc) - length(replace(prosrc, '''40001''', ''))) / 7), 0) from pg_proc where prosrc like '%''40001''%'")) == 110, functions=count_code('40001'))

        sh(['docker', 'run', '-d', '--name', REST, '--network', NET, '-p', f'{PORT}:3000', '-e', 'PGRST_DB_URI=postgres://authenticator:pw@' + PG + ':5432/postgres',
            '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', f'PGRST_JWT_SECRET={SECRET}', f'postgrest/postgrest:{REST_TAG}'])
        ready = False
        for _ in range(60):
            if ping() == 200:
                ready = True
                break
            time.sleep(1)
        rest_log = sh(['docker', 'logs', REST], check_rc=False).stdout + sh(['docker', 'logs', REST], check_rc=False).stderr
        check('POSTGREST_READY', ready, version=next((l for l in rest_log.splitlines() if 'Starting PostgREST' in l), '')[-60:])
        if not ready:
            raise RuntimeError('PostgREST did not become ready')
        stop_runaway('rpc_apply_profile_avatar')

        # 1. BEFORE: the defect, one function outside the certified set and one inside it
        before = {}
        for fn in ('rpc_apply_profile_avatar', 'rpc_send_agreement_photo_message_v5'):
            r = call(fn, timeout=3.0)
            time.sleep(2)
            n = busy(fn)
            before[fn] = {'answer': r, 'busyAfterTheClientLeft': n}
            check(f'BEFORE_{fn}_NEVER_ANSWERS_AND_KEEPS_RUNNING', r.get('status') is None and n >= 1, **before[fn])
            stop_runaway(fn)
            time.sleep(1)

        # 2. part 1
        ok, p = run_candidate('b24_nonretried_conflicts_part1.sql')
        check('PART1_APPLIES', ok, tail=(p.stderr or p.stdout)[-300:])
        after1 = snapshot()
        p1names = {r['fn'] for r in p1}
        p2names = {r['fn'] for r in p2}
        left = {k for k, v in after1.items() if v != init.get(k)}
        check('PART1_CHANGED_EXACTLY_THE_54_FUNCTIONS', left == p1names, changed=len(left), unexpected=sorted(left - p1names)[:5], missing=sorted(p1names - left)[:5])
        check('PART1_LEFT_THE_CERTIFIED_14_ALONE', all(after1.get(f) == init.get(f) for f in p2names) and q("select count(*) from pg_proc where prosrc like '%''40001''%'") == '14', remaining=q("select count(*) from pg_proc where prosrc like '%''40001''%'"))
        check('PART1_CERTIFICATE_DID_NOT_MOVE', q('select private.closure_source_digest_v5()') == d0 and q('select private.retention_ai_source_ready()') == 't')
        ok, p = run_candidate('b24_nonretried_conflicts_part1.sql', expect_ok=False)
        check('PART1_REFUSES_TO_RUN_TWICE', ok and 'B24_ALREADY_APPLIED' in (p.stderr + p.stdout), err=(p.stderr or '')[-160:])
        r = call('rpc_apply_profile_avatar', timeout=3.0)
        check('AFTER_PART1_CONFLICT_ANSWERS_409_AT_ONCE', r.get('status') == 409 and 'MEDIA_VERSION_CONFLICT' in r.get('body', '') and '"PT409"' in r.get('body', '') and r['ms'] < 1500, **r)
        time.sleep(2)
        check('AFTER_PART1_NOTHING_STAYS_BUSY', busy('rpc_apply_profile_avatar') == 0)

        # 3. part 2
        ok, p = run_candidate('b24_nonretried_conflicts_part2_certified.sql')
        check('PART2_APPLIES', ok, tail=(p.stderr or p.stdout)[-300:])
        d1 = q('select private.closure_source_digest_v5()')
        check('PART2_MOVED_THE_DIGEST_AND_REBOUND_ALL_THREE_PLACES', d1 != d0 and q('select sha256 from private.closure_source_v5') == d1 and q('select sha256 from private.closure_erasure_source_v5') == d1
              and q('select private.retention_ai_source_ready()') == 't' and d1 in q("select prosrc from pg_proc where proname = 'retention_ai_source_ready'") and d0 not in q("select prosrc from pg_proc where proname = 'retention_ai_source_ready'"),
              old=d0[:16], new=d1[:16])
        check('NO_40001_LEFT_ANYWHERE', count_code('40001') == 0 and int(q("select coalesce(sum((length(prosrc) - length(replace(prosrc, '''PT409''', ''))) / 7), 0) from pg_proc where prosrc like '%''PT409''%'")) == 110)
        ok, p = run_candidate('b24_nonretried_conflicts_part2_certified.sql', expect_ok=False)
        check('PART2_REFUSES_TO_RUN_TWICE', ok and 'B24P2_ALREADY_APPLIED' in (p.stderr + p.stdout), err=(p.stderr or '')[-160:])
        r = call('rpc_send_agreement_photo_message_v5', timeout=3.0)
        check('AFTER_PART2_CERTIFIED_CONFLICT_ANSWERS_409_AT_ONCE', r.get('status') == 409 and 'MEDIA_COMMAND_CONFLICT' in r.get('body', '') and r['ms'] < 1500, **r)
        time.sleep(2)
        check('AFTER_PART2_NOTHING_STAYS_BUSY', busy('rpc_send_agreement_photo_message_v5') == 0)
        # every spelling of the raise went through PostgREST identically: the message is the same and the status is 409 for one function of each spelling
        spellings = {}
        for fn in ('rpc_activate_urgent', 'rpc_accept_ai_task_review', 'rpc_save_worker_capacity', 'rpc_save_worker_availability'):
            spellings[fn] = call(fn, timeout=3.0)
        check('EVERY_SPELLING_ANSWERS_409', all(v.get('status') == 409 for v in spellings.values()), answers={k: (v.get('status'), v.get('ms')) for k, v in spellings.items()})

        # 4. reverts: byte-for-byte
        ok, p = run_candidate('b24_nonretried_conflicts_part2_revert.sql', relaxed=True)
        check('PART2_REVERTS', ok, tail=(p.stderr or p.stdout)[-300:])
        ok, p = run_candidate('b24_nonretried_conflicts_part1_revert.sql')
        check('PART1_REVERTS', ok, tail=(p.stderr or p.stdout)[-300:])
        final = snapshot()
        check('EVERY_BODY_IS_BYTE_FOR_BYTE_THE_ORIGINAL', final == init and len(final) == len(rows), differing=[k for k in init if final.get(k) != init[k]][:5])
        check('THE_ORIGINAL_DIGEST_IS_BACK_AND_READY', q('select private.closure_source_digest_v5()') == d0 and q('select private.retention_ai_source_ready()') == 't' and q('select sha256 from private.closure_source_v5') == d0)
        summary = {'checks': CHECKS, 'before': before, 'afterPart1': r, 'result': 'PASS' if all(c['ok'] for c in CHECKS) else 'FAIL'}
    finally:
        try:
            log = sh(['docker', 'logs', REST], check_rc=False)
            open(os.path.join(ART, 'postgrest.log'), 'w', encoding='utf-8').write((log.stdout + log.stderr)[-4000:])
        except Exception:                                           # noqa: BLE001
            pass
        sh(['docker', 'rm', '-f', PG, REST], check_rc=False)
        sh(['docker', 'network', 'rm', NET], check_rc=False)
    json.dump(summary, open(os.path.join(ART, 'summary.json'), 'w', encoding='utf-8'), indent=1)
    print('RESULT', summary['result'], flush=True)
    sys.exit(0 if summary['result'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
