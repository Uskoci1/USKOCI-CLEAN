import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { Izvor } from '../ports';

const accountId = '10000000-0000-4000-8000-000000000001';
const agreementId = '20000000-0000-4000-8000-000000000001';
let mockSession = { user: { id: accountId }, session: { user: { id: accountId } }, accountRevision: 1, sessionEpoch: 1 };
let mockActivity = 'active', mockFocused = true, mockPlatform = 'android';
const mockAppListeners = new Set<(state: string) => void>();
const mockReceived = jest.fn(), mockDropped = jest.fn(), mockRemoveReceived = jest.fn(), mockRemoveDropped = jest.fn();
type Channel = {
  changes: Map<string, (value: unknown) => void>;
  system?: (value: unknown) => void;
  status?: (value: string) => void;
  on: jest.Mock;
  subscribe: jest.Mock;
};
const mockChannels: Channel[] = [];
const mockRemoveChannel = jest.fn(() => Promise.resolve());
const mockOpenChannel = jest.fn(() => {
  const channel: Channel = { changes: new Map(), on: jest.fn(), subscribe: jest.fn() };
  channel.on.mockImplementation((type: string, filter: { event?: string }, callback: (value: unknown) => void) => {
    if (type === 'postgres_changes') channel.changes.set(filter.event!, callback);
    else if (type === 'system') channel.system = callback;
    return channel;
  });
  channel.subscribe.mockImplementation((callback: (value: string) => void) => { channel.status = callback; return channel; });
  mockChannels.push(channel); return channel;
});
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ channel: mockOpenChannel, removeChannel: mockRemoveChannel }) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { ...native.Platform, OS: mockPlatform };
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
    if (name === '../data/agreementInvalidationService') return require('../agreementInvalidationService');
    if (name === '../store/sesija') return require('../../store/sesija');
    if (name === '../ui/notifications/publicInboxCopy') return require('../../ui/notifications/publicInboxCopy');
    throw new Error('Unexpected hook dependency ' + name);
  });

const source = { poreklo: 'lazni' } as const, liveSource = { poreklo: 'supabase' } as const, refresh = jest.fn();
type Props = { enabled?: boolean; accountRevision?: number; agreementId?: string; dataSource?: Pick<Izvor, 'poreklo'> };
function Probe({ enabled = true, accountRevision = 1, agreementId: target = agreementId, dataSource = source }: Props) {
  useAgreementIncomingRefresh({ accountId, accountRevision, agreementId: target, enabled, source: dataSource, refresh });
  return null;
}
const hint = () => ({ request: { identifier: 'incoming-1', trigger: { type: 'push' },
  content: { title: 'Nova poruka u Dogovoru', body: 'Imaš novu poruku.', data: { kind: 'INBOX' } } } });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); refresh.mockResolvedValue(undefined);
  mockSession = { user: { id: accountId }, session: { user: { id: accountId } }, accountRevision: 1, sessionEpoch: 1 };
  mockActivity = 'active'; mockFocused = true; mockPlatform = 'android'; mockAppListeners.clear();
  mockChannels.length = 0;
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
    else if (reason === 'source') tree.update(<Probe dataSource={{ poreklo: 'lazni' }} />);
    else if (reason === 'target') tree.update(<Probe agreementId="agreement-b" />);
    else if (reason === 'disabled') tree.update(<Probe enabled={false} />);
    else if (reason === 'blur') { mockFocused = false; tree.update(<Probe />); }
    else tree.unmount();
    await flush();
  });
  await act(async () => { old(hint()); await flush(); });
  expect(refresh).not.toHaveBeenCalled();
});

const invalidation = (revision = 1) => ({ schema: 'public', table: 'agreement_invalidations_v1',
  eventType: 'INSERT', commit_timestamp: '2026-09-27T20:00:00.123456+00:00', errors: [],
  new: { agreement_id: agreementId, revision }, old: {} });
const emit = (channel: Channel, revision = 1) => channel.changes.get('INSERT')?.(invalidation(revision));
const activity = async (state: string) => act(async () => {
  mockActivity = state;
  for (const listener of [...mockAppListeners]) listener(state);
  await flush();
});

it.each(['lazni', 'disabled', 'background', 'unfocused', 'web'])('does not open a private channel when %s', async reason => {
  if (reason === 'background') mockActivity = 'background';
  if (reason === 'unfocused') mockFocused = false;
  if (reason === 'web') mockPlatform = 'web';
  await mount({ dataSource: reason === 'lazni' ? source : liveSource, enabled: reason !== 'disabled' });
  expect(mockOpenChannel).not.toHaveBeenCalled();
});

it('connects the focused Supabase Agreement to only the body-free channel and existing refresh', async () => {
  await mount({ dataSource: liveSource });
  expect(mockOpenChannel).toHaveBeenCalledTimes(1);
  const channel = mockChannels[0];
  expect(channel.on.mock.calls.filter(call => call[0] === 'postgres_changes').map(call => call[1])).toEqual([
    { event: 'INSERT', schema: 'public', table: 'agreement_invalidations_v1', filter: 'agreement_id=eq.' + agreementId },
    { event: 'UPDATE', schema: 'public', table: 'agreement_invalidations_v1', filter: 'agreement_id=eq.' + agreementId },
  ]);
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => {
    channel.status?.('SUBSCRIBED'); channel.system?.({ extension: 'postgres_changes', status: 'ok' }); emit(channel);
    await flush();
  });
  expect(refresh.mock.calls).toEqual([[]]);
  expect(mockReceived).toHaveBeenCalledTimes(1);
  await act(async () => { received()(hint()); await flush(); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(2_000); });
  expect(refresh).toHaveBeenCalledTimes(2); // The pre-existing push fallback remains connected.
});

it('coalesces same-turn push, join, system and CDC before dispatch into one canonical read', async () => {
  await mount({ dataSource: liveSource }); const channel = mockChannels[0];
  await act(async () => {
    received()(hint()); emit(channel); channel.status?.('SUBSCRIBED');
    channel.system?.({ extension: 'postgres_changes', status: 'ok' }); await flush();
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); received()(hint()); await flush(); });
  expect(refresh).toHaveBeenCalledTimes(1); // Its push receipt remains deduplicated.
});

it('retains one trailing canonical read across push/arrival/reconnect while the first read is pending', async () => {
  let finish!: () => void;
  refresh.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  await mount({ dataSource: liveSource }); const channel = mockChannels[0];
  await act(async () => { emit(channel); await flush(); });
  await act(async () => {
    emit(channel, 2); channel.status?.('SUBSCRIBED'); channel.system?.({ extension: 'postgres_changes', status: 'ok' });
    received()(hint());
    await jest.advanceTimersByTimeAsync(5_000); await flush();
  });
  expect(refresh).toHaveBeenCalledTimes(1); expect(mockOpenChannel).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await flush(); });
  expect(refresh).toHaveBeenCalledTimes(2);
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('cleans a partial CDC registration while preserving the owned push fallback', async () => {
  const open = mockOpenChannel.getMockImplementation()!;
  mockOpenChannel.mockImplementationOnce(() => {
    const channel = open(), on = channel.on.getMockImplementation()!;
    channel.on.mockImplementation((type: string, filter: unknown, callback: unknown) => {
      if (type === 'system') throw new Error('unavailable');
      return on(type, filter, callback);
    });
    return channel;
  });
  await mount({ dataSource: liveSource }); const retired = mockChannels[0];
  expect(mockRemoveChannel).toHaveBeenCalledWith(retired);
  await act(async () => { emit(retired); await flush(); });
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { received()(hint()); await flush(); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); await flush(); });
  expect(mockRemoveReceived).toHaveBeenCalledTimes(1); expect(mockAppListeners.size).toBe(0);
});

it('cleans a partial push registration while keeping the owned CDC channel usable', async () => {
  mockDropped.mockImplementationOnce(() => { throw new Error('unavailable'); });
  await mount({ dataSource: liveSource });
  expect(mockRemoveReceived).toHaveBeenCalledTimes(1);
  await act(async () => { received()(hint()); await flush(); });
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { emit(mockChannels[0]); await flush(); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); await flush(); });
  expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannels[0]); expect(mockAppListeners.size).toBe(0);
});

it('retires both sources on background and only creates one channel for the next foreground visit', async () => {
  await mount({ dataSource: liveSource }); const old = mockChannels[0];
  await activity('background');
  expect(mockRemoveChannel).toHaveBeenCalledWith(old); expect(mockRemoveReceived).toHaveBeenCalledTimes(1);
  await act(async () => { emit(old); old.status?.('SUBSCRIBED'); await flush(); });
  expect(refresh).not.toHaveBeenCalled();
  await activity('active'); await activity('active');
  expect(mockOpenChannel).toHaveBeenCalledTimes(2); expect(mockReceived).toHaveBeenCalledTimes(2);
  await act(async () => { emit(old); old.status?.('SUBSCRIBED'); await flush(); });
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { emit(mockChannels[1]); await flush(); });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it.each(['accountABA', 'session', 'source', 'target', 'disabled', 'blur', 'unmount'])('retires queued and retained wire callbacks on %s', async reason => {
  await mount({ dataSource: liveSource }); const old = mockChannels[0];
  act(() => {
    emit(old); // Retirement happens before its queued canonical read can start.
    if (reason === 'accountABA') mockSession = { ...mockSession, accountRevision: 3, sessionEpoch: 3 };
    else if (reason === 'session') mockSession = { ...mockSession, sessionEpoch: 2 };
    else if (reason === 'source') tree.update(<Probe />);
    else if (reason === 'target') tree.update(<Probe dataSource={liveSource} agreementId="20000000-0000-4000-8000-000000000002" />);
    else if (reason === 'disabled') tree.update(<Probe dataSource={liveSource} enabled={false} />);
    else if (reason === 'blur') { mockFocused = false; tree.update(<Probe dataSource={liveSource} />); }
    else tree.unmount();
  });
  await act(async () => {
    emit(old); old.status?.('SUBSCRIBED'); old.system?.({ extension: 'postgres_changes', status: 'ok' }); await flush();
  });
  expect(refresh).not.toHaveBeenCalled(); expect(mockRemoveChannel).toHaveBeenCalledWith(old);
});

it('waits for loaded chat admission after foreground and keeps terminal/disabled history unsubscribed', async () => {
  await mount({ dataSource: liveSource }); await activity('background');
  await act(async () => { tree.update(<Probe dataSource={liveSource} enabled={false} />); await flush(); });
  await activity('active');
  expect(mockOpenChannel).toHaveBeenCalledTimes(1);
  await act(async () => { tree.update(<Probe dataSource={liveSource} />); await flush(); });
  expect(mockOpenChannel).toHaveBeenCalledTimes(2);
  const current = mockChannels[1];
  await act(async () => { tree.update(<Probe dataSource={liveSource} enabled={false} />); await flush(); });
  await act(async () => { emit(current); await flush(); });
  expect(refresh).not.toHaveBeenCalled(); expect(mockRemoveChannel).toHaveBeenCalledWith(current);
});
