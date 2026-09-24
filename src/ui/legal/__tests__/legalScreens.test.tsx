import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { LegalBundleStatus } from '../../../contracts/legal';
const mockRead = jest.fn(), mockProcessors = jest.fn(), mockAccept = jest.fn(), mockOutcome = jest.fn(), mockOpen = jest.fn(), mockBack = jest.fn();
let mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null, accountRevision: 1 };
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) { if (key === 'Linking') return { openURL: (...args: unknown[]) => mockOpen(...args) };
    return ['View', 'ActivityIndicator', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (callback: () => unknown) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../../store/sesija', () => ({ sesijaSada: () => mockOwner, useSesija: () => mockOwner }));
jest.mock('../../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../../data/legalClientService', () => ({ legalClientService: {
  readBundle: (...args: unknown[]) => mockRead(...args), acceptReviewedBundle: (...args: unknown[]) => mockAccept(...args), readAcceptance: (...args: unknown[]) => mockOutcome(...args),
} }));
jest.mock('../../../data/processorMapClientService', () => ({ processorMapClientService: { readStatus: (...args: unknown[]) => mockProcessors(...args) } }));
jest.mock('../../settings/SettingsPresentation', () => {
  const element = (name: string) => ({ children, footer, ...props }: any) => require('react').createElement(name, props, children, footer);
  return Object.fromEntries(['SettingsAction', 'SettingsGroup', 'SettingsIntro', 'SettingsPanel', 'SettingsRow', 'SettingsScreen', 'SettingsText', 'SettingsInfo'].map(name => [name, element(name)]));
});
import LegalRoute from '../../../app/(app)/profil/pravna';
import { PublicLegalModal } from '../LegalDocuments';
const ok = <T,>(podatak: T) => ({ ok: true, podatak });
const bundle = (): LegalBundleStatus => ({ ready: true, acceptedCurrentBundle: false, reason: null, documents: [
  { kind: 'TERMS', version: 'RC2', sha256: 'a'.repeat(64), url: 'https://example.test/terms', publishedAt: '', effectiveAt: '' },
  { kind: 'PRIVACY', version: 'V1', sha256: 'b'.repeat(64), url: 'https://example.test/privacy', publishedAt: '', effectiveAt: '' },
] });
const receipt = { accepted: true, idempotentReplay: false, termsVersion: 'RC2', termsSha256: 'a'.repeat(64), privacyVersion: 'V1', privacySha256: 'b'.repeat(64), acceptedAt: '2026-09-13T00:00:00Z' };
let tree: ReactTestRenderer;
const hosts = (type: string) => tree.root.findAll(node => node.type === type);
const renderedCopy = () => tree.root.findAll(node => typeof node.type === 'string').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => hosts('SettingsAction').find(node => node.props.label === label)!;
beforeEach(() => {
  jest.clearAllMocks(); mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
  mockRead.mockResolvedValue(ok(bundle())); mockProcessors.mockResolvedValue(ok({ ready: false, reason: 'PROCESSOR_MAP_NOT_PUBLISHED', missingProviders: [] }));
  mockAccept.mockResolvedValue(ok(receipt)); mockOutcome.mockResolvedValue(ok({ found: true, receipt })); mockOpen.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('shows only the exact server documents and opens their HTTPS URLs', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  const rows = hosts('SettingsRow'); expect(rows.map(row => row.props.label)).toEqual(['Uslovi korišćenja', 'Politika privatnosti']);
  await act(async () => rows[0].props.onPress()); expect(mockOpen).toHaveBeenCalledWith('https://example.test/terms');
  expect(renderedCopy()).not.toContain('OpenAI'); expect(renderedCopy()).not.toContain('Gemini');
});
it('the single action accepts exact displayed hashes once', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  expect(mockAccept).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333', 'a'.repeat(64), 'b'.repeat(64));
  expect(action('Prihvati pregledane dokumente')).toBeUndefined(); expect(renderedCopy()).toContain('Prihvaćene su aktuelne verzije');
});
it('unknown acceptance offers an owned readback and confirms its exact receipt', async () => {
  mockAccept.mockResolvedValue({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  await act(async () => action('Proveri ishod prihvatanja').props.onPress());
  expect(mockOutcome).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333'); expect(mockAccept).toHaveBeenCalledTimes(1);
});
it('old account callbacks cannot accept, open documents or navigate', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  const accept = action('Prihvati pregledane dokumente').props.onPress, link = hosts('SettingsRow')[0].props.onPress, back = hosts('SettingsScreen')[0].props.onBack;
  mockOwner = { ...mockOwner, accountRevision: 3 }; await act(async () => { accept(); link(); back(); });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockOpen).not.toHaveBeenCalled(); expect(mockBack).not.toHaveBeenCalled();
});
it('unpublished documents never display an accept action', async () => {
  mockRead.mockResolvedValue(ok({ ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] }));
  await act(async () => { tree = create(<LegalRoute />); });
  expect(hosts('SettingsRow')).toHaveLength(0); expect(action('Prihvati pregledane dokumente')).toBeUndefined();
});
it('the public modal reads anonymously and never offers or records ledger acceptance', async () => {
  mockOwner = { user: null, accountRevision: 0 }; const close = jest.fn();
  await act(async () => { tree = create(<PublicLegalModal kind="PRIVACY" onClose={close} />); });
  await act(async () => hosts('SettingsRow')[1].props.onPress()); expect(mockOpen).toHaveBeenCalledWith('https://example.test/privacy');
  // The public view is a sheet now: its own close control ends it, and closing leaves the form behind it untouched.
  await act(async () => tree.root.findByProps({ accessibilityRole: 'button', accessibilityLabel: 'Zatvori' }).props.onPress()); expect(close).toHaveBeenCalledTimes(1);
  expect(hosts('SettingsScreen')).toHaveLength(0);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockProcessors).not.toHaveBeenCalled();
});
it('renders actual published processor fields without a local provider fallback', async () => {
  mockProcessors.mockResolvedValue(ok({ ready: true, mapVersion: 'published-1', effectiveAt: '', providers: [{ providerCode: 'SERVER_VALUE', providerDisplayName: 'Objavljeni obrađivač',
    legalEntityName: 'Objavljeno pravno lice', legalRole: 'PROCESSOR', purpose: 'Objavljena svrha', dataCategories: ['Objavljena kategorija'], processingRegions: 'Objavljeni region',
    crossBorderTransfer: true, transferMechanism: 'Objavljeni mehanizam', dpaReference: 'Objavljeni ugovor', privacyNoticeUrl: 'https://example.test/provider',
    retentionDeletionTerms: 'Objavljeni rok', subprocessorTerms: 'Objavljeni podobrađivači', legalBasisReference: 'Objavljeni osnov' }] }));
  await act(async () => { tree = create(<LegalRoute />); });
  // Each provider is folded to its name, its legal entity and role until opened.
  expect(renderedCopy()).toContain('Objavljeno pravno lice · Obrađivač'); expect(renderedCopy()).not.toContain('Objavljeni region');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Objavljeni obrađivač' }).props.onPress());
  expect(renderedCopy()).toContain('Objavljeni region'); expect(renderedCopy()).toContain('Objavljeni rok');
  await act(async () => action('Obaveštenje o privatnosti · Objavljeni obrađivač').props.onPress());
  expect(mockOpen).toHaveBeenCalledWith('https://example.test/provider');
});
it('the screen is named as the entries that open it, and a running acceptance keeps its words', async () => {
  let resolve!: (value: unknown) => void; mockAccept.mockReturnValue(new Promise(done => { resolve = done; }));
  await act(async () => { tree = create(<LegalRoute />); });
  expect(hosts('SettingsScreen')[0].props.title).toBe('Pravila i saglasnosti');
  await act(async () => { action('Prihvati pregledane dokumente').props.onPress(); });
  expect(action('Prihvati pregledane dokumente').props).toMatchObject({ loading: true, disabled: true });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  await act(async () => resolve(ok(receipt)));
  expect(action('Prihvati pregledane dokumente')).toBeUndefined(); expect(renderedCopy()).toContain('Prihvaćene su aktuelne verzije');
});
it('an acceptance failure is said right above the button that failed', async () => {
  mockAccept.mockResolvedValue({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  // Once, as an alert beside the readback it now offers, and not a second time under the intro.
  const alerts = tree.root.findAll(node => node.type === ('SettingsText' as React.ElementType) && [node.props.children].flat().includes('Ishod nije potvrđen.'));
  expect(alerts).toHaveLength(1); expect(alerts[0].props.accessibilityRole).toBe('alert');
  expect(action('Proveri ishod prihvatanja')).toBeDefined();
});
