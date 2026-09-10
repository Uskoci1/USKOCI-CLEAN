import type { NeedDetailProjection, NeedScheduleProjection, PotrebaProjekcija, StanjePotrebe } from '../contracts/projections';
import type { Izvor } from './ports';
import { capabilityTerms } from '../lib/capabilityTerms';
import { calendarInstant } from '../lib/calendarTime';
import { countryCode, timeZone } from '../lib/market';
import { normalizeTaskGeography } from '../lib/location';
import { needScheduleText } from './needDetailPresentation';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type NeedReadService = Pick<Izvor, 'mojePotrebe' | 'potreba'>;

function podrucje(area: string | null | undefined, city: string | null | undefined) {
  return [area, city].filter(Boolean).join(', ') || 'Lokacija nije navedena';
}

function stanje(
  raw: string,
  popunjeno: number,
  ukupno: number,
  brojPrijava: number,
): StanjePotrebe {
  switch (raw) {
    case 'DRAFT':
      return 'NACRT';
    case 'PUBLISHED':
      return brojPrijava > 0 ? 'CEKA_PRIJAVE' : 'OBJAVLJENA';
    case 'SELECTION':
      if (popunjeno >= ukupno) return 'POPUNJENA';
      return popunjeno > 0 ? 'DELIMICNO_POPUNJENA' : 'CEKA_PRIJAVE';
    case 'ACTIVE':
      return 'POPUNJENA';
    case 'COMPLETED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'ARCHIVED':
      return 'ZATVORENA';
    default:
      throw new Error(`NEED_STATUS_UNSUPPORTED:${raw}`);
  }
}

function detail(raw: Record<string, any>): { detail: NeedDetailProjection; schedule: NeedScheduleProjection } {
  const invalid = (): never => { throw new Error('NEED_DETAIL_INVALID_PROJECTION'); };
  const array = (value: unknown): string[] => capabilityTerms(value) ?? invalid();
  const nullableDate = (value: unknown): string | null => value === null ? null
    : typeof value === 'string' && calendarInstant(value) !== null ? value : invalid();
  const relation = (value: unknown): Record<string, unknown> | null => value === null ? null
    : value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
  const geographyRow = relation(raw.need_geography), conditions = relation(raw.need_requirement_details);
  const topology = geographyRow ? relation(geographyRow.public_topology) ?? invalid() : null;
  const normalizedGeography = topology ? normalizeTaskGeography(topology) : null;
  // Historical rows predate current normalized topology and may have no witness.
  // Keep the Need readable; never invent or display an incompatible topology.
  const geography = normalizedGeography?.mode === raw.execution_location_mode ? normalizedGeography : null;
  const category = typeof raw.category === 'string' ? raw.category.replace(/^ +| +$/g, '') : null;
  const kinds = ['FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE'];
  const modes = ['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE'];
  if (category === null || Array.from(category).length < 1 || Array.from(category).length > 120
    || !kinds.includes(raw.schedule_kind) || (raw.execution_location_mode !== null && !modes.includes(raw.execution_location_mode))
    || typeof raw.verified_identity_required !== 'boolean'
    || (raw.minimum_experience_years !== null && (!Number.isInteger(raw.minimum_experience_years) || raw.minimum_experience_years < 0))
    || (raw.task_country_code !== null && countryCode(raw.task_country_code) !== raw.task_country_code)
    || (raw.task_timezone !== null && !timeZone(raw.task_timezone))) invalid();
  const od = nullableDate(raw.starts_at), end = nullableDate(raw.ends_at);
  if (od && end && calendarInstant(od)! >= calendarInstant(end)!) invalid();
  return { schedule: { kind: raw.schedule_kind, startsAt: od, endsAt: end },
    detail: { kategorija: raw.category, geografija: geography, rezimLokacije: raw.execution_location_mode,
    zahtevi: { vestine: array(raw.required_skills), alati: array(raw.required_tools), vozila: array(raw.required_vehicles),
      dozvole: array(raw.required_licenses), bitniUslovi: conditions ? array(conditions.critical_conditions) : null,
      iskustvoGodina: raw.minimum_experience_years, potvrdjenIdentitet: raw.verified_identity_required } } };
}

function mapNeed(raw: any): PotrebaProjekcija {
  const { detail: detalji, schedule } = detail(raw);
  const ukupno = Math.max(1, Number(raw.required_slots ?? 1));
  const popunjeno = Math.max(0, Math.min(ukupno, Number(raw.covered_slots ?? 0)));
  const brojPrijava = Array.isArray(raw.marketplace_responses)
    ? raw.marketplace_responses.length
    : 0;
  const cena = raw.requester_price_rsd;
  const mode = raw.mode === 'MY_PRICE' || raw.mode === 'OFFERS' ? raw.mode : undefined;

  return {
    id: raw.id,
    revizija: Number(raw.revision),
    naslov: raw.title ?? '',
    opis: raw.description ?? '',
    stanje: stanje(String(raw.status), popunjeno, ukupno, brojPrijava),
    pokrivenost: {
      ukupno,
      popunjeno,
      preostalo: Math.max(0, ukupno - popunjeno),
      udeo: ukupno > 0 ? popunjeno / ukupno : 0,
    },
    vremeTekst: needScheduleText(schedule, raw.task_timezone ?? undefined),
    taskCountryCode: raw.task_country_code ?? undefined, taskTimezone: raw.task_timezone ?? undefined,
    schedule,
    detalji,
    podrucjeTekst: detalji.rezimLokacije === 'REMOTE' ? 'Na daljinu' : podrucje(raw.approximate_area, raw.approximate_city),
    uslovi: [
      ...(raw.required_skills ?? []),
      ...(raw.required_tools ?? []),
      ...(raw.required_vehicles ?? []),
    ],
    brojPrijava,
    rezimCene: mode,
    ponudjenaCena:
      cena === null || cena === undefined
        ? undefined
        : {
            iznos: Number(cena),
            valuta: 'RSD',
            prikaz: `${Number(cena).toLocaleString('sr-Latn-RS')} RSD`,
          },
  };
}

const NEED_SELECT = `
  id, revision, title, description, category, status, schedule_kind, starts_at, ends_at,
  task_country_code, task_timezone, execution_location_mode,
  approximate_area, approximate_city,
  required_slots, required_skills, required_tools, required_vehicles, required_licenses,
  minimum_experience_years, verified_identity_required,
  covered_slots, mode, requester_price_rsd,
  marketplace_responses(id), need_geography(public_topology), need_requirement_details(critical_conditions)
`;

/**
 * Canonical production client boundary for Need read operations.
 * Existing RLS owns access. Public topology/requirements are embedded in the same
 * Need query, so detail review never joins a second revision or private location.
 * Publication still uses its separate context/decision/command authority.
 */
export const needClientService: NeedReadService = {
  async mojePotrebe() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message || 'AUTH_READ_FAILED');
    if (!authData.user) throw new Error('AUTH_REQUIRED');

    const { data, error } = await supabase
      .from('needs')
      .select(NEED_SELECT)
      .eq('requester_account_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message || 'NEED_LIST_FAILED');
    if (!Array.isArray(data)) throw new Error('NEED_LIST_INVALID_PROJECTION');
    return data.map(mapNeed);
  },

  async potreba(id) {
    const needId = id.trim();
    if (!needId) return null;

    const { data, error } = await supabase
      .from('needs')
      .select(NEED_SELECT)
      .eq('id', needId)
      .maybeSingle();

    if (error) throw new Error(error.message || 'NEED_READ_FAILED');
    return data ? mapNeed(data) : null;
  },
};
