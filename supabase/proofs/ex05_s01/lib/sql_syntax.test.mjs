// EX05-S01 offline unit test: every SQL statement this package generates (the catalog guard, the chain-facts read, the pin read, the B24 target observation, the fixture and
// pause statements) is parsed by the PostgreSQL grammar (pglast, the same parser the D12 and EX-04 workflows use). No database is needed; the test is skipped when pglast is not installed
// (the offline CI job installs pglast==8.4 first, so it always runs there).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {catalogDigestSql, CHAIN_FACTS_SQL} from './harness.mjs';
import {chainReadSql, loadPins} from './pins.mjs';
import {parseB24Part1Targets, targetObservationSql, CANDIDATE_PATH} from './b24_chain.mjs';
import {SQL, SQL_SAMPLES} from './sql_snippets.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

function interpreter() {
  for (const python of ['python3', 'python']) {
    try { execFileSync(python, ['-c', 'import pglast'], {stdio: 'ignore'}); return python; } catch { /* next */ }
  }
  return null;
}
const python = interpreter();
function statementCount(sql) {
  const script = 'import sys, pglast\nprint(len(pglast.parse_sql(sys.stdin.read())))\n';
  return Number(execFileSync(python, ['-c', script], {input: sql, encoding: 'utf8'}).trim());
}
const opts = {skip: python === null && 'pglast is not installed'};

test('the catalog guard statement is one valid statement', opts, () => assert.equal(statementCount(catalogDigestSql()), 1));
test('the chain-facts statement is one valid statement', opts, () => assert.equal(statementCount(CHAIN_FACTS_SQL), 1));
test('the pin read statement is one valid statement', opts, () => {
  const {rows} = loadPins(readFileSync(root + 'supabase/proofs/ex05_s01/dev_pins.json', 'utf8'));
  assert.equal(statementCount(chainReadSql(rows)), 1);
});
test('the B24 target observation statement is one valid statement', opts, () => {
  const targets = parseB24Part1Targets(readFileSync(root + CANDIDATE_PATH, 'utf8'));
  assert.equal(statementCount(targetObservationSql(targets)), 1);
});
test('every fixed SQL snippet the proofs run parses (with sample identifiers)', opts, () => {
  for (const [name, args] of Object.entries(SQL_SAMPLES)) {
    const sql = SQL[name](...args);
    assert.ok(statementCount(sql) >= 1, name);
  }
});
