import type { Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type ContactClientService = Pick<Izvor, 'podeliTelefon' | 'opoziviTelefon'>;

function rpcFailure<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

/**
 * CDL-A05 — canonical production boundary for PHONE contact grants.
 * Backend authority remains rpc_set_contact_grant; this service preserves the
 * already-active request/error contract without adding client-side authority.
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
};
