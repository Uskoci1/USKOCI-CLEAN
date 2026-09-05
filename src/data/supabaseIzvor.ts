import { Izvor, Ishod, IzborKomanda, PodnesiPrijavuKomanda } from './ports';
import { supabaseKlijent } from './supabaseClient';
import type { 
  DogovorProjekcija, 
  KandidatProjekcija, 
  KontaktProjekcija, 
  Novac, 
  PorukaProjekcija, 
  PotrebaProjekcija, 
  PrilikaProjekcija, 
  RezimIzvrsenja, 
  UcesnikProjekcija, 
  Pokrivenost 
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

function jednaRelacija<T>(vrednost: T | T[] | null | undefined): T | null {
  if (Array.isArray(vrednost)) return vrednost[0] ?? null;
  return vrednost ?? null;
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
>;

export const supabaseIzvor: SupabaseIzvor = {
  poreklo: 'supabase',

  async otvorenePrilike() {
    // Explicit public-safe projection
    const { data, error } = await supabase.from('needs')
      .select(`
        id, title, status, starts_at, approximate_area, approximate_city, approximate_lat, approximate_lng,
        required_slots, required_skills, required_tools, required_vehicles,
        covered_slots, mode, requester_price_rsd,
        app_profiles!requester_profile_id(display_name)
      `)
      .in('status', ['PUBLISHED', 'SELECTION'])
      .order('created_at', { ascending: false });
      
    if (error || !data) return [];
    
    return data.map((r: any) => {
      const narucilac = jednaRelacija(r.app_profiles);
      return {
        id: r.id,
        naslov: r.title,
        statusTekst: r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
        podrucjeTekst: fLoc(r.approximate_area, r.approximate_city),
        vremeTekst: fTime(r.starts_at),
        pokrivenost: pokrivenost(r.required_slots || 1, r.covered_slots || 0),
        uslovi: [...(r.required_skills||[]), ...(r.required_tools||[]), ...(r.required_vehicles||[])],
        narucilacIme: narucilac?.display_name || '',
        narucilacOcena: null,
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
        covered_slots, mode, requester_price_rsd,
        app_profiles!requester_profile_id(display_name)
      `)
      .eq('id', id).maybeSingle();
      
    if (error || !data) return null;
    
    const narucilac = jednaRelacija(data.app_profiles);

    return {
      id: data.id,
      naslov: data.title,
      statusTekst: data.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
      podrucjeTekst: fLoc(data.approximate_area, data.approximate_city),
      vremeTekst: fTime(data.starts_at),
      pokrivenost: pokrivenost(data.required_slots || 1, data.covered_slots || 0),
      uslovi: [...(data.required_skills||[]), ...(data.required_tools||[]), ...(data.required_vehicles||[])],
      narucilacIme: narucilac?.display_name || '',
      narucilacOcena: null,
      priblizno: data.approximate_lat ? { lat: data.approximate_lat, lng: data.approximate_lng } : null,
      rezimCene: data.mode as any,
      ponudjenaCena: data.requester_price_rsd,
    };
  },

  async prijaveZaPotrebu(potrebaId: string) {
    const { data, error } = await supabase.from('marketplace_responses')
      .select(`
        id, current_version, price_rsd, covered_slots, proposed_start_at, status,
        app_profiles!worker_profile_id(display_name),
        marketplace_response_versions(version, content_hash)
      `)
      .eq('need_id', potrebaId);
      
    if (error || !data) return [];
    
    return data.map((r: any) => {
      const ver = r.marketplace_response_versions?.find((v: any) => v.version === r.current_version);
      const radnik = jednaRelacija(r.app_profiles);
      return {
        prijavaId: r.id,
        verzija: r.current_version,
        hash: ver?.content_hash || '',
        ime: radnik?.display_name || '',
        inicijali: (radnik?.display_name || '?').substring(0, 2).toUpperCase(),
        ocenaTekst: 'Novo',
        recenzijeTekst: 'Nema ocena',
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
    if (!user?.user) return { ok: false, kod: "AUTH_REQUIRED", poruka: "Prijavite se pre slanja ponude." };
    
    let workerProfileId = k.radnikProfilId;
    if (!workerProfileId) {
      const { data: prof } = await supabase.from("app_profiles")
        .select("id")
        .eq("account_id", user.user.id)
        .eq("kind", "WORKER")
        .maybeSingle();
      if (!prof?.id) {
        return { ok: false, kod: "WORKER_PROFILE_REQUIRED", poruka: "Potreban je profil Uskočera za slanje ponude." };
      }
      workerProfileId = prof.id;
    }

    const { data, error } = await supabase.rpc("rpc_submit_response", {
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
    if (error) return handleRpcError(error, "RPC_ERROR", "Greška pri slanju prijave.");
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
      p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija, p_response_id: k.prijavaId,
      p_response_version: k.prijavaVerzija, p_content_hash: k.prijavaHash, p_client_request_id: k.clientRequestId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška pri izboru.');
    return { ok: true, podatak: { dogovorId: data } };
  },
  
  async otkaziDogovor(dogovorId: string, razlog: string) {
    const { data, error } = await supabase.rpc('rpc_cancel_agreement', { p_agreement_id: dogovorId, p_reason: razlog });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async oznaciZavrsetak(dogovorId: string) {
    const { data, error } = await supabase.rpc('rpc_mark_work_done', { p_agreement_id: dogovorId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { rokPotvrdeIso: new Date().toISOString() } };
  },
  
  async potvrdiZavrsetak(dogovorId: string) {
    const { data, error } = await supabase.rpc('rpc_confirm_completion', { p_agreement_id: dogovorId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async otkrijTacnuLokaciju(dogovorId: string) {
    const { error } = await supabase.rpc('rpc_r24_reveal_exact_location', { p_agreement_id: dogovorId });
    if (error) return handleRpcError(error, 'LOCATION_ERROR', 'Greška pri otkrivanju lokacije.');
    return { ok: true, podatak: { adresa: 'Preuzeto sa servera' } };
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

  async azurirajRadnikProfil(k: any) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { ok: false, kod: 'UNAUTHORIZED', poruka: 'Niste ulogovani.' };
    
    // First, get the profile ID
    const profil = await this.mojRadnikProfil();
    let profileId = profil?.id;
    
    if (!profileId) {
      // Create if it doesn't exist
      const { data: inserted, error: insertError } = await supabase
        .from('app_profiles')
        .insert({
          account_id: user.id,
          kind: 'WORKER',
          display_name: k.ime ?? '',
          city: k.grad ?? '',
          bio: k.biografija ?? '',
          profile_status: k.zavrsi ? undefined : 'DRAFT',
          available_now: k.dostupanOdmah ?? false,
          radius_km: k.radijusKm ?? 15,
        })
        .select('id')
        .single();
        
      if (insertError) return handleRpcError(insertError, 'INSERT_ERROR', 'Greška pri kreiranju profila.');
      profileId = inserted.id;
    } else {
      // Update
      const patch: any = {};
      if (k.ime !== undefined) patch.display_name = k.ime;
      if (k.grad !== undefined) patch.city = k.grad;
      if (k.biografija !== undefined) patch.bio = k.biografija;
      if (k.vestine !== undefined) patch.skills = k.vestine;
      if (k.alati !== undefined) patch.tools = k.alati;
      if (k.vozila !== undefined) patch.vehicles = k.vozila;
      if (k.dostupanOdmah !== undefined) patch.available_now = k.dostupanOdmah;
      if (k.radijusKm !== undefined) patch.radius_km = k.radijusKm;
      
      const { error: updateError } = await supabase
        .from('app_profiles')
        .update(patch)
        .eq('id', profileId);
      
      if (updateError) return handleRpcError(updateError, 'UPDATE_ERROR', 'Greška pri izmeni profila.');
    }
    
    // If completing the profile, call the RPC instead of direct DB update
    if (k.zavrsi) {
      const { error: rpcError } = await supabase.rpc('rpc_complete_worker_profile');
      if (rpcError) return handleRpcError(rpcError, 'RPC_ERROR', 'Greška pri kompletiranju profila.');
    }
    
    return { ok: true, podatak: null };
  },

  async otvoriRazgovor() {
    const { data, error } = await supabase.rpc('rpc_ai_open_conversation', { p_purpose: 'NEW_NEED' });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { razgovorId: data } };
  },
  
  async razgovor(razgovorId: string) { return null; },
  async posaljiKorisnikovuPoruku(razgovorId: string, telo: string) { return { ok: true, podatak: { predlozeno: 0 } }; },
  
  async potvrdiCinjenicu(cinjenicaId: string) {
    const { data, error } = await supabase.rpc('rpc_ai_confirm_fact', { p_fact_id: cinjenicaId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async ispraviCinjenicu(cinjenicaId: string, novaVrednost: string) { return { ok: true, podatak: { novaCinjenicaId: '' } }; },
  
  async objaviPotrebu(razgovorId: string) {
    const { data, error } = await supabase.rpc('rpc_ai_publish_need', { p_conversation_id: razgovorId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { potrebaId: data } };
  }
};
