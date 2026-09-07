import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockTask = jest.fn();
const mockNeed = jest.fn();
const mockProfile = jest.fn();
const mockSubmit = jest.fn();
const mockSource = { prilika: mockTask, potreba: mockNeed, mojRadnikProfil: mockProfile, podnesiPrijavu: mockSubmit };
const mockRouter = { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAlert = jest.fn();
let mockId: string | undefined = 'task-a';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Alert') return { alert: mockAlert };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: mockId }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button' }));

import Composer from '../../app/(app)/prilike/[id]/prijava';
let tree: ReactTestRenderer | undefined;
async function render() { await act(async () => { tree = create(<Composer />); }); }
const text = () => tree!.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree!.root.findByProps({ label }).props.onPress;
const sendButtons = () => tree!.root.findAllByProps({ label: 'Pošalji prijavu' });
beforeEach(() => {
  jest.clearAllMocks(); mockTask.mockReset(); mockId = 'task-a'; mockRouter.canGoBack.mockReturnValue(true);
  mockNeed.mockResolvedValue({ id: 'task-a', revizija: 1, pokrivenost: { ukupno: 1, preostalo: 1 } });
  mockProfile.mockResolvedValue({ id: 'worker-a', stanje: 'ACTIVE' });
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

describe('existing W05 consumer read-error compatibility', () => {
  it('catches the detail port rejection, shows retry, and recovers to the existing composer without a mutation', async () => {
    mockTask.mockRejectedValueOnce(new Error('private transport detail')).mockResolvedValueOnce({ id: 'task-a', naslov: 'Selidba' });
    await render();
    expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati'); expect(text()).not.toContain('private');
    expect(sendButtons()).toHaveLength(0);
    const retry = button('Pokušajte ponovo'); await act(async () => { retry(); retry(); });
    expect(mockTask).toHaveBeenCalledTimes(2); expect(sendButtons()).toHaveLength(1);
    expect(mockSubmit).not.toHaveBeenCalled(); expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows successful unavailability rather than a blank screen and supports the detail fallback', async () => {
    mockTask.mockResolvedValue(null); mockRouter.canGoBack.mockReturnValue(false); await render();
    expect(text()).toContain('Podaci za prijavu nisu dostupni'); expect(sendButtons()).toHaveLength(0);
    const back = button('Nazad na zadatak'); await act(async () => { back(); back(); });
    expect(mockRouter.replace.mock.calls).toEqual([[{ pathname: '/prilike/[id]', params: { id: 'task-a' } }]]);
  });

  it('keeps Back usable during an unfinished read', async () => {
    mockTask.mockReturnValue(new Promise(() => {})); await render();
    await act(async () => button('Nazad na zadatak')()); expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(sendButtons()).toHaveLength(0); expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('does not start an invalid route read or leave it loading forever', async () => {
    mockId = undefined; await render(); expect(mockTask).not.toHaveBeenCalled();
    expect(text()).toContain('Podaci za prijavu nisu dostupni'); expect(text()).not.toContain('Učitavam');
  });
});
