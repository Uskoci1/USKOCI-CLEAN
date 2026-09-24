import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { NeedLocationInput } from '../../contracts/location';
import type { NeedFactV2Key } from '../../contracts/needFactsV2';
import { factLabel, factReviewValue, slotLabel } from '../../data/aiNeedV2Ui';
import { REVIEW_FACT_COPY } from '../../data/reviewFactProblem';
import { dogovorenoVreme } from '../../lib/dogovorenoVreme';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { novac } from '../../lib/novac';

/**
 * What the publish review shows in a fact's row. Pure (no service, no Supabase), so a screen suite can import it.
 *
 * `factReviewValue` stays the exact reading a correction is seeded from; this is only what a person reads: a moment in
 * the app's one time format (no seconds, "po vremenu u Srbiji" only on a phone in another zone), money with its grouping
 * and currency, and the confirmed points as a count and their private details, never coordinates or a country code.
 */
export function reviewRowValue(fact: AiNeedV2Fact): string {
  if (fact.valueType === 'TIMESTAMPTZ') return dogovorenoVreme(fact.value, 'Termin nije dostupan');
  if (fact.key === 'need.price_rsd') return typeof fact.value === 'number' && Number.isSafeInteger(fact.value)
    ? novac(fact.value) : 'Podatak nije dostupan';
  if (fact.key === 'need.resolved_location') {
    const raw = fact.value as { binding?: { taskCountryCode?: unknown; geography?: unknown; exactAddress?: unknown } } | null;
    const location = normalizeNeedLocation({ ...raw?.binding, accessNotes: null, resolvedLocation: fact.value });
    if (!location?.resolvedLocation) return 'Potvrđene tačke nisu dostupne';
    const points = location.resolvedLocation.points, total = locationSlots(location.geography).length;
    const stationary = location.geography.mode === 'STATIONARY';
    // One point needs no name; several say which one each detail belongs to.
    const named = (slot: typeof points[number]['slot'], text: string) => total > 1 ? `${slotLabel(slot, stationary)} · ${text}` : text;
    return [`${points.length} od ${total} tačaka potvrđeno`, ...points.flatMap(point => [
      ...(point.address ? [named(point.slot, `Adresa tačke: ${point.address}`)] : []),
      ...(point.accessNotes ? [named(point.slot, `Pristup: ${point.accessNotes}`)] : []),
    ])].join('\n');
  }
  return factReviewValue(fact);
}

export type PublicAnchor = { latitude: number; longitude: number };

/**
 * The approximate point the public map will show once the task is published, computed the way the server does it
 * (`private.materialize_resolved_location`, migration 20260910130851): the service area's point for work on an area
 * that has one, otherwise the start point, rounded to two decimals half away from zero (Postgres `round`). No confirmed
 * anchor point, or remote work, means no point: nothing is invented.
 */
export function publicAnchorPoint(location: NeedLocationInput | null | undefined): PublicAnchor | null {
  if (!location || location.geography.mode === 'REMOTE' || !location.resolvedLocation) return null;
  const slot = location.geography.mode === 'AREA_BASED' && location.geography.serviceArea ? 'serviceArea' : 'start';
  const point = location.resolvedLocation.points.find(item => item.slot === slot);
  if (!point) return null;
  const round = (e6: number) => Math.sign(e6) * Math.round(Math.abs(e6) / 1e4) / 100;
  return { latitude: round(point.latitudeE6), longitude: round(point.longitudeE6) };
}

/** One thing that still stands between the review and publication, and where it is fixed. */
export type ReviewTodo = { key: string; text: string;
  /** `conversation` goes back to the conversation, `location` opens the place, a fact key opens that row's editor. */
  target: 'conversation' | 'location' | NeedFactV2Key | null };

/**
 * "Još treba", in order: a safety block, what is missing (never naming the category, owner decision 2026-09-21), the
 * place on the map, then what the server would refuse about the facts themselves. The unavailable identity condition is
 * its own block with its own action, not a row here.
 */
export function reviewTodos(review: { safety: string; missingRequired: readonly NeedFactV2Key[]; location: unknown },
  factProblem: string | null): ReviewTodo[] {
  const todos: ReviewTodo[] = [];
  if (review.safety === 'BLOCK') todos.push({ key: 'safety', text: 'Sadržaj ne može da se objavi u ovom obliku.', target: 'conversation' });
  const missing = review.missingRequired.filter(key => key !== 'need.category');
  if (missing.length) todos.push({ key: 'missing', text: `Nedostaje: ${missing.map(factLabel).join(', ')}.`, target: 'conversation' });
  else if (review.missingRequired.length) todos.push({ key: 'missing', text: 'Treba još malo o samom poslu.', target: 'conversation' });
  if (!review.location) todos.push({ key: 'location', text: 'Mesto na mapi nije potvrđeno.', target: 'location' });
  if (factProblem) todos.push({ key: 'fact', text: factProblem, target: factProblem === REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED
    ? 'need.price_rsd' : factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED || factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED
      ? 'need.starts_at' : null });
  return todos;
}
