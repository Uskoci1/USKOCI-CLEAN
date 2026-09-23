import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Seen on the emulator on 2026-09-23: the rating screen showed five enabled stars and six tags, and no
// press did anything — twice, on two builds. The guard compared the focus token with the one captured
// at the last render, and the token is minted after the render.
const mockContext = jest.fn(), mockSubmit = jest.fn();
jest.mock('../../data/reviewsClientService', () => ({ reviewsClientService: { context: (...args: unknown[]) => mockContext(...args), submit: (...args: unknown[]) => mockSubmit(...args) } }));
jest.mock('expo-router', () => ({ router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() }, useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' }, accountRevision: 0 }) }));
jest.mock('../../data/supabaseClient', () => ({ supabaseKlijent: jest.fn(), supabaseKonfigurisan: () => false }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../Press', () => ({ Press: 'Press' }));
jest.mock('../Text', () => ({ T: 'T' }));
jest.mock('../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' }));
import { AgreementReviewScreen } from '../reviews/AgreementReviewScreen';

const agreementId = '20000000-0000-4000-8000-000000000001', accountId = '10000000-0000-4000-8000-000000000001';
const context = { ok: true, podatak: { eligible: true, targetAccountId: '10000000-0000-4000-8000-000000000002', review: null,
  tagCatalog: { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] } } };
let tree: ReactTestRenderer;
const byLabel = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
beforeEach(() => { mockContext.mockReset(); mockSubmit.mockReset(); mockContext.mockResolvedValue(context); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

// No eyebrow (owner rule, 2026-09-23): the bar is the arrow and the title of the content, not the part of the app.
test('the top bar names the screen by its content, with no eyebrow over it', async () => {
  await act(async () => { tree = create(<AgreementReviewScreen agreementId={agreementId} accountId={accountId} accountRevision={0} />); });
  const bar = tree.root.findByType('DetailTopBar' as React.ElementType);
  expect(bar.props.title).toBe('Ocena saradnje'); expect(bar.props.eyebrow).toBeUndefined();
});

test('a star pressed right after the screen settles is selected, and the tag too — with no further render in between', async () => {
  await act(async () => { tree = create(<AgreementReviewScreen agreementId={agreementId} accountId={accountId} accountRevision={0} />); });
  const star = byLabel('Ocena 5 od 5');
  expect(star.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  await act(async () => star.props.onPress());
  expect(byLabel('Ocena 5 od 5').props.accessibilityState.checked).toBe(true);
  await act(async () => byLabel('Po dogovoru').props.onPress());
  expect(byLabel('Po dogovoru').props.accessibilityState.checked).toBe(true);
  expect(tree.root.findByProps({ label: 'Sačuvaj ocenu' }).props.disabled).toBe(false);
});
