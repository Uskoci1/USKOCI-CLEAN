import { Izvor, Ishod } from './ports';
import { calendarFailure } from './calendarErrors';
import { readOwnedResult, record, sameId, uuid } from './serverReceipt';
import { sesijaSada } from '../store/sesija';
import { publicProfileClientService } from './publicProfileClientService';
import { readPublicNeedDetail } from './needClientService';
import { needScheduleText } from './needDetailPresentation';
import { supabaseKlijent } from './supabaseClient';
import type {
  JavniProfilProjekcija,
  Novac,
  Pokrivenost,
} from '../contracts/projections';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_t, prop) => (supabaseKlijent() as never)[prop],
});

function handleRpcError<T>(error: unknown, defaultCode: string, defaultMessage: string): Ishod<T> {
  const calendar = calendarFailure(error);
  if (calendar) return calendar;
  const value = record(error);
  return {
    ok: false,
    kod: typeof value?.code === 'string' ? value.code : defaultCode,
    poruka: typeof value?.message === 'string' ? value.message : defaultMessage,
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
  return [area, city].filter(Boolean).join(', ') || 'Lokacija nije navedena';
}

function publicTaskContext(raw: Record<string, any>) {
  const { detail: detalji, schedule } = readPublicNeedDetail(raw);
  if (typeof raw.description !== 'string') throw new Error('TASK_DESCRIPTION_INVALID');
  const remote = detalji.rezimLokacije === 'REMOTE';
  const lat = raw.approximate_lat, lng = raw.approximate_lng;
  const priblizno = !remote && typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
    ? { lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2)) } : null;
  return { opis: raw.description, detalji, schedule, taskCountryCode: raw.task_country_code ?? undefined,
    taskTimezone: raw.task_timezone ?? undefined, vremeTekst: needScheduleText(schedule, raw.task_timezone ?? undefined),
    podrucjeTekst: remote ? 'Na daljinu' : fLoc(raw.approximate_area, raw.approximate_city), priblizno };
}

function formatPublicRating(profile: JavniProfilProjekcija | null | undefined): string | null {
  if (!profile?.poverenje.ocenaDostupna || profile.poverenje.ocenaProsek === null) return null;
  return profile.poverenje.ocenaProsek.toLocaleString('sr-Latn-RS', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * One narrow RPC per distinct profile id. A profile projection failure must not
 * erase otherwise-public Need/Application rows, so marketplace list consumers
 * degrade to unavailable trust while the explicit javniProfil() port itself
 * still fails loudly when called directly by a profile screen.
 */
async function safePublicProfiles(profileIds: Array<string | null | undefined>) {
  const ids = [...new Set(profileIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        return [id, await publicProfileClientService.javniProfil(id)] as const;
      } catch (error) {
        console.error('[Public profile projection unavailable]', { profileId: id, error });
        return [id, null] as const;
      }
    }),
  );
  return new Map<string, JavniProfilProjekcija | null>(entries);
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
  | 'lokacijskaDozvola'
  | 'podeliTacnuLokaciju'
  | 'opoziviTacnuLokaciju'
  | 'azurirajRadnikProfil'
  | 'javniProfil'
  | 'posaljiKorisnikovuPoruku'
  | 'ispraviCinjenicu'
  | 'otvoriRazgovor'
  | 'razgovor'
  | 'objaviPotrebu'
  | 'mojePrijave'
  | 'povuciPrijavu'
  | 'podnesiPrijavu'
  | 'izaberiPrijavu'
>;

export const supabaseIzvor: SupabaseIzvor = {
  poreklo: 'supabase',

  async otvorenePrilike() {
    const { data, error } = await supabase.from('needs')
      .select(`
        id, title, status, starts_at, approximate_area, approximate_city, approximate_lat, approximate_lng,
        required_slots, required_skills, required_tools, required_vehicles,
        covered_slots, mode, requester_price_rsd, requester_profile_id,
        description, category, schedule_kind, ends_at, task_country_code, task_timezone, execution_location_mode,
        required_licenses, minimum_experience_years, verified_identity_required,
        need_geography(public_topology), need_requirement_details(critical_conditions)
      `)
      .in('status', ['PUBLISHED', 'SELECTION'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) throw new Error('OPPORTUNITIES_RESPONSE_INVALID');

    const profiles = await safePublicProfiles(data.map((r: any) => r.requester_profile_id));

    return data.map((r: any) => {
      const narucilac = profiles.get(r.requester_profile_id) ?? null;
      return {
        id: r.id,
        naslov: r.title,
        statusTekst: r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
        ...publicTaskContext(r),
        pokrivenost: pokrivenost(r.required_slots || 1, r.covered_slots || 0),
        uslovi: [...(r.required_skills || []), ...(r.required_tools || []), ...(r.required_vehicles || [])],
        narucilacProfilId: r.requester_profile_id,
        narucilacIme: narucilac?.ime || '',
        narucilacOcena: formatPublicRating(narucilac),
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
        covered_slots, mode, requester_price_rsd, requester_profile_id, response_deadline,
        description, category, schedule_kind, ends_at, task_country_code, task_timezone, execution_location_mode,
        required_licenses, minimum_experience_years, verified_identity_required,
        need_geography(public_topology), need_requirement_details(critical_conditions)
      `)
      .eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Missing/malformed capacity is an invalid read, never implicit free space.
    if (!Number.isSafeInteger(data.required_slots) || data.required_slots <= 0
      || !Number.isSafeInteger(data.covered_slots) || data.covered_slots < 0) {
      throw new Error('TASK_CAPACITY_INVALID');
    }
    const rok = data.response_deadline;
    if (rok !== null && (typeof rok !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(rok)
      || !Number.isFinite(Date.parse(rok)))) throw new Error('TASK_DEADLINE_INVALID');

    const profiles = await safePublicProfiles([data.requester_profile_id]);
    const narucilac = profiles.get(data.requester_profile_id) ?? null;

    return {
      id: data.id,
      naslov: data.title,
      statusTekst: ['PUBLISHED', 'SELECTION'].includes(data.status) ? 'Traži ponude' : 'Prijave zatvorene',
      primaNovePrijave: ['PUBLISHED', 'SELECTION'].includes(data.status)
        && data.required_slots > data.covered_slots && (rok === null || Date.parse(rok) > Date.now()),
      rokZaPrijaveIso: rok,
      ...publicTaskContext(data),
      pokrivenost: pokrivenost(data.required_slots, data.covered_slots),
      uslovi: [...(data.required_skills || []), ...(data.required_tools || []), ...(data.required_vehicles || [])],
      narucilacProfilId: data.requester_profile_id,
      narucilacIme: narucilac?.ime || '',
      narucilacOcena: formatPublicRating(narucilac),
      rezimCene: data.mode as any,
      ponudjenaCena: data.requester_price_rsd ? rsd(data.requester_price_rsd) : undefined,
    };
  },

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
    const owner = sesijaSada();
    if (!owner.user) throw new Error('WORKER_PROFILE_AUTH_REQUIRED');
    const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
    const options = { account, errors: {}, fallback: 'WORKER_PROFILE_READ_FAILED', invalid: 'WORKER_PROFILE_INVALID' };
    const auth = await readOwnedResult({ ...options, request: () => supabase.auth.getUser(),
      decode: raw => sameId(record(record(raw)?.user)?.id, account.accountId) ? true : null });
    if (!auth.ok) throw new Error('WORKER_PROFILE_READ_FAILED');
    const result = await readOwnedResult({ ...options, request: () => supabase.from('app_profiles')
      .select('id,account_id,kind,display_name,city,bio,skills,tools,vehicles,profile_status,available_now,radius_km')
      .eq('account_id', account.accountId).eq('kind', 'WORKER').maybeSingle(),
      decode: raw => {
        if (raw === null) return { profile: null };
        const data = record(raw);
        if (!data || !uuid(data.id) || !sameId(data.account_id, account.accountId) || data.kind !== 'WORKER' ||
          !['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(String(data.profile_status)) || typeof data.available_now !== 'boolean' ||
          typeof data.radius_km !== 'number' || !Number.isInteger(data.radius_km) || data.radius_km < 1 || data.radius_km > 200 ||
          !['display_name', 'city', 'bio'].every(key => data[key] === null || typeof data[key] === 'string') ||
          !['skills', 'tools', 'vehicles'].every(key => Array.isArray(data[key]) && data[key].every((item: unknown) => typeof item === 'string'))) return null;
        return { profile: { id: data.id, ime: data.display_name as string ?? '', grad: data.city as string ?? '',
          biografija: data.bio as string ?? '', vestine: data.skills as string[], alati: data.tools as string[], vozila: data.vehicles as string[],
          stanje: data.profile_status as 'DRAFT' | 'ACTIVE' | 'SUSPENDED', dostupanOdmah: data.available_now, radijusKm: data.radius_km } };
      },
    });
    if (!result.ok) throw new Error('WORKER_PROFILE_READ_FAILED');
    return result.podatak.profile;
  },

  async potvrdiCinjenicu(cinjenicaId: string) {
    const { error } = await supabase.rpc('rpc_ai_confirm_fact', { p_fact_id: cinjenicaId });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },
};
