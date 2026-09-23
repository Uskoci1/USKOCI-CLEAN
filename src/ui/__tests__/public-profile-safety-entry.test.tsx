import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { JavniProfilProjekcija } from '../../contracts/projections';
const P = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', N = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const mockNavigate = jest.fn();
const mockReadTarget = jest.fn();
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) } }));
jest.mock('../../data/safetyClientService', () => ({ safetyClientService: { readTarget: (...args: unknown[]) => mockReadTarget(...args) } }));
import { PublicProfileSheet } from '../system/PublicProfileSheet';
import { useSafetyEntry } from '../safety/useSafetyEntry';

const profile = (): JavniProfilProjekcija => ({ profilId: P, uloga: 'narucilac', ime: 'Marko', avatarPutanja: null, grad: 'Novi Sad',
  naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 0, identitetVerifikovan: false,
    ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } });
// The sheet is presentation; the entry it offers belongs to the screen, so the test wires the real hook.
function Harness() {
  const safety = useSafetyEntry(P, { needId: N });
  return <PublicProfileSheet state={{ loading: false, data: profile() }} onClose={() => {}} onRetry={() => {}} safety={safety} />;
}
const find = (tree: ReactTestRenderer, label: string) => tree.root.findAll(node =>
  typeof node.type !== 'string' && node.props?.accessibilityRole === 'button' && String(node.props?.accessibilityLabel ?? '').includes(label))[0];
const alerts = (tree: ReactTestRenderer) => tree.root.findAll(n => n.props?.accessibilityRole === 'alert')
  .map(n => JSON.stringify(n.props.children)).join(' ');

beforeEach(() => { mockNavigate.mockReset(); mockReadTarget.mockReset(); });

it('offers one entry from the profile and opens bezbednost with the person the server resolved', async () => {
  mockReadTarget.mockResolvedValue({ ok: true, podatak: { profileId: P, available: true,
    target: { accountId: 'me', targetAccountId: B, blocked: false, revision: 2, authoritative: true } } });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  const press = find(tree, 'Prijavi ili blokiraj');
  expect(press).toBeTruthy();
  await act(async () => { press.props.onPress(); });
  expect(mockReadTarget).toHaveBeenCalledWith(P);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/bezbednost', params: { targetAccountId: B, needId: N } });
});

it('says plainly that there is no target instead of opening a screen that cannot act', async () => {
  mockReadTarget.mockResolvedValue({ ok: true, podatak: { profileId: P, available: false, target: null } });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(alerts(tree)).toContain('Korisnik trenutno nije dostupan');
});

it('carries the server refusal without inventing a navigation', async () => {
  mockReadTarget.mockResolvedValue({ ok: false, kod: 'SAFETY_TARGET_READ_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni.' });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(alerts(tree)).toContain('Podaci trenutno nisu dostupni');
});

it('does not send a second read while the first is still open', async () => {
  let resolve!: (value: unknown) => void;
  mockReadTarget.mockImplementation(() => new Promise(r => { resolve = r; }));
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  const press = () => find(tree, 'Prijavi ili blokiraj').props.onPress();
  await act(async () => { press(); press(); });
  expect(mockReadTarget).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ ok: true, podatak: { profileId: P, available: false, target: null } }); });
});
