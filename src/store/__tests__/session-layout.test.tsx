import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Session } from '@supabase/supabase-js';

const mockRouter = { replace: jest.fn() };
const mockSegments = ['(app)'];
const mockConsume = jest.fn();
const mockRole = jest.fn();
const mockSession = { user: { id: 'account-a' } } as Session;
let mockRendered: { isLoaded: boolean; session: Session | null; user: Session['user'] | null; sessionEpoch: number; returnTargetRevision: number } =
  { isLoaded: true, session: mockSession, user: mockSession.user, sessionEpoch: 1, returnTargetRevision: 0 };
let mockCurrent = mockRendered;

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => {
  const React = require('react');
  const { Screen } = require('expo-router/build/views/Screen');
  const { Protected } = require('expo-router/build/views/Protected');
  const { useFilterScreenChildren } = require('expo-router/build/layouts/withLayoutContext');
  const Stack = ({ children }: { children?: React.ReactNode }) => {
    const filtered = useFilterScreenChildren(children);
    return React.createElement('Stack', {
      screens: filtered.screens.map((screen: { name: string }) => screen.name),
      protectedScreens: Array.from(filtered.protectedScreens),
    });
  };
  Stack.Screen = Screen;
  Stack.Protected = Protected;
  return { Stack, useRouter: () => mockRouter, useSegments: () => mockSegments };
});
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureHandlerRootView' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: 'SafeAreaProvider' }));
jest.mock('../sesija', () => ({ useSesija: () => mockRendered, sesijaSada: () => mockCurrent }));
jest.mock('../povratniCilj', () => ({ povratniCilj: { consumeCompleted: (...args: unknown[]) => mockConsume(...args) } }));
jest.mock('../uloga', () => ({ postaviUlogu: (role: string) => mockRole(role) }));

import RootLayout from '../../app/_layout';

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockSegments.splice(0, mockSegments.length, '(app)');
  mockRendered = { isLoaded: true, session: mockSession, user: mockSession.user, sessionEpoch: 1, returnTargetRevision: 0 };
  mockCurrent = mockRendered;
  mockConsume.mockResolvedValue(null);
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); });
async function render() { await act(async () => { tree = create(<RootLayout />); }); }

describe('session-owned root return navigation', () => {
  it('exposes only Auth at cold signed-out startup and excludes every private root route', async () => {
    mockRendered = { ...mockRendered, session: null, user: null };
    mockCurrent = mockRendered;
    await render();
    const stack = tree.root.findByType('Stack' as React.ElementType);
    expect(stack.props.screens).toEqual(['auth']);
    expect(stack.props.protectedScreens.sort()).toEqual(['(app)', 'dogovor/[id]', 'obavestenja', 'prijave']);
  });

  it('exposes the four private root routes only after authentication and excludes Auth', async () => {
    await render();
    const stack = tree.root.findByType('Stack' as React.ElementType);
    expect(stack.props.screens.sort()).toEqual(['(app)', 'dogovor/[id]', 'obavestenja', 'prijave']);
    expect(stack.props.protectedScreens).toEqual(['auth']);
  });

  it.each([
    [{ kind: 'REQUESTER_DRAFT', draftKey: 'draft-1' }, { pathname: '/nova', params: { conversationId: 'draft-1' } }],
    [{ kind: 'NEED', needId: 'need-1' }, { pathname: '/potrebe/[id]/pregled', params: { id: 'need-1' } }],
    [{ kind: 'DOGOVOR', agreementId: 'agreement-1' }, { pathname: '/dogovor/[id]', params: { id: 'agreement-1' } }],
  ])('rechecks a newly completed intent and keeps its existing typed destination', async (returnTarget, destination) => {
    mockConsume.mockResolvedValueOnce(null).mockResolvedValue({
      completedByUserId: 'account-a', intent: { intent: 'WORKER', returnTarget },
    });
    await render();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    mockRendered = { ...mockRendered, returnTargetRevision: 1 };
    mockCurrent = mockRendered;
    await act(async () => tree.update(<RootLayout />));
    expect(mockConsume).toHaveBeenCalledTimes(2);
    expect(mockRole).toHaveBeenCalledWith('uskocer');
    expect(mockRouter.replace).toHaveBeenCalledWith(destination);
  });

  it.each(['account-b', 'account-a'])('rejects stale A completion before React cleanup when current account is %s in a newer epoch', async accountId => {
    let resolve!: (record: unknown) => void;
    mockConsume.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render();
    mockCurrent = { ...mockRendered, user: { ...mockSession.user, id: accountId }, sessionEpoch: 2 };
    expect(mockConsume.mock.calls[0][1]()).toBe(false);
    await act(async () => resolve({ intent: { intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'old-private-need' } } }));
    expect(mockRole).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('handles failed local consumption without a navigation or unhandled rejection', async () => {
    mockConsume.mockRejectedValueOnce(new Error('storage unavailable'));
    await render();
    expect(mockRole).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not leave Auth from a stale signed-in render after logout', async () => {
    mockSegments.splice(0, mockSegments.length, 'auth');
    mockCurrent = { ...mockRendered, session: null, user: null, sessionEpoch: 2 };
    await render();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not open Auth from a stale signed-out render after a new sign-in', async () => {
    mockRendered = { ...mockRendered, session: null, user: null };
    mockCurrent = { ...mockRendered, session: mockSession, user: mockSession.user, sessionEpoch: 2 };
    await render();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
