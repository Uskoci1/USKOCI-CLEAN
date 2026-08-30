import { Izvor, Ishod, IzborKomanda, IzmenaKomanda } from './ports';
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

export const supabaseIzvor: Izvor = {
  poreklo: 'supabase',

  async mojePotrebe() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return [];
    const { data, error } = await supabase.from('needs')
      .select(`
        *,
        agreements(status, marketplace_responses(covered_slots)),
        marketplace_responses(id)
      `)
      .eq('requester_account_id', user.user.id)
      .order('created_at', { ascending: false });
    
    if (error || !data) return [];
    
    return data.map((r: any) => {
      let popunjeno = 0;
      for (const a of r.agreements || []) {
        if (['CONFIRMED','SUPERSEDED','COMPLETED'].includes(a.status)) {
           popunjeno += a.marketplace_responses?.covered_slots || 0;
        }
      }
      return {
        id: r.id,
        revizija: r.revision,
        naslov: r.title,
        opis: r.description,
        stanje: r.status,
        pokrivenost: pokrivenost(r.required_slots || 1, popunjeno),
        vremeTekst: fTime(r.starts_at),
        podrucjeTekst: fLoc(r.approximate_area, r.approximate_city),
        uslovi: [...(r.required_skills||[]), ...(r.required_tools||[]), ...(r.required_vehicles||[])],
        brojPrijava: r.marketplace_responses?.length || 0,
      };
    });
  },

  async potreba(id: string) {
    const { data, error } = await supabase.from('needs')
      .select(`*, agreements(status, marketplace_responses(covered_slots)), marketplace_responses(id)`)
      .eq('id', id).maybeSingle();
    if (error || !data) return null;
    
    let popunjeno = 0;
    for (const a of data.agreements || []) {
      if (['CONFIRMED','SUPERSEDED','COMPLETED'].includes(a.status)) {
         popunjeno += a.marketplace_responses?.covered_slots || 0;
      }
    }
    return {
      id: data.id,
      revizija: data.revision,
      naslov: data.title,
      opis: data.description,
      stanje: data.status,
      pokrivenost: pokrivenost(data.required_slots || 1, popunjeno),
      vremeTekst: fTime(data.starts_at),
      podrucjeTekst: fLoc(data.approximate_area, data.approximate_city),
      uslovi: [...(data.required_skills||[]), ...(data.required_tools||[]), ...(data.required_vehicles||[])],
      brojPrijava: data.marketplace_responses?.length || 0,
    };
  },

  async otvorenePrilike() {
    const { data, error } = await supabase.from('needs')
      .select(`*, agreements(status, marketplace_responses(covered_slots)), app_profiles!requester_profile_id(display_name)`)
      .in('status', ['PUBLISHED', 'SELECTION', 'ACTIVE'])
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    
    return data.map((r: any) => {
      let popunjeno = 0;
      for (const a of r.agreements || []) {
        if (['CONFIRMED','SUPERSEDED','COMPLETED'].includes(a.status)) {
           popunjeno += a.marketplace_responses?.covered_slots || 0;
        }
      }
      return {
        id: r.id,
        naslov: r.title,
        statusTekst: r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
        podrucjeTekst: fLoc(r.approximate_area, r.approximate_city),
        vremeTekst: fTime(r.starts_at),
        pokrivenost: pokrivenost(r.required_slots || 1, popunjeno),
        uslovi: [...(r.required_skills||[]), ...(r.required_tools||[]), ...(r.required_vehicles||[])],
        narucilacIme: r.app_profiles?.display_name || '',
        narucilacOcena: null,
        priblizno: r.approximate_lat ? { lat: r.approximate_lat, lng: r.approximate_lng } : null,
      };
    });
  },

  async prilika(id: string) {
    const { data, error } = await supabase.from('needs')
      .select(`*, agreements(status, marketplace_responses(covered_slots)), app_profiles!requester_profile_id(display_name)`)
      .eq('id', id).maybeSingle();
    if (error || !data) return null;
    
    let popunjeno = 0;
    for (const a of data.agreements || []) {
      if (['CONFIRMED','SUPERSEDED','COMPLETED'].includes(a.status)) {
         popunjeno += a.marketplace_responses?.covered_slots || 0;
      }
    }
    return {
      id: data.id,
      naslov: data.title,
      statusTekst: data.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
      podrucjeTekst: fLoc(data.approximate_area, data.approximate_city),
      vremeTekst: fTime(data.starts_at),
      pokrivenost: pokrivenost(data.required_slots || 1, popunjeno),
      uslovi: [...(data.required_skills||[]), ...(data.required_tools||[]), ...(data.required_vehicles||[])],
      narucilacIme: data.app_profiles?.display_name || '',
      narucilacOcena: null,
      priblizno: data.approximate_lat ? { lat: data.approximate_lat, lng: data.approximate_lng } : null,
    };
  },

  async prijaveZaPotrebu(potrebaId: string) {
    const { data, error } = await supabase.from('marketplace_responses')
      .select(`*, app_profiles!worker_profile_id(display_name), marketplace_response_versions(version, content_hash)`)
      .eq('need_id', potrebaId);
    if (error || !data) return [];
    
    return data.map((r: any) => {
      const ver = r.marketplace_response_versions?.find((v: any) => v.version === r.current_version);
      return {
        prijavaId: r.id,
        verzija: r.current_version,
        hash: ver?.content_hash || '',
        ime: r.app_profiles?.display_name || '',
        inicijali: (r.app_profiles?.display_name || '?').substring(0, 2).toUpperCase(),
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

  async mojiDogovori() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return [];
    
    const { data, error } = await supabase.from('agreements')
      .select(`
        *,
        needs(title, approximate_area, approximate_city, required_slots, starts_at),
        worker:app_profiles!worker_profile_id(display_name, account_id),
        requester:app_profiles!requester_profile_id(display_name, account_id),
        agreement_execution(state, mode, requester_deadline_at, problem_opened_at)
      `)
      .order('created_at', { ascending: false });
    
    if (error || !data) return [];
    
    return data.map((r: any) => {
      const isReq = r.requester_account_id === user.user?.id;
      const me = isReq ? r.requester : r.worker;
      const other = isReq ? r.worker : r.requester;
      
      const ucesnici: UcesnikProjekcija[] = [
        { id: me?.account_id||'', ime: me?.display_name||'', inicijali: (me?.display_name||'?').substring(0,2).toUpperCase(), uloga: isReq ? 'narucilac' : 'uskocer', mesta: null, viSte: true, telefon: null },
        { id: other?.account_id||'', ime: other?.display_name||'', inicijali: (other?.display_name||'?').substring(0,2).toUpperCase(), uloga: isReq ? 'uskocer' : 'narucilac', mesta: null, viSte: false, telefon: null },
      ];
      
      const exec = r.agreement_execution?.[0] || {};
      
      return {
        id: r.id,
        verzija: r.current_version,
        naslov: r.needs?.title || '',
        stanje: r.status,
        cena: rsd(r.terms?.price_rsd || 0),
        vremeTekst: fTime(r.needs?.starts_at),
        putanjaTekst: fLoc(r.needs?.approximate_area, r.needs?.approximate_city),
        pokrivenost: pokrivenost(r.needs?.required_slots || 1, r.terms?.covered_slots || 1),
        ucesnici,
        rezim: exec.mode === 'PHYSICAL' ? 'FIZICKI' : exec.mode === 'REMOTE' ? 'DALJINSKI' : 'PREUZIMANJE_DOSTAVA',
        kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: exec.mode === 'PHYSICAL', tacnaLokacija: null, emailNijeDeljen: true },
        chatDostupan: true,
        rokPotvrdeIso: exec.requester_deadline_at || null,
        problemOtvoren: !!exec.problem_opened_at,
        ocenaMoguca: r.status === 'COMPLETED',
        hronologija: [{ vremeTekst: fTime(r.created_at), tekst: 'Dogovor kreiran' }]
      };
    });
  },

  async dogovor(id: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;
    
    const { data, error } = await supabase.from('agreements')
      .select(`
        *,
        needs(title, approximate_area, approximate_city, required_slots, starts_at),
        worker:app_profiles!worker_profile_id(display_name, account_id),
        requester:app_profiles!requester_profile_id(display_name, account_id),
        agreement_execution(state, mode, requester_deadline_at, problem_opened_at),
        access_grants(channel, granted_by_account_id, granted_to_account_id, status)
      `)
      .eq('id', id).maybeSingle();
      
    if (error || !data) return null;
    
    const r = data;
    const isReq = r.requester_account_id === user.user?.id;
    const me = isReq ? r.requester : r.worker;
    const other = isReq ? r.worker : r.requester;
    const uid = user.user?.id;
    
    let mojTelPodeljen = false;
    let njihovTel = null;
    
    for (const g of r.access_grants || []) {
      if (g.channel === 'PHONE' && g.status === 'GRANTED') {
         if (g.granted_by_account_id === uid) mojTelPodeljen = true;
         if (g.granted_to_account_id === uid) njihovTel = 'Dostupan u bazi'; // Placeholder for actual phone if we join it
      }
    }
    
    const ucesnici: UcesnikProjekcija[] = [
      { id: me?.account_id||'', ime: me?.display_name||'', inicijali: (me?.display_name||'?').substring(0,2).toUpperCase(), uloga: isReq ? 'narucilac' : 'uskocer', mesta: null, viSte: true, telefon: null },
      { id: other?.account_id||'', ime: other?.display_name||'', inicijali: (other?.display_name||'?').substring(0,2).toUpperCase(), uloga: isReq ? 'uskocer' : 'narucilac', mesta: null, viSte: false, telefon: njihovTel },
    ];
    
    const exec = r.agreement_execution?.[0] || {};
    
    return {
      id: r.id,
      verzija: r.current_version,
      naslov: r.needs?.title || '',
      stanje: r.status,
      cena: rsd(r.terms?.price_rsd || 0),
      vremeTekst: fTime(r.needs?.starts_at),
      putanjaTekst: fLoc(r.needs?.approximate_area, r.needs?.approximate_city),
      pokrivenost: pokrivenost(r.needs?.required_slots || 1, r.terms?.covered_slots || 1),
      ucesnici,
      rezim: exec.mode === 'PHYSICAL' ? 'FIZICKI' : exec.mode === 'REMOTE' ? 'DALJINSKI' : 'PREUZIMANJE_DOSTAVA',
      kontakt: { mojTelefonPodeljen: mojTelPodeljen, njihovTelefon: njihovTel, lokacijaPostoji: exec.mode === 'PHYSICAL', tacnaLokacija: null, emailNijeDeljen: true },
      chatDostupan: true,
      rokPotvrdeIso: exec.requester_deadline_at || null,
      problemOtvoren: !!exec.problem_opened_at,
      ocenaMoguca: r.status === 'COMPLETED',
      hronologija: [{ vremeTekst: fTime(r.created_at), tekst: 'Dogovor kreiran' }]
    };
  },

  async poruke(dogovorId: string) {
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('agreement_messages')
      .select(`*`)
      .eq('agreement_id', dogovorId)
      .order('created_at', { ascending: true });
      
    if (error || !data) return [];
    
    return data.map((r: any) => ({
      id: r.id,
      posiljalacIme: r.sender_account_id === user?.user?.id ? 'Ja' : 'Sagovornik',
      moja: r.sender_account_id === user?.user?.id,
      telo: r.body,
      vremeTekst: fTime(r.created_at),
      procitano: true, // naive for now
    }));
  },

  async izaberiPrijavu(k: IzborKomanda) {
    const { data, error } = await supabase.rpc('rpc_select_response', {
      p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija, p_response_id: k.prijavaId,
      p_response_version: k.prijavaVerzija, p_content_hash: k.prijavaHash, p_client_request_id: k.clientRequestId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška pri izboru.');
    return { ok: true, podatak: { dogovorId: data } };
  },
  
  async oznaciPrijavuVidjenom(prijavaId: string) { return { ok: true, podatak: null }; },
  
  async predloziIzmenu(k: IzmenaKomanda) {
    const { data, error } = await supabase.rpc('rpc_propose_agreement_change', {
      p_agreement_id: k.dogovorId, p_expected_version: k.ocekivanaVerzija, p_reason: k.razlog,
      p_amount: k.izmena.cenaIznos, p_currency: k.izmena.cenaValuta, p_start_time: k.izmena.pocetakIso,
      p_end_time: k.izmena.krajIso, p_scope: k.izmena.obim, p_idempotency_key: k.clientRequestId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { predlogId: data } };
  },
  
  async odgovoriNaIzmenu(predlogId: string, prihvatam: boolean) { return { ok: true, podatak: null }; },
  
  async posaljiPoruku(dogovorId: string, telo: string) { return { ok: true, podatak: { porukaId: '' } }; },
  
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
  
  async prijaviProblem(dogovorId: string, opis: string) {
    const { data, error } = await supabase.rpc('rpc_report_problem', { p_agreement_id: dogovorId, p_description: opis });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async podeliTelefon(dogovorId: string) { return { ok: true, podatak: null }; },
  async opoziviTelefon(dogovorId: string) { return { ok: true, podatak: null }; },
  async otkrijTacnuLokaciju(dogovorId: string) { return { ok: true, podatak: { adresa: '' } }; },

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