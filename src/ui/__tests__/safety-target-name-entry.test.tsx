import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { JavniProfilProjekcija } from '../../contracts/projections';

/**
 * EX-07 S06: the entry from a public profile hands the safety screen the PROFILE it was opened from (an identifier, never a name) so that the screen can ask the
 * server for the name of that profile. Only a build compiled with the flag does; without it the navigation is exactly what it was.
 */
const P = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', N = 'ffffffff-ffff-4fff-8fff-ffffffffffff', G = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NAME = 'EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME';
const mockNavigate = jest.fn();
const mockReadTarget = jest.fn();
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => effect(), [effect]),
}));
jest.mock('../../data/safetyClientService', () => ({ safetyClientService: { readTarget: (...args: unknown[]) => mockReadTarget(...args) } }));
import { PublicProfileSheet } from '../system/PublicProfileSheet';
import { useSafetyEntry } from '../safety/useSafetyEntry';

const profile = (): JavniProfilProjekcija => ({ profilId: P, uloga: 'narucilac', ime: 'Marko', avatarPutanja: null, grad: 'Novi Sad',
  naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 0, identitetVerifikovan: false,
    ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } });
function Harness({ context }: { context: { needId?: string | null; agreementId?: string | null } }) {
  const safety = useSafetyEntry(P, context);
  return <PublicProfileSheet state={{ loading: false, data: profile() }} onClose={() => {}} onRetry={() => {}} safety={safety} />;
}
const find = (tree: ReactTestRenderer, label: string) => tree.root.findAll(node =>
  typeof node.type !== 'string' && node.props?.accessibilityRole === 'button' && String(node.props?.accessibilityLabel ?? '').includes(label))[0];
const resolved = (displayName?: string | null) => ({ ok: true, podatak: { profileId: P, available: true, ...(displayName === undefined ? {} : { displayName }),
  target: { accountId: 'me', targetAccountId: B, blocked: false, revision: 2, authoritative: true } } });

async function open(context: { needId?: string | null; agreementId?: string | null }) {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness context={context} />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  await act(async () => { tree.unmount(); });
  return mockNavigate.mock.calls[0]?.[0];
}

beforeEach(() => { delete process.env[NAME]; mockNavigate.mockReset(); mockReadTarget.mockReset(); mockReadTarget.mockResolvedValue(resolved('Marko Tajni')); });
afterEach(() => { delete process.env[NAME]; });

describe('flag off: the navigation is what it was', () => {
  it.each([
    [{ needId: N }, { targetAccountId: B, needId: N }],
    [{ agreementId: G }, { targetAccountId: B, agreementId: G }],
    [{}, { targetAccountId: B }],
  ])('opens bezbednost with %j and nothing more', async (context, params) => {
    expect(await open(context)).toStrictEqual({ pathname: '/bezbednost', params });
    expect(mockReadTarget).toHaveBeenCalledWith(P);
  });

  it('carries no name and no profile even when the server result has one', async () => {
    const call = await open({ needId: N });
    expect(JSON.stringify(call)).not.toMatch(/Marko|"profileId"/);
  });
});

describe('flag on: the profile is handed on, the name never is', () => {
  beforeEach(() => { process.env[NAME] = '1'; });

  it.each([
    [{ needId: N }, { targetAccountId: B, profileId: P, needId: N }],
    [{ agreementId: G }, { targetAccountId: B, profileId: P, agreementId: G }],
    [{}, { targetAccountId: B, profileId: P }],
  ])('opens bezbednost with %j and the profile it was opened from', async (context, params) => {
    expect(await open(context)).toStrictEqual({ pathname: '/bezbednost', params });
  });

  it.each([resolved('Marko Tajni'), resolved(null), resolved()])('never puts the displayed name in the route (server result %#)', async answer => {
    mockReadTarget.mockResolvedValue(answer);
    const call = await open({ needId: N });
    expect(JSON.stringify(call)).not.toContain('Marko');
    expect(Object.keys(call.params).sort()).toEqual(['needId', 'profileId', 'targetAccountId']);
  });

  it('still opens nothing for a profile that is no target', async () => {
    mockReadTarget.mockResolvedValue({ ok: true, podatak: { profileId: P, available: false, target: null } });
    expect(await open({ needId: N })).toBeUndefined();
  });
});
