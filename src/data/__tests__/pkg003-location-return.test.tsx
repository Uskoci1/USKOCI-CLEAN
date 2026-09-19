import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockRefresh = jest.fn();
const mockSave = jest.fn();
let mockConversationId = '30000000-0000-4000-8000-000000000003';
let mockEditor: Record<string, unknown> = {
  data: null,
  loading: false,
  error: null,
  saved: false,
  busy: false,
  uncertain: false,
  refresh: mockRefresh,
  save: mockSave,
};

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: () => ({ conversationId: mockConversationId }),
}));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: () => mockEditor }));
jest.mock('../locationClientService', () => ({ needLocationClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../productionLocationResolver', () => ({ createProductionLocationResolver: () => ({ kind: 'mock-resolver' }) }));
jest.mock('../../ui/location/NeedLocationForm', () => ({ NeedLocationForm: (props: unknown) => require('react').createElement('NeedLocationForm', props) }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationScreen: (props: unknown) => require('react').createElement('LocationScreen', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('T', props) }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: (props: unknown) => require('react').createElement('Button', props) }));

import MestoZadatka from '../../app/(app)/mesto-zadatka';

let tree: ReactTestRenderer;

beforeEach(() => {
  jest.clearAllMocks();
  mockConversationId = '30000000-0000-4000-8000-000000000003';
  mockCanGoBack.mockReturnValue(false);
  mockEditor = {
    data: null,
    loading: false,
    error: null,
    saved: false,
    busy: false,
    uncertain: false,
    refresh: mockRefresh,
    save: mockSave,
  };
});
afterEach(() => { act(() => tree?.unmount()); });

async function render() {
  await act(async () => { tree = create(<MestoZadatka />); });
  return tree.root.findByType('LocationScreen' as never);
}

describe('PKG-003 location review return', () => {
  it('returns a direct/deep entry to the current canonical complete review', async () => {
    const screen = await render();
    act(() => screen.props.onBack());
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/pregled-zadatka',
      params: { conversationId: mockConversationId },
    });
  });

  it('preserves an existing navigation stack instead of replacing it', async () => {
    mockCanGoBack.mockReturnValue(true);
    const screen = await render();
    act(() => screen.props.onBack());
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('uses the same canonical fallback after a saved location when no back stack exists', async () => {
    mockEditor = { ...mockEditor, saved: true };
    await render();
    const button = tree.root.findByProps({ label: 'Vrati se na pregled' });
    act(() => button.props.onPress());
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/pregled-zadatka',
      params: { conversationId: mockConversationId },
    });
  });
});
