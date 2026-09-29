import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { check, classify, embed, main, readLiveBlock, rowsFromRedovi, summarize } from './osvezi-master-plan.mjs';

const ELEMENTS = ['live-head-short', 'live-branch', 'live-flow-total', 'live-flow-breakdown', 'live-p6-status', 'live-p6-note',
  'live-release-status', 'live-release-note', 'live-next-title', 'live-next-note', 'live-generated', 'live-source-note',
  'live-snapshot-tag', 'live-priority-grid'];

const page = (ids) => `<html><body>${ELEMENTS.map((e) => `<i id="${e}"></i>`).join('')}${ids.map((i) => `<section class="flow-card" data-flow="${i}"></section>`).join('')}
<script id="live-state" type="application/json">{"schemaVersion":1,"source":{"repo":"x/y"},"p6":{"status":"OPEN","note":""}}</script></body></html>`;

const redovi = { redovi: [
  { id: 'A01', naslov: 'Jedan', finalization: { status: 'KOD PROŠAO / UREĐAJ ČEKA', priorities: ['P0', 'P2'] } },
  { id: 'A02', naslov: 'Dva', finalization: { status: 'NOT IMPLEMENTED', priorities: ['P4'] } },
  { id: 'B01', naslov: 'Tri', finalization: { status: 'ZAVRŠEN', priorities: ['P0'] } },
  { id: 'B02', naslov: 'Četiri', finalization: { status: 'MAPIRANO', priorities: [] } },
] };

test('classifier is conservative: done needs an explicit closed status without an open qualifier', () => {
  assert.equal(classify('ZAVRŠEN'), 'done');
  assert.equal(classify('ZAVRŠEN / NATIVE ČEKA'), 'native');
  assert.equal(classify('SOURCE/CI PASS'), 'open');
  assert.equal(classify('NOT IMPLEMENTED'), 'blocked');
  assert.equal(classify('KOD PROŠAO / UREĐAJ ČEKA'), 'native');
  assert.equal(classify('IZVOR PRIPREMLJEN / NIJE PROVERENO'), 'native');
  assert.equal(classify(''), 'open');
});

test('summary counts flows and priorities from the one registry', () => {
  const sum = summarize(rowsFromRedovi(redovi));
  assert.deepEqual(sum.counts, { done: 1, native: 1, blocked: 1, open: 1 });
  assert.equal(sum.flowTotal, 4);
  assert.deepEqual(sum.priorities.P0, { total: 2, done: 1, native: 1, blocked: 0, open: 0 });
  assert.equal(sum.flows.A02.state, 'blocked');
});

test('refresh rewrites only the live block, is idempotent and never lets JSON close the script tag', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plan-'));
  const html = join(dir, 'plan.html'), reg = join(dir, 'redovi.json'), state = join(dir, 'state.json');
  writeFileSync(html, page(['A01', 'A02', 'B01', 'B02'])); writeFileSync(reg, JSON.stringify(redovi));
  writeFileSync(state, JSON.stringify({ p6: { status: 'OPEN', note: 'x </script><b>y' }, next: { title: 'n', note: '' } }));
  const argv = ['--html', html, '--redovi', reg, '--state', state, '--head', 'a'.repeat(40), '--branch', 'b', '--now', '2026-09-30T00:00:00Z'];
  const before = readFileSync(html, 'utf8');
  assert.equal(main(argv), 0);
  const once = readFileSync(html, 'utf8');
  assert.equal(main(argv), 0);
  assert.equal(readFileSync(html, 'utf8'), once);
  const strip = (s) => s.replace(/<script id="live-state"[\s\S]*?<\/script>/, '');
  assert.equal(strip(once), strip(before));
  assert.equal((once.match(/<\/script>/g) || []).length, 1);
  const { state: live } = readLiveBlock(once);
  assert.equal(live.p6.note, 'x </script><b>y');
  assert.equal(live.flowTotal, 4);
  assert.deepEqual(check(once, rowsFromRedovi(redovi)), []);
  assert.ok(embed({ a: '</script>' }).includes(String.fromCharCode(92) + 'u003c/script>'));
});

test('check reports a card without status, a stale status and a missing dashboard element', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plan-'));
  const html = join(dir, 'plan.html'), reg = join(dir, 'redovi.json');
  writeFileSync(html, page(['A01', 'A02', 'B01', 'B02'])); writeFileSync(reg, JSON.stringify(redovi));
  main(['--html', html, '--redovi', reg, '--head', 'c'.repeat(40), '--branch', 'b', '--now', '2026-09-30T00:00:00Z']);
  const good = readFileSync(html, 'utf8');
  const changed = { redovi: redovi.redovi.map((r) => (r.id === 'A01' ? { ...r, finalization: { ...r.finalization, status: 'DRUGI STATUS' } } : r)) };
  assert.ok(check(good, rowsFromRedovi(changed)).some((p) => p.includes('stale status for A01')));
  assert.ok(check(good.replace('id="live-p6-note"', 'id="x"'), null).some((p) => p.includes('#live-p6-note')));
  assert.ok(check(good.replace('data-flow="B02"', 'data-flow="ZZ9"'), null).length > 0);
});
