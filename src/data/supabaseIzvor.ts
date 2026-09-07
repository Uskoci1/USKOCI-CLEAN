import { Izvor, Ishod, IzborKomanda, PodnesiPrijavuKomanda } from './ports';
import { discoveryClientService } from './discoveryClientService';
import { supabaseKlijent } from './supabaseClient';

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

function fTime(iso: string | null): string {
  if (!iso) return 'Fleksibilno';
  return new Date(iso).toLocaleString('sr-Latn-RS');
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
  | 'prijaveZaPotrebu'
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
  | 'mojePrijave'
  | 'povuciPrijavu'
>;

export const supabaseIzvor: SupabaseIzvor = {
  poreklo: 'supabase',

  otvorenePrilike: discoveryClientService.otvorenePrilike,
  otvorenePrilikeStrana: discoveryClientService.otvorenePrilikeStrana,
  prilika: discoveryClientService.prilika,
  detaljiPrilike: discoveryClientService.detaljiPrilike,

  async poruke(dogovorId: string, expectedAccountId?: string) {
    const uuid = (value: unknown): value is string => typeof value === 'string' && value.length === 36
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!uuid(dogovorId) || (expectedAccountId !== undefined && !uuid(expectedAccountId))) {
      throw new Error('MESSAGE_SCOPE_INVALID');
    }
    const { data: user, error: authError } = await supabase.auth.getUser();
    const accountId = user?.user?.id;
    if (authError || !accountId || (expectedAccountId && expectedAccountId !== accountId)) {
      throw new Error('MESSAGE_AUTH_CONTEXT_CHANGED');
    }
    const { data, error } = await supabase.from('agreement_messages')
      .select(`id, sender_account_id, client_message_id, body, created_at`)
      .eq('agreement_id', dogovorId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) throw new Error('MESSAGE_READ_FAILED');
    const { data: current, error: currentError } = await supabase.auth.getUser();
    if (currentError || current?.user?.id !== accountId) throw new Error('MESSAGE_AUTH_CONTEXT_CHANGED');

    return data.map((r: any) => {
      if (!uuid(r?.id) || !uuid(r?.sender_account_id) || typeof r.body !== 'string'
        || typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))
        || !(r.client_message_id === null || (typeof r.client_message_id === 'string'
          && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/.test(r.client_message_id) && !/\s/.test(r.client_message_id)))) {
        throw new Error('MESSAGE_PROJECTION_INVALID');
      }
      return {
        id: r.id,
        clientMessageId: r.client_message_id,
        posiljalacAccountId: r.sender_account_id,
        posiljalacIme: r.sender_account_id === accountId ? 'Ja' : 'Sagovornik',
        moja: r.sender_account_id === accountId,
        telo: r.body,
        vremeTekst: fTime(r.created_at),
        procitano: null,
      };
    });
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
