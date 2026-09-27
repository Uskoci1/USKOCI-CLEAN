import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
let mockActivity = 'active', mockFocused = true, mockPlatform = 'android';
const mockAppListeners = new Set<(state: string) => void>();
const mockReceived = jest.fn(), mockDropped = jest.fn(), mockRemoveReceived = jest.fn(), mockRemoveDropped = jest.fn();
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    if (key === 'AppState') return { get currentState() { return mockActivity; },
      addEventListener: (_: string, callback: (state: string) => void) => { mockAppListeners.add(callback); return { remove: () => mockAppListeners.delete(callback) }; } };
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => {
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
} }));
jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: (callback: (value: unknown) => void) => { mockReceived(callback); return { remove: mockRemoveReceived }; },
  addNotificationsDroppedListener: (callback: () => void) => { mockDropped(callback); return { remove: mockRemoveDropped }; },
}));

// Expo's Jest preset preserves import(), which needs the unavailable VM ESM
// loader. Like the native-current-location suite, compile exact production bytes
// to CommonJS; substitute only module resolution, never lifecycle/control logic.
const compiled = ts.transpileModule(readFileSync(join(__dirname, '../../hooks/useAgreementIncomingRefresh.ts'), 'utf8'), {
  fileName: 'useAgreementIncomingRefresh.ts', reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
expect(compiled.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)).toEqual([]);
const { useAgreementIncomingRefresh }: typeof import('../../hooks/useAgreementIncomingRefresh') =
  new Function('exports', 'require', compiled.outputText + '\nreturn exports;')({}, (name: string) => {
    if (name === 'react') return require('react');
    if (name === 'react-native') return require('react-native');
    if (name === 'expo-router') return require('expo-router');
    if (name === 'expo-notifications') return require('expo-notifications');
    if (name === '../data/agreementIncomingRefresh') return require('../agreementIncomingRefresh');
    if (name === '../store/sesija') return require('../../store/sesija');
    if (name === '../ui/notifications/publicInboxCopy') return require('../../ui/notifications/publicInboxCopy');
    throw new Error('Unexpected hook dependency ' + name);
  });

const source = {}, refresh = jest.fn();
type Props = { enabled?: boolean; accountRevision?: number; agreementId?: string; dataSource?: object };
function Probe({ enabled = true, accountRevision = 1, agreementId = 'agreement-a', dataSource = source }: Props) {
  useAgreementIncomingRefresh({ accountId: 'account-a', accountRevision, agreementId, enabled, source: dataSource, refresh });
  return null;
}
const hint = () => ({ request: { identifier: 'incoming-1', trigger: { type: 'push' },
  content: { title: 'Nova poruka u Dogovoru', body: 'Imaš novu poruku.', data: { kind: 'INBOX' } } } });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); refresh.mockResolvedValue(undefined);
  mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
  mockActivity = 'active'; mockFocused = true; mockPlatform = 'android'; mockAppListeners.clear();
});
afterEach(async () => { await act(async () => { tree?.unmount(); await flush(); }); jest.useRealTimers(); });
const mount = async (props: Props = {}) => act(async () => { tree = create(<Probe {...props} />); await flush(); });
const received = () => mockReceived.mock.calls.at(-1)![0] as (value: unknown) => void;

it.each(['disabled', 'background', 'unfocused', 'web'])('does not register a native listener when %s', async reason => {
  if (reason === 'background') mockActivity = 'background';
  if (reason === 'unfocused') mockFocused = false;
  if (reason === 'web') mockPlatform = 'web';
  await mount({ enabled: reason !== 'disabled' });
  expect(mockReceived).not.toHaveBeenCalled(); expect(mockDropped).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});

it('refreshes only after a hint and replaces foreground listeners without replaying old hints', async () => {
  await mount(); const old = received(); expect(refresh).not.toHaveBeenCalled();
  await act(async () => { old(hint()); await flush(); }); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { mockActivity = 'inactive'; mockAppListeners.forEach(fn => fn(mockActivity)); old(hint()); await flush(); });
  expect(mockRemoveReceived).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { mockActivity = 'active'; mockAppListeners.forEach(fn => fn(mockActivity)); await flush(); });
  expect(mockReceived).toHaveBeenCalledTimes(2); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { old(hint()); received()(hint()); await flush(); }); expect(refresh).toHaveBeenCalledTimes(2);
});

it.each(['accountABA', 'session', 'source', 'target', 'disabled', 'blur', 'unmount'])('retires a retained listener on %s', async reason => {
  await mount(); const old = received();
  await act(async () => {
    if (reason === 'accountABA') mockSession = { ...mockSession, accountRevision: 3, sessionEpoch: 3 };
    else if (reason === 'session') mockSession = { ...mockSession, sessionEpoch: 2 };
    else if (reason === 'source') tree.update(<Probe dataSource={{}} />);
    else if (reason === 'target') tree.update(<Probe agreementId="agreement-b" />);
    else if (reason === 'disabled') tree.update(<Probe enabled={false} />);
    else if (reason === 'blur') { mockFocused = false; tree.update(<Probe />); }
    else tree.unmount();
    await flush();
  });
  await act(async () => { old(hint()); await flush(); });
  expect(refresh).not.toHaveBeenCalled();
});
