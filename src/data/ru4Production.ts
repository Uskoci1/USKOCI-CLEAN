import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

export type Ru4RazresiPrijavuInput = {
  prijavaId: string;
  ocekivanaVerzija: number;
  ocekivanaPotrebaRevizija: number;
  clientRequestId: string;
  akcija: 'KEEP' | 'UPDATE' | 'WITHDRAW';
  pokrivenaMesta?: number | null;
  cenaRsd?: number | null;
  predlozeniPocetak?: string | null;
  predlozeniKraj?: string | null;
  napomena?: string | null;
};

export const ru4Production = {
  async remainingSearchState(needId: string): Promise<{ closed: boolean; closedAt: string | null }> {
    const { data, error } = await supabase
      .from('needs')
      .select('remaining_search_closed_at')
      .eq('id', needId)
      .maybeSingle();
    if (error) throw new Error(error.message || 'REMAINING_SEARCH_STATE_READ_FAILED');
    const closedAt = typeof data?.remaining_search_closed_at === 'string' ? data.remaining_search_closed_at : null;
    return { closed: !!closedAt, closedAt };
  },

  async closeRemainingSearch(
    needId: string,
    expectedRevision: number,
    clientRequestId: string,
    reason = '',
  ): Promise<Ishod<{ closedRemainingSlots: number }>> {
    const { data, error } = await supabase.rpc('rpc_close_remaining_search', {
      p_need_id: needId,
      p_expected_revision: expectedRevision,
      p_client_request_id: clientRequestId,
      p_reason: reason,
    });
    if (error) return fail(error, 'REMAINING_SEARCH_CLOSE_FAILED', 'Preostala potraga nije mogla da se zatvori.');
    return {
      ok: true,
      podatak: { closedRemainingSlots: Number(data?.closedRemainingSlots ?? 0) },
    };
  },

  async resolveChangedApplication(input: Ru4RazresiPrijavuInput): Promise<Ishod<{ status: string; version: number }>> {
    const { data, error } = await supabase.rpc('rpc_resolve_stale_response_after_need_edit', {
      p_response_id: input.prijavaId,
      p_expected_response_version: input.ocekivanaVerzija,
      p_expected_need_revision: input.ocekivanaPotrebaRevizija,
      p_client_request_id: input.clientRequestId,
      p_action: input.akcija,
      p_covered_slots: input.pokrivenaMesta ?? null,
      p_price_rsd: input.cenaRsd ?? null,
      p_proposed_start_at: input.predlozeniPocetak ?? null,
      p_proposed_end_at: input.predlozeniKraj ?? null,
      p_scope_note: input.napomena ?? null,
    });
    if (error) return fail(error, 'STALE_RESPONSE_RESOLUTION_FAILED', 'Prijava nije mogla da se uskladi sa izmenjenim Zadatkom.');
    return {
      ok: true,
      podatak: {
        status: String(data?.status ?? ''),
        version: Number(data?.version ?? input.ocekivanaVerzija),
      },
    };
  },
};
