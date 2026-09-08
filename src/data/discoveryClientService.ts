import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrilikeCursor, PrilikeStranaUpit } from '../contracts/discovery';
import type { JavniProfilProjekcija, PrilikaProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import { publicProfileClientService } from './publicProfileClientService';
import { supabaseKlijent } from './supabaseClient';
import { publicTaskMaterial } from './publicTaskDetailProjection';
import { discoveryArea, discoverySchedule } from './discoveryFormat';

// Only authenticated public Need fields. Never add account IDs, sensitive rows,
// exact addresses, private terms or raw profiles to the discovery projection.
const PUBLIC_NEED_FIELDS = [
  'id', 'title', 'status', 'created_at', 'starts_at', 'ends_at', 'schedule_kind',
  'execution_location_mode', 'approximate_area', 'approximate_city', 'approximate_lat', 'approximate_lng',
  'required_slots', 'required_skills', 'required_tools', 'required_vehicles', 'covered_slots',
  'mode', 'requester_price_rsd', 'requester_profile_id', 'response_deadline',
].join(',');
// Default LEFT embeds keep readable terminal parents when child policies filter material.
const PUBLIC_DETAIL_FIELDS = [PUBLIC_NEED_FIELDS, 'revision', 'description', 'category', 'required_licenses',
  'minimum_experience_years', 'verified_identity_required',
  'geography:need_geography(need_id,public_topology)',
  'requirementDetails:need_requirement_details(need_id,critical_conditions)',
].join(',');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES = ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE'];
const SCHEDULES = ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'];
type Service = Pick<Izvor, 'otvorenePrilike' | 'otvorenePrilikeStrana' | 'prilika' | 'detaljiPrilike'>;
type Row = Record<string, any>;

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || match[0].length !== value.length) return false;
  const [, year, month, day, hour, minute, second, , zoneHour, zoneMinute] = match;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= days
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && Number(zoneHour || 0) <= 23 && Number(zoneMinute || 0) <= 59 && Number.isFinite(Date.parse(value));
}

function cancelled(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error('DISCOVERY_READ_CANCELLED');
  error.name = 'AbortError';
  throw error;
}

/** The public-profile port has no signal; stop waiting without resending or publishing its late result. */
function waitForProfile<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { try { cancelled(signal); } catch (error) { reject(error); } };
    signal.addEventListener('abort', abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

function cursor(value: PrilikeCursor): PrilikeCursor {
  if (!value || !timestamp(value.createdAt) || typeof value.id !== 'string' || value.id.length !== 36 || !UUID.test(value.id)) {
    throw new Error('DISCOVERY_CURSOR_INVALID');
  }
  // Preserve microseconds. Date.toISOString would lose part of the ordering key.
  return { createdAt: value.createdAt, id: value.id };
}

function mapNeed(raw: unknown): PrilikaProjekcija {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
  const r = raw as Row;
  if (typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || !r.title
    || typeof r.requester_profile_id !== 'string' || !r.requester_profile_id
    || typeof r.status !== 'string' || typeof r.approximate_city !== 'string' || typeof r.approximate_area !== 'string'
    || !MODES.includes(r.execution_location_mode) || !SCHEDULES.includes(r.schedule_kind)
    || !['required_skills', 'required_tools', 'required_vehicles'].every(key =>
      Array.isArray(r[key]) && r[key].every((value: unknown) => typeof value === 'string'))) {
    throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
  }
  if (!Number.isSafeInteger(r.required_slots) || r.required_slots < 1 || r.required_slots > 50
    || !Number.isSafeInteger(r.covered_slots) || r.covered_slots < 0) throw new Error('TASK_CAPACITY_INVALID');
  if (r.response_deadline !== null && !timestamp(r.response_deadline)) throw new Error('TASK_DEADLINE_INVALID');
  if ((r.starts_at !== null && !timestamp(r.starts_at)) || (r.ends_at !== null && !timestamp(r.ends_at))) {
    throw new Error('TASK_SCHEDULE_INVALID');
  }
  const hasPoint = typeof r.approximate_lat === 'number' && Number.isFinite(r.approximate_lat)
    && Math.abs(r.approximate_lat) <= 90 && typeof r.approximate_lng === 'number'
    && Number.isFinite(r.approximate_lng) && Math.abs(r.approximate_lng) <= 180;
  const open = ['PUBLISHED', 'SELECTION'].includes(r.status);
  return {
    id: r.id, naslov: r.title, statusTekst: open ? 'Objavljen zadatak' : 'Prijave zatvorene',
    primaNovePrijave: open && r.required_slots > r.covered_slots
      && (r.response_deadline === null || Date.parse(r.response_deadline) > Date.now()),
    rokZaPrijaveIso: r.response_deadline,
    executionLocationMode: r.execution_location_mode, scheduleKind: r.schedule_kind,
    startsAt: r.starts_at, endsAt: r.ends_at, grad: r.approximate_city,
    podrucjeTekst: discoveryArea(r.execution_location_mode, r.approximate_area, r.approximate_city),
    vremeTekst: discoverySchedule(r.schedule_kind, r.starts_at, r.ends_at),
    pokrivenost: { ukupno: r.required_slots, popunjeno: r.covered_slots,
      preostalo: Math.max(0, r.required_slots - r.covered_slots), udeo: Math.min(1, r.covered_slots / r.required_slots) },
    uslovi: [...r.required_skills, ...r.required_tools, ...r.required_vehicles],
    narucilacProfilId: r.requester_profile_id, narucilacIme: '', narucilacOcena: null,
    // The same approximate anchor denotes origin/first stop/centroid according
    // to executionLocationMode. It is not a route or an exact-location grant.
    priblizno: hasPoint && r.execution_location_mode !== 'REMOTE'
      ? { lat: r.approximate_lat, lng: r.approximate_lng } : null,
    rezimCene: ['MY_PRICE', 'OFFERS'].includes(r.mode) ? r.mode : undefined,
    ponudjenaCena: Number.isSafeInteger(r.requester_price_rsd) && r.requester_price_rsd > 0
      ? { iznos: r.requester_price_rsd, valuta: 'RSD', prikaz: `${r.requester_price_rsd.toLocaleString('sr-Latn-RS')} RSD` }
      : undefined,
  };
}

/** Narrow read adapter; RLS and command RPCs retain all business authority. */
export function createDiscoveryClientService(deps: {
  client: () => Pick<SupabaseClient, 'from'>;
  publicProfile: (id: string) => Promise<JavniProfilProjekcija | null>;
}): Service {
  async function project(data: unknown, signal?: AbortSignal) {
    cancelled(signal);
    if (!Array.isArray(data)) throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
    // Validate the whole page before issuing optional profile enrichment reads.
    const items = data.map(mapNeed);
    const ids = [...new Set(items.map(item => item.narucilacProfilId))];
    const profiles = new Map<string, JavniProfilProjekcija | null>();
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (next < ids.length) {
        cancelled(signal);
        const id = ids[next++];
        let profile: JavniProfilProjekcija | null = null;
        try { profile = await waitForProfile(deps.publicProfile(id), signal); } catch { /* Optional public trust remains unavailable. */ }
        cancelled(signal);
        profiles.set(id, profile?.profilId === id ? profile : null);
      }
    }));
    cancelled(signal);
    return items.map(item => {
      const profile = profiles.get(item.narucilacProfilId);
      const rating = profile?.poverenje.ocenaDostupna ? profile.poverenje.ocenaProsek : null;
      return { ...item, narucilacIme: profile?.ime ?? '',
        narucilacOcena: typeof rating === 'number' && Number.isFinite(rating)
          ? rating.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null,
        // A deadline may pass while optional profile reads are pending.
        primaNovePrijave: item.primaNovePrijave && (item.rokZaPrijaveIso === null
          || Date.parse(item.rokZaPrijaveIso!) > Date.now()),
      };
    });
  }

  return {
    async otvorenePrilike() {
      const { data, error } = await deps.client().from('needs').select(PUBLIC_NEED_FIELDS)
        .in('status', ['PUBLISHED', 'SELECTION']).order('created_at', { ascending: false });
      if (error) throw error;
      return project(data);
    },
    async otvorenePrilikeStrana(upit: PrilikeStranaUpit = {}) {
      const limit = upit.limit ?? 30;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('DISCOVERY_LIMIT_INVALID');
      const after = upit.cursor === undefined ? null : cursor(upit.cursor);
      const signal = upit.signal;
      cancelled(signal);
      let query = deps.client().from('needs').select(PUBLIC_NEED_FIELDS).in('status', ['PUBLISHED', 'SELECTION']);
      if (after) query = query.or(`created_at.lt.${after.createdAt},and(created_at.eq.${after.createdAt},id.lt.${after.id})`);
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      cancelled(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > limit + 1) throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
      // Validate cursor material even on a final page; never emit an unsafe next key.
      const keys = (data as unknown[]).map(raw => {
        const row = raw as Row | null;
        return cursor({ createdAt: row?.created_at, id: row?.id });
      });
      if (new Set(keys.map(key => key.id)).size !== keys.length) throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
      const items = await project(data.slice(0, limit), signal);
      return { items, nextCursor: data.length > limit ? keys[limit - 1] : null };
    },
    async prilika(id) {
      if (!id.trim()) return null;
      const { data, error } = await deps.client().from('needs').select(PUBLIC_NEED_FIELDS).eq('id', id).maybeSingle();
      if (error) throw error;
      if (data === null) return null;
      return (await project([data]))[0];
    },
    async detaljiPrilike(id, opcije = {}) {
      const signal = opcije.signal;
      cancelled(signal);
      if (typeof id !== 'string' || id.length !== 36 || !UUID.test(id)) throw new Error('PUBLIC_TASK_ID_INVALID');
      let query = deps.client().from('needs').select(PUBLIC_DETAIL_FIELDS).eq('id', id.toLowerCase());
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query.maybeSingle();
      cancelled(signal);
      if (error) throw error;
      if (data === null) return null;
      // Validate material before optional public-profile reads. No material is cached or merged across reads.
      const material = publicTaskMaterial(data, id.toLowerCase());
      return { ...(await project([data], signal))[0], ...material };
    },
  };
}

export const discoveryClientService = createDiscoveryClientService({
  client: supabaseKlijent, publicProfile: id => publicProfileClientService.javniProfil(id),
});
