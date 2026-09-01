import type { AzurirajProfilKomanda, Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type CommandOverrides = Partial<Pick<
  Izvor,
  | 'oznaciPrijavuVidjenom'
  | 'predloziIzmenu'
  | 'odgovoriNaIzmenu'
  | 'posaljiPoruku'
  | 'oznaciZavrsetak'
  | 'prijaviProblem'
  | 'podeliTelefon'
  | 'opoziviTelefon'
  | 'otkrijTacnuLokaciju'
  | 'azurirajRadnikProfil'
  | 'posaljiKorisnikovuPoruku'
  | 'ispraviCinjenicu'
  | 'objaviPotrebu'
>>;

function rpcFailure<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

export const productionAuthorityOverrides: CommandOverrides = {
  async oznaciPrijavuVidjenom(prijavaId) {
    const { error } = await supabase.rpc('rpc_mark_response_viewed', {
      p_response_id: prijavaId,
    });
    if (error) return rpcFailure(error, 'RESPONSE_VIEW_FAILED', 'Prijava nije mogla da se označi kao pregledana.');
    return { ok: true, podatak: null };
  },

  // Current live rpc_propose_agreement_change immediately supersedes the active
  // version. Canon says proposal -> counterparty review -> accept/reject, so the
  // production client must not call that obsolete semantic path as if it were a
  // pending proposal.
  async predloziIzmenu() {
    return {
      ok: false,
      kod: 'AGREEMENT_CHANGE_FLOW_NOT_READY',
      poruka: 'Izmene Dogovora su privremeno zaključane dok serverski predlog i prihvatanje ne budu usaglašeni.',
    };
  },

  async odgovoriNaIzmenu() {
    return {
      ok: false,
      kod: 'AGREEMENT_CHANGE_RESPONSE_NOT_READY',
      poruka: 'Odgovor na izmenu nije dostupan dok serverski tok predloga ne bude zatvoren.',
    };
  },

  // Keep even the lower-precedence compatibility override on the authoritative
  // RPC path. If adapter composition changes later, chat must never silently
  // regress to direct table INSERT authority.
  async posaljiPoruku(dogovorId, telo) {
    const body = telo.trim();
    if (!body) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' };
    const { data, error } = await supabase.rpc('rpc_send_agreement_message', {
      p_agreement_id: dogovorId,
      p_body: body,
    });
    if (error || !data) return rpcFailure(error, 'MESSAGE_SEND_FAILED', 'Poruka nije poslata.');
    return { ok: true, podatak: { porukaId: data } };
  },

  async oznaciZavrsetak(dogovorId) {
    const { data, error } = await supabase.rpc('rpc_mark_work_done', {
      p_agreement_id: dogovorId,
    });
    if (error || !data) return rpcFailure(error, 'COMPLETION_FAILED', 'Završetak nije mogao da se označi.');
    return { ok: true, podatak: { rokPotvrdeIso: data } };
  },

  async prijaviProblem(dogovorId, opis) {
    const narrative = opis.trim();
    if (!narrative) return { ok: false, kod: 'NARRATIVE_REQUIRED', poruka: 'Opišite problem.' };
    const { error } = await supabase.rpc('rpc_report_problem', {
      p_agreement_id: dogovorId,
      p_narrative: narrative,
    });
    if (error) return rpcFailure(error, 'PROBLEM_REPORT_FAILED', 'Problem nije mogao da se sačuva.');
    return { ok: true, podatak: null };
  },

  async podeliTelefon(dogovorId) {
    const { error } = await supabase.rpc('rpc_set_contact_grant', {
      p_agreement_id: dogovorId,
      p_channel: 'PHONE',
      p_granted: true,
    });
    if (error) return rpcFailure(error, 'PHONE_GRANT_FAILED', 'Broj telefona nije podeljen.');
    return { ok: true, podatak: null };
  },

  async opoziviTelefon(dogovorId) {
    const { error } = await supabase.rpc('rpc_set_contact_grant', {
      p_agreement_id: dogovorId,
      p_channel: 'PHONE',
      p_granted: false,
    });
    if (error) return rpcFailure(error, 'PHONE_REVOKE_FAILED', 'Deljenje telefona nije opozvano.');
    return { ok: true, podatak: null };
  },

  async otkrijTacnuLokaciju(dogovorId) {
    const { data, error } = await supabase.rpc('rpc_reveal_contact', {
      p_agreement_id: dogovorId,
      p_channel: 'EXACT_LOCATION',
    });
    if (error) return rpcFailure(error, 'LOCATION_REVEAL_FAILED', 'Tačna lokacija nije dostupna.');
    const address = data?.exactAddress;
    if (typeof address !== 'string' || !address.trim()) {
      return { ok: false, kod: 'LOCATION_NOT_SET', poruka: 'Tačna lokacija nije postavljena.' };
    }
    return { ok: true, podatak: { adresa: address } };
  },

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

  // There is currently no deployed Edge Function on the canonical Supabase
  // project. Never pretend an AI message was processed when no provider ran.
  async posaljiKorisnikovuPoruku() {
    return {
      ok: false,
      kod: 'AI_PROVIDER_NOT_CONFIGURED',
      poruka: 'AI obrada trenutno nije povezana sa serverskim providerom.',
    };
  },

  async ispraviCinjenicu() {
    return {
      ok: false,
      kod: 'AI_FACT_REVISION_NOT_READY',
      poruka: 'Ispravka AI činjenice još nema autoritativan serverski put.',
    };
  },

  async objaviPotrebu(razgovorId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se pre objave Potrebe.' };
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from('app_profiles')
      .select('id')
      .eq('account_id', userData.user.id)
      .eq('kind', 'REQUESTER')
      .maybeSingle();
    if (profileError || !requesterProfile) {
      return rpcFailure(profileError, 'REQUESTER_PROFILE_REQUIRED', 'Potreban je profil Naručioca pre objave.');
    }

    const { data, error } = await supabase.rpc('rpc_ai_publish_need', {
      p_conversation_id: razgovorId,
      p_profile_id: requesterProfile.id,
    });
    if (error) return rpcFailure(error, 'AI_PUBLISH_BLOCKED', 'Objava još nije dozvoljena.');
    return { ok: true, podatak: { potrebaId: data } };
  },
};
