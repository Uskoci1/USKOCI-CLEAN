import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { PasswordRecoveryError } from '../../contracts/passwordRecovery';

let mockLink: string | null = 'uskociapp://oporavak#synthetic';
let mockAccount: { user: { id: string } | null; accountRevision: number } = { user: null, accountRevision: 0 };
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockClear = jest.fn();
const mockVerify = jest.fn();
const mockSave = jest.fn();
const mockDispose = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CheckCircle: 'Icon', LockKey: 'Icon', Eye: 'Icon', EyeSlash: 'Icon' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }),
  useNavigation: () => ({ setParams: mockSetParams }) }));
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockLink, clearInitialURL: () => mockClear() }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../passwordRecoveryClientService', () => ({ passwordRecoveryClientService: {
  createSession: () => ({ verify: mockVerify, updatePassword: mockSave, dispose: mockDispose }),
} }));
import PasswordRecoveryScreen from '../../app/oporavak';
let tree: ReactTestRenderer;
const hosts = (type: string) => tree.root.findAll(node => node.type === type);
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
const text = () => textOf(tree.root);
const button = (label: string) => hosts('Pressable').find(node => node.props.accessibilityLabel === label || textOf(node).trim() === label)!;
const field = (label: string) => hosts('TextInput').find(node => node.props.accessibilityLabel === label)!;
async function render() { await act(async () => { tree = create(<PasswordRecoveryScreen />); }); }
async function fill(label: string, value: string) { await act(async () => field(label).props.onChangeText(value)); }
async function press(label: string) { await act(async () => button(label).props.onPress()); }
const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { resolve, reject, promise };
};
beforeEach(() => {
  jest.clearAllMocks(); mockLink = 'uskociapp://oporavak#synthetic'; mockAccount = { user: null, accountRevision: 0 };
  mockVerify.mockResolvedValue({ email: 'account-a@example.test' }); mockSave.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('does not render password controls or success before server verification finishes', async () => {
  const waiting = deferred<{ email: string }>(); mockVerify.mockReturnValue(waiting.promise);
  await render(); expect(text()).toContain('Proveravamo link'); expect(hosts('TextInput')).toHaveLength(0);
  expect(mockClear).toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSetParams).toHaveBeenCalledWith({ '#': '' });
  await act(async () => waiting.resolve({ email: 'account-a@example.test' }));
  expect(field('Nova lozinka').props.secureTextEntry).toBe(true);
  expect(field('Nova lozinka').props.autoComplete).toBe('new-password');
  expect(text()).toContain('account-a@example.test');
});
it('validates confirmation locally, single-flights the write and waits for confirmed success', async () => {
  await render(); await fill('Nova lozinka', '  Nova Lozinka!  '); await fill('Potvrdite novu lozinku', 'different');
  await press('Sačuvajte novu lozinku'); expect(mockSave).not.toHaveBeenCalled(); expect(text()).toContain('Lozinke se ne poklapaju.');
  await fill('Potvrdite novu lozinku', '  Nova Lozinka!  ');
  const waiting = deferred<void>(); mockSave.mockReturnValue(waiting.promise);
  const send = button('Sačuvajte novu lozinku').props.onPress;
  await act(async () => { send(); send(); });
  expect(mockSave.mock.calls).toEqual([['  Nova Lozinka!  ']]);
  expect(field('Nova lozinka').props.editable).toBe(false);
  expect(text()).not.toContain('Lozinka je\npromenjena.');
  await act(async () => waiting.resolve());
  expect(text()).toContain('Lozinka je\npromenjena.'); expect(hosts('TextInput')).toHaveLength(0);
  expect(mockReplace).not.toHaveBeenCalled();
  await press('Prijavite se'); expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'login' } });
});
it('refuses a signed-in actor before checking the supplied link', async () => {
  mockAccount = { user: { id: 'another-account' }, accountRevision: 1 }; await render();
  expect(text()).toContain('Najpre se odjavite'); expect(mockVerify).not.toHaveBeenCalled();
  expect(hosts('TextInput')).toHaveLength(0); await press('Nazad u aplikaciju'); expect(mockReplace).toHaveBeenCalledWith('/');
});
it('drops a late verified identity after account change and never displays its email', async () => {
  const waiting = deferred<{ email: string }>(); mockVerify.mockReturnValue(waiting.promise); await render();
  mockAccount = { user: { id: 'another-account' }, accountRevision: 1 };
  await act(async () => { tree.update(<PasswordRecoveryScreen />); waiting.resolve({ email: 'old-private@example.test' }); });
  expect(text()).not.toContain('old-private@example.test'); expect(mockDispose).toHaveBeenCalled();
});
it('shows a used/expired link without a password form and offers the recovery request route', async () => {
  mockVerify.mockRejectedValue(new PasswordRecoveryError('INVALID_LINK')); await render();
  expect(text()).toContain('Link je nevažeći ili je istekao'); expect(hosts('TextInput')).toHaveLength(0);
  await press('Zatražite novi link'); expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'recovery' } });
});
it('retries a verification read with a new lease, not a password update', async () => {
  mockVerify.mockRejectedValueOnce(new PasswordRecoveryError('VERIFY_UNAVAILABLE')); await render();
  await press('Pokušajte ponovo'); expect(mockVerify).toHaveBeenCalledTimes(2); expect(mockSave).not.toHaveBeenCalled();
  expect(field('Nova lozinka')).toBeDefined();
});
it('does not claim success or offer blind write retry after an unknown outcome', async () => {
  await render(); await fill('Nova lozinka', 'new-password'); await fill('Potvrdite novu lozinku', 'new-password');
  mockSave.mockRejectedValue(new PasswordRecoveryError('UPDATE_UNKNOWN')); await press('Sačuvajte novu lozinku');
  expect(text()).toContain('Nije potvrđeno da li je lozinka promenjena'); expect(hosts('TextInput')).toHaveLength(0);
  expect(button('Pokušajte ponovo')).toBeUndefined(); expect(mockSave).toHaveBeenCalledTimes(1);
});
it('clears entered secrets when another recovery link arrives', async () => {
  await render(); await fill('Nova lozinka', 'previous-password'); await fill('Potvrdite novu lozinku', 'previous-password');
  mockLink = 'uskociapp://oporavak#different-synthetic'; mockVerify.mockResolvedValue({ email: 'account-b@example.test' });
  await act(async () => tree.update(<PasswordRecoveryScreen />));
  expect(field('Nova lozinka').props.value).toBe(''); expect(field('Potvrdite novu lozinku').props.value).toBe('');
  expect(text()).toContain('account-b@example.test'); expect(mockSave).not.toHaveBeenCalled();
});
it('does not hide an interrupted write behind a newer link or a late success', async () => {
  await render(); await fill('Nova lozinka', 'new-password'); await fill('Potvrdite novu lozinku', 'new-password');
  const waiting = deferred<void>(); mockSave.mockReturnValue(waiting.promise);
  await act(async () => button('Sačuvajte novu lozinku').props.onPress());
  mockLink = 'uskociapp://oporavak#different-synthetic';
  await act(async () => tree.update(<PasswordRecoveryScreen />));
  await act(async () => waiting.resolve());
  expect(text()).toContain('Nije potvrđeno da li je lozinka promenjena'); expect(mockVerify).toHaveBeenCalledTimes(1);
});


it('clears the fragment in the installed Expo serializer, not just a mocked router', () => {
  const { getPathFromState } = require('expo-router/build/fork/getPathFromState');
  const state = { routes: [{ name: 'oporavak', params: { '#': '' } }], index: 0 };
  expect(getPathFromState(state, { screens: { oporavak: 'oporavak' } })).toBe('/oporavak');
});


it('scrubs the focused route rather than just the enclosing navigator params', () => {
  const { BaseRouter } = require('expo-router/build/react-navigation/routers/BaseRouter');
  const { getPathFromState } = require('expo-router/build/fork/getPathFromState');
  const config = { screens: { slot: { path: '', screens: { oporavak: 'oporavak' } } } };
  const leaf = { key: 'leaf-stack', type: 'stack', stale: false, index: 0, routeNames: ['oporavak'],
    routes: [{ key: 'recovery-route', name: 'oporavak', params: { '#': 'synthetic-secret' } }] };
  const state = { key: 'root', type: 'stack', stale: false, index: 0, routeNames: ['slot'],
    routes: [{ key: 'slot-route', name: 'slot', state: leaf }] };
  const action = { type: 'SET_PARAMS', payload: { params: { '#': '' } } };
  const wrongOwner = BaseRouter.getStateForAction(state, action);
  expect(getPathFromState(wrongOwner, config)).toBe('/oporavak#synthetic-secret');
  const cleanLeaf = BaseRouter.getStateForAction(leaf, { ...action, source: 'recovery-route' });
  const clean = { ...state, routes: [{ ...state.routes[0], state: cleanLeaf }] };
  expect(getPathFromState(clean, config)).toBe('/oporavak');
});
