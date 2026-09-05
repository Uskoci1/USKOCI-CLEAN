import { Izvor, Ishod, IzborKomanda, PodnesiPrijavuKomanda } from './ports';
import { publicProfileClientService } from './publicProfileClientService';
import { supabaseKlijent } from './supabaseClient';
import type {
  JavniProfilProjekcija,
  Novac,
  Pokrivenost,
} from '../contracts/projections';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_t, prop) => (supabaseKlijent() as never)[prop],
});

function handleRpcError<T>(error: any, defaultCode: string, defaultMessage: string): Ishod<T> {
  console.error('[Supabase RPC Error]', error);
  return {
    ok: false,
    kod: error?.code || defaultCode,
    poruka: error?.message || defaultMessage,
  };
}

const rsd = (iznos: number): Novac => ({
  iznos,
  valuta: 'RSD',
  prikaz: `${iznos.toLocaleString('sr-Latn-RS')} RSD`,
});

function pokrivenost(ukupno: number, popunjeno: number): Pokrivenost {
  const preostalo = Math.max(0, ukupno - popunjeno);
  return { ukupno, popunjeno, preostalo, udeo: ukupno ? popunjeno / ukupno : 0 };
}

function fTime(iso: string | null): string {
  if (!iso) return 'Fleksibilno';
  return new Date(iso).toLocaleString('sr-Latn-RS');
}

function fLoc(area: string, city: string) {
  return area ? `${area}, ${city}` : city;
}

function formatPublicRating(profile: JavniProfilProjekcija | null | undefined): string | null {
  if (!profile?.poverenje.ocenaDostupna || profile.poverenje.ocenaProsek === null) return null;
  return profile.poverenje.ocenaProsek.toLocaleString('sr-Latn-RS', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatPublicReviews(profile: JavniProfilProjekcija | null | undefined): string {
  if (!profile?.poverenje.recenzijeDostupne || profile.poverenje.brojRecenzija === null) {
    return 'Ocene nisu dostupne';
  }
  const count = profile.poverenje.brojRecenzija;
  if (count === 0) return 'Nema recenzija';
  return `${count} ${count === 1 ? 'recenzija' : 'recenzija'}`;
}

/**
 * One narrow RPC per distinct profile id. A profile projection failure must not
 * erase otherwise-public Need/Application rows, so marketplace list consumers
 * degrade to unavailable trust while the explicit javniProfil() port itself
 * still fails loudly when called directly by a profile screen.
 */
async function safePublicProfiles(profileIds: Array<string | null | undefined>) {
  const ids = [...new Set(profileIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        return [id, await publicProfileClientService.javniProfil(id)] as const;
      } catch (error) {
        console.error('[Public profile projection unavailable]', { profileId: id, error });
        return [id, null] as const;
      }
    }),
  );
  return new Map<string, JavniProfilProjekcija | null>(entries);
}

type SupabaseIzvor = Omit<
  Izvor,
  | 'mojiDogovori'
  | 'dogovor'
  | 'predloziIzmenu'
  | 'odgovoriNaIzmenu'
  | 'posaljiPoruku'
  | 'mojePotrebe'
  | 'potreba'
  | 'oznaciPrijavuVidjenom'
  | 'podeliTelefon'
  | 'opoziviTelefon'
  | 'prijaviProblem'
  | 'oznaciZavrsetak'
  | 'otkrijTacnuLokaciju'
  | 'azurirajRadnikProfil'
  | 'javniProfil'
  | 'posaljiKorisnikovuPoruku'
  | 'ispraviCinjenicu'
  | 'otvoriRazgovor'
  | 'razgovor'
  | 'objaviPotrebu'
>;

export const supabaseIzvor: SupabaseIzvor = {
  poreklo: 'supabase',

  async otvorenePrilike() {
    const { data, error } = await supabase.from('needs')
      .select(`
        id, title, status, starts_at, approximate_area, approximate_city, approximate_lat, approximate_lng,
        required_slots, required_skills, required_tools, required_vehicles,
        covered_slots, mode, requester_price_rsd, requester_profile_id
      `)
      .in('status', ['PUBLISHED', 'SELECTION'])
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    const profiles = await safePublicProfiles(data.map((r: any) => r.requester_profile_id));

    return data.map((r: any) => {
      const narucilac = profiles.get(r.requester_profile_id) ?? null;
      return {
        id: r.id,
        naslov: r.title,
        statusTekst: r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
        podrucjeTekst: fLoc(r.approximate_area, r.approximate_city),
        vremeTekst: fTime(r.starts_at),
        pokrivenost: pokrivenost(r.required_slots || 1, r.covered_slots || 0),
        uslovi: [...(r.required_skills || []), ...(r.required_tools || []), ...(r.required_vehicles || [])],
        narucilacProfilId: r.requester_profile_id,
        narucilacIme: narucilac?.ime || '',
        narucilacOcena: formatPublicRating(narucilac),
        priblizno: (r.approximate_lat && r.approximate_lng) ? { lat: r.approximate_lat, lng: r.approximate_lng } : null,
        rezimCene: r.mode,
        ponudjenaCena: r.requester_price_rsd ? rsd(r.requester_price_rsd) : undefined,
      };
    });
  },

  async prilika(id: string) {
    const { data, error } = await supabase.from('needs')
      .select(`
        id, title, status, starts_at, approximate_area, approximate_city, approximate_lat, approximate_lng,
        required_slots, required_skills, required_tools, required_vehicles,
        covered_slots, mode, requester_price_rsd, requester_profile_id
      `)
      .eq('id', id).maybeSingle();

    if (error || !data) return null;

    const profiles = await safePublicProfiles([data.requester_profile_id]);
    const narucilac = profiles.get(data.requester_profile_id) ?? null;

    return {
      id: data.id,
      naslov: data.title,
      statusTekst: data.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
      podrucjeTekst: fLoc(data.approximate_area, data.approximate_city),
      vremeTekst: fTime(data.starts_at),
      pokrivenost: pokrivenost(data.required_slots || 1, data.covered_slots || 0),
      uslovi: [...(data.required_skills || []), ...(data.required_tools || []), ...(data.required_vehicles || [])],
      narucilacProfilId: data.requester_profile_id,
      narucilacIme: narucilac?.ime || '',
      narucilacOcena: formatPublicRating(narucilac),
      priblizno: data.approximate_lat ? { lat: data.approximate_lat, lng: data.approximate_lng } : null,
      rezimCene: data.mode as any,
      ponudjenaCena: data.requester_price_rsd ? rsd(data.requester_price_rsd) : undefined,
    };
  },

  async prijaveZaPotrebu(potrebaId: string) {
    const { data, error } = await supabase.from('marketplace_responses')
      .select(`
        id, current_version, price_rsd, covered_slots, proposed_start_at, status, worker_profile_id,
        marketplace_response_versions(version, content_hash)
      `)
      .eq('need_id', potrebaId);

    if (error || !data) return [];

    const profiles = await safePublicProfiles(data.map((r: any) => r.worker_profile_id));

    return data.map((r: any) => {
      const ver = r.marketplace_response_versions?.find((v: any) => v.version === r.current_version);
      const radnik = profiles.get(r.worker_profile_id) ?? null;
      const ime = radnik?.ime || '';
      return {
        prijavaId: r.id,
        radnikProfilId: r.worker_profile_id,
        verzija: r.current_version,
        hash: ver?.content_hash || '',
        ime,
        inicijali: (ime || '?').substring(0, 2).toUpperCase(),
        ocenaTekst: formatPublicRating(radnik) ?? '—',
        recenzijeTekst: formatPublicReviews(radnik),
        cena: rsd(r.price_rsd || 0),
        pokrivaMesta: r.covered_slots || 1,
        dolazakTekst: fTime(r.proposed_start_at),
        prevozTekst: 'Dogovor',
        stanje: r.status,
        razlogPreporuke: null,
      };
    });
  },

  async poruke(dogovorId: string) {
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('agreement_messages')
      .select(`id, sender_account_id, body, created_at`)
      .eq('agreement_id', dogovorId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.id,
      posiljalacIme: r.sender_account_id === user?.user?.id ? 'Ja' : 'Sagovornik',
      moja: r.sender_account_id === user?.user?.id,
      telo: r.body,
      vremeTekst: fTime(r.created_at),
      procitano: true,
    }));
  },

  async podnesiPrijavu(k: PodnesiPrijavuKomanda): Promise<Ishod<{ prijavaId: string; verzija: number; hash: string }>> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se pre slanja ponude.' };

    let workerProfileId = k.radnikProfilId;
    if (!workerProfileId) {
      const { data: prof } = await supabase.from('app_profiles')
        .select('id')
        .eq('account_id', user.user.id)
        .eq('kind', 'WORKER')
        .maybeSingle();
      if (!prof?.id) {
        return { ok: false, kod: 'WORKER_PROFILE_REQUIRED', poruka: 'Potreban je profil Uskočera za slanje ponude.' };
      }
      workerProfileId = prof.id;
    }

    const { data, error } = await supabase.rpc('rpc_submit_response', {
      p_need_id: k.potrebaId,
      p_need_revision: k.potrebaRevizija,
      p_worker_profile_id: workerProfileId,
      p_covered_slots: k.pokrivenaMesta,
      p_price_rsd: k.cenaRsd,
      p_proposed_start_at: k.predlozeniPocetak,
      p_proposed_end_at: k.predlozeniKraj,
      p_scope_note: k.napomena,
      p_client_request_id: k.clientRequestId,
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška pri slanju prijave.');
    return {
      ok: true,
      podatak: {
        prijavaId: data.responseId,
        verzija: data.version,
        hash: data.contentHash,
      },
    };
  },

  async izaberiPrijavu(k: IzborKomanda) {
    const { data, error } = await supabase.rpc('rpc_select_response', {
      p_need_id: k.potrebaId,
      p_need_revision: k.potrebaRevizija,
      p_response_id: k.prijavaId,
      p_response_version: k.prijavaVerzija,
      p_content_hash: k.prijavaHash,
      p_client_request_id: k.clientRequestId,
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška pri izboru.');
    return { ok: true, podatak: { dogovorId: data } };
  },

  async otkaziDogovor(dogovorId: string, razlog: string) {
    const { error } = await supabase.rpc('rpc_cancel_agreement', { p_agreement_id: dogovorId, p_reason: razlog });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },

  async potvrdiZavrsetak(dogovorId: string) {
    const { error } = await supabase.rpc('rpc_confirm_completion', { p_agreement_id: dogovorId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },

  async mojRadnikProfil() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return null;
    const { data, error } = await supabase
      .from('app_profiles')
      .select('*')
      .eq('account_id', user.id)
      .eq('kind', 'WORKER')
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      ime: data.display_name || '',
      grad: data.city || '',
      biografija: data.bio || '',
      vestine: data.skills || [],
      alati: data.tools || [],
      vozila: data.vehicles || [],
      stanje: data.profile_status as any,
      dostupanOdmah: data.available_now || false,
      radijusKm: data.radius_km || 15,
    };
  },

  async potvrdiCinjenicu(cinjenicaId: string) {
    const { error } = await supabase.rpc('rpc_ai_confirm_fact', { p_fact_id: cinjenicaId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
};