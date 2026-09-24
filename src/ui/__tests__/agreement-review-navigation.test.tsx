import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The rating screen was dead on two phones and one emulator on 2026-09-23: five enabled stars, six enabled
// tags, and no press did anything, while the top bar's back arrow on the same screen worked. The isolated
// screen tests could not see it because they mock `useFocusEffect` as a plain effect. This suite mounts the
// REAL Expo Router runtime — root Stack, the `(app)` Tabs, and `useFocusEffect` as shipped — and walks the
// exact path the phone takes: the root-level Dogovor screen navigates into the hidden `oceni-dogovor` tab.
const mockContext = jest.fn(), mockSubmit = jest.fn();
jest.mock('../../data/reviewsClientService', () => ({ reviewsClientService: { context: (...args: unknown[]) => mockContext(...args), submit: (...args: unknown[]) => mockSubmit(...args) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' }, accountRevision: 0 }) }));
jest.mock('../../data/supabaseClient', () => ({ supabaseKlijent: jest.fn(), supabaseKonfigurisan: () => false }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The press surface itself is not under test; a plain Pressable keeps the real onPress path without Reanimated.
jest.mock('../Press', () => { const React = require('react'); const { Pressable } = require('react-native');
  return { Press: (props: Record<string, unknown>) => React.createElement(Pressable, props) }; });
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => 'uskoci://' + path,
  resolveScheme: () => 'uskoci', addEventListener: () => ({ remove() {} }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../system/FactArt', () => ({ FactArt: 'FactArt' }));
// One store answers both names (ui/system/motion, 2026-09-24): mocking it covers useSystemReducedMotion and every
// component that reads useReducedMotion directly, so the whole tree sees the value this suite chose.
jest.mock('../system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../Text', () => ({ T: 'T' }));
jest.mock('../v2/V2Action', () => ({ V2Action: 'Action' }));
// The route reads the Dogovor only to show whom the rating is about; here there is none, and the rating works without it.
jest.mock('../../store/uloga', () => ({ useIzvor: () => ({ dogovor: async () => null }) }));

import { ExpoRoot, router, Stack } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import OceniDogovor from '../../app/(app)/oceni-dogovor';
import RealTabsLayout from '../../app/(app)/_layout';

const agreementId = '20000000-0000-4000-8000-000000000001';
const context = { ok: true, podatak: { eligible: true, targetAccountId: '10000000-0000-4000-8000-000000000002', review: null,
  tagCatalog: { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] } } };

function RootLayout() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(app)" /><Stack.Screen name="dogovor/[id]" /></Stack>; }
function Home() { return <Text>Početna</Text>; }
function Agreements() { return <Text>Dogovori</Text>; }
/** The root-level Dogovor screen: one button that opens the review exactly as src/app/dogovor/[id].tsx does. */
function Agreement() {
  return <Pressable accessibilityRole="button" accessibilityLabel="Oceni saradnju"
    onPress={() => router.navigate({ pathname: '/oceni-dogovor', params: { agreementId } })}><Text>Dogovor</Text></Pressable>;
}
const routes = inMemoryContext({ _layout: RootLayout, '(app)/_layout': RealTabsLayout, '(app)/index': Home, '(app)/dogovori': Agreements,
  '(app)/oceni-dogovor': OceniDogovor, 'dogovor/[id]': Agreement });

let tree: ReactTestRenderer;
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };
const byLabel = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
beforeEach(() => { jest.useFakeTimers(); mockContext.mockReset(); mockSubmit.mockReset(); mockContext.mockResolvedValue(context); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); });

test('opened from the root-level Dogovor, the review screen takes a star and a tag on the first press', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location={`/dogovor/${agreementId}`} />); });
  await settle();
  await act(async () => byLabel('Oceni saradnju').props.onPress());
  await settle();
  // The pushed tab moves with a shift transition on the phone; let it finish before touching anything.
  await act(async () => { jest.advanceTimersByTime(600); });
  await settle();
  expect(mockContext).toHaveBeenCalledWith(agreementId, expect.anything());
  const star = byLabel('Ocena 5 od 5');
  expect(star.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  await act(async () => star.props.onPress());
  expect(byLabel('Ocena 5 od 5').props.accessibilityState.checked).toBe(true);
  await act(async () => byLabel('Po dogovoru').props.onPress());
  expect(byLabel('Po dogovoru').props.accessibilityState.checked).toBe(true);
  expect(tree.root.findByProps({ label: 'Sačuvaj ocenu' }).props.disabled).toBe(false);
});

// Round 4 review rd item 1: the Dogovori list's rating strip opens the review with `from: 'dogovori'`, and Back returns
// to the list, so the way back says the list ("Nazad na Dogovore"), not a Dogovor.
test.each([['dogovori', 'Nazad na Dogovore'], ['pocetna', 'Nazad na Početnu'], [null, 'Nazad na Dogovor']] as const)(
  'opened from %s, the way back says "%s"', async (from, label) => {
    mockContext.mockResolvedValue({ ok: true, podatak: { ...context.podatak, eligible: false } });
    const query = `agreementId=${agreementId}${from ? `&from=${from}` : ''}`;
    await act(async () => { tree = create(<ExpoRoot context={routes} location={`/oceni-dogovor?${query}`} />); });
    await settle(); await act(async () => { jest.advanceTimersByTime(600); }); await settle();
    const backs = tree.root.findAll(node => typeof node.props.label === 'string' && node.props.label.startsWith('Nazad na'));
    // The top bar's arrow now names the same place as the green button (round 6): every way back says one place.
    const labels = backs.map(node => node.props.label);
    expect(new Set(labels)).toEqual(new Set([label])); expect(labels.length).toBeGreaterThanOrEqual(1);
  });
