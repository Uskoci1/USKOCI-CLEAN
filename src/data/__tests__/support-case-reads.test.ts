import { decodeSupportDetail, decodeSupportInbox, decodeSupportSnapshot } from '../supportCaseReadDecoders';
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000001', E = '30000000-0000-4000-8000-000000000001', D = '40000000-0000-4000-8000-000000000001';
const time = '2026-09-13T05:00:00.123456Z';
const row = () => ({ id: C, caseNumber: '71', channel: 'SERVICE', topic: 'TECHNICAL', status: 'RECEIVED', revision: 1,
  lastSequence: '1', createdAt: time, updatedAt: time, context: null, unread: false });
const inbox = () => ({ accountId: A, mode: 'OWN', operatorAvailable: false, cases: [row()], nextBeforeCaseNumber: null, authoritative: true });
const event = () => ({ id: E, caseId: C, sequence: '1', kind: 'CREATE', authorRole: 'AUTHOR', body: 'Pomoć', createdAt: time, decisionId: null, appealId: null });
const detail = () => ({ accountId: A, case: { id: C, caseNumber: '71', authorAccountId: A, channel: 'SERVICE', topic: 'TECHNICAL',
  title: 'Pomoć', desiredOutcome: null, context: {}, status: 'RECEIVED', revision: 1, lastSequence: '1', createdAt: time, updatedAt: time },
  viewerRole: 'AUTHOR', operatorAvailable: false, allowedActions: ['AUTHOR_REPLY'], events: [event()], decisions: [], appeals: [], evidence: [], nextAfterSequence: null, authoritative: true });
const task = () => ({ kind: 'TASK', id: C, revision: 2, content: { title: 'Zadatak', description: 'Javni opis', status: 'ACTIVE', createdAt: time,
  executionMode: 'STATIONARY', countryCode: 'RS', submitterRole: 'REQUESTER', media: [] } });
const review = () => ({ kind: 'TASK_REVIEW', id: C, revision: null, content: { draftId: null, draftRevision: 0, displayedContentDigest: 'a'.repeat(64),
  publicFacts: [{ key: 'need.title', value: 'Zadatak', displayValue: 'Zadatak', status: 'CONFIRMED' }], safety: 'ALLOW', createdAt: time,
  policy: { bundleId: null, version: null, contentSha256: null }, evaluation: null, media: [] } });
it('accepts bounded owner inbox and an explicit actual-grant operator view', () => {
  expect(decodeSupportInbox(inbox(), A, 'OWN', null)).toEqual(inbox());
  expect(decodeSupportInbox({ ...inbox(), mode: 'OPERATOR', operatorAvailable: true }, A, 'OPERATOR', null)).not.toBeNull();
  expect(decodeSupportInbox({ ...inbox(), mode: 'OPERATOR' }, A, 'OPERATOR', null)).toBeNull();
  expect(decodeSupportInbox({ ...inbox(), mode: 'SAFETY', operatorAvailable: true }, A, 'SAFETY', null)).toBeNull();
});
it.each([{ accountId: B }, { authoritative: false }, { operatorAvailable: 'true' }, { title: 'PRIVATE' }, { nextBeforeCaseNumber: '71' },
  { cases: [row(), row()] }, { cases: [{ ...row(), title: 'PRIVATE' }] }, { cases: [{ ...row(), context: { kind: 'TASK', id: C, revision: 1, body: 'PRIVATE' } }] }])(
  'rejects leaked or contradictory inbox envelopes %#', patch => { expect(decodeSupportInbox({ ...inbox(), ...patch }, A, 'OWN', null)).toBeNull(); });
it('enforces descending stable case cursors and inclusive page bound', () => {
  const cases = Array.from({ length: 50 }, (_, i) => ({ ...row(), id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, caseNumber: String(100 - i) }));
  expect(decodeSupportInbox({ ...inbox(), cases, nextBeforeCaseNumber: '51' }, A, 'OWN', '101')).not.toBeNull();
  expect(decodeSupportInbox({ ...inbox(), cases, nextBeforeCaseNumber: '50' }, A, 'OWN', null)).toBeNull();
  expect(decodeSupportInbox({ ...inbox(), cases: cases.reverse(), nextBeforeCaseNumber: null }, A, 'OWN', null)).toBeNull();
  expect(decodeSupportInbox(inbox(), A, 'OWN', '71')).toBeNull();
});
it('accepts owned detail and retains author precedence even when that account has operator access', () => {
  expect(decodeSupportDetail(detail(), A, C, '0')).toEqual(detail());
  expect(decodeSupportDetail({ ...detail(), operatorAvailable: true }, A, C, '0')).not.toBeNull();
  expect(decodeSupportDetail({ ...detail(), operatorAvailable: true, viewerRole: 'OPERATOR' }, A, C, '0')).toBeNull();
  const other = { ...detail(), case: { ...detail().case, authorAccountId: B }, viewerRole: 'OPERATOR', operatorAvailable: true, allowedActions: ['CLAIM'] };
  expect(decodeSupportDetail(other, A, C, '0')).not.toBeNull();
});
it.each([{ allowedActions: ['DECIDE'] }, { allowedActions: ['CREATE'] }, { allowedActions: ['AUTHOR_REPLY', 'AUTHOR_REPLY'] },
  { operatorAvailable: 'true' }, { rawAudit: 'PRIVATE' }, { events: [{ ...event(), body: { private: 'object' } }] },
  { events: [{ ...event(), authorRole: 'ADMIN' }] }, { events: [{ ...event(), caseId: B }] }, { nextAfterSequence: '1' }])(
  'rejects unknown action authority, private fields or invalid detail events %#', patch => { expect(decodeSupportDetail({ ...detail(), ...patch }, A, C, '0')).toBeNull(); });
it('binds decision and selected evidence to actual visible events and denies side effects', () => {
  const decision = { id: D, caseId: C, caseRevision: 2, outcome: 'ACCEPTED', reasonCode: 'REVIEWED', explanation: 'Obrazloženje', effect: 'NONE',
    evidenceIds: [], priorDecisionId: null, createdAt: time, reviewType: 'INITIAL' };
  const data = { ...detail(), case: { ...detail().case, revision: 2, lastSequence: '2', status: 'DECIDED' }, allowedActions: ['APPEAL'],
    events: [{ ...event(), sequence: '2', kind: 'DECIDE', authorRole: 'OPERATOR', decisionId: D }], decisions: [decision],
    evidence: [{ id: B, eventId: E, reference: task(), createdAt: time }] };
  expect(decodeSupportDetail(data, A, C, '1')).not.toBeNull();
  expect(decodeSupportDetail({ ...data, decisions: [{ ...decision, effect: 'PUBLISH' }] }, A, C, '1')).toBeNull();
  expect(decodeSupportDetail({ ...data, decisions: [{ ...decision, id: B }] }, A, C, '1')).toBeNull();
  expect(decodeSupportDetail({ ...data, evidence: [{ ...data.evidence[0], eventId: D }] }, A, C, '1')).toBeNull();
  expect(decodeSupportDetail(data, A, C, '2')).toBeNull();
});
it('accepts the exact public Task and review snapshots with absent optional canonical fields', () => {
  expect(decodeSupportSnapshot(task())).toEqual(task()); expect(decodeSupportSnapshot(review())).toEqual(review());
  expect(decodeSupportSnapshot({ ...task(), content: { ...task().content, title: null, description: null, executionMode: null, countryCode: null } })).not.toBeNull();
});
it.each(['exactAddress', 'accessNotes', 'ownerAccountId', 'storagePath', 'signedUrl', 'conversation', 'audio'])('rejects nested private snapshot field %s', key => {
  expect(decodeSupportSnapshot({ ...task(), content: { ...task().content, [key]: 'PRIVATE' } })).toBeNull();
  expect(decodeSupportSnapshot({ ...review(), content: { ...review().content, [key]: 'PRIVATE' } })).toBeNull();
});
it.each(['need.exact_address', 'need.access_notes', 'need.resolved_location', 'need.public_photo_paths', 'unknown.key'])('excludes private and unknown exported facts %s', key => {
  const data = review(); data.content.publicFacts[0].key = key; expect(decodeSupportSnapshot(data)).toBeNull();
});
it('permits only explicit public geography labels, never coordinates or arbitrary objects', () => {
  const p = { label: null, city: 'Novi Sad', area: null }, value = { mode: 'STATIONARY', start: p, end: { ...p, city: null }, serviceArea: { ...p, city: null }, waypoints: [] };
  const data = { ...review(), content: { ...review().content, publicFacts: [{ key: 'need.task_geography', value, displayValue: 'Novi Sad', status: 'CONFIRMED' }] } };
  expect(decodeSupportSnapshot(data)).not.toBeNull();
  expect(decodeSupportSnapshot({ ...data, content: { ...data.content, publicFacts: [{ ...data.content.publicFacts[0], value: { ...value, start: { ...p, latitudeE6: 45000000 } } }] } })).toBeNull();
});
it('accepts registered image identity without granting raw Storage URLs', () => {
  const m = { assetId: E, sha256: 'a'.repeat(64), width: 1200, height: 1600 }, data = { ...task(), content: { ...task().content, media: [m] } };
  expect(decodeSupportSnapshot(data)).not.toBeNull();
  expect(decodeSupportSnapshot({ ...data, content: { ...data.content, media: [{ ...m, url: 'PRIVATE' }] } })).toBeNull();
  expect(decodeSupportSnapshot({ ...data, content: { ...data.content, media: [m, m] } })).toBeNull();
});
it('admits optional selected private-message photo identities while retaining the old exact text snapshot', () => {
  const old = { kind: 'AGREEMENT_MESSAGE', id: E, revision: 2, content: { agreementId: C, body: '', createdAt: time, mine: true } };
  const m = { assetId: D, sha256: 'b'.repeat(64), width: 1600, height: 1200 };
  expect(decodeSupportSnapshot(old)).toEqual(old);
  expect(decodeSupportSnapshot({ ...old, content: { ...old.content, media: [m] } })).not.toBeNull();
  for (const media of [[{ ...m, storagePath: 'PRIVATE' }], [{ ...m, ownerAccountId: A }], [m, m], null, [{ ...m, width: 1601 }]])
    expect(decodeSupportSnapshot({ ...old, content: { ...old.content, media } })).toBeNull();
  expect(decodeSupportSnapshot({ kind: 'GROUP_MESSAGE', id: E, revision: null,
    content: { groupId: C, sequence: '1', body: '', createdAt: time, mine: true, media: [m] } })).toBeNull();
});
it('uses existing safety vocabulary without copying the report narrative or identity', () => {
  const data = { kind: 'SAFETY_REPORT', id: E, revision: null, content: { category: 'FRAUD', needId: null, agreementId: C, createdAt: time } };
  expect(decodeSupportSnapshot(data)).not.toBeNull();
  expect(decodeSupportSnapshot({ ...data, content: { ...data.content, narrative: 'PRIVATE' } })).toBeNull();
  expect(decodeSupportSnapshot({ ...data, content: { ...data.content, category: 'OTHER_DEMO_CATEGORY' } })).toBeNull();
});
