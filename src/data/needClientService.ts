import type { PotrebaProjekcija, StanjePotrebe } from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';
import { needDisplayProjection } from './needDisplayProjection';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type NeedReadService = Pick<Izvor, 'mojePotrebe' | 'potreba'>;

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

function mapNeed(raw: any): PotrebaProjekcija {
  if (!Number.isSafeInteger(raw.required_slots) || raw.required_slots < 1 ||
    !Number.isSafeInteger(raw.covered_slots) || raw.covered_slots < 0 || raw.covered_slots > raw.required_slots) throw new Error('NEED_CAPACITY_INVALID');
  const ukupno = raw.required_slots;
  const popunjeno = raw.covered_slots;
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
    ...needDisplayProjection(raw),
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
  approximate_area, approximate_city,
  required_slots, required_skills, required_tools, required_vehicles,
  required_licenses, minimum_experience_years, verified_identity_required, public_photo_paths,
  execution_location_mode, need_geography(public_topology), need_requirement_details(critical_conditions),
  covered_slots, mode, requester_price_rsd,
  marketplace_responses(id)
`;

/**
 * Canonical production client boundary for Need read operations.
 * Database authority remains in live RLS. This service reads persisted public
 * task fields, including the full public route and schedule, and maps them to
 * the Izvor projection contract without inventing missing fact values.
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
