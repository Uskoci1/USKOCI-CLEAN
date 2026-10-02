// EX05-S01 offline tests of offline_report.mjs (TAP summary to the small report the evidence table reads).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tapReport} from '../offline_report.mjs';

const script = fileURLToPath(new URL('../offline_report.mjs', import.meta.url));
const green = 'TAP version 13\nok 1 - a\n1..2\n# tests 158\n# suites 5\n# pass 158\n# fail 0\n# cancelled 0\n# skipped 0\n';

test('a green summary with exit 0 is PASS with the counts node printed', () => {
  const report = tapReport(green, 0);
  assert.equal(report.result, 'PASS'); assert.equal(report.tests, 158); assert.equal(report.pass, 158); assert.equal(report.checks.length, 158);
  assert.ok(report.checks.every(check => check.result === 'PASS'));
});

test('a failing test, a non-zero exit, a cancelled test, an empty run and a missing summary are each a FAIL', () => {
  assert.equal(tapReport(green.replace('# pass 158', '# pass 157').replace('# fail 0', '# fail 1'), 1).result, 'FAIL');
  assert.equal(tapReport(green, 1).result, 'FAIL');
  assert.equal(tapReport(green.replace('# cancelled 0', '# cancelled 1'), 0).result, 'FAIL');
  assert.equal(tapReport(green.replace('# tests 158', '# tests 0').replace('# pass 158', '# pass 0'), 0).result, 'FAIL');
  const missing = tapReport('TAP version 13\nnot ok 1 - crashed\n', 1);
  assert.equal(missing.result, 'FAIL'); assert.equal(missing.summarised, false); assert.equal(missing.tests, 0);
});

test('the failing run keeps the failed count visible in checks', () => {
  const report = tapReport(green.replace('# pass 158', '# pass 150').replace('# fail 0', '# fail 8'), 1);
  assert.equal(report.checks.filter(check => check.result === 'FAIL').length, 8); assert.equal(report.pass, 150);
});

test('the command line writes the report and exits 1 on a FAIL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ex05-s01-offline-'));
  writeFileSync(join(dir, 'ok.tap'), green); writeFileSync(join(dir, 'bad.tap'), green.replace('# fail 0', '# fail 2'));
  const ok = spawnSync(process.execPath, [script, '--tap', join(dir, 'ok.tap'), '--exit', '0', '--out', join(dir, 'ok.json')], {encoding: 'utf8'});
  assert.equal(ok.status, 0, ok.stderr); assert.equal(JSON.parse(readFileSync(join(dir, 'ok.json'), 'utf8')).result, 'PASS');
  const bad = spawnSync(process.execPath, [script, '--tap', join(dir, 'bad.tap'), '--exit', '0', '--out', join(dir, 'bad.json')], {encoding: 'utf8'});
  assert.equal(bad.status, 1); assert.equal(JSON.parse(readFileSync(join(dir, 'bad.json'), 'utf8')).result, 'FAIL');
  assert.notEqual(spawnSync(process.execPath, [script, '--tap', join(dir, 'ok.tap')], {encoding: 'utf8'}).status, 0);
});
