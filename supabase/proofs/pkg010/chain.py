#!/usr/bin/env python3
"""PKG-010 exact-head V5 contract chain (disposable database only).

Reconstructs the ordered 147-file history on the disposable live79 database and
executes the ordered V5 proofs at their exact predecessor positions:

  1. the recorded live80-87 aliases (MIGRATION_PROVENANCE.json live_history_snapshot)
     and the pending source migrations up to history count 116 are replayed with
     psql exactly as the PKG-003/PKG-006/PKG-008 proof workflows do;
  2. every proof listed in chain.json then runs in order with node. Each proof
     applies its own migration file(s) through closure_runtime.apply (git blob
     equality, history snapshot before/after) and writes its report into
     PRE_V3_ARTIFACT_DIR;
  3. this driver asserts the history count before and after every proof, the
     report result and sourceSha, and the final 147/20260913081242 history.

PKG010_PROOFS=all (default) runs every listed proof and is the only receipt-grade
mode. A comma-separated subset is diagnostic only: the files owned by unlisted
proofs are replayed with psql and the summary records mode=DIAGNOSTIC_SUBSET,
which the package receipt refuses. `--plan` prints the derived plan without a
database. No live project, provider or device is touched.
"""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.environ.get('GITHUB_WORKSPACE') or os.getcwd()
MANIFEST = os.path.join(ROOT, 'supabase', 'proofs', 'pkg010', 'chain.json')
PROVENANCE = os.path.join(ROOT, 'supabase', 'migrations', 'MIGRATION_PROVENANCE.json')
PROOF_DIR = 'supabase/proofs/pre_v3'
TAG = '$pkg010stmt$'
APPLY = re.compile(r"apply\(report,\s*(?:'([^']+)'|(\w+)),\s*(\d+)\)")
CONST = re.compile(r"const\s+(\w+)\s*=\s*'(2026\d{10}_[^']+\.sql)'")


def read_text(path):
    with open(path, encoding='utf-8', newline='') as fh:
        return fh.read()


def targets_of(script):
    """(file, predecessor) pairs the proof applies through closure_runtime.apply."""
    src = read_text(os.path.join(ROOT, PROOF_DIR, script)).replace('\r\n', '\n')
    consts = dict(CONST.findall(src))
    out = []
    for m in APPLY.finditer(src):
        file = m.group(1) or consts.get(m.group(2))
        if not file:
            raise SystemExit(f'PKG010_UNRESOLVED_APPLY_TARGET {script} {m.group(0)}')
        out.append((file, int(m.group(3))))
    return out


def plan(manifest, prov):
    pending = prov['pending_forward_migrations']
    files = [p['file'] for p in pending]
    aliases = [e for e in prov['live_history_snapshot']['entries'] if e['version'] > manifest['replay']['liveBaseVersion']]
    if len(aliases) != manifest['replay']['liveAliasCount']:
        raise SystemExit(f'PKG010_ALIAS_COUNT {len(aliases)}')
    steps, owned = [], {}
    for proof in manifest['proofs']:
        targets = targets_of(proof['script'])
        for i, (file, predecessor) in enumerate(targets):
            if file not in files:
                raise SystemExit(f'PKG010_UNKNOWN_MIGRATION {proof["script"]} {file}')
            if files.index(file) + manifest['replay']['historyAfterAliases'] != predecessor or predecessor != targets[0][1] + i:
                raise SystemExit(f'PKG010_PREDECESSOR_MISMATCH {proof["script"]} {file} {predecessor}')
            if file in owned:
                raise SystemExit(f'PKG010_FILE_OWNED_TWICE {file}')
            owned[file] = proof['script']
        steps.append({**proof, 'predecessor': targets[0][1] if targets else None, 'applies': [t[0] for t in targets]})
    through = manifest['replay']['replayedByPsqlThroughCount']
    for index, file in enumerate(files):
        count = manifest['replay']['historyAfterAliases'] + index + 1
        if (count <= through) == (file in owned):
            raise SystemExit(f'PKG010_REPLAY_BOUNDARY {file} count={count}')
    if manifest['replay']['historyAfterAliases'] + len(files) != manifest['finalHistoryCount'] or files[-1][:14] != manifest['finalVersion']:
        raise SystemExit('PKG010_FINAL_HISTORY_MISMATCH')
    return aliases, pending, steps


def main():
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    prov = json.load(open(PROVENANCE, encoding='utf-8'))
    aliases, pending, steps = plan(manifest, prov)
    if '--plan' in sys.argv[1:]:
        for s in steps:
            print(f"{s['script']:45s} predecessor={s['predecessor']} applies={[f[:14] for f in s['applies']]} domain={s['pkg010Domain']}")
        print(f"aliases={len(aliases)} pending={len(pending)} final={manifest['finalHistoryCount']}/{manifest['finalVersion']}")
        return

    db = os.environ['RU5_DEVICE_DB_URL']
    sha = os.environ['GITHUB_SHA']
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    if not re.fullmatch(r'[0-9a-f]{40}', sha) or head != sha:
        raise SystemExit(f'PKG010_SHA_MISMATCH env={sha} head={head}')
    art = os.environ.get('PRE_V3_ARTIFACT_DIR') or '/tmp/pkg010-artifacts'
    os.makedirs(art, exist_ok=True)
    selected = os.environ.get('PKG010_PROOFS', 'all').strip() or 'all'
    subset = None if selected == 'all' else {s.strip() for s in selected.split(',') if s.strip()}
    if subset is not None and (subset - {s['script'] for s in steps}):
        raise SystemExit(f'PKG010_UNKNOWN_PROOF {sorted(subset - {s["script"] for s in steps})}')
    summary = {
        'package': manifest['package'], 'gapIds': manifest['gapIds'], 'candidateSha': sha, 'result': 'RUNNING',
        'mode': 'FULL_CHAIN' if subset is None else 'DIAGNOSTIC_SUBSET', 'selectedProofs': 'all' if subset is None else sorted(subset),
        'replayedByPsql': [], 'proofs': [], 'history': None, 'disposableDbOnly': True, 'liveAccess': False, 'providerCalled': False,
    }

    def write_summary():
        with open(os.path.join(art, 'pkg010-chain-summary.json'), 'w', encoding='utf-8') as fh:
            fh.write(json.dumps(summary, indent=2) + '\n')

    def scalar(query):
        return subprocess.run(['psql', db, '-X', '-Atc', query], text=True, capture_output=True, check=True).stdout.strip()

    def history():
        raw = scalar("select count(*)::text || '/' || coalesce(max(version),'') from supabase_migrations.schema_migrations")
        count, version = raw.split('/')
        return int(count), version

    ACTIVITY = ("select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select pid, usename, application_name, state, wait_event_type, wait_event,"
                " extract(epoch from now()-xact_start)::int xact_seconds, extract(epoch from now()-state_change)::int state_seconds,"
                " pg_blocking_pids(pid) blocked_by, left(regexp_replace(coalesce(query,''), '\\s+', ' ', 'g'), 300) query"
                " from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and backend_type = 'client backend'"
                " and (state <> 'idle' or xact_start is not null) order by xact_start nulls last) r")

    def activity():
        """Diagnostic only: sessions that are active, waiting or idle in transaction (a proof process is never alive between steps)."""
        try:
            return json.loads(scalar(ACTIVITY))
        except Exception as error:  # noqa: BLE001 - diagnostics must never mask the real failure
            return [{'diagnosticError': str(error)[:300]}]

    def fail(reason, log_path=None):
        summary['result'] = 'FAIL'
        summary['failure'] = reason
        summary['history'] = '%d/%s' % history()
        summary['activityAtFailure'] = activity()
        write_summary()
        print('activity_at_failure=' + json.dumps(summary['activityAtFailure'])[:4000], flush=True)
        if log_path and os.path.exists(log_path):
            sys.stdout.write(read_text(log_path)[-3000:] + '\n')
        raise SystemExit('PKG010_CHAIN_FAILED ' + reason)

    def run_sql(query, label):
        r = subprocess.run(['psql', db, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
        if r.returncode:
            sys.stdout.write(r.stdout[-4000:])
            sys.stderr.write(r.stderr[-4000:])
            fail('REPLAY_SQL ' + label)

    def replay(file, version, name):
        path = os.path.join(ROOT, 'supabase', 'migrations', file)
        print(f'replay_source={file} recorded_as={version}_{name}', flush=True)
        r = subprocess.run(['psql', db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path], text=True, capture_output=True)
        if r.returncode:
            sys.stdout.write(r.stdout[-4000:])
            sys.stderr.write(r.stderr[-4000:])
            fail('REPLAY_APPLY ' + file)
        body = read_text(path)
        if TAG in body:
            fail('REPLAY_TAG_COLLISION ' + file)
        run_sql("insert into supabase_migrations.schema_migrations(version,name,statements) "
                f"values ('{version}','{name}',array[{TAG}{body}{TAG}]);", file)
        summary['replayedByPsql'].append(file)

    count, version = history()
    if (count, version) != (manifest['replay']['liveBaseCount'], manifest['replay']['liveBaseVersion']):
        fail(f'LIVE_BASE_MISMATCH {count}/{version}')

    # The disposable database's minute scheduler (cron job uskoci_marketplace_tick ->
    # select private.marketplace_tick(25)) is paused for the whole chain exactly as
    # v5_retention_compatibility_proof.mjs pauses it for its own run: under chain load a
    # tick held row locks for 10+ seconds and made proof RPCs (57014) and the erasure
    # proof's drift DDL (20 s psql bound) time out behind it (runs 35060803243 and
    # 35061654279). The tick's own contracts are proven by the legal P2/P3 proofs and by
    # v5_retention_compatibility_proof, which invoke it directly; that proof's own
    # pause/restore is idempotent against an already paused job.
    def scheduler_job():
        jobs = json.loads(scalar("select coalesce(jsonb_agg(to_jsonb(j)),'[]') from cron.job j where jobname='uskoci_marketplace_tick'"))
        if len(jobs) != 1:
            fail(f'SCHEDULER_JOB_COUNT {len(jobs)}')
        return jobs[0]

    def tick_backends():
        return json.loads(scalar("select coalesce(jsonb_agg(pid),'[]') from pg_stat_activity where application_name='pg_cron'"
                                 " and state is distinct from 'idle' and query like 'select private.marketplace_tick%'"))

    def open_runs(jobid):
        return int(scalar(f"select count(*) from cron.job_run_details where jobid={jobid} and end_time is null and status not in ('succeeded','failed')"))

    job_before = scheduler_job()
    run_sql(f"begin;set local lock_timeout='5s';select cron.alter_job(job_id:={job_before['jobid']}::bigint,active:=false);commit;", 'scheduler_pause')
    drain_started = time.monotonic()
    while tick_backends() or open_runs(job_before['jobid']):
        if time.monotonic() - drain_started > 120:
            fail('SCHEDULER_DRAIN_TIMEOUT')
        time.sleep(1)
    summary['localScheduler'] = {'job': job_before['jobname'], 'jobid': job_before['jobid'], 'before': job_before, 'paused': True,
                                 'drainedSeconds': round(time.monotonic() - drain_started, 1), 'afterPause': scheduler_job(),
                                 'note': 'Paused for the whole chain (same cron.alter_job form as v5_retention_compatibility_proof.mjs); no proof assertion changed.'}
    print(f"scheduler_paused job={job_before['jobname']} jobid={job_before['jobid']} drained_in={summary['localScheduler']['drainedSeconds']}s", flush=True)
    write_summary()
    for e in aliases:
        replay(e.get('file') or f"{e['version']}_{e['name']}.sql", e['version'], e['name'])
    if history()[0] != manifest['replay']['historyAfterAliases']:
        fail('ALIAS_HISTORY_MISMATCH %d/%s' % history())
    cursor = 0  # next pending file index

    def replay_until(target_count):
        nonlocal cursor
        while history()[0] < target_count:
            p = pending[cursor]
            replay(p['file'], p['version'], p['name'])
            cursor += 1
        run_sql("notify pgrst, 'reload schema';", 'reload')

    write_summary()
    for step in steps:
        entry = {'script': step['script'], 'report': step['report'], 'pkg010Domain': step['pkg010Domain'],
                 'predecessor': step['predecessor'], 'applies': step['applies'], 'result': None}
        if subset is not None and step['script'] not in subset:
            entry['result'] = 'SKIPPED_REPLAYED_BY_PSQL'
            summary['proofs'].append(entry)
            write_summary()
            continue
        if step['applies']:
            replay_until(step['predecessor'])
            count = history()[0]
            if count != step['predecessor']:
                fail(f"PREDECESSOR {step['script']} expected {step['predecessor']} actual {count}")
            expected_files = [p['file'] for p in pending[cursor:cursor + len(step['applies'])]]
            if expected_files != step['applies']:
                fail(f"ORDER {step['script']} expected {expected_files} proof applies {step['applies']}")
        before = history()
        stray = activity()
        if stray:
            entry['activityBefore'] = stray
            print(f"activity_before {step['script']}: " + json.dumps(stray)[:2000], flush=True)
        log_path = os.path.join(art, step['script'] + '.log')
        started = time.monotonic()
        with open(log_path, 'w', encoding='utf-8') as log:
            try:
                code = subprocess.run(['node', f"{PROOF_DIR}/{step['script']}"], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                      env={**os.environ, 'GITHUB_SHA': sha, 'PRE_V3_ARTIFACT_DIR': art},
                                      timeout=manifest['proofTimeoutSeconds']).returncode
            except subprocess.TimeoutExpired:
                code = 124
        entry['exitCode'] = code
        entry['seconds'] = round(time.monotonic() - started, 3)
        report_path = os.path.join(art, step['report'])
        report = json.load(open(report_path, encoding='utf-8')) if os.path.exists(report_path) else {'result': 'MISSING'}
        entry['result'] = report.get('result')
        entry['checks'] = len(report.get('checks', []))
        entry['failure'] = report.get('failure')
        entry['migrations'] = report.get('migrations')
        after = history()
        leftover = activity()
        if leftover:
            entry['activityAfter'] = leftover
            print(f"activity_after {step['script']}: " + json.dumps(leftover)[:2000], flush=True)
        entry['historyBefore'] = '%d/%s' % before
        entry['historyAfter'] = '%d/%s' % after
        summary['proofs'].append(entry)
        write_summary()
        print(f"{step['script']} exit={code} result={entry['result']} checks={entry['checks']} history={entry['historyAfter']} seconds={entry['seconds']}", flush=True)
        if code or report.get('result') != 'PASS':
            fail(f"PROOF {step['script']} exit={code} result={report.get('result')} failure={report.get('failure')}", log_path)
        if report.get('sourceSha') != sha:
            fail(f"PROOF_SOURCE {step['script']} {report.get('sourceSha')}", log_path)
        if step['applies']:
            if after[0] != step['predecessor'] + len(step['applies']) or report.get('historyCount') != after[0]:
                fail(f"HISTORY_AFTER {step['script']} {after} report={report.get('historyCount')}", log_path)
            recorded = scalar("select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations where version in (%s)"
                              % ','.join("'%s'" % f[:14] for f in step['applies']))
            if recorded != ','.join(f[:14] for f in step['applies']):
                fail(f"HISTORY_ROWS {step['script']} {recorded}", log_path)
            cursor += len(step['applies'])
        elif after != before:
            fail(f"HISTORY_CHANGED_WITHOUT_APPLY {step['script']} {before} {after}", log_path)
    replay_until(manifest['finalHistoryCount'])
    count, version = history()
    if (count, version) != (manifest['finalHistoryCount'], manifest['finalVersion']):
        fail(f'FINAL_HISTORY {count}/{version}')
    summary['history'] = f'{count}/{version}'
    summary['localScheduler']['afterChain'] = scheduler_job()
    summary['result'] = 'PASS'
    summary['domainProofs'] = [p['script'] for p in summary['proofs'] if p['pkg010Domain'] and p['result'] == 'PASS']
    write_summary()
    with open(os.path.join(art, 'pkg010-schema.txt'), 'w', encoding='utf-8') as fh:
        fh.write(summary['history'] + '\n')
    print(f"PASS PKG010_V5_CONTRACT_CHAIN mode={summary['mode']} proofs={len([p for p in summary['proofs'] if p['result'] == 'PASS'])} history={summary['history']}", flush=True)


if __name__ == '__main__':
    main()
