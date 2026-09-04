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

export type Ru4MojaPrijava = {
  prijavaId: string;
  potrebaId: string;
  naslov: string;
  opis: string;
  potrebaRevizija: number;
  prijavaRevizija: number;
  prijavaVerzija: number;
  status: string;
  promenjenaPotreba: boolean;
  cenaRsd: number;
  pokrivaMesta: number;
  napomena: string;
  podrucjeTekst: string;
  vremeTekst: string;
};

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

function vreme(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('sr-Latn-RS') : 'Fleksibilno';
}

function podrucje(area: string | null | undefined, city: string | null | undefined) {
  return [area, city].filter(Boolean).join(', ') || 'Lokacija nije navedena';
}

export const ru4Production = {
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

  async mojePrijave(): Promise<Ru4MojaPrijava[]> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message || 'AUTH_READ_FAILED');
    if (!authData.user) throw new Error('AUTH_REQUIRED');

    const { data: responses, error: responseError } = await supabase
      .from('marketplace_responses')
      .select('id,need_id,status,current_version,submitted_against_need_revision,covered_slots,price_rsd,scope_note,submitted_at')
      .eq('worker_account_id', authData.user.id)
      .order('submitted_at', { ascending: false });
    if (responseError) throw new Error(responseError.message || 'MY_RESPONSES_READ_FAILED');
    if (!responses?.length) return [];

    const needIds = [...new Set(responses.map((row: any) => String(row.need_id)))];
    const { data: needs, error: needsError } = await supabase
      .from('needs')
      .select('id,title,description,revision,status,approximate_city,approximate_area,starts_at,remaining_search_closed_at')
      .in('id', needIds);
    if (needsError) throw new Error(needsError.message || 'MY_RESPONSE_NEEDS_READ_FAILED');

    const byId = new Map((needs ?? []).map((row: any) => [String(row.id), row]));
    return responses.map((row: any) => {
      const need: any = byId.get(String(row.need_id));
      const currentNeedRevision = Number(need?.revision ?? row.submitted_against_need_revision ?? 1);
      const responseNeedRevision = Number(row.submitted_against_need_revision ?? 1);
      const status = String(row.status ?? '');
      return {
        prijavaId: String(row.id),
        potrebaId: String(row.need_id),
        naslov: String(need?.title ?? 'Zadatak'),
        opis: String(need?.description ?? ''),
        potrebaRevizija: currentNeedRevision,
        prijavaRevizija: responseNeedRevision,
        prijavaVerzija: Number(row.current_version ?? 1),
        status,
        promenjenaPotreba: status === 'STALE_REVIEW_REQUIRED' || currentNeedRevision !== responseNeedRevision,
        cenaRsd: Number(row.price_rsd ?? 0),
        pokrivaMesta: Number(row.covered_slots ?? 1),
        napomena: String(row.scope_note ?? ''),
        podrucjeTekst: podrucje(need?.approximate_area, need?.approximate_city),
        vremeTekst: vreme(need?.starts_at),
      };
    });
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
