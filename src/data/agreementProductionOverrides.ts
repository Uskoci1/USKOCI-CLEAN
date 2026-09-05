import type { Ishod, IzmenaKomanda, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AgreementOverrides = Partial<Pick<
  Izvor,
  'posaljiPoruku' | 'predloziIzmenu' | 'odgovoriNaIzmenu'
>>;

function fail<T>(error: any, code: string, message: string): Ishod<T> {
  return { ok: false, kod: error?.message || error?.code || code, poruka: error?.message || message };
}

export const agreementProductionOverrides: AgreementOverrides = {
  async posaljiPoruku(dogovorId, telo) {
    const body = telo.trim();
    if (!body) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' };
    const { data, error } = await supabase.rpc('rpc_send_agreement_message', {
      p_agreement_id: dogovorId,
      p_body: body,
    });
    if (error || !data) return fail(error, 'MESSAGE_SEND_FAILED', 'Poruka nije poslata.');
    return { ok: true, podatak: { porukaId: data } };
  },

  async predloziIzmenu(k: IzmenaKomanda) {
    const patch: Record<string, unknown> = {};
    if (k.izmena.cenaIznos !== undefined) patch.price_rsd = k.izmena.cenaIznos;
    if (k.izmena.cenaValuta !== undefined) patch.currency = k.izmena.cenaValuta;
    if (k.izmena.pocetakIso !== undefined) patch.proposed_start_at = k.izmena.pocetakIso;
    if (k.izmena.krajIso !== undefined) patch.proposed_end_at = k.izmena.krajIso;
    if (k.izmena.obim !== undefined) patch.scope_note = k.izmena.obim;

    if (!Object.keys(patch).length) {
      return { ok: false, kod: 'CHANGE_PATCH_REQUIRED', poruka: 'Izmenite bar jedno polje Dogovora.' };
    }

    const { data, error } = await supabase.rpc('rpc_propose_agreement_change_v2', {
      p_agreement_id: k.dogovorId,
      p_expected_version: k.ocekivanaVerzija,
      p_patch: patch,
      p_reason: k.razlog ?? null,
      p_client_request_id: k.clientRequestId,
    });
    if (error || !data) return fail(error, 'CHANGE_PROPOSAL_FAILED', 'Predlog izmene nije sačuvan.');
    return { ok: true, podatak: { predlogId: data } };
  },

  async odgovoriNaIzmenu(predlogId, prihvatam) {
    const { error } = await supabase.rpc('rpc_respond_agreement_change', {
      p_proposal_id: predlogId,
      p_accept: prihvatam,
    });
    if (error) return fail(error, 'CHANGE_RESPONSE_FAILED', 'Odgovor na izmenu nije sačuvan.');
    return { ok: true, podatak: null };
  },
};
