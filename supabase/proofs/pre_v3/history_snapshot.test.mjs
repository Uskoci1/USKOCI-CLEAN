import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {migrationSnapshotQuery,sqlProcessFailure} from './history_snapshot.mjs';
test('history equality fingerprints the complete row, including names and SQL bodies', () => {
  const query=migrationSnapshotQuery();
  assert.match(query,/sha256\(convert_to\(to_jsonb\(m\)::text, 'UTF8'\)\)/);
  assert.match(query,/order by version$/);
  assert.doesNotMatch(query,/where|limit|substring|left\(/i);
  assert.match(migrationSnapshotQuery('20260912091100'),/where version <> '20260912091100'/);
});
test('history exclusion is restricted to a single valid version', () => {
  for (const value of ['', '20260912', "20260912091100' or true--", 'x'.repeat(14)])
    assert.throws(()=>migrationSnapshotQuery(value), /INVALID_MIGRATION_VERSION/);
});
test('reproduces the empty-stderr overflow hidden by the former proof diagnostic', () => {
  let failure;
  try { execFileSync(process.execPath,['-e',"process.stdout.write('x'.repeat(2*1024*1024))"],
    {encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:5000}); } catch(e){failure=e;}
  assert.equal(failure?.code,'ENOBUFS');
  assert.equal(String(failure.stderr),'');
  assert.match(sqlProcessFailure(failure), /^LOCAL_SQL:ENOBUFS:status=NONE:/);
});
test('diagnostics do not serialize private process metadata and remain bounded', () => {
  const result=sqlProcessFailure({code:'PRIVATE_CODE',status:1,message:'PRIVATE_MESSAGE',
    stdout:'PRIVATE_STDOUT',spawnargs:['PRIVATE_URL'],stderr:'x'.repeat(4000)});
  assert.ok(result.length<960);assert.doesNotMatch(result,/PRIVATE/);
});
