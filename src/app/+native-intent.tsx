import * as Linking from 'expo-linking';
import { passwordRecoveryIntent } from '../store/passwordRecoveryIntent';

/** Native OS callbacks enter through a clean route, never token-bearing params. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  let link = path;
  if (path === '/oporavak' || path.startsWith('/oporavak#') || path.startsWith('/oporavak?')) {
    link = 'uskociapp://oporavak' + path.slice('/oporavak'.length);
  }
  let url: URL;
  try { url = new URL(link); } catch { return path; }
  if (url.protocol !== 'uskociapp:' || url.hostname !== 'oporavak') return path;
  passwordRecoveryIntent.publish(link);
  try { Linking.clearInitialURL(); } catch { /* The transient handoff already owns this callback. */ }
  return '/oporavak';
}
