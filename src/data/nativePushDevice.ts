import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PushPlatform } from './pushDeviceClientService';
export type NativePushState = { kind: 'READY'; token: string; platform: PushPlatform } | { kind: 'UNSUPPORTED' | 'UNCONFIGURED' | 'PERMISSION_REQUIRED' | 'DENIED' };

/** Called from explicit notification settings. Opening/reading never prompts. */
export async function nativePushDevice(requestPermission: boolean, current: () => boolean): Promise<NativePushState> {
 const platform = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : null;
 if (!platform || !Device.isDevice) return { kind: 'UNSUPPORTED' };
 const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
 if (typeof projectId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) return { kind: 'UNCONFIGURED' };
 const check = () => { if (!current()) throw Error('PUSH_SCOPE_CHANGED'); };
 check();
 // Android requires a channel before asking for notification permission/token.
 if (platform === 'ANDROID') {
  await Notifications.setNotificationChannelAsync('default', { name: 'USKOČI', importance: Notifications.AndroidImportance.DEFAULT,
   lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE });
  check();
 }
 let permission = await Notifications.getPermissionsAsync(); check();
 if (!permission.granted && requestPermission && permission.canAskAgain) { permission = await Notifications.requestPermissionsAsync(); check(); }
 if (!permission.granted) return { kind: permission.canAskAgain ? 'PERMISSION_REQUIRED' : 'DENIED' };
 const result = await Notifications.getExpoPushTokenAsync({ projectId }); check();
 if (result.type !== 'expo' || !/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(result.data) || result.data.length > 256) throw Error('PUSH_TOKEN_UNAVAILABLE');
 return { kind: 'READY', token: result.data, platform };
}
