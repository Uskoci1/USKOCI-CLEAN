import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import PushSettings from '../../app/(app)/profil/obavestenja';
const mockBack = jest.fn(), mockReplace = jest.fn(), mockCanBack = jest.fn();
let mockIntent = 'narucilac'; let mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), replace: (path: string) => mockReplace(path), canGoBack: () => mockCanBack() }, Stack: { Screen: () => null }, useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: (props: unknown) => require('react').createElement('SafeArea', props) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockOwner, sesijaSada: () => mockOwner }));
jest.mock('../../ui/Press', () => ({ Press: (props: unknown) => require('react').createElement('Press', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('Text', props) }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: () => null }));
jest.mock('../../ui/notifications/PushPreferences', () => ({ PushPreferences: (props: unknown) => require('react').createElement('PushPreferences', props) }));
let tree: Renderer.ReactTestRenderer;
const back = () => tree.root.findByProps({ accessibilityLabel: 'Nazad na profil' }).props.onPress;
beforeEach(() => { jest.resetAllMocks(); mockCanBack.mockReturnValue(true); mockIntent = 'narucilac'; mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 }; act(() => { tree = Renderer.create(<PushSettings />); }); });
afterEach(() => act(() => tree.unmount()));
it('renders top safe area, actual accessible header/back and footer; parent owns bottom inset', () => {
 expect(tree.root.findByType('SafeArea' as never).props.edges).toEqual(['top']);
 expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Podešavanja obaveštenja');
 expect(tree.root.findByType('PushPreferences' as never).props.role).toBe('REQUESTER');
 expect(JSON.stringify(tree.toJSON())).toContain('Obaveštenja o zadacima koje objavljuješ.'); expect(JSON.stringify(tree.toJSON())).not.toMatch(/Meni treba|Ja mogu/);
 act(() => back()()); expect(mockBack).toHaveBeenCalledTimes(1);
});
it('direct route opens a known Profile fallback', () => { mockCanBack.mockReturnValue(false); act(() => back()()); expect(mockReplace).toHaveBeenCalledWith('/profil'); });
it('retained back after unmount is inert', () => { const old = back(); act(() => tree.unmount()); old(); expect(mockBack).not.toHaveBeenCalled(); });
it('account ABA cannot navigate through an old callback', () => { const old = back(); mockOwner = { ...mockOwner, accountRevision: 3 }; old(); expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); });
// Owner decision 1 (2026-09-19). The server keeps two sets of notification settings for one account.
// Which set this screen edited used to follow the app's global mode; it is chosen on this screen now.
it('chooses which of the two server sets to edit here, on the screen, and a flip of the retired app mode changes nothing', () => {
 const old = back(); mockIntent = 'uskocer'; act(() => { tree.update(<PushSettings />); });
 expect(tree.root.findByType('PushPreferences' as never).props.role).toBe('REQUESTER');
 act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
 expect(tree.root.findByType('PushPreferences' as never).props.role).toBe('WORKER');
 expect(JSON.stringify(tree.toJSON())).toContain('Obaveštenja o poslovima na koje se prijavljuješ.');
 old(); expect(mockBack).toHaveBeenCalledTimes(1);
});
