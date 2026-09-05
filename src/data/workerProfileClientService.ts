import type { AzurirajProfilKomanda, Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type WorkerProfileClientService = Pick<Izvor, 'azurirajRadnikProfil'>;

function rpcFailure<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

/**
 * Canonical production boundary for Worker profile mutation.
 * Profile activation authority remains rpc_complete_worker_profile; this service
 * preserves the already-active request, validation and error contract exactly.
 */
export const workerProfileClientService: WorkerProfileClientService = {
  async azurirajRadnikProfil(k: AzurirajProfilKomanda) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se da biste izmenili profil.' };
    }

    const { data: existing, error: existingError } = await supabase
      .from('app_profiles')
      .select('id')
      .eq('account_id', userData.user.id)
      .eq('kind', 'WORKER')
      .maybeSingle();
    if (existingError) return rpcFailure(existingError, 'PROFILE_READ_FAILED', 'Profil nije mogao da se učita.');

    const patch: Record<string, unknown> = {};
    if (k.ime !== undefined) patch.display_name = k.ime;
    if (k.grad !== undefined) patch.city = k.grad;
    if (k.biografija !== undefined) patch.bio = k.biografija;
    if (k.vestine !== undefined) patch.skills = k.vestine;
    if (k.alati !== undefined) patch.tools = k.alati;
    if (k.vozila !== undefined) patch.vehicles = k.vozila;
    if (k.dostupanOdmah !== undefined) patch.available_now = k.dostupanOdmah;
    if (k.radijusKm !== undefined) patch.radius_km = k.radijusKm;

    let profileId = existing?.id as string | undefined;
    if (!profileId) {
      const { data: inserted, error } = await supabase
        .from('app_profiles')
        .insert({
          account_id: userData.user.id,
          kind: 'WORKER',
          display_name: k.ime ?? '',
          city: k.grad ?? '',
          bio: k.biografija ?? '',
          skills: k.vestine ?? [],
          tools: k.alati ?? [],
          vehicles: k.vozila ?? [],
          available_now: k.dostupanOdmah ?? false,
          radius_km: k.radijusKm ?? 15,
          profile_status: 'DRAFT',
        })
        .select('id')
        .single();
      if (error || !inserted) return rpcFailure(error, 'PROFILE_CREATE_FAILED', 'Profil nije mogao da se kreira.');
      profileId = inserted.id;
    } else if (Object.keys(patch).length) {
      const { error } = await supabase.from('app_profiles').update(patch).eq('id', profileId);
      if (error) return rpcFailure(error, 'PROFILE_UPDATE_FAILED', 'Profil nije mogao da se sačuva.');
    }

    if (k.zavrsi) {
      const { error } = await supabase.rpc('rpc_complete_worker_profile', {
        p_profile_id: profileId,
      });
      if (error) return rpcFailure(error, 'PROFILE_ACTIVATION_FAILED', 'Profil još ne ispunjava uslove za aktivaciju.');
    }

    return { ok: true, podatak: null };
  },
};
