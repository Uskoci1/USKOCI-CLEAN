import type { PotrebaProjekcija, PrilikaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { shiftDate, zonedParts } from '../ui/calendar/calendarPresentation';
export type MarketplaceItem = PotrebaProjekcija | PrilikaProjekcija;
export type PublicBounds = [west: number, south: number, east: number, north: number];
export type PublicViewport = { center: [number, number]; zoom: number; bounds: PublicBounds };
/** Kada: the day the work can be done, read from the task's own schedule in the task's own zone. */
export type WhenFilter = 'any' | 'today' | 'tomorrow' | 'week';
/** Gde se radi: on the spot or remotely, from the task's own location mode. */
export type WhereFilter = 'any' | 'onsite' | 'remote';
/** Slobodna mesta: any, or at least two places still open. */
export type PlacesFilter = 'any' | 'two';
export type MarketplaceView = { query: string; section: 'active' | 'drafts' | 'history' | 'all'; attention: boolean;
  price: 'all' | 'MY_PRICE' | 'OFFERS'; mode: 'list' | 'map'; area: PublicBounds | null; viewport: PublicViewport | null; selectedId: string | null;
  /** Zadaci filters (2026-09-24). Absent means 'any': a view written before them filters exactly as it did. */
  when?: WhenFilter; where?: WhereFilter; places?: PlacesFilter;
  /** A chosen place on the map where several tasks share one public point (its `pointKey`); null when none. */
  selectedPlace?: string | null };
export const initialMarketplaceView = (): MarketplaceView => ({ query: '', section: 'active', attention: false,
  price: 'all', mode: 'list', area: null, viewport: null, selectedId: null, when: 'any', where: 'any', places: 'any', selectedPlace: null });
export const isOwnedNeed = (item: MarketplaceItem): item is PotrebaProjekcija => 'stanje' in item;
/** Only the existing public approximation is admitted. This never reads private pins or asks for GPS. */
export function publicPoint(item: MarketplaceItem): { lat: number; lng: number } | null {
  if (item.detalji?.rezimLokacije === 'REMOTE') return null;
  if (!('priblizno' in item)) return null;
  const point = item.priblizno;
  return point && typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
    && typeof point.lng === 'number' && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180
    ? { lat: Number(point.lat.toFixed(2)), lng: Number(point.lng.toFixed(2)) } : null;
}
export function publicBounds(raw: unknown): PublicBounds | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(value => typeof value === 'number' && Number.isFinite(value))) return null;
  const [west, south, east, north] = raw;
  return Math.abs(west) <= 180 && Math.abs(east) <= 180 && south >= -90 && north <= 90 && south <= north
    ? [west, south, east, north] : null;
}
export function publicViewport(raw: unknown): PublicViewport | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PublicViewport>, bounds = publicBounds(value.bounds);
  return bounds && Array.isArray(value.center) && value.center.length === 2 && value.center.every(Number.isFinite)
    && Math.abs(value.center[0]) <= 180 && Math.abs(value.center[1]) <= 90 && typeof value.zoom === 'number'
    && Number.isFinite(value.zoom) && value.zoom >= 0 && value.zoom <= 24
    ? { center: [value.center[0], value.center[1]], zoom: value.zoom, bounds } : null;
}
export function hasNeedAttention(item: PotrebaProjekcija): boolean {
  return item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA' && item.pokrivenost.preostalo > 0 && (item.brojPrijavaZaIzbor ?? 0) > 0;
}
/**
 * One presentation subset of one existing read. No matching/eligibility/ranking authority. `now` is read only by the
 * Kada filter; a view without the Zadaci filters never looks at it.
 */
export function marketplaceItems(items: readonly MarketplaceItem[], view: MarketplaceView, owned: boolean, now: Date = new Date()): MarketplaceItem[] {
  const query = view.query.trim().toLocaleLowerCase('sr-Latn-RS');
  const when = view.when ?? 'any', where = view.where ?? 'any', places = view.places ?? 'any';
  return items.filter(item => {
    if (when !== 'any' && !happensIn(item, when, now)) return false;
    if (where !== 'any' && workMode(item) !== where) return false;
    if (places === 'two' && !((item.pokrivenost?.preostalo ?? 0) >= 2)) return false;
    if (owned) {
      if (!isOwnedNeed(item)) return false;
      if (view.section === 'drafts' && item.stanje !== 'NACRT' || view.section === 'history' && item.stanje !== 'ZATVORENA'
        || view.section === 'active' && (item.stanje === 'NACRT' || item.stanje === 'ZATVORENA')) return false;
      if (view.attention && !hasNeedAttention(item)) return false;
    }
    if (view.price !== 'all' && item.rezimCene !== view.price) return false;
    if (query && ![item.naslov, item.podrucjeTekst, ...item.uslovi].join(' ').toLocaleLowerCase('sr-Latn-RS').includes(query)) return false;
    if (view.area) {
      const point = publicPoint(item); if (!point) return false;
      const [west, south, east, north] = view.area;
      if (point.lat < south || point.lat > north || (west <= east ? point.lng < west || point.lng > east : point.lng < west && point.lng > east)) return false;
    }
    return true;
  });
}
/**
 * How many of my own tasks each set of "Moji zadaci" holds, and how many of the active ones wait for my choice among
 * applications. The list's own filter decides each set, so Početna's "Moji zadaci" row and the screen it opens can
 * never count differently (owner's information architecture, 2026-09-23).
 */
export type OwnedTaskCounts = { total: number; active: number; waiting: number; drafts: number; history: number };
export function ownedTaskCounts(items: readonly MarketplaceItem[]): OwnedTaskCounts {
  const count = (section: MarketplaceView['section']) => marketplaceItems(items, { ...initialMarketplaceView(), section }, true).length;
  return { total: count('all'), active: count('active'), drafts: count('drafts'), history: count('history'),
    waiting: items.filter(item => isOwnedNeed(item) && hasNeedAttention(item)).length };
}
/** IDs and rounded public points only; no titles, accounts, exact locations or other properties enter the map SDK. */
export function publicFeatures(items: readonly MarketplaceItem[]): GeoJSON.FeatureCollection<GeoJSON.Point, { needId: string }> {
  return { type: 'FeatureCollection', features: items.flatMap(item => {
    const point = publicPoint(item);
    return point ? [{ type: 'Feature' as const, id: item.id, properties: { needId: item.id }, geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] } }] : [];
  }) };
}
export function publicInitialBounds(items: readonly MarketplaceItem[]): PublicBounds | null {
  const points = items.flatMap(item => { const value = publicPoint(item); return value ? [value] : []; });
  if (!points.length) return null;
  return [Math.max(-180, Math.min(...points.map(point => point.lng)) - 0.02), Math.max(-85, Math.min(84.98, Math.min(...points.map(point => point.lat)) - 0.02)),
    Math.min(180, Math.max(...points.map(point => point.lng)) + 0.02), Math.min(85, Math.max(-84.98, Math.max(...points.map(point => point.lat)) + 0.02))];
}

/* ------------------------------------------------------------------------------------------- Zadaci (2026-09-24) */

/** How the task is done, from its own location mode; null when the task does not say. */
export function workMode(item: MarketplaceItem): 'onsite' | 'remote' | null {
  const mode = item.detalji?.rezimLokacije;
  return mode === 'REMOTE' ? 'remote' : typeof mode === 'string' && mode ? 'onsite' : null;
}
/** Whether any of these tasks says how it is done, so "Gde se radi" has something to choose from. */
export const saysWorkMode = (items: readonly MarketplaceItem[]) => items.some(item => workMode(item) !== null);

/** The civil day an instant falls on in `zone`; an end at exactly midnight belongs to the day before it. */
function civilDay(value: string | null | undefined, zone: string, end: boolean): string | null {
  const exact = calendarInstant(value);
  if (exact === null) return null;
  const ms = Number(exact >= 0n ? exact / 1000n : (exact - 999n) / 1000n);
  try {
    const parts = zonedParts(new Date(ms), zone);
    return end && parts.time === '00:00:00' ? zonedParts(new Date(ms - 1), zone).date : parts.date;
  } catch { return null; }
}
const FIRST_DAY = '0000-01-01', LAST_DAY = '9999-12-31';
/**
 * The days a task can be done on, in its own zone, as an inclusive [first, last] pair of civil dates; null when its
 * schedule does not say. A saved window or range is read as it is. Without dates, "danas / sutra / ove nedelje" mean
 * what the card says they mean, and a task that is flexible or remote at any time can be done on any day. A fixed
 * window without its start is incomplete ("Tačan termin nije potpun") and matches no particular day.
 */
function workDays(item: MarketplaceItem, now: Date): [string, string] | null {
  const schedule = item.schedule;
  if (!schedule) return null;
  const zone = item.taskTimezone ?? 'UTC';
  const first = civilDay(schedule.startsAt, zone, false), last = civilDay(schedule.endsAt, zone, true);
  if (first) return [first, last && last >= first ? last : first];
  if (last) return schedule.kind === 'FIXED_WINDOW' ? null : [FIRST_DAY, last];
  let today: string;
  try { today = zonedParts(now, zone).date; } catch { return null; }
  switch (schedule.kind) {
    case 'TODAY_FLEXIBLE': return [today, today];
    case 'TOMORROW_FLEXIBLE': return [shiftDate(today, 1), shiftDate(today, 1)];
    case 'WEEK_FLEXIBLE': return [today, weekEnd(today)];
    case 'FLEXIBLE': case 'REMOTE_ANYTIME': return [FIRST_DAY, LAST_DAY];
    default: return null;
  }
}
/** Sunday of the week `day` is in (the Serbian week runs Monday to Sunday). */
function weekEnd(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDate(day, (7 - weekday) % 7);
}
/** Whether the task can be done on the chosen day(s), each read in the task's own zone. */
export function happensIn(item: MarketplaceItem, when: WhenFilter, now: Date = new Date()): boolean {
  if (when === 'any') return true;
  const days = workDays(item, now);
  if (!days) return false;
  let today: string;
  try { today = zonedParts(now, item.taskTimezone ?? 'UTC').date; } catch { return false; }
  const [from, to] = when === 'today' ? [today, today] : when === 'tomorrow' ? [shiftDate(today, 1), shiftDate(today, 1)] : [today, weekEnd(today)];
  return days[0] <= to && days[1] >= from;
}

/** The Zadaci list: the filtered subset, without the tasks that are mine (they live under Početna, "Moji zadaci"). */
export function discoveryItems(items: readonly MarketplaceItem[], view: MarketplaceView, mine: ReadonlySet<string> | undefined,
  now: Date = new Date()): MarketplaceItem[] {
  const shown = marketplaceItems(items, view, false, now);
  return mine?.size ? shown.filter(item => !mine.has(item.id)) : shown;
}
/** Whether the Zadaci filters (price and the three sections of the filter sheet) differ from "everything". */
export function discoveryFiltered(view: MarketplaceView): boolean {
  return view.price !== 'all' || (view.when ?? 'any') !== 'any' || (view.where ?? 'any') !== 'any' || (view.places ?? 'any') !== 'any';
}

/** Where the list sheet starts: the map when most tasks are on it, the list when many are not or there are few. */
export type DiscoverySnap = 'peek' | 'half' | 'full';
/**
 * Half when at least half of the shown tasks have no pin, or when three or fewer are shown; otherwise peek. When none
 * of them has a pin the map has nothing to show at all, so the list takes the screen (the same rule taken to its end).
 */
export function discoveryStartSnap(shown: number, withoutPin: number): DiscoverySnap {
  if (shown > 0 && withoutPin >= shown) return 'full';
  return shown <= 3 || withoutPin * 2 >= shown ? 'half' : 'peek';
}

/** One public point, as the map draws it: the rounded coarse point (~1 km) is the key. */
export const pointKey = (point: { lat: number; lng: number }) => `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
export type PinPlace = { key: string; point: { lat: number; lng: number }; ids: string[] };
/**
 * Tasks grouped by their public point. Several tasks rounded to one point sit exactly on top of each other on the map,
 * so only the top one could be pressed; as a place they are reachable together. Order follows the list.
 */
export function pinPlaces(items: readonly MarketplaceItem[]): Map<string, PinPlace> {
  const places = new Map<string, PinPlace>();
  for (const item of items) {
    const point = publicPoint(item);
    if (!point) continue;
    const key = pointKey(point), place = places.get(key);
    if (place) place.ids.push(item.id); else places.set(key, { key, point, ids: [item.id] });
  }
  return places;
}

/**
 * What a pin says. An amount is money exactly as the read formatted it ("6.000 RSD", "120.000 RSD"): an amount never
 * loses its currency, whatever its length (the `Novac` contract: `prikaz` is already formatted and never a bare number);
 * the pill is as wide as its words. A task that asks for offers says so in a quiet word that never wears the money
 * colour or weight; a missing price says nothing on the pin and says why to a screen reader. Never an invented amount.
 */
export type PinLabel = { text: string; tone: 'money' | 'offer' | 'none'; spoken: string };
export function pinLabel(item: MarketplaceItem): PinLabel {
  if (item.rezimCene === 'OFFERS') return { text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' };
  const price = item.ponudjenaCena, full = typeof price?.prikaz === 'string' ? price.prikaz.trim() : '';
  if (!price || !full) return { text: '', tone: 'none', spoken: 'Cena nije navedena' };
  return { text: full, tone: 'money', spoken: full };
}
