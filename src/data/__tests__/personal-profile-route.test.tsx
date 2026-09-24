import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The display-name route (/profil/podaci): one field and one action (2026-09-24). The route had no test at all. These pin
 * what the recomposition must keep: a grey save says why, one save sends one command with the loaded revision, the same
 * name retried after an unknown outcome reuses its request id (an edit issues a new one), and an unknown outcome turns
 * the one action into a read of the saved name.
 */
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const REVISION = 'a'.repeat(64);
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
let mockIds: string[] = [];
const mockRead = jest.fn(), mockSave = jest.fn();
jest.mock('../requesterProfileClientService', () => ({ requesterProfileClientService: {
  read: (...a: unknown[]) => mockRead(...a), save: (...a: unknown[]) => mockSave(...a) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => mockIds.shift() ?? 'no-more-ids' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));

import Route from '../../app/(app)/profil/podaci';

const identity = (displayName = 'Ana Petrović', revision = REVISION) => ({ schema: 'REQUESTER_IDENTITY_V1', accountId: ACCOUNT,
  profileId: '22222222-2222-4222-8222-222222222222', displayName, revision, writableFields: ['displayName'] });
const ok = (podatak: unknown) => ({ ok: true, podatak });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Button' && node.props.label === label)[0];
const field = () => tree.root.findByProps({ accessibilityLabel: 'Ime za prikaz' });
const type = async (value: string) => { await act(async () => field().props.onChangeText(value)); };
const press = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
async function render() { await act(async () => { tree = create(<Route />); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockIds = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  mockRead.mockReset().mockResolvedValue(ok(identity())); mockSave.mockReset();
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('a grey save says why: an empty name, or the name that is already saved', async () => {
  await render();
  expect(field().props.value).toBe('Ana Petrović');
  expect(button('Sačuvaj ime').props.disabled).toBe(true); expect(button('Sačuvaj ime').props.reason).toBe('Ovo ime je već sačuvano.');
  await type('  ');
  expect(button('Sačuvaj ime').props.disabled).toBe(true); expect(button('Sačuvaj ime').props.reason).toBe('Ime ne može da ostane prazno.');
  expect(texts()).toContain('Ovo ime vide ljudi sa kojima dogovaraš pomoć za svoje zadatke.');
});

it('one save sends the trimmed name with its request id and the loaded revision, and says so only after it is saved', async () => {
  mockSave.mockResolvedValue(ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) }));
  await render(); await type('  Ana P.  '); await press('Sačuvaj ime');
  expect(mockSave.mock.calls).toEqual([[{ displayName: 'Ana P.', clientRequestId: '33333333-3333-4333-8333-333333333333', expectedRevision: REVISION }]]);
  expect(texts()).toContain('Ime je sačuvano.');
  // Right after the save the button does not repeat what the line above says.
  expect(field().props.value).toBe('Ana P.'); expect(button('Sačuvaj ime').props.reason).toBeNull();
});

it('an unknown outcome turns the one action into a read, and the same name retried reuses its request id', async () => {
  mockSave.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
  await render(); await type('Ana P.'); await press('Sačuvaj ime');
  expect(button('Sačuvaj ime')).toBeUndefined(); expect(texts()).toContain('Čuvanje nije potvrđeno.');
  expect(field().props.editable).toBe(false);
  await press('Proveri sačuvane podatke');
  expect(mockRead).toHaveBeenCalledTimes(2);
  mockSave.mockResolvedValueOnce(ok({ saved: true, idempotentReplay: true, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) }));
  await press('Sačuvaj ime');
  expect(mockSave.mock.calls.map(call => call[0].clientRequestId)).toEqual(['33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333']);
});

it('an edit after an unconfirmed attempt issues a new request id', async () => {
  mockSave.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
  await render(); await type('Ana P.'); await press('Sačuvaj ime'); await press('Proveri sačuvane podatke');
  mockSave.mockResolvedValueOnce(ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana Petrović Jović', 'b'.repeat(64)) }));
  await type('Ana Petrović Jović'); await press('Sačuvaj ime');
  expect(mockSave.mock.calls.map(call => call[0].clientRequestId)).toEqual(['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']);
});

it('a first read that fails offers the read again, not an empty form', async () => {
  mockRead.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_REQUIRED', poruka: 'Profil nije pronađen. Osveži prikaz.' });
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ime za prikaz' })).toHaveLength(0);
  expect(texts()).toContain('Ime nije učitano'); expect(texts()).toContain('Profil nije pronađen. Osveži prikaz.');
  await press('Proveri sačuvane podatke');
  expect(mockRead).toHaveBeenCalledTimes(2); expect(field().props.value).toBe('Ana Petrović');
});
