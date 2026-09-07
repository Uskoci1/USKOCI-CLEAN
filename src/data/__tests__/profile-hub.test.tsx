import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockAccountId = 'account-a';
let mockIntent: 'narucilac' | 'uskocer' = 'narucilac';
const mockPostaviUlogu = jest.fn();
const mockSignOut = jest.fn();
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRefresh = jest.fn();
let mockResource = { data: { ime: 'Ana Petrović', grad: 'Novi Sad' } as { ime: string | null; grad: string | null } | null,
  loading: false, error: false, refresh: mockRefresh };

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', ArrowsLeftRight: 'Icon', User: 'Icon', CaretRight: 'Icon', SignOut: 'Icon' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccountId } }), sesijaSada: () => ({ user: { id: mockAccountId } }) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: (value: string) => mockPostaviUlogu(value) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: { signOut: mockSignOut } }) }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => mockResource }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));

import Profil from '../../app/(app)/profil';

let tree: ReactTestRenderer;
async function render() { await act(async () => { tree = create(<Profil />); }); }
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label }).props.onPress();
const logout = () => tree.root.findByProps({ label: 'Odjavite se' }).props.onPress();
const visibleText = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = 'account-a'; mockIntent = 'narucilac';
  mockResource = { data: { ime: 'Ana Petrović', grad: 'Novi Sad' }, loading: false, error: false, refresh: mockRefresh };
  mockRouter.canGoBack.mockReturnValue(true);
  mockSignOut.mockResolvedValue({ error: null });
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); });

describe('real profile hub', () => {
  it('shows actual identity with no fabricated reputation or dead feature rows', async () => {
    await render();
    const rendered = visibleText();
    expect(rendered).toContain('Ana Petrović'); expect(rendered).toContain('Novi Sad');
    for (const fake of ['Miloš', 'MŠ', '4,9', '18 recenzija', 'Javni profil', 'Podešavanja']) expect(rendered).not.toContain(fake);
  });

  it('keeps missing identity distinct from loading and failed reads', async () => {
    mockResource.data = null;
    await render();
    expect(visibleText()).toContain('Ime još nije uneto');
    mockResource = { ...mockResource, error: true };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).not.toContain('Ime još nije uneto');
    await act(async () => tree.root.findByProps({ label: 'Pokušajte ponovo' }).props.onPress());
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    mockResource = { ...mockResource, error: false, loading: true };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).toContain('Učitavamo profil');
  });

  it('double-tap switches intent once and enters real Worker discovery', async () => {
    await render();
    const onPress = tree.root.findByProps({ accessibilityLabel: 'Pređite na JA MOGU' }).props.onPress;
    await act(async () => { onPress(); onPress(); });
    expect(mockPostaviUlogu.mock.calls).toEqual([['uskocer']]);
    expect(mockRouter.replace.mock.calls).toEqual([['/prilike']]);
  });

  it('Worker hub opens the real editor and Back restores source or intent root', async () => {
    mockIntent = 'uskocer';
    await render();
    await act(async () => press('Uredite Radni profil'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/radnik');
    await act(async () => tree.unmount());
    mockRouter.canGoBack.mockReturnValue(false);
    await render();
    await act(async () => press('Nazad'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/moje-prijave');
  });

  it('does not let a stale press act on a newly signed-in account', async () => {
    await render();
    mockAccountId = 'account-b';
    await act(async () => { press('Pređite na JA MOGU'); logout(); });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockPostaviUlogu).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('returns to the actual source when navigation history is available', async () => {
    await render();
    await act(async () => press('Nazad'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('makes a failed local logout retryable without exposing the transport error', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('secret transport detail'));
    await render();
    await act(async () => logout());
    expect(visibleText()).toContain('Odjava nije potvrđena. Pokušajte ponovo.');
    expect(visibleText()).not.toContain('secret transport detail');
    await act(async () => logout());
    expect(mockSignOut).toHaveBeenCalledTimes(2);
    expect(visibleText()).not.toContain('Odjava nije potvrđena');
  });

  it('serializes local logout and ignores late failure after account changes', async () => {
    let resolve!: (value: unknown) => void;
    mockSignOut.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render();
    const onPress = tree.root.findByProps({ label: 'Odjavite se' }).props.onPress;
    await act(async () => { onPress(); onPress(); });
    expect(mockSignOut.mock.calls).toEqual([[{ scope: 'local' }]]);
    mockAccountId = 'account-b';
    await act(async () => { tree.update(<Profil />); resolve({ error: new Error('late failure') }); });
    expect(visibleText()).not.toContain('Odjava nije potvrđena');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
