import { nativePushDevice } from '../nativePushDevice';
const mockPermissions = jest.fn(), mockRequest = jest.fn(), mockToken = jest.fn(), mockChannel = jest.fn();
let mockPlatform = 'android', mockDevice = true;
const mockConstants = { easConfig: { projectId: '11111111-1111-4111-8111-111111111111' } };
jest.mock('expo-notifications', () => ({ getPermissionsAsync: () => mockPermissions(), requestPermissionsAsync: () => mockRequest(), getExpoPushTokenAsync: (args: unknown) => mockToken(args), setNotificationChannelAsync: (...args: unknown[]) => mockChannel(...args), AndroidImportance: { DEFAULT: 3 }, AndroidNotificationVisibility: { PRIVATE: 0 } }));
jest.mock('expo-device', () => ({ get isDevice() { return mockDevice; } }));
jest.mock('expo-constants', () => ({ __esModule: true, get default() { return mockConstants; } }));
jest.mock('react-native', () => ({ Platform: { get OS() { return mockPlatform; } } }));
beforeEach(() => { jest.resetAllMocks(); mockPlatform = 'android'; mockDevice = true; mockChannel.mockResolvedValue({}); mockPermissions.mockResolvedValue({ granted: false, canAskAgain: true }); mockRequest.mockResolvedValue({ granted: true, canAskAgain: true }); mockToken.mockResolvedValue({ type: 'expo', data: 'ExpoPushToken[synthetic]' }); });
it('reading settings never asks for permission or a token without consent', async () => {
 expect(await nativePushDevice(false, () => true)).toEqual({ kind: 'PERMISSION_REQUIRED' }); expect(mockRequest).not.toHaveBeenCalled(); expect(mockToken).not.toHaveBeenCalled();
});
it('explicit enable creates Android channel before permission and captures existing project', async () => {
 expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 expect(mockChannel.mock.invocationCallOrder[0]).toBeLessThan(mockRequest.mock.invocationCallOrder[0]); expect(mockToken).toHaveBeenCalledWith({ projectId: mockConstants.easConfig.projectId });
});
it('permanent OS denial does not loop prompts or acquire a token', async () => {
 mockPermissions.mockResolvedValue({ granted: false, canAskAgain: false }); expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'DENIED' }); expect(mockRequest).not.toHaveBeenCalled(); expect(mockToken).not.toHaveBeenCalled();
});
it.each(['web', 'windows'])('unsupported %s never touches push APIs', async value => { mockPlatform = value; expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'UNSUPPORTED' }); expect(mockPermissions).not.toHaveBeenCalled(); });
it('physical device prerequisite is explicit', async () => { mockDevice = false; expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'UNSUPPORTED' }); expect(mockChannel).not.toHaveBeenCalled(); });
it('late permission response after blur/account change cannot acquire token', async () => {
 let current = true; mockRequest.mockImplementation(async () => { current = false; return { granted: true }; });
 await expect(nativePushDevice(true, () => current)).rejects.toThrow('PUSH_SCOPE_CHANGED'); expect(mockToken).not.toHaveBeenCalled();
});
it('malformed provider token is never eligible for registration', async () => { mockPermissions.mockResolvedValue({ granted: true }); mockToken.mockResolvedValue({ type: 'expo', data: 'https://private-token' }); await expect(nativePushDevice(false, () => true)).rejects.toThrow('PUSH_TOKEN_UNAVAILABLE'); });
