import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WORK_KINDS, readWorkPreferences, readWorkPreferencesPatch, patchWorkPreferences,
  additionalDispatchBlockers, mergeReviewedNotifications, experienceYears } from './preferences.contract.mjs';

const contract = JSON.parse(readFileSync(new URL('./contract.json', import.meta.url), 'utf8'));
const registry = { version: contract.kinds.classificationVersion, sha256: contract.registrySha256 };
const base = () => ({
  registryVersion: registry.version, registrySha256: registry.sha256,
  desiredWorkKinds: [], declinedWorkKinds: [], workNotes: [], proactiveNotifications: true,
  urgentTasksEnabled: null, legacySameDayUrgentNotifications: true,
  notifications: { revision: 4, opportunitiesEnabled: true, urgentDuringQuietHours: false },
});
const task = (patch = {}) => ({ workKinds: ['CISCENJE'], urgent: false, legacySameDayUrgent: false, ...patch });
const decide = (prefs, value = task()) => additionalDispatchBlockers(prefs, value, registry);

test('frozen metadata agrees with the actual closed taxonomy and every captured function-body pin', () => {
  assert.deepEqual(WORK_KINDS, contract.kinds.kinds);
  for (const file of ['live-functions.json', 'live-dependencies.json']) {
    const evidence = JSON.parse(readFileSync(new URL('./evidence/' + file, import.meta.url), 'utf8'));
    for (const fn of evidence) assert.equal(createHash('md5').update(fn.body).digest('hex'), fn.body_md5, fn.signature);
  }
  const evidence = JSON.parse(readFileSync(new URL('./evidence/live-functions.json', import.meta.url), 'utf8'));
  const taxonomy = evidence.find(fn => fn.signature.startsWith('private.work_kinds_v5('));
  for (const kind of WORK_KINDS) assert.ok(taxonomy.body.includes("'" + kind + "'"));
});
test('baseline preserves legacy dispatch without claiming skill, availability or delivery eligibility', () => {
  assert.deepEqual(decide(base()), { blockers: [], manualEligibilityChanged: false });
});
test('preference documents cannot silently omit fields or admit unknown ones', () => {
  const { notifications, ...missing } = base();
  assert.throws(() => readWorkPreferences(missing));
  assert.throws(() => readWorkPreferences({ ...base(), pushEnabled: true }));
  assert.throws(() => readWorkPreferences({ ...base(), desiredWorkKinds: ['UNSUPPORTED'] }));
  assert.throws(() => readWorkPreferences({ ...base(), desiredWorkKinds: ['CISCENJE', 'CISCENJE'] }));
  assert.throws(() => readWorkPreferences({ ...base(), urgentTasksEnabled: 'false' }));
  assert.throws(() => readWorkPreferences({ ...base(), notifications: { ...notifications, revision: -1 } }));
});
test('provider cannot propose version, source revision, legacy urgency, push permission or hidden commands', () => {
  for (const patch of [{ registryVersion: 'WK-2' }, { legacySameDayUrgentNotifications: false },
    { notifications: { revision: 5 } }, { notifications: { pushEnabled: true } }, { __command: 'save' }]) {
    assert.throws(() => readWorkPreferencesPatch(patch));
  }
});
test('editing one preference preserves every unmentioned value and never mutates the source document', () => {
  const initial = { ...base(), desiredWorkKinds: ['CISCENJE', 'DOSTAVA'] };
  const next = patchWorkPreferences(initial, { declinedWorkKinds: ['DOSTAVA'] });
  assert.deepEqual(next.desiredWorkKinds, ['CISCENJE', 'DOSTAVA']);
  assert.deepEqual(next.notifications, initial.notifications);
  assert.deepEqual(initial.declinedWorkKinds, []);
});
test('fine-grained negative prose cannot be promoted to an executable broad work kind', () => {
  assert.throws(() => readWorkPreferencesPatch({ declinedWorkKinds: ['ne prenosim klavire'] }));
  assert.throws(() => readWorkPreferencesPatch({ declinedWorkKinds: ['PREVOZ_BEZ_NOSENJA'] }));
});
test('exact abilities and limitations remain descriptive without turning a coarse kind into an exclusion', () => {
  const workNotes = ['Mogu da nosim, ne mogu da prevozim.', 'Не носим клавире.'];
  const prefs = patchWorkPreferences(base(), { workNotes });
  assert.deepEqual(prefs.workNotes, workNotes);
  assert.deepEqual(prefs.declinedWorkKinds, []);
  assert.deepEqual(decide(prefs, task({ workKinds: ['SELIDBE_PREVOZ'] })),
    { blockers: [], manualEligibilityChanged: false });
  assert.deepEqual(patchWorkPreferences(prefs, { urgentTasksEnabled: false }).workNotes, workNotes);
  assert.deepEqual(base().workNotes, []);
});
test('descriptive notes are bounded and explicit edits do not silently truncate user wording', () => {
  for (const workNotes of [[' '], ['x'.repeat(501)], Array.from({ length: 21 }, (_, i) => String(i)),
    ['same', 'same'], [42], 'not an array']) assert.throws(() => readWorkPreferencesPatch({ workNotes }));
  assert.deepEqual(readWorkPreferencesPatch({ workNotes: ['Š'.repeat(500)] }).workNotes, ['Š'.repeat(500)]);
});
test('decline wins for mixed tasks even when another required kind is desired', () => {
  const prefs = { ...base(), desiredWorkKinds: ['CISCENJE'], declinedWorkKinds: ['DOSTAVA'] };
  assert.deepEqual(decide(prefs, task({ workKinds: ['CISCENJE', 'DOSTAVA'] })).blockers, ['DECLINED_WORK_KIND']);
});
test('desired work narrows automatic selection while never granting manual eligibility', () => {
  const prefs = { ...base(), desiredWorkKinds: ['DOSTAVA'] };
  assert.deepEqual(decide(prefs), { blockers: ['OUTSIDE_DESIRED_WORK_KINDS'], manualEligibilityChanged: false });
  assert.deepEqual(decide(prefs, task({ workKinds: ['DOSTAVA'] })).blockers, []);
});
test('unknown classified work is not silently admitted through an explicit desired-kind list', () => {
  assert.deepEqual(decide({ ...base(), desiredWorkKinds: ['CISCENJE'] }, task({ workKinds: [] })).blockers, ['OUTSIDE_DESIRED_WORK_KINDS']);
  assert.deepEqual(decide(base(), task({ workKinds: [] })).blockers, []);
});
test('proactive pause blocks automatic suggestions and is independent of the delivery category', () => {
  const prefs = { ...base(), proactiveNotifications: false };
  assert.deepEqual(decide(prefs).blockers, ['PROACTIVE_NOTIFICATIONS_PAUSED']);
  assert.deepEqual(decide({ ...base(), notifications: { ...base().notifications, opportunitiesEnabled: false } }).blockers, []);
});
test('all-HITNO preference table preserves legacy fallback across urgent schedules', () => {
  for (const urgent of [false, true]) for (const legacySameDayUrgent of [false, true])
    for (const urgentTasksEnabled of [null, false, true]) for (const legacy of [false, true]) {
      const prefs = { ...base(), urgentTasksEnabled, legacySameDayUrgentNotifications: legacy };
      const result = decide(prefs, task({ urgent, legacySameDayUrgent }));
      const expected = !urgent ? [] : urgentTasksEnabled === false ? ['URGENT_TASKS_PAUSED']
        : urgentTasksEnabled === null && legacySameDayUrgent && !legacy ? ['SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'] : [];
      assert.deepEqual(result.blockers, expected, JSON.stringify({ urgent, legacySameDayUrgent, urgentTasksEnabled, legacy }));
    }
});
test('a changed registry rejects a frozen review before using a new alias interpretation', () => {
  assert.throws(() => additionalDispatchBlockers(base(), task(), { ...registry, sha256: 'a'.repeat(64) }), /REGISTRY_STALE/);
});
test('reviewed delivery change preserves push consent, unrelated categories and quiet-hour interval', () => {
  const current = { push_enabled: false, in_app_enabled: true, opportunities_enabled: true,
    urgent_overrides_quiet_hours: false, quiet_hours_enabled: true, quiet_start: '22:00',
    quiet_end: '08:00', quiet_timezone: 'Europe/Belgrade', dogovor_enabled: false };
  const prefs = patchWorkPreferences(base(), { notifications: { opportunitiesEnabled: false, urgentDuringQuietHours: true } });
  const merged = mergeReviewedNotifications(current, 4, prefs);
  assert.equal(merged.changed, true);
  assert.deepEqual(merged.settings, { ...current, opportunities_enabled: false, urgent_overrides_quiet_hours: true });
  assert.equal(current.urgent_overrides_quiet_hours, false);
});
test('independent settings revision must make an AI review stale, even for an apparently equal subset', () => {
  assert.throws(() => mergeReviewedNotifications({ opportunities_enabled: true, urgent_overrides_quiet_hours: false }, 5, base()), /STALE/);
});
test('unchanged notification choices require no separate settings write or new consent row', () => {
  const merged = mergeReviewedNotifications({ opportunities_enabled: true, urgent_overrides_quiet_hours: false }, 4, base());
  assert.equal(merged.changed, false);
});
test('experience uses only the current integer0..80 contract without invented units or inference', () => {
  for (const value of [0, 1, 5, 80]) assert.equal(experienceYears(value), value);
  for (const value of [-1, 81, 2.5, '5', null, undefined, true]) assert.throws(() => experienceYears(value));
});
