// EX05-S01 offline unit tests of the finding classifiers (G22: push ON / in-app OFF; G16: group sends emit no event). Pure functions: the proofs RECORD an observation and the
// classifier names the finding, so the verdict logic itself is tested here without a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FINDING, classifyInAppOffPush, classifyGroupNotifications, FAIL_ON_UNEXPECTED} from './findings.mjs';

const gapObservation = () => ({
  preferences: {inAppEnabled: false, pushEnabled: true, dogovorEnabled: true},
  inApp: {state: 'SUPPRESSED', suppressionReason: 'IN_APP_OFF'},
  push: {state: 'CREATED', suppressionReason: null},
  begin: {kind: 'SEND', eventType: 'MESSAGE_RECEIVED', eventIdPresent: true},
  expoMessages: 1,
  resolver: {kind: 'UNAVAILABLE'},
  ack: {markedEventCount: 0},
  window: {targetMatches: true},
});

test('G22: a push that arrives for an in-app-OFF recipient whose exact target is UNAVAILABLE is the reproduced contract gap', () => {
  assert.equal(classifyInAppOffPush(gapObservation()), FINDING.G22_GAP);
});

test('G22: when the resolver serves the exact target there is no gap', () => {
  const obs = gapObservation(); obs.resolver = {kind: 'AGREEMENT_MESSAGE'}; obs.ack = {markedEventCount: 1};
  assert.equal(classifyInAppOffPush(obs), FINDING.G22_NO_GAP);
});

test('G22: when no PUSH delivery is created for the combination the gap is not reachable', () => {
  const obs = gapObservation(); obs.push = {state: 'SUPPRESSED', suppressionReason: 'PUSH_OFF'}; obs.begin = null; obs.expoMessages = 0;
  assert.equal(classifyInAppOffPush(obs), FINDING.G22_PUSH_NOT_CREATED);
});

test('G22: an in-app delivery that is NOT suppressed, a missing observation or an odd resolver answer is an unexpected shape (a harness or contract surprise, never a finding)', () => {
  const unsuppressed = gapObservation(); unsuppressed.inApp = {state: 'CREATED', suppressionReason: null};
  assert.equal(classifyInAppOffPush(unsuppressed), FINDING.UNEXPECTED);
  assert.equal(classifyInAppOffPush(null), FINDING.UNEXPECTED);
  assert.equal(classifyInAppOffPush({}), FINDING.UNEXPECTED);
  const odd = gapObservation(); odd.resolver = {kind: 'SOMETHING_ELSE'};
  assert.equal(classifyInAppOffPush(odd), FINDING.UNEXPECTED);
  const noEvent = gapObservation(); noEvent.begin = {kind: 'SEND', eventType: 'MESSAGE_RECEIVED', eventIdPresent: false};
  assert.equal(classifyInAppOffPush(noEvent), FINDING.UNEXPECTED);
});

test('G16: a group send that adds a message and no event, no delivery is the reproduced gap; any event or delivery means the contract changed', () => {
  assert.equal(classifyGroupNotifications({messagesAdded: 1, eventsAdded: 0, deliveriesAdded: 0, invalidationRowsAdded: 0}), FINDING.G16_GAP);
  assert.equal(classifyGroupNotifications({messagesAdded: 1, eventsAdded: 2, deliveriesAdded: 4, invalidationRowsAdded: 0}), FINDING.G16_CHANGED);
  assert.equal(classifyGroupNotifications({messagesAdded: 1, eventsAdded: 0, deliveriesAdded: 1, invalidationRowsAdded: 0}), FINDING.G16_CHANGED);
  assert.equal(classifyGroupNotifications({messagesAdded: 0, eventsAdded: 0, deliveriesAdded: 0, invalidationRowsAdded: 0}), FINDING.UNEXPECTED);
  assert.equal(classifyGroupNotifications(undefined), FINDING.UNEXPECTED);
});

test('only the unexpected shape fails a run: a reproduced gap is a finding, never a red build', () => {
  assert.deepEqual(FAIL_ON_UNEXPECTED, [FINDING.UNEXPECTED]);
  assert.notEqual(FINDING.G22_GAP, FINDING.UNEXPECTED);
});
