import { atLeast, dateRange, type DateRange, type MarketplaceView, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { civilDay, weekLabel } from '../../calendar/calendarPresentation';
import { plural } from '../../system/plural';

/**
 * The words of the Zadaci search (Discovery V47), in one place: the search pill, the quick chips, the steps of the search
 * panel and the chips under the list's count all say a choice the same way. Every set starts with its "everything"
 * choice, so the default always sits in the same place.
 */
export const WHEN: readonly (readonly [WhenFilter, string])[] = [['any', 'Bilo kada'], ['today', 'Danas'], ['tomorrow', 'Sutra'],
  ['week', 'Ove nedelje'], ['weekend', 'Ovaj vikend'], ['next7', 'Narednih 7 dana']];
/** The time choices a quick chip over the map toggles; the rest are in the panel's Kada step. */
export const QUICK_WHEN: readonly WhenFilter[] = ['today', 'tomorrow', 'week'];
export const WHERE: readonly (readonly [WhereFilter, string])[] = [['any', 'Sve'], ['onsite', 'Na lokaciji'], ['remote', 'Onlajn']];
export const PRICE: readonly (readonly [MarketplaceView['price'], string])[] = [['all', 'Sve'], ['MY_PRICE', 'Moja cena'], ['OFFERS', 'Ponude']];

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
 * Line 1 of the search pill, and the value of the "Gde" step: the chosen place (with the searched words, when there are
 * both), the searched words, the map's area, or "Svi zadaci".
 */
export function whereWords(view: Pick<MarketplaceView, 'place' | 'query' | 'area'>): string {
  const place = typeof view.place === 'string' ? view.place.trim() : '', query = view.query.trim();
  if (place) return query ? `${place} · ${quoted(query)}` : place;
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
