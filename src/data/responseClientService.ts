import type { Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type ResponseClientService = Pick<Izvor, 'oznaciPrijavuVidjenom'>;

function rpcFailure<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

/**
 * CDL-A04 — canonical production boundary for the response-viewed command.
 * Backend authority remains rpc_mark_response_viewed; this service only
 * preserves the existing client request/error contract without adding
 * client-side business authority.
 */
export const responseClientService: ResponseClientService = {
  async oznaciPrijavuVidjenom(prijavaId) {
    const { error } = await supabase.rpc('rpc_mark_response_viewed', {
      p_response_id: prijavaId,
    });
    if (error) {
      return rpcFailure(
        error,
        'RESPONSE_VIEW_FAILED',
        'Prijava nije mogla da se označi kao pregledana.',
      );
    }
    return { ok: true, podatak: null };
  },
};
