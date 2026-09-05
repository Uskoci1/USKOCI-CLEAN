import type { Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type ContactClientService = Pick<Izvor, 'podeliTelefon' | 'opoziviTelefon' | 'otkrijTacnuLokaciju'>;

function rpcFailure<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

/**
 * Canonical production boundary for contact/privacy operations migrated so far.
 * Backend authority remains in canonical grant/reveal RPCs; this service preserves
 * the already-active request/error contract without adding client-side authority.
 */
export const contactClientService: ContactClientService = {
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
};
