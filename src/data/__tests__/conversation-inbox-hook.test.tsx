import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ConversationInboxItem, ConversationInboxPage } from '../../contracts/conversationInbox';
import type { ConversationInboxPort } from '../conversationInboxClientService';

const accountId = '10000000-0000-4000-8000-000000000001';
const mockSession = { user: { id: accountId }, accountRevision: 1, sessionEpoch: 1 };
let mockActivity = 'active', mockFocused = true;
const mockAppListeners = new Set<(state: string) => void>();
const mockList = jest.fn<ReturnType<ConversationInboxPort['list']>, Parameters<ConversationInboxPort['list']>>();
const mockStopIncoming = jest.fn(), mockStopCoordinator = jest.fn();
const mockSubscribeIncoming = jest.fn((..._args: unknown[]) => mockStopIncoming);

jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../conversationInboxClientService', () => ({
  createConversationInboxClientService: () => ({ list: mockList }),
}));
// Notification transport is not under test. Keep the real hook and inbox model;
// this boundary never executes the hook's lazy native notification import.
jest.mock('../agreementIncomingRefresh', () => ({
  createAgreementIncomingRefresh: () => ({ hint: jest.fn(), stop: mockStopCoordinator }),
  subscribeAgreementIncomingRefresh: (...args: unknown[]) => mockSubscribeIncoming(...args),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { ...native.Platform, OS: 'android' };
    if (key === 'AppState') return {
      get currentState() { return mockActivity; },
      addEventListener: (_: string, callback: (state: string) => void) => {
        mockAppListeners.add(callback);
        return { remove: () => mockAppListeners.delete(callback) };
      },
    };
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => {
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
} }));

import { useConversationInbox } from '../../hooks/useConversationInbox';

const item: ConversationInboxItem = {
  kind: 'AGREEMENT', id: '20000000-0000-4000-8000-000000000001',
  routeAgreementId: '20000000-0000-4000-8000-000000000001',
  task: { id: '30000000-0000-4000-8000-000000000001', title: 'Selidba' }, counterpart: null,
  lastMessage: { id: '40000000-0000-4000-8000-000000000001', createdAt: '2026-10-02T10:00:00.123456Z',
    mine: false, kind: 'TEXT', preview: 'Privatna poruka' }, unreadMessageCount: null,
};
const page: ConversationInboxPage = {
  schema: 'MY_CONVERSATIONS_PAGE_V1', accountId, authoritative: true,
  asOf: '2026-10-02T12:00:00.123456Z', snapshotAt: '2026-10-02T12:00:00.123456Z',
  items: [item], nextCursor: null,
};
let inbox: ReturnType<typeof useConversationInbox>, tree: ReactTestRenderer | undefined;
function Probe() { inbox = useConversationInbox(); return null; }
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function activity(value: string) {
  await act(async () => {
    mockActivity = value;
    [...mockAppListeners].forEach(listener => listener(value));
    await flush();
  });
}
beforeEach(() => {
  jest.clearAllMocks(); mockList.mockReset(); mockAppListeners.clear();
  mockActivity = 'active'; mockFocused = true;
  mockList.mockResolvedValue({ ok: true, podatak: page });
});
afterEach(async () => { await act(async () => { tree?.unmount(); await flush(); }); });

test('background clears a blurred mounted inbox without restarting reads until focus returns', async () => {
  await act(async () => { tree = create(<Probe />); await flush(); });
  expect(inbox.state.page?.items).toEqual([item]);
  expect(inbox.model.canOpen(item)).toBe(true);
  expect(mockList).toHaveBeenCalledTimes(1);

  // Ordinary in-app navigation retains rows for Back, but cannot open stale rows.
  await act(async () => { mockFocused = false; tree!.update(<Probe />); await flush(); });
  expect(inbox.state.page?.items).toEqual([item]);
  expect(inbox.state.loadedPages).toBe(1);
  expect(inbox.model.canOpen(item)).toBe(false);
  expect(mockStopIncoming).toHaveBeenCalledTimes(1);
  expect(mockStopCoordinator).toHaveBeenCalledTimes(1);

  // The focus listener has retired: only the mount-lifetime observer can clear
  // this retained private preview while the user is on another screen.
  await activity('background');
  expect(inbox.state).toMatchObject({ page: null, loadedPages: 0, stale: true });
  expect(inbox.model.canOpen(item)).toBe(false);
  expect(mockList).toHaveBeenCalledTimes(1);
  await activity('active');
  expect(inbox.state.page).toBeNull();
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(mockSubscribeIncoming).toHaveBeenCalledTimes(1);

  await act(async () => { mockFocused = true; tree!.update(<Probe />); await flush(); });
  expect(mockList).toHaveBeenCalledTimes(2);
  expect(mockList.mock.calls[1][0]).toBeNull();
  expect(inbox.state.page?.items).toEqual([item]);
  expect(inbox.model.canOpen(item)).toBe(true);
  expect(mockSubscribeIncoming).toHaveBeenCalledTimes(2);
  await act(async () => { tree!.unmount(); tree = undefined; await flush(); });
  expect(mockAppListeners.size).toBe(0);
});
