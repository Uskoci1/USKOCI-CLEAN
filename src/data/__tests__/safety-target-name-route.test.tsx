import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * EX-07 S06: the route hands the safety screen the PROFILE the person came from (an identifier, never a name) only in a build compiled with the flag, and only when it is
 * an identifier; a profile that is not one never stops the safety screen from opening. Without the flag the route is exactly what it was.
 */
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002', P = '10000000-0000-4000-8000-0000000000aa';
const NAME = 'EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME';
let mockParams: Record<string, string | undefined> = {};
const mockSession = { user: { id: A }, accountRevision: 1 };
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession }));
jest.mock('../../ui/safety/SafetyScreen', () => ({ SafetyScreen: 'Safety' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Route from '../../app/(app)/bezbednost';

let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const safety = () => tree.root.findByType('Safety' as React.ElementType);
beforeEach(() => { delete process.env[NAME]; jest.clearAllMocks(); mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); delete process.env[NAME]; });

describe('flag off: the route is what it was', () => {
  it('opens the safety screen with exactly the target and the context, whatever profile the link carries', async () => {
    mockParams = { targetAccountId: B, profileId: P, needId: A }; await render();
    expect(safety().props).toStrictEqual({ targetAccountId: B, needId: A, agreementId: null });
  });

  it('opens it with a context-free target as before', async () => {
    mockParams = { targetAccountId: B }; await render();
    expect(safety().props).toStrictEqual({ targetAccountId: B, needId: null, agreementId: null });
  });

  it('a profile that is not an identifier changes nothing', async () => {
    mockParams = { targetAccountId: B, profileId: 'not-a-uuid' }; await render();
    expect(safety().props).toStrictEqual({ targetAccountId: B, needId: null, agreementId: null });
  });
});

describe('flag on: the profile is handed on when it is an identifier', () => {
  beforeEach(() => { process.env[NAME] = '1'; });

  it('passes the profile beside the target and the context', async () => {
    mockParams = { targetAccountId: B, profileId: P, agreementId: A }; await render();
    expect(safety().props).toStrictEqual({ targetAccountId: B, profileId: P, needId: null, agreementId: A });
  });

  it.each([undefined, '', 'not-a-uuid', 'Marko Petrovic'])('passes no profile for %p and still opens the safety screen', async profileId => {
    mockParams = { targetAccountId: B, ...(profileId === undefined ? {} : { profileId }) }; await render();
    expect(safety().props).toStrictEqual({ targetAccountId: B, needId: null, agreementId: null });
  });

  it('keeps every refusal it had: no target, your own account, a context that is not an identifier', async () => {
    for (const params of [{}, { targetAccountId: A, profileId: P }, { targetAccountId: B, profileId: P, needId: 'not-a-uuid' }]) {
      mockParams = params; await render();
      expect(tree.root.findAllByType('Safety' as React.ElementType)).toHaveLength(0);
      await act(async () => tree.unmount());
    }
  });
});
