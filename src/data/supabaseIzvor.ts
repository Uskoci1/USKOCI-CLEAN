import { Izvor, Ishod, IzborKomanda, IzmenaKomanda } from './ports';
import { supabaseKlijent } from './supabaseClient';

// Lenji pristup: klijent se pravi tek kad neka metoda stvarno pozove Supabase.
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

export const supabaseIzvor: Izvor = {
  poreklo: 'supabase',
  async mojePotrebe() { return []; },
  async potreba(id) { return null; },
  async otvorenePrilike() { return []; },
  async prilika(id) { return null; },
  async prijaveZaPotrebu(potrebaId) { return []; },
  async mojiDogovori() { return []; },
  async dogovor(id) { return null; },
  async poruke(dogovorId) { return []; },
  
  async izaberiPrijavu(k: IzborKomanda) {
    const { data, error } = await supabase.rpc('rpc_select_response', {
      p_need_id: k.potrebaId,
      p_need_revision: k.potrebaRevizija,
      p_response_id: k.prijavaId,
      p_response_version: k.prijavaVerzija,
      p_response_hash: k.prijavaHash,
      p_slots: k.mesta,
      p_idempotency_key: k.clientRequestId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška pri izboru.');
    return { ok: true, podatak: { dogovorId: data } };
  },
  async oznaciPrijavuVidjenom(prijavaId) { return { ok: true, podatak: null }; },
  
  async predloziIzmenu(k: IzmenaKomanda) {
    const { data, error } = await supabase.rpc('rpc_propose_agreement_change', {
      p_agreement_id: k.dogovorId,
      p_expected_version: k.ocekivanaVerzija,
      p_reason: k.razlog,
      p_amount: k.izmena.cenaIznos,
      p_currency: k.izmena.cenaValuta,
      p_start_time: k.izmena.pocetakIso,
      p_end_time: k.izmena.krajIso,
      p_scope: k.izmena.obim,
      p_idempotency_key: k.clientRequestId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { predlogId: data } };
  },
  
  async odgovoriNaIzmenu(predlogId, prihvatam) { return { ok: true, podatak: null }; },
  async posaljiPoruku(dogovorId, telo) { return { ok: true, podatak: { porukaId: '' } }; },
  
  async otkaziDogovor(dogovorId, razlog) {
    const { data, error } = await supabase.rpc('rpc_cancel_agreement', {
      p_agreement_id: dogovorId,
      p_reason: razlog
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async oznaciZavrsetak(dogovorId) {
    const { data, error } = await supabase.rpc('rpc_mark_work_done', {
      p_agreement_id: dogovorId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { rokPotvrdeIso: new Date().toISOString() } };
  },
  
  async potvrdiZavrsetak(dogovorId) {
    const { data, error } = await supabase.rpc('rpc_confirm_completion', {
      p_agreement_id: dogovorId
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async prijaviProblem(dogovorId, opis) {
    const { data, error } = await supabase.rpc('rpc_report_problem', {
      p_agreement_id: dogovorId,
      p_description: opis
    });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async podeliTelefon(dogovorId) { return { ok: true, podatak: null }; },
  async opoziviTelefon(dogovorId) { return { ok: true, podatak: null }; },
  async otkrijTacnuLokaciju(dogovorId) { return { ok: true, podatak: { adresa: '' } }; },

  async otvoriRazgovor() {
    const { data, error } = await supabase.rpc('rpc_ai_open_conversation', { p_purpose: 'NEW_NEED' });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { razgovorId: data } };
  },
  
  async razgovor(razgovorId) { return null; },
  async posaljiKorisnikovuPoruku(razgovorId, telo) { return { ok: true, podatak: { predlozeno: 0 } }; },
  
  async potvrdiCinjenicu(cinjenicaId) {
    const { data, error } = await supabase.rpc('rpc_ai_confirm_fact', { p_fact_id: cinjenicaId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
  
  async ispraviCinjenicu(cinjenicaId, novaVrednost) { return { ok: true, podatak: { novaCinjenicaId: '' } }; },
  
  async objaviPotrebu(razgovorId) {
    const { data, error } = await supabase.rpc('rpc_ai_publish_need', { p_conversation_id: razgovorId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: { potrebaId: data } };
  },
};
