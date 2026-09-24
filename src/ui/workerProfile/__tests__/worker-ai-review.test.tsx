import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAiReview } from '../../../data/workerAiClientService';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'TextInput', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));

import { WorkerAiActivation, WorkerAiReviewDetails } from '../WorkerAiPresentation';
import { sys } from '../../system/tokens';

/**
 * The frozen review of the AI worker profile (2026-09-24): dates as "24. sep", windows in the one time format without
 * seconds, no raw zone name for Serbian time, and one word for anything not given.
 */
const review = (patch: Partial<WorkerAiReview['profile']['availability']> = {}, profile: Partial<WorkerAiReview['profile']> = {}): WorkerAiReview => ({
  schemaVersion: 'WORKER_PROFILE_V1', reviewId: 'r', conversationId: 'c', accountId: 'a', profileId: 'p', revision: 1, activate: false,
  missingRequired: [], canAccept: true, expiresAt: '2026-09-24T12:00:00Z', displayedContentDigest: 'd'.repeat(64),
  profile: { displayName: 'Ana', bio: '', skills: ['Selidbe'], tools: [], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false,
      rules: [{ id: 'rule', weekdays: [1], startTime: '08:00', endTime: '16:00', startsOn: '2026-09-24', endsOn: null, label: '', active: true }],
      windows: [{ id: 'w', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:30:00Z', state: 'AVAILABLE', label: '' }], ...patch },
    ...profile },
} as WorkerAiReview);

let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
afterEach(async () => { await act(async () => tree?.unmount()); });

it('writes a rule start as a day, a window without seconds, and no zone line for Serbian time', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review()} />); });
  const copy = texts();
  expect(copy).toContain('08:00–16:00 · od 24. sep'); expect(copy).not.toContain('2026-09-24');
  expect(copy).toContain('26. sep'); expect(copy).toContain('10:00–12:30'); expect(copy).not.toMatch(/\d\d:\d\d:\d\d/);
  expect(copy).not.toContain('Vremenska zona');
});

it('names the zone only when it is not Serbian time', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ timezone: 'Europe/Vienna' })} />); });
  expect(texts()).toContain('Vremenska zona');
});

// Review of step 9 (2026-09-24): licences are on the owner's decision list, so their empty word stays the one it was
// ("Nisu navedene"); every other field not given says the one word. The test pinned the licence word too; it no longer does.
it('says one word for anything not given, and keeps the licence row as the owner worded it', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({}, { skills: [], location: { operatingCountryCode: null, city: '', radiusKm: 20, approximatePosition: null } })} />); });
  const copy = texts();
  expect(copy).not.toMatch(/Još nije navedeno/);
  expect(copy.split('Nije navedeno').length - 1).toBeGreaterThanOrEqual(5);
  expect(copy.split('Nisu navedene').length - 1).toBe(1);
});

it('writes the year of a rule day only when it is not the current one', async () => {
  const next = String(new Date().getFullYear() + 1), now = String(new Date().getFullYear());
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ rules: [{ id: 'rule', weekdays: [1], startTime: '08:00', endTime: '16:00',
    startsOn: `${now}-09-24`, endsOn: `${next}-01-05`, label: '', active: true }] })} />); });
  const copy = texts();
  expect(copy).toContain(`od 24. sep do 5. jan ${next}`); expect(copy).not.toContain(`24. sep ${now}`);
});

it('draws the activation choice on a flat tint with a white thumb', async () => {
  await act(async () => { tree = create(<WorkerAiActivation activate={false} disabled={false} change={() => {}} />); });
  const toggle = tree.root.findByType('Switch' as React.ElementType);
  expect(toggle.props.thumbColor).toBe(sys.color.surface);
  expect(toggle.props.accessibilityLabel).toBe('Aktiviraj profil posle čuvanja');
});
