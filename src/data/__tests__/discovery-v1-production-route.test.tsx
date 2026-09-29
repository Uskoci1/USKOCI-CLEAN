import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const mockSource = { otvorenePrilike: jest.fn(async () => []), otvorenaPrilika: jest.fn(async () => ({ item: null, asOf: '2026-09-30T00:00:00Z' })),
  odnosiPremaZadacima: jest.fn(async () => ({ owned: new Set(), applied: new Set(), relation: () => ({ kind: 'UNKNOWN' }) })) };
let mockParams: Record<string, unknown> = {};
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci' } } }));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
}));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({ data: [], loading: false, refreshing: false, error: false, refresh: async () => {} }) }));
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'LegacyDiscovery' }));
jest.mock('../../ui/v2/discovery/DiscoveryV1Route', () => ({ DiscoveryV1Route: 'P6Route' }));

import Zadaci from '../../app/(app)/zadaci';
import { rememberPublication } from '../publicationHandoff';
import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from '../aiTaskReviewClientService';

function authenticPublicationParams() {
  const reviewId = '33333333-3333-4333-8333-333333333333';
  const handoff = rememberPublication({
    review: { accountId: ACCOUNT, reviewId } as AiTaskReviewEnvelope,
    command: { authoritative: true, state: 'PUBLISHED', reviewId, needId: NEED, needRevision: 1 } as AiTaskPublicationCommand,
    publishedReadback: true,
  }, { accountId: ACCOUNT, accountRevision: 1 });
  if (!handoff) throw new Error('Expected an owned publication handoff');
  return { publishedNeedId: NEED, publishedRevision: '1', publishedHandoff: handoff.token };
}

const original = process.env.EXPO_PUBLIC_P6_DISCOVERY_READER;
let tree: ReactTestRenderer | undefined;
const render = async () => act(async () => { tree = create(<Zadaci />); });
const mounted = (type: string) => tree!.root.findAllByType(type as unknown as React.ElementType).length;
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  if (original === undefined) delete process.env.EXPO_PUBLIC_P6_DISCOVERY_READER; else process.env.EXPO_PUBLIC_P6_DISCOVERY_READER = original;
});

test('a build without the production flag keeps the legacy reader, whatever the URL says', async () => {
  delete process.env.EXPO_PUBLIC_P6_DISCOVERY_READER;
  mockParams = { p6Proof: '1' };
  await render();
  expect(mounted('LegacyDiscovery')).toBe(1);
  expect(mounted('P6Route')).toBe(0);
});

test('the production flag mounts the P6 reader with no proof parameter and no proof package', async () => {
  process.env.EXPO_PUBLIC_P6_DISCOVERY_READER = '1';
  mockParams = {};
  await render();
  expect(mounted('P6Route')).toBe(1);
  expect(mounted('LegacyDiscovery')).toBe(0);
});

test('this session\'s own confirmed publication keeps its separately proved landing reader', async () => {
  process.env.EXPO_PUBLIC_P6_DISCOVERY_READER = '1';
  mockParams = authenticPublicationParams();
  await render();
  expect(mounted('LegacyDiscovery')).toBe(1);
  expect(mounted('P6Route')).toBe(0);
});

test('publication parameters without this session\'s handoff prove nothing and do not pin the legacy reader', async () => {
  process.env.EXPO_PUBLIC_P6_DISCOVERY_READER = '1';
  mockParams = { publishedNeedId: NEED, publishedRevision: '1', publishedHandoff: 'publication-forged' };
  await render();
  expect(mounted('P6Route')).toBe(1);
  expect(mounted('LegacyDiscovery')).toBe(0);
});
