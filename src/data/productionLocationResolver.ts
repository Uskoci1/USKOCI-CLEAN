import { createConfiguredLocationResolver } from './configuredLocationResolver';
import { supabaseKlijent, supabaseKonfigurisan } from './supabaseClient';
import { sesijaSada } from '../store/sesija';

/** Only the app's authenticated Edge endpoint is reachable from the native editor. */
export function createProductionLocationResolver() {
  const providerHint = process.env.EXPO_PUBLIC_LOCATION_PROVIDER_HINT;
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!providerHint || !baseUrl || !supabaseKonfigurisan()) return createConfiguredLocationResolver();
  const owner = sesijaSada(), accountId = owner.user?.id, incarnation = owner.accountRevision;
  const owns = () => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === incarnation;
  return createConfiguredLocationResolver({ endpoint: `${baseUrl.replace(/\/$/, '')}/functions/v1/uskoci-location-search`, providerHint,
    getAccessToken: async () => {
      if (!owns()) return null;
      const { data, error } = await supabaseKlijent().auth.getSession();
      const session = data.session;
      return !error && owns() && session && session.user.id === accountId ? session.access_token : null;
    },
  }, async (_endpoint, init) => {
    if (!owns() || init.signal?.aborted) throw new Error('LOCATION_SESSION_CHANGED');
    const headers = new Headers(init.headers);
    const { data, error } = await supabaseKlijent().functions.invoke('uskoci-location-search', {
      body: JSON.parse(String(init.body)), headers: { Authorization: headers.get('Authorization') ?? '' },
      signal: init.signal ?? undefined,
    });
    if (!owns() || init.signal?.aborted) throw new Error('LOCATION_SESSION_CHANGED');
    return { ok: !error, redirected: false, json: async () => data };
  });
}
