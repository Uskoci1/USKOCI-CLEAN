import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const mockRead = jest.fn();
const mockPrepare = jest.fn();
let mockParams: { form?: string } = {};
const mockAuth = { signInWithPassword: jest.fn(), signUp: jest.fn(), sendPhoneOtp: jest.fn(),
  verifyPhoneOtp: jest.fn(), requestPasswordRecovery: jest.fn() };
let mockSession = { user: null as null | { id: string }, accountRevision: 0 };
let mockForeground: (state: string) => void;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { addEventListener: (_: unknown, cb: typeof mockForeground) => {
      mockForeground = cb; return { remove: jest.fn() };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' },
  Easing: { bezier: () => undefined }, interpolate: () => 0, useAnimatedStyle: () => ({}),
  useSharedValue: () => ({ value: 0 }), withTiming: (value: unknown) => value }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop', G: 'G', Path: 'Path' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', EnvelopeSimple: 'Icon', Eye: 'Icon', EyeSlash: 'Icon',
  LockKey: 'Icon', MapPin: 'Icon', Phone: 'Icon', User: 'Icon', X: 'Icon' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('../entryIntentClientService', () => ({ entryIntentClientService: { prepare: (...args: unknown[]) => mockPrepare(...args) } }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('../../ui/entry/EntryWelcome', () => ({ EntryWelcome: 'Hero' }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../authAvailabilityClientService', () => ({ authAvailabilityClientService: { read: (...args: unknown[]) => mockRead(...args) } }));
jest.mock('../authClientService', () => ({ authClientService: {
  signInWithPassword: (...args: unknown[]) => mockAuth.signInWithPassword(...args),
  signUp: (...args: unknown[]) => mockAuth.signUp(...args),
  sendPhoneOtp: (...args: unknown[]) => mockAuth.sendPhoneOtp(...args),
  verifyPhoneOtp: (...args: unknown[]) => mockAuth.verifyPhoneOtp(...args),
  requestPasswordRecovery: (...args: unknown[]) => mockAuth.requestPasswordRecovery(...args),
} }));

import AuthScreen from '../../app/auth';

const emailOnly = { emailPassword: true, emailSignup: true, phoneOtp: false,
  emailConfirmationRequired: true, passwordRecovery: false };
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAll(node => node.type === type);
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
const text = () => textOf(tree.root);
const button = (label: string) => host('Pressable').find(node => textOf(node).trim() === label)!;
const input = (placeholder: string) => host('TextInput').find(node => node.props.placeholder === placeholder)!;
async function press(label: string) { await act(async () => button(label).props.onPress()); }
async function fill(placeholder: string, value: string) { await act(async () => input(placeholder).props.onChangeText(value)); }
async function render() {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); mockPrepare.mockResolvedValue(undefined); mockParams = {}; mockRead.mockResolvedValue(emailOnly); mockSession = { user: null, accountRevision: 0 };
  for (const method of Object.values(mockAuth)) method.mockResolvedValue(undefined);
  mockAuth.signUp.mockResolvedValue({ hasSession: false });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('shows actual email-only entry without provider placeholders or invented saved targets', async () => {
  await render();
  expect(input('ime@primer.rs')).toBeDefined(); expect(button('Prijavite se')).toBeDefined();
  expect(button('Napravi nalog').props.accessibilityRole).toBe('button');
  expect(text()).toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('MENI TREBA · ISTI NALOG');
  expect(text()).not.toContain('JA MOGU · ISTI NALOG');
  for (const fake of ['Google', 'Apple', 'Telefon', 'Sačuvali smo', 'istu Priliku', 'ili nastavite preko']) expect(text()).not.toContain(fake);
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
});

it('uses the flatter signup stage while retaining all real fields and the explicit primary command', async () => {
  await render();
  const heading = (value: string) => host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === value)!;
  expect(StyleSheet.flatten(heading('Dobro došao.').props.style).fontSize).toBe(31);
  await press('Napravi nalog');
  expect(StyleSheet.flatten(heading('Napravite nalog').props.style)).toMatchObject({ fontSize: 27, lineHeight: 30.51 });
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Ime', 'Prezime', 'Grad', 'Email', 'Lozinka', 'Potvrdite lozinku']);
  const form = host('View').find(node => node.findAllByType('TextInput' as React.ElementType).length === 6 && StyleSheet.flatten(node.props.style)?.borderBottomWidth === 1)!;
  expect(StyleSheet.flatten(form.props.style)).toMatchObject({ backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 });
  expect(host('Pressable').filter(node => node.props.accessibilityRole === 'checkbox')).toHaveLength(1);
  expect(button('Napravite nalog')).toBeDefined();
  expect(text()).not.toContain('Korak 1 od 3');
  expect(mockAuth.signUp).not.toHaveBeenCalled();
  await press('Već imaš nalog? Prijavi se');
  expect(StyleSheet.flatten(heading('Dobro došao.').props.style).fontSize).toBe(31);
});

it('keeps an empty password submission local and immediately editable', async () => {
  await render(); await press('Prijavite se');
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  expect(text()).toContain('Unesite email i lozinku.');
  expect(input('ime@primer.rs').props.editable).toBe(true);
});

it('hides a revealed password when switching form mode, preserving the entered value without submitting', async () => {
  await render(); await fill('Unesite lozinku', 'local-dummy-value');
  const toggle = () => host('Pressable').find(node => node.props.accessibilityLabel === 'Prikaži lozinku')!;
  await act(async () => toggle().props.onPress());
  expect(input('Unesite lozinku').props.secureTextEntry).toBe(false);
  await press('Napravi nalog');
  expect(button('Već imaš nalog? Prijavi se').props.accessibilityRole).toBe('button');
  expect(button('Napravi nalog')).toBeUndefined();
  expect(host('Pressable').some(node => node.props.accessibilityRole === 'tab')).toBe(false);
  expect(input('Unesite lozinku').props.value).toBe('local-dummy-value');
  expect(input('Unesite lozinku').props.secureTextEntry).toBe(true);
  await act(async () => toggle().props.onPress());
  await press('Već imaš nalog? Prijavi se');
  expect(input('Unesite lozinku').props.secureTextEntry).toBe(true);
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
});

it('shows loading/error/retry before enabling a form and preserves entered credentials across a settings retry', async () => {
  const pending = deferred<unknown>(); mockRead.mockReturnValueOnce(pending.promise);
  await render(); expect(text()).toContain('Proveravamo dostupne'); expect(host('TextInput')).toHaveLength(0);
  await act(async () => pending.reject(new Error('offline')));
  expect(text()).toContain('Ne možemo da proverimo');
  await press('Pokušajte ponovo'); await fill('ime@primer.rs', 'ana@example.test');
  await act(async () => mockForeground('active'));
  expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
});

it('does not offer signup when disabled, while existing email login remains available', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, emailSignup: false });
  await render(); expect(button('Napravite nalog')).toBeUndefined(); expect(button('Prijavite se')).toBeDefined();
  expect(text()).toContain('Otvaranje novih naloga trenutno nije dostupno.');
});

it('gives an explicit route back if signup is disabled while the signup form is open', async () => {
  await render(); await press('Napravi nalog');
  mockRead.mockResolvedValue({ ...emailOnly, emailSignup: false });
  await act(async () => mockForeground('active'));
  expect(button('Nazad na prijavu')).toBeDefined(); await press('Nazad na prijavu');
  expect(button('Prijavite se')).toBeDefined();
});

it('blocks duplicate signup, conflicting navigation and editing, then shows accurate confirmation with a real login Back', async () => {
  await render(); await press('Napravi nalog');
  for (const [placeholder, value] of [['Ime', 'Ana'], ['Prezime', 'Petrović'], ['Vaš grad', 'Novi Sad'],
    ['ime@primer.rs', 'ana@example.test'], ['Unesite lozinku', 'password'], ['Ponovite lozinku', 'password']]) await fill(placeholder, value);
  await act(async () => host('Pressable').find(node => node.props.accessibilityRole === 'checkbox')!.props.onPress());
  const pending = deferred<{ hasSession: boolean }>(); mockAuth.signUp.mockReturnValueOnce(pending.promise);
  const submit = button('Napravite nalog').props.onPress;
  await act(async () => { submit(); submit(); });
  expect(mockAuth.signUp).toHaveBeenCalledTimes(1); expect(host('TextInput').every(node => node.props.editable === false)).toBe(true);
  const close = host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!;
  expect(close.props.disabled).toBe(true); await act(async () => close.props.onPress());
  expect(host('TextInput')).toHaveLength(6);
  await act(async () => pending.resolve({ hasSession: false }));
  expect(text()).toContain('Ako je registracija prihvaćena'); expect(text()).not.toContain('Poslali smo Vam poruku');
  expect(button('Izmenite email')).toBeDefined(); await press('Nazad na prijavu');
  expect(button('Prijavite se')).toBeDefined(); expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
});

it('visibly gates unfinished recovery and never sends a broken reset link', async () => {
  await render(); await press('Zaboravili ste lozinku?');
  expect(text()).toContain('Oporavak lozinke još nije dostupan');
  expect(host('Text').some(node => textOf(node) === 'Oporavak pristupa')).toBe(true);
  const title = host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === 'Vratite pristup nalogu.')!;
  expect(StyleSheet.flatten(title.props.style).fontSize).toBe(27);
  expect(textOf(title)).not.toContain('\n');
  expect(host('TextInput')).toHaveLength(0); expect(button('Pošaljite link')).toBeUndefined();
  expect(mockAuth.requestPasswordRecovery).not.toHaveBeenCalled();
  await press('Nazad na prijavu'); expect(button('Prijavite se')).toBeDefined();
});

it('does not promise a confirmation email when autoconfirm is enabled but signup returns no session', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, emailConfirmationRequired: false });
  await render(); await press('Napravi nalog');
  for (const [placeholder, value] of [['Ime', 'Ana'], ['Prezime', 'Petrović'], ['Vaš grad', 'Novi Sad'],
    ['ime@primer.rs', 'ana@example.test'], ['Unesite lozinku', 'password'], ['Ponovite lozinku', 'password']]) await fill(placeholder, value);
  await act(async () => host('Pressable').find(node => node.props.accessibilityRole === 'checkbox')!.props.onPress());
  await press('Napravite nalog');
  expect(text()).toContain('Nalog još nije prijavljen.'); expect(text()).not.toContain('dobićete poruku');
  expect(button('Nazad na prijavu')).toBeDefined();
});

it('rejects an old login press after the form changes to signup', async () => {
  await render(); await fill('ime@primer.rs', 'ana@example.test'); await fill('Unesite lozinku', 'password');
  const oldPress = button('Prijavite se').props.onPress;
  await press('Napravi nalog'); await act(async () => oldPress());
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

it('does not invoke an old phone command after fresh settings disable phone', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true }); await render(); await press('Telefon');
  const oldPress = button('Pošaljite kod').props.onPress;
  mockRead.mockResolvedValue(emailOnly); await act(async () => mockForeground('active'));
  expect(text()).toContain('Prijava telefonom trenutno nije dostupna.');
  await act(async () => oldPress()); expect(mockAuth.sendPhoneOtp).not.toHaveBeenCalled();
  await press('Nazad na prijavu'); expect(button('Prijavite se')).toBeDefined();
});

it('serializes SMS verify and resend through the same command boundary', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true }); await render(); await press('Telefon');
  await fill('+381 6x xxx xxxx', '+381601234567'); await press('Pošaljite kod'); await fill('123456', '012345');
  const pending = deferred<void>(); mockAuth.verifyPhoneOtp.mockReturnValueOnce(pending.promise);
  await act(async () => { button('Potvrdite kod').props.onPress(); button('Pošaljite novi kod').props.onPress(); });
  expect(mockAuth.verifyPhoneOtp).toHaveBeenCalledTimes(1); expect(mockAuth.sendPhoneOtp).toHaveBeenCalledTimes(1);
  await act(async () => pending.reject(new Error('Kod nije prihvaćen.')));
  expect(text()).toContain('Kod nije prihvaćen.'); await press('Pošaljite novi kod');
  expect(mockAuth.sendPhoneOtp).toHaveBeenCalledTimes(2);
});

it('opens a direct auth destination without an intro and submits through the existing service', async () => {
  mockParams = { form: 'login' };
  await act(async () => { tree = create(<AuthScreen />); });
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(0);
  await fill('ime@primer.rs', 'ana@example.test');
  await fill('Unesite lozinku', 'password');
  await press('Prijavite se');
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.test', password: 'password' });
});

it.each([['onRequester', 'REQUESTER'], ['onWorker', 'WORKER']])('prepares %s once before opening Auth', async (action, intent) => {
  await act(async () => { tree = create(<AuthScreen />); });
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  const press = tree.root.findByType('Hero' as React.ElementType).props[action];
  await act(async () => { press(); press(); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  expect(mockPrepare).toHaveBeenCalledWith(intent);
  expect(host('TextInput')).toHaveLength(0);
  expect(text()).not.toContain('ISTI NALOG');
  await act(async () => pending.resolve());
  expect(input('ime@primer.rs')).toBeDefined();
  expect(text()).toContain(intent === 'REQUESTER' ? 'MENI TREBA · ISTI NALOG' : 'JA MOGU · ISTI NALOG');
  expect(text()).toContain(intent === 'REQUESTER' ? 'Nastavi do svojih Zadataka i Dogovora.' : 'Nastavi do Prijava, Zadataka i Dogovora.');
});

it('retains the entry and exposes retry after failed intent storage', async () => {
  mockPrepare.mockRejectedValueOnce(new Error('storage offline'));
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(tree.root.findByType('Hero' as React.ElementType).props.error).toContain('Pokušajte ponovo');
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(input('ime@primer.rs')).toBeDefined();
});

it('keeps prepared intent through signup and recovery but clears it for explicit plain sign-in', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  await press('Napravi nalog');
  expect(text()).not.toContain('JA MOGU · ISTI NALOG');
  await press('Već imaš nalog? Prijavi se');
  expect(text()).toContain('JA MOGU · ISTI NALOG');
  await press('Zaboravili ste lozinku?');
  expect(text()).toContain('BEZBEDAN POVRATAK');
  await press('Nazad na prijavu');
  expect(text()).toContain('JA MOGU · ISTI NALOG');
  await act(async () => host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!.props.onPress());
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
  expect(text()).toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('JA MOGU · ISTI NALOG');
});

it('does not carry a prepared label across an account incarnation change', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onRequester());
  expect(text()).toContain('MENI TREBA · ISTI NALOG');
  mockSession = { user: { id: 'other-account' }, accountRevision: 1 };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('MENI TREBA · ISTI NALOG');
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('MENI TREBA · ISTI NALOG');
});

it('does not accept a late prepare or show its label after signed-out account ABA', async () => {
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => { tree.root.findByType('Hero' as React.ElementType).props.onWorker(); });
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => pending.resolve());
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
  expect(host('TextInput')).toHaveLength(0);
  expect(text()).not.toContain('JA MOGU · ISTI NALOG');
});

it('uses neutral presentation for a new direct Auth destination after a prepared selection', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  mockParams = { form: 'login' };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('JA MOGU · ISTI NALOG');
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});


it('submits recovery only on user action and reports accepted rather than delivered email', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  await render(); await fill('ime@primer.rs', 'ana@example.test');
  await press('Zaboravili ste lozinku?');
  expect(mockAuth.requestPasswordRecovery).not.toHaveBeenCalled();
  expect(host('TextInput')).toHaveLength(1);
  await press('Pošaljite link');
  expect(mockAuth.requestPasswordRecovery.mock.calls).toEqual([['ana@example.test']]);
  expect(text()).toContain('Ako nalog sa ovim emailom postoji');
  expect(text()).not.toContain('Poslali smo');
  expect(button('Nazad na prijavu')).toBeDefined();
});

it('prevents duplicate recovery sends and keeps a failed request editable', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  const waiting = deferred<void>(); mockAuth.requestPasswordRecovery.mockReturnValue(waiting.promise);
  await render(); await press('Zaboravili ste lozinku?'); await fill('ime@primer.rs', 'ana@example.test');
  const send = button('Pošaljite link').props.onPress;
  await act(async () => { send(); send(); });
  expect(mockAuth.requestPasswordRecovery).toHaveBeenCalledTimes(1);
  expect(input('ime@primer.rs').props.editable).toBe(false);
  await act(async () => waiting.reject(new Error('Proverite email pre ponovnog pokušaja.')));
  expect(text()).toContain('Proverite email pre ponovnog pokušaja.');
  expect(input('ime@primer.rs').props.editable).toBe(true);
});
