import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Where the "Komentari" section of a profile is wired (D12): under the rating line of `AccountReputation`, only in a build with the
 * flag and only with a profile to read; and what the profile screen hands it. The section itself is tested in
 * `review-comments-section.test.tsx`; here it is a named element, so what is judged is WHERE it is placed and with WHAT.
 */
jest.setTimeout(60_000);
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', PROFILE = '99999999-9999-4999-8999-999999999999';
const mockAccountId = A;
const mockReputation = jest.fn(), mockUseFocused = jest.fn();
let mockRealReputation = true;
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
type Row = { ime: string | null; grad: string | null; profileId?: string; stanje?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null };
let mockIdentity: Row = { ime: 'Ana Petrović', grad: 'Novi Sad', profileId: PROFILE };
let mockResource: { data: { identity: Row | null; capability: Row | null } | null; loading: boolean; error: boolean; refresh: jest.Mock } =
  { data: { identity: mockIdentity, capability: null }, loading: false, error: false, refresh: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccountId }, accountRevision: 1 }), sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: 1 }) }));
jest.mock('../../../data/supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected direct call in a wiring test'); } }));
jest.mock('../../../data/reviewsClientService', () => ({
  ...jest.requireActual('../../../data/reviewsClientService'),
  reviewsClientService: { reputation: (...args: unknown[]) => mockReputation(...args) },
}));
jest.mock('../../../data/authClientService', () => ({ authClientService: { signOutLocal: jest.fn() } }));
jest.mock('../../../data/ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: (load: unknown) => mockUseFocused(load) }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../ReviewCommentsSection', () => ({ ReviewCommentsSection: 'ReviewCommentsSection' }));
// `AccountReputation` is the real component in the first block and a named element in the second (the profile screen only hands it props).
jest.mock('../AccountReputation', () => {
  const actual = jest.requireActual('../AccountReputation');
  return { ...actual, AccountReputation: (props: Record<string, unknown>) => {
    const React = require('react');
    return mockRealReputation ? React.createElement(actual.AccountReputation, props) : React.createElement('AccountReputation', props);
  } };
});
import { AccountReputation } from '../AccountReputation';
import Profil from '../../../app/(app)/profil';

const FLAG = 'EXPO_PUBLIC_D12_REVIEW_COMMENT';
let tree: ReactTestRenderer;
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const photo = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); delete process.env[FLAG]; mockRealReputation = true;
  mockReputation.mockResolvedValue({ ok: true, podatak: { accountId: A, reviewCount: 12, averageRating: 4.8, state: 'RATED', authoritative: true } });
  mockUseFocused.mockImplementation(() => ({ data: { accountId: A, reviewCount: 12, averageRating: 4.8, state: 'RATED', authoritative: true }, loading: false, error: false, refresh: jest.fn() }));
  mockIdentity = { ime: 'Ana Petrović', grad: 'Novi Sad', profileId: PROFILE };
  mockResource = { data: { identity: mockIdentity, capability: null }, loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { delete process.env[FLAG]; await act(async () => tree?.unmount()); });

describe('under the rating line of the account reputation', () => {
  const draw = async (props: Record<string, unknown>) => { await act(async () => { tree = create(<AccountReputation accountId={A} {...props} />); }); };

  it('without the build flag it is the rating line alone, even with a profile to read', async () => {
    await draw({ commentsProfileId: PROFILE, commentPhoto: photo });
    expect(texts()).toContain('4,8 · 12 ocena');
    expect(hosts('ReviewCommentsSection')).toHaveLength(0);
  });

  it('with the flag and a profile, the section follows the rating line and gets that profile and the photo drawer', async () => {
    process.env[FLAG] = '1';
    await draw({ commentsProfileId: PROFILE, commentPhoto: photo });
    expect(texts()).toContain('4,8 · 12 ocena');
    const sections = hosts('ReviewCommentsSection');
    expect(sections).toHaveLength(1);
    expect(sections[0].props).toEqual({ profileId: PROFILE, photo });
    // After the line, never before it: the siblings of the one fragment, in this order.
    const siblings = (tree.toJSON() as { type: string }[]).map(node => node.type);
    expect(siblings.indexOf('ReviewCommentsSection')).toBeGreaterThan(0);
  });

  it.each([[undefined], [null], ['']])('with the flag but no profile (%p) there is no section and nothing is read for it', async value => {
    process.env[FLAG] = '1';
    await draw({ commentsProfileId: value });
    expect(texts()).toContain('4,8 · 12 ocena');
    expect(hosts('ReviewCommentsSection')).toHaveLength(0);
  });

  it('the section is independent of the rating read: an unavailable rating still lists the comments', async () => {
    process.env[FLAG] = '1';
    mockUseFocused.mockImplementation(() => ({ data: null, loading: false, error: true, refresh: jest.fn() }));
    await draw({ commentsProfileId: PROFILE });
    expect(texts()).toContain('Ocene trenutno nisu dostupne.');
    expect(hosts('ReviewCommentsSection')).toHaveLength(1);
  });
});

describe('what the profile screen hands the reputation', () => {
  // The profile screen reads its own profile through the same hook; here it answers with the profile and the reputation is a named element.
  beforeEach(() => { mockRealReputation = false; mockUseFocused.mockImplementation(() => mockResource); });
  const render = async () => { await act(async () => { tree = create(<Profil />); }); };

  it('the profile of the identity row and a photo drawer; nothing else changes about how the reputation is placed', async () => {
    await render();
    const reputations = hosts('AccountReputation');
    expect(reputations).toHaveLength(1);
    expect(reputations[0].props).toMatchObject({ accountId: A, commentsProfileId: PROFILE });
    expect(typeof reputations[0].props.commentPhoto).toBe('function');
  });

  it('a profile that has not been read has no profile to hand over', async () => {
    mockResource = { data: { identity: { ime: 'Ana', grad: null }, capability: null }, loading: false, error: false, refresh: jest.fn() };
    mockUseFocused.mockImplementation(() => mockResource);
    await render();
    expect(hosts('AccountReputation')[0].props.commentsProfileId).toBeNull();
  });

  it('the photo drawer draws the reviewer\'s profile photo at the size it is asked for, with the stand-in it is handed', async () => {
    await render();
    const draw = hosts('AccountReputation')[0].props.commentPhoto as (profileId: string, size: number, fallback: React.ReactNode) => React.ReactElement<Record<string, unknown>>;
    const element = draw('88888888-8888-4888-8888-888888888888', 40, 'stand-in');
    expect(element.type).toBe('ProfilePhoto');
    expect(element.props).toEqual({ profileId: '88888888-8888-4888-8888-888888888888', size: 40, fallback: 'stand-in' });
  });
});
