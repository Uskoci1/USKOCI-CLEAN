import { Redirect } from 'expo-router';
import { useSesija } from '../store/sesija';

/** Retired context-free candidate URL; current candidates require a real Need ID. */
export default function RetiredPrijave() {
  const { isLoaded, session, intentReady } = useSesija();
  if (!isLoaded || (session && intentReady === false)) return null;
  return <Redirect href={session ? '/' : { pathname: '/auth', params: { form: 'login' } }} />;
}
