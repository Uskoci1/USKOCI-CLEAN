import { workerCapacityRevision, workerCapacityValue } from '../contracts/workerCapacity';
import { noTaskRelations, taskRelationIndex } from './taskRelation';
import { legacyRpcFailure } from './legacyRpcFailure';
import { Izvor, Ishod } from './ports';
import { calendarFailure } from './calendarErrors';
import { positiveInteger, readOwnedResult, record, sameId, uuid } from './serverReceipt';
import { sesijaSada } from '../store/sesija';
import { publicProfileClientService } from './publicProfileClientService';
import { readPublicNeedDetail } from './needClientService';
import { needScheduleText } from './needDetailPresentation';
import { readNeedUrgencies } from './needUrgencyClientService';
import { supabaseKlijent } from './supabaseClient';
import type {
  JavniProfilProjekcija,
  Novac,
  Pokrivenost,
} from '../contracts/projections';
import { novac } from '../lib/novac';
import { podrucjeTekst } from '../lib/location';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_t, prop) => (supabaseKlijent() as never)[prop],
});

function handleRpcError<T>(error: unknown, defaultCode: string, defaultMessage: string): Ishod<T> {
  const calendar = calendarFailure(error);
  if (calendar) return calendar;
  return legacyRpcFailure(error, defaultCode, defaultMessage);
}

const rsd = (iznos: number): Novac => ({
  iznos,
  valuta: 'RSD',
  prikaz: novac(iznos),
});

function pokrivenost(ukupno: number, popunjeno: number): Pokrivenost {
  const preostalo = Math.max(0, ukupno - popunjeno);
  return { ukupno, popunjeno, preostalo, udeo: ukupno ? popunjeno / ukupno : 0 };
}

function fTime(iso: string | null): string {
  if (!iso) return 'Fleksibilno';
  return new Date(iso).toLocaleString('sr-Latn-RS');
}


/**
 * One item of public.rpc_list_open_tasks_v3, shaped like the row the shared public projection reads, so
 * that the list keeps exactly one way of reading a public task. The reader's allowlist is narrower than
 * the table on purpose: there is no description here, because a list of two hundred tasks has no business
 * shipping two hundred descriptions to every viewer, and the detail screen reads the one a person opens.
 */
function openTaskRow(item: Record<string, any>) {
  return {
    id: item.id, title: item.title, status: item.status, urgent: item.urgent,
    category: item.category, schedule_kind: item.scheduleKind, starts_at: item.startsAt, ends_at: item.endsAt,
    execution_location_mode: item.executionLocationMode,
    approximate_area: item.approximateArea ?? '', approximate_city: item.approximateCity ?? '',
    approximate_lat: item.pin?.lat ?? null, approximate_lng: item.pin?.lng ?? null,
    required_slots: item.requiredSlots, covered_slots: item.coveredSlots,
    required_skills: item.requiredSkills, required_tools: item.requiredTools,
    required_vehicles: item.requiredVehicles, required_licenses: item.requiredLicenses,
    minimum_experience_years: item.minimumExperienceYears, verified_identity_required: item.verifiedIdentityRequired,
    task_country_code: item.taskCountryCode, task_timezone: item.taskTimezone,
    mode: item.priceMode, requester_price_rsd: item.requesterPriceRsd, price_basis: item.priceBasis,
    requester_profile_id: item.requesterProfileId, response_deadline: item.responseDeadline,
    remaining_search_closed_at: null,
    description: '',
    need_geography: item.publicTopology == null ? null : { public_topology: item.publicTopology },
    need_requirement_details: item.criticalConditions == null ? null : { critical_conditions: item.criticalConditions },
  };
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
    podrucjeTekst: remote ? 'Na daljinu' : podrucjeTekst(raw.approximate_area, raw.approximate_city), priblizno };
}

function validPublicInstant(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
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
  | 'potvrdiZavrsetak'
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
  | 'paznjaZaPocetnu'
  | 'povuciPrijavu'
  | 'podnesiPrijavu'
  | 'izaberiPrijavu'
>;

export const supabaseIzvor: SupabaseIzvor = {
  poreklo: 'supabase',

  async otvorenePrilike() {
    // PKG-023d/i. The list and the map used to read every open task straight from the table, with the
    // description of each and no bound at all. They now read the server's allowlisted projection, ordered
    // by the server-owned published_at, in pages of two hundred. The page walk is a keyset, so nothing
    // repeats and nothing is hidden, and it keeps going until the server says there is no more: the
    // screen shows what it always showed, and the ceiling below is a refusal, never a silent truncation.
    const items: any[] = [];
    let cursor: { at: string; id: string } | null = null;
    for (let page = 0; ; page++) {
      if (page >= 25) throw new Error('OPPORTUNITIES_TOO_MANY_PAGES');
      const { data, error } = await supabase.rpc('rpc_list_open_tasks_v3', {
        p_limit: 200, p_before_at: cursor?.at ?? null, p_before_id: cursor?.id ?? null,
      });
      if (error) throw error;
      const rows = (data as { items?: unknown; hasMore?: unknown } | null)?.items;
      if (!Array.isArray(rows)) throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
      items.push(...rows);
      const last = rows[rows.length - 1] as { sortAt?: unknown; id?: unknown } | undefined;
      if ((data as any).hasMore !== true || !last || typeof last.sortAt !== 'string' || typeof last.id !== 'string') break;
      cursor = { at: last.sortAt, id: last.id };
    }
    // The server already refuses a task whose remaining search is closed, so no client-side filter can
    // decide it any more; every row here is an open one.
    const openData = items.map(openTaskRow);
    const [profiles, urgency] = await Promise.all([safePublicProfiles(openData.map((r: any) => r.requester_profile_id)), readNeedUrgencies(openData)]);

    return openData.map((r: any) => {
      const narucilac = profiles.get(r.requester_profile_id) ?? null;
      return {
        id: r.id,
        urgency: urgency.get(r.id),
        naslov: r.title,
        statusTekst: r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
        ...publicTaskContext(r),
        pokrivenost: pokrivenost(r.required_slots || 1, r.covered_slots || 0),
        uslovi: [...(r.required_skills || []), ...(r.required_tools || []), ...(r.required_vehicles || [])],
        narucilacProfilId: r.requester_profile_id,
        narucilacIme: narucilac?.ime || '',
        narucilacOcena: formatPublicRating(narucilac),
        rezimCene: r.mode,
        osnovaCene: r.price_basis === 'TOTAL' || r.price_basis === 'PER_PERSON' ? r.price_basis : null,
        ponudjenaCena: r.requester_price_rsd ? rsd(r.requester_price_rsd) : undefined,
      };
    });
  },

  /**
   * PKG-023b. One bounded call per page of tasks instead of my whole task list and my whole
   * application list for one label. The server answers only for the ids asked and says nothing
   * about any other task; a failure throws, so the caller shows no labels rather than wrong ones.
   */
  async odnosiPremaZadacima(idovi: readonly string[]) {
    const asked = [...new Set(idovi.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (asked.length === 0) return noTaskRelations;
    const items: unknown[] = [];
    // The server refuses more than a hundred in one call; a screen that shows more asks again.
    for (let from = 0; from < asked.length; from += 100) {
      const { data, error } = await supabase.rpc('rpc_get_my_task_relations', { p_need_ids: asked.slice(from, from + 100) });
      if (error) throw new Error('TASK_RELATIONS_READ_FAILED');
      const page = (data as { items?: unknown } | null)?.items;
      if (!Array.isArray(page)) throw new Error('TASK_RELATIONS_INVALID_PROJECTION');
      items.push(...page);
    }
    return taskRelationIndex(items, asked);
  },

  async prilika(id: string) {
    const { data, error } = await supabase.from('needs')
      .select(`
        id, title, status, urgent, starts_at, approximate_area, approximate_city, approximate_lat, approximate_lng,
        required_slots, required_skills, required_tools, required_vehicles,
        covered_slots, mode, requester_price_rsd, price_basis, requester_profile_id, response_deadline, remaining_search_closed_at,
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
    if (rok !== null && !validPublicInstant(rok)) throw new Error('TASK_DEADLINE_INVALID');
    const remainingClosedAt = data.remaining_search_closed_at;
    if (remainingClosedAt !== null && !validPublicInstant(remainingClosedAt)) throw new Error('TASK_REMAINING_SEARCH_STATE_INVALID');
    const remainingClosed = remainingClosedAt !== null;

    const [profiles, urgency] = await Promise.all([safePublicProfiles([data.requester_profile_id]), readNeedUrgencies([data])]);
    const narucilac = profiles.get(data.requester_profile_id) ?? null;

    return {
      id: data.id,
      urgency: urgency.get(data.id),
      naslov: data.title,
      statusTekst: !remainingClosed && ['PUBLISHED', 'SELECTION'].includes(data.status) ? 'Traži ponude' : 'Prijave zatvorene',
      primaNovePrijave: !remainingClosed && ['PUBLISHED', 'SELECTION'].includes(data.status)
        && data.required_slots > data.covered_slots && (rok === null || Date.parse(rok) > Date.now()),
      rokZaPrijaveIso: rok,
      ...publicTaskContext(data),
      pokrivenost: pokrivenost(data.required_slots, data.covered_slots),
      uslovi: [...(data.required_skills || []), ...(data.required_tools || []), ...(data.required_vehicles || [])],
      narucilacProfilId: data.requester_profile_id,
      narucilacIme: narucilac?.ime || '',
      narucilacOcena: formatPublicRating(narucilac),
      rezimCene: data.mode as any,
      osnovaCene: data.price_basis === 'TOTAL' || data.price_basis === 'PER_PERSON' ? data.price_basis : null,
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
      .select(`id, agreement_version, sender_account_id, client_message_id, body, created_at`)
      .eq('agreement_id', dogovorId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) throw new Error('MESSAGE_READ_FAILED');
    const { data: current, error: currentError } = await supabase.auth.getUser();
    if (currentError || current?.user?.id !== accountId) throw new Error('MESSAGE_AUTH_CONTEXT_CHANGED');

    return data.map((r: any) => {
      if (!uuid(r?.id) || !positiveInteger(r?.agreement_version) || !uuid(r?.sender_account_id) || typeof r.body !== 'string'
        || typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))
        || !(r.client_message_id === null || (typeof r.client_message_id === 'string'
          && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/.test(r.client_message_id) && !/\s/.test(r.client_message_id)))) {
        throw new Error('MESSAGE_PROJECTION_INVALID');
      }
      return {
        id: r.id,
        dogovorVerzija: r.agreement_version,
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

  async mojRadnikProfil() {
    const owner = sesijaSada();
    if (!owner.user) throw new Error('WORKER_PROFILE_AUTH_REQUIRED');
    const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
    const options = { account, errors: {}, fallback: 'WORKER_PROFILE_READ_FAILED', invalid: 'WORKER_PROFILE_INVALID' };
    const auth = await readOwnedResult({ ...options, request: () => supabase.auth.getUser(),
      decode: raw => sameId(record(record(raw)?.user)?.id, account.accountId) ? true : null });
    if (!auth.ok) throw new Error('WORKER_PROFILE_READ_FAILED');
    const result = await readOwnedResult({ ...options, request: () => supabase.rpc('rpc_get_worker_profile_for_edit', {}),
      decode: raw => {
        if (raw === null) return { profile: null };
        const data = record(raw);
        if (!data || !uuid(data.id) || !workerCapacityValue(data.team_capacity) || !workerCapacityRevision(data.capacity_revision) || !sameId(data.account_id, account.accountId) || data.kind !== 'WORKER' ||
          !['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(String(data.profile_status)) || typeof data.available_now !== 'boolean' ||
          typeof data.radius_km !== 'number' || !Number.isInteger(data.radius_km) || data.radius_km < 1 || data.radius_km > 200 ||
          !['display_name', 'city', 'bio'].every(key => data[key] === null || typeof data[key] === 'string') ||
          !['skills', 'tools', 'vehicles'].every(key => Array.isArray(data[key]) && data[key].every((item: unknown) => typeof item === 'string'))) return null;
        return { profile: { id: data.id, ime: data.display_name as string ?? '', grad: data.city as string ?? '',
          biografija: data.bio as string ?? '', vestine: data.skills as string[], alati: data.tools as string[], vozila: data.vehicles as string[],
          stanje: data.profile_status as 'DRAFT' | 'ACTIVE' | 'SUSPENDED', dostupanOdmah: data.available_now, radijusKm: data.radius_km,
          kapacitetTima: data.team_capacity as number, capacityRevision: data.capacity_revision as string } };
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
