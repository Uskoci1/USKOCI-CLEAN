// Pure source-admission tests: no database, network or environment side effects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readD0140aPredecessorPlan } from './d0140a_bundle_registration_predecessor.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/policy/d0140a_bundle_registration_files.json', 'utf8'));
const SOURCE_DOC = 'docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md';
const SOURCE_SHA = '792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa';

test('plan admits exactly the frozen live87 inventory plus one pending forward file', () => {
  const plan = readD0140aPredecessorPlan();
  assert.equal(plan.historical_predecessor_count, 87);
  assert.equal(plan.source_migration_count, 88);
  assert.equal(plan.expected_predecessor_count, 87);
  assert.equal(plan.source_inventory.at(-1).file, unit.forward_file);
});

test('candidate and forward bytes are identical and match the manifest digests', () => {
  const forward = readFileSync(`supabase/migrations/${unit.forward_file}`);
  assert.deepEqual(forward, readFileSync(unit.candidate_file));
  assert.equal(forward.length, unit.bytes);
  assert.equal(createHash('md5').update(forward).digest('hex'), unit.md5);
  assert.equal(createHash('sha256').update(forward).digest('hex'), unit.sha256);
  assert.ok(!forward.includes(13), 'forward file must be LF only');
});

test('the owner-locked source document is unchanged and every seeded rule id and outcome comes from it verbatim', () => {
  const doc = readFileSync(SOURCE_DOC, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(doc).digest('hex'), SOURCE_SHA, 'source document changed: re-verify the registration');
  assert.match(doc, /Status: `OWNER_LOCKED_MINIMUM \/ NOT_PRODUCTION_ACTIVATED`/);
  const docRules = Object.fromEntries([...doc.matchAll(/^\| `(RS-MIN-\d{3})` \| .*? \| `([A-Z_]+)`/gm)].map(m => [m[1], m[2]]));
  const text = readFileSync(`supabase/migrations/${unit.forward_file}`, 'utf8');
  const seeded = Object.fromEntries([...text.matchAll(/\('(RS-MIN-\d{3})','([A-Z_]+)'\)/g)].map(m => [m[1], m[2]]));
  assert.equal(Object.keys(docRules).length, 16);
  assert.deepEqual(seeded, docRules);
  assert.ok(text.includes(`'source_sha256','${SOURCE_SHA}'`));
  assert.ok(text.includes("'RS_PUBLICATION_POLICY_MINIMUM',1,'RS',false,false,false"), 'bundle must be registered unreviewed, incomplete, inactive');
  assert.ok(!/is_reviewed\s*=\s*true|is_active\s*=\s*true|reviewed_at\s*=|activated_at\s*=/i.test(text), 'migration must not review or activate');
  assert.ok(!/create (or replace )?function|alter function|grant |revoke /i.test(text), 'migration must not touch any function, grant or the ALLOW gate');
});

test('provenance declares the unit as pending and not live', () => {
  const provenance = JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json', 'utf8'));
  const pending = provenance.pending_forward_migrations.find(entry => entry.file === unit.forward_file);
  assert.ok(pending, 'pending entry missing');
  assert.equal(pending.classification, 'PENDING_FORWARD_MIGRATION');
  assert.equal(pending.live_applied, false);
  assert.equal(pending.raw_md5, unit.md5);
  assert.equal(pending.predecessor_live_migration_count, 87);
  assert.equal(pending.predecessor_live_head, '20260907135905');
});
