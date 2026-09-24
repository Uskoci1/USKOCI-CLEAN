import { atLeast, dateRange, type DateRange, type MarketplaceView, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { civilDay, weekLabel } from '../../calendar/calendarPresentation';
import { plural, zadataka } from '../../system/plural';

/**
 * The words of the Zadaci search (Discovery V47), in one place: the search pill, the quick chips, the steps of the search
 * panel and the chips under the list's count all say a choice the same way. Every set starts with its "everything"
 * choice, so the default always sits in the same place. The work-mode and price words are the ones the app already says
 * (review of V47): "Tražim ponude" and "Na daljinu" as a task itself says them, "Navedena cena" as the Moji zadaci price
 * filter says it, "Bilo gde" / "Na licu mesta" as the Zadaci filter sheet before V47 said them; never new names.
 */
export const WHEN: readonly (readonly [WhenFilter, string])[] = [['any', 'Bilo kada'], ['today', 'Danas'], ['tomorrow', 'Sutra'],
  ['week', 'Ove nedelje'], ['weekend', 'Ovaj vikend'], ['next7', 'Narednih 7 dana']];
/** The time choices a quick chip over the map toggles; the rest are in the panel's Kada step. */
export const QUICK_WHEN: readonly WhenFilter[] = ['today', 'tomorrow', 'week'];
export const WHERE: readonly (readonly [WhereFilter, string])[] = [['any', 'Bilo gde'], ['onsite', 'Na licu mesta'], ['remote', 'Na daljinu']];
export const PRICE: readonly (readonly [MarketplaceView['price'], string])[] = [['all', 'Sve'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']];
/** The one reset of the search, on the panel and on the empty list alike. */
export const CLEAR_ALL = 'Obriši uslove';
/** What removes one condition that is on (a chip under the count). */
export const removeWords = (label: string) => `Ukloni uslov: ${label}`;
/** Where the list is narrowed to one public point (a place's "Prikaži sve u listi"). */
export const PIN_PLACE = 'Na ovom mestu';

/** The words of one choice of a set, or '' for a value the set does not have. */
export function said<K extends string>(options: readonly (readonly [K, string])[], key: K | undefined): string {
  return options.find(([value]) => value === key)?.[1] ?? '';
}

/** "Koliko vas dolazi": "2+ mesta" for at least two places, "Bilo koliko" for every open task. */
export const placesWords = (places: number | undefined) => atLeast(places) > 1 ? `${atLeast(places)}+ mesta` : 'Bilo koliko';

/** A chosen range of days: "26. sep" for one day, "26–28. sep" inside a month, "30. sep – 2. okt" across two. */
export function datesWords(range: DateRange, now: Date = new Date()): string {
  return range.from === range.to ? civilDay(range.from, now) : weekLabel([range.from, range.to], now);
}

/** Kada in words: the chosen days, or the flexible choice ("Bilo kada" when nothing is chosen). */
export function whenWords(view: Pick<MarketplaceView, 'when' | 'dates'>, now: Date = new Date()): string {
  const dates = dateRange(view.dates);
  return dates ? datesWords(dates, now) : said(WHEN, view.when ?? 'any') || 'Bilo kada';
}

/** A searched word as it is shown back: in Serbian quotation marks, so it never reads as a place. */
export const quoted = (text: string) => `„${text.trim()}“`;

/**
 * Line 1 of the search pill, and the value of the "Gde" step: one public point (a place's whole set, "Na ovom mestu"),
 * the chosen place (with the searched words, when there are both), the searched words, the map's area, or "Svi zadaci".
 */
export function whereWords(view: Pick<MarketplaceView, 'place' | 'query' | 'area' | 'pinPlace'>): string {
  const place = typeof view.place === 'string' ? view.place.trim() : '', query = view.query.trim();
  const where = view.pinPlace ? PIN_PLACE : place;
  if (where) return query ? `${where} · ${quoted(query)}` : where;
  if (query) return quoted(query);
  return view.area ? 'Oblast sa mape' : 'Svi zadaci';
}

/**
 * Line 2 of the search pill: when, then the other conditions that are on ("Ovaj vikend · 2+ mesta"), or an invitation to
 * add some when none is ("Bilo kada · Dodaj uslove").
 */
export function conditionsWords(view: MarketplaceView, now: Date = new Date()): string {
  const extras = [(view.where ?? 'any') !== 'any' ? said(WHERE, view.where) : '', atLeast(view.places) > 1 ? placesWords(view.places) : '',
    view.price !== 'all' ? said(PRICE, view.price) : ''].filter(Boolean);
  return [whenWords(view, now), ...(extras.length ? extras : ['Dodaj uslove'])].join(' · ');
}

/** Tasks a time choice leaves out because they name no day: said, never hidden silently. */
export const undatedWords = (count: number) => plural(count, 'zadatak bez datuma nije u ovom izboru.',
  'zadatka bez datuma nisu u ovom izboru.', 'zadataka bez datuma nije u ovom izboru.');

/**
 * The list sheet's top line, never blank (Discovery V47 review): while the list is read (or while it is still read which
 * tasks are mine) it says so; a read that failed says so; nothing found is "Nema zadataka" (the empty list under it says
 * why, in its own words). Otherwise one format, every count through the plural: the tasks listed, then apart and quieter
 * (`extra`) the tasks the map cannot show — "12 zadataka · 3 zadatka bez tačke na mapi", under an area
 * "2 zadatka u oblasti · 2 zadatka bez tačke na mapi" or "U oblasti nema zadataka", on one point "4 zadatka na ovom mestu".
 */
export function countLineWords({ status, listed, inArea, withoutPoint, pinless, area, pinPlace }: {
  status: 'loading' | 'error' | 'ready'; listed: number; inArea: number; withoutPoint: number;
  /** Without an area: how many of the listed tasks have no point on the map. */ pinless: number;
  area: boolean; pinPlace: boolean;
}): { words: string; extra: string } {
  if (status === 'loading') return { words: 'Učitavamo zadatke…', extra: '' };
  if (status === 'error') return { words: 'Zadaci nisu učitani', extra: '' };
  const without = (count: number) => count ? ` · ${zadataka(count)} bez tačke na mapi` : '';
  if (pinPlace) return { words: listed ? `${zadataka(listed)} na ovom mestu` : 'Nema zadataka', extra: '' };
  if (area) return { words: inArea ? `${zadataka(inArea)} u oblasti` : 'U oblasti nema zadataka', extra: without(withoutPoint) };
  return listed ? { words: zadataka(listed), extra: without(pinless) } : { words: 'Nema zadataka', extra: '' };
}
