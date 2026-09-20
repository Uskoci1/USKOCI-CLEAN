import { capabilityTerms } from '../lib/capabilityTerms';
import { countryCode } from '../lib/market';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots, normalizeNeedLocation, normalizeTaskGeography } from '../lib/location';
import { civilInstant, displayDate, zonedParts } from '../ui/calendar/calendarPresentation';
import type { AiNeedSafety, AiNeedV2Fact } from '../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  type NeedFactV2Key,
  type NeedTaskGeography,
  type NeedTaskGeographyPoint,
  type LocationSlot,
} from '../contracts/needFactsV2';

export type FactCorrection =
  | { ok: true; value: unknown; displayValue: string }
  | { ok: false; message: string };

const PRICE_MODE: Record<string, string> = {
  'moja cena': 'MY_PRICE',
  'moja_cena': 'MY_PRICE',
  my_price: 'MY_PRICE',
  ponude: 'OFFERS',
  offers: 'OFFERS',
};

const PRICE_BASIS: Record<string, string> = {
  ukupno: 'TOTAL',
  'ukupno za ceo zadatak': 'TOTAL',
  total: 'TOTAL',
  'po osobi': 'PER_PERSON',
  po_osobi: 'PER_PERSON',
  per_person: 'PER_PERSON',
};

const SCHEDULE_KIND: Record<string, string> = {
  'tačan termin': 'FIXED_WINDOW',
  'tacan termin': 'FIXED_WINDOW',
  fixed_window: 'FIXED_WINDOW',
  fleksibilno: 'FLEXIBLE',
  flexible: 'FLEXIBLE',
  'daljinski bilo kada': 'REMOTE_ANYTIME',
  remote_anytime: 'REMOTE_ANYTIME',
  danas: 'TODAY_FLEXIBLE',
  today_flexible: 'TODAY_FLEXIBLE',
  sutra: 'TOMORROW_FLEXIBLE',
  tomorrow_flexible: 'TOMORROW_FLEXIBLE',
  'ove nedelje': 'WEEK_FLEXIBLE',
  week_flexible: 'WEEK_FLEXIBLE',
};

export function factLabel(key: NeedFactV2Key): string {
  return NEED_FACT_V2_DEFINITIONS[key].label;
}

export function sortFacts(facts: AiNeedV2Fact[]): AiNeedV2Fact[] {
  const order = new Map(
    Object.keys(NEED_FACT_V2_DEFINITIONS).map((key, index) => [key, index]),
  );
  return [...facts].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
}

/**
 * Which editor a fact opens. A moment and a list used to have none: the only control was a text
 * box, so correcting a date meant retyping `2026-09-15T10:00:00Z` and correcting a list meant
 * editing `["Prevoz","utovar"]` as JSON. Rather than offer that, "Izmeni" on those seven facts left
 * the review without a word. They keep their exact shapes — a comma inside an item and the
 * precision of an instant still survive the round trip — and get a picker and a list field that
 * write those shapes for the person. A structured place stays with the location editor.
 */
export type FactEditorKind = 'text' | 'timestamp' | 'list' | 'none';
export function factEditorKind(fact: AiNeedV2Fact): FactEditorKind {
  return fact.valueType === 'OBJECT' ? 'none' : fact.valueType === 'TIMESTAMPTZ' ? 'timestamp'
    : fact.valueType === 'TEXT_ARRAY' ? 'list' : 'text';
}

const PRICE_LABELS: Record<string, string> = { MY_PRICE: 'Moja cena', OFFERS: 'Ponude', FASTEST: 'Najbrže (raniji način)' };
const PRICE_BASIS_LABELS: Record<string, string> = { TOTAL: 'Ukupno za ceo zadatak', PER_PERSON: 'Po osobi' };
const SCHEDULE_LABELS: Record<string, string> = { FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Daljinski bilo kada',
  TODAY_FLEXIBLE: 'Danas', TOMORROW_FLEXIBLE: 'Sutra', WEEK_FLEXIBLE: 'Ove nedelje' };
const GEOGRAPHY_LABELS: Record<NeedTaskGeography['mode'], string> = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta',
  MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
const REVIEW_TIMEZONE = 'Europe/Belgrade';
function slotLabel(slot: LocationSlot, stationary = false): string {
  return slot === 'start' ? stationary ? 'Mesto' : 'Polazište' : slot === 'end' ? 'Odredište'
    : slot === 'serviceArea' ? 'Područje' : `Stanica ${Number(slot.split('/')[1]) + 1}`;
}
function geographyReview(geography: NeedTaskGeography): string {
  const point = (value: NeedTaskGeographyPoint) => [value.label, value.city, value.area].filter(value => value !== undefined).join(' · ');
  const lines = [GEOGRAPHY_LABELS[geography.mode]];
  for (const slot of locationSlots(geography)) {
    const place = slot === 'start' ? geography.start : slot === 'end' ? geography.end
      : slot === 'serviceArea' ? geography.serviceArea : geography.waypoints?.[Number(slot.split('/')[1])];
    if (place) lines.push(`${slotLabel(slot, geography.mode === 'STATIONARY')}: ${point(place)}`);
  }
  return lines.join('\n');
}

/** Human review always reads the typed value, never model-supplied displayValue.
 * Caller controls private-row disclosure; this formatter does not grant access. */
export function factReviewValue(fact: AiNeedV2Fact): string {
  const value = fact.value;
  if (fact.key === 'need.task_geography') {
    const geography = normalizeTaskGeography(value);
    return geography ? geographyReview(geography) : 'Lokacija nije dostupna';
  }
  if (fact.key === 'need.resolved_location') {
    const raw = value as { binding?: { taskCountryCode?: unknown; geography?: unknown; exactAddress?: unknown } } | null;
    const location = normalizeNeedLocation({ ...raw?.binding, accessNotes: null, resolvedLocation: value });
    if (!location?.resolvedLocation) return 'Potvrđene tačke nisu dostupne';
    const points = location.resolvedLocation.points;
    return [`${points.length} od ${locationSlots(location.geography).length} tačaka · ${location.taskCountryCode}`,
      geographyReview(location.geography), ...(location.exactAddress ? [`Tačna adresa: ${location.exactAddress}`] : []),
      ...points.map(point => [
        `${slotLabel(point.slot, location.geography.mode === 'STATIONARY')}: ${(point.latitudeE6 / 1e6).toFixed(6)}, ${(point.longitudeE6 / 1e6).toFixed(6)}`,
        ...(point.address ? [`Adresa tačke: ${point.address}`] : []), ...(point.accessNotes ? [`Pristup: ${point.accessNotes}`] : []),
      ].join('\n'))].join('\n');
  }
  if (fact.valueType === 'TEXT_ARRAY') {
    const values = capabilityTerms(value);
    return values ? values.length ? values.map(item => `• ${item}`).join('\n') : 'Nema navedenih stavki' : 'Podatak nije dostupan';
  }
  if (fact.valueType === 'BOOLEAN') return value === true ? 'Da' : value === false ? 'Ne' : 'Podatak nije dostupan';
  if (fact.valueType === 'INTEGER') return typeof value === 'number' && Number.isInteger(value)
    ? `${value}${fact.key === 'need.price_rsd' ? ' RSD' : ''}` : 'Podatak nije dostupan';
  if (fact.valueType === 'TIMESTAMPTZ') {
    const instant = calendarInstant(value);
    if (instant === null) return 'Termin nije dostupan';
    try {
      const milliseconds = instant >= 0 ? instant / 1000n : (instant - 999n) / 1000n;
      const parts = zonedParts(new Date(Number(milliseconds)), REVIEW_TIMEZONE);
      // Include date/year/seconds and exact fractional precision, never device timezone.
      const fraction = typeof value === 'string' ? /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] : undefined;
      return `${displayDate(parts.date)} ${parts.date.slice(0, 4)} · ${parts.time}${fraction ? `.${fraction}` : ''} (vreme u Beogradu)`;
    } catch { return 'Termin nije dostupan'; }
  }
  if (fact.key === 'need.price_mode') return typeof value === 'string' ? PRICE_LABELS[value] ?? 'Način cene nije dostupan' : 'Način cene nije dostupan';
  if (fact.key === 'need.price_basis') return typeof value === 'string' ? PRICE_BASIS_LABELS[value] ?? 'Osnova cene nije dostupna' : 'Osnova cene nije dostupna';
  if (fact.key === 'need.schedule_kind') return typeof value === 'string' ? SCHEDULE_LABELS[value] ?? 'Vrsta termina nije dostupna' : 'Vrsta termina nije dostupna';
  return typeof value === 'string' ? value : 'Podatak nije dostupan';
}

/** Parseable input retains value identity, including commas inside array items
 * and timestamp precision. Structured locations stay in the existing editor. */
export function factCorrectionValue(fact: AiNeedV2Fact): string {
  if (fact.valueType === 'OBJECT') return '';
  if (fact.valueType === 'TEXT_ARRAY') return capabilityTerms(fact.value) ? JSON.stringify(fact.value) : '';
  if (fact.valueType === 'BOOLEAN') return fact.value === true ? 'Da' : fact.value === false ? 'Ne' : '';
  if (fact.valueType === 'INTEGER') return typeof fact.value === 'number' && Number.isInteger(fact.value) ? String(fact.value) : '';
  if (fact.valueType === 'TIMESTAMPTZ') return typeof fact.value === 'string' && calendarInstant(fact.value) !== null ? fact.value : '';
  if (fact.key === 'need.price_mode' || fact.key === 'need.schedule_kind' || fact.key === 'need.price_basis') return factReviewValue(fact);
  return typeof fact.value === 'string' ? fact.value : '';
}

/** The date and the minute of a moment, in the zone the review shows it in. */
export function factTimestampFields(fact: AiNeedV2Fact): { date: string; time: string } {
  const instant = calendarInstant(fact.value);
  if (instant === null) return { date: '', time: '' };
  try {
    const milliseconds = instant >= 0 ? instant / 1000n : (instant - 999n) / 1000n;
    const parts = zonedParts(new Date(Number(milliseconds)), REVIEW_TIMEZONE);
    return { date: parts.date, time: parts.time.slice(0, 5) };
  } catch { return { date: '', time: '' }; }
}

/**
 * What the picker hands to `correctionFromText`. A moment nobody moved goes back byte for byte, so
 * opening the editor and saving cannot shave the seconds or the offset off a stored instant; a
 * moved one goes through the civil parser, which owns the zone and the DST rules.
 */
export function timestampCorrectionText(fact: AiNeedV2Fact, date: string, time: string): string {
  const original = factTimestampFields(fact);
  if (date === original.date && time === original.time && typeof fact.value === 'string') return fact.value;
  return `${date} ${time}`.trim();
}

export function factListItems(fact: AiNeedV2Fact): string[] {
  return capabilityTerms(fact.value) ?? [];
}

/** JSON, so an item with a comma in it stays one item. An empty list is a valid correction. */
export function listCorrectionText(items: readonly string[]): string {
  return JSON.stringify(items);
}

export function correctionFromText(fact: AiNeedV2Fact, input: string): FactCorrection {
  const text = input.trim();
  if (!text) return { ok: false, message: 'Unesi vrednost.' };

  switch (fact.valueType) {
    case 'INTEGER': {
      const normalized = text.replace(/\s/g, '').replace(',', '.');
      const parsed = Number(normalized);
      if (!Number.isInteger(parsed)) {
        return { ok: false, message: 'Unesi ceo broj.' };
      }
      return { ok: true, value: parsed, displayValue: text };
    }
    case 'BOOLEAN': {
      const normalized = text.toLocaleLowerCase('sr-Latn-RS');
      if (['da', 'yes', 'true', '1'].includes(normalized)) {
        // AF-D23: this build has no document or selfie check, and the decision says never to show a
        // verified identity without actual verification. The condition is refused at the moment a
        // person says it, in the conversation, rather than accepted here and taken back two screens
        // later at the review — which is where the other two layers live: `pregled-zadatka` greys
        // publication with this reason and offers to drop the condition, and a resumed publication
        // command fails IDENTITY_VERIFICATION_UNAVAILABLE. Those two exist for drafts that already
        // carry the fact; they are not a reason to stop refusing it here. Guarded by the four
        // AF-D23 cases in src/data/__tests__/aiNeedV2Ui.test.ts.
        if (fact.key === 'need.verified_identity_required') return { ok: false,
          message: 'Provera identiteta nije dostupna u ovoj test verziji. Izaberi „Ne“ da nastaviš bez tog uslova.' };
        return { ok: true, value: true, displayValue: 'Da' };
      }
      if (['ne', 'no', 'false', '0'].includes(normalized)) {
        return { ok: true, value: false, displayValue: 'Ne' };
      }
      return { ok: false, message: 'Unesi „da“ ili „ne“.' };
    }
    case 'TEXT_ARRAY': {
      if (text.startsWith('[')) {
        try {
          const values = capabilityTerms(JSON.parse(text));
          const display = values?.length ? Array.from(values.join(', ')).slice(0, 1000).join('') : 'Nema navedenih stavki';
          return values ? { ok: true, value: values, displayValue: display }
            : { ok: false, message: 'Proveri listu: najviše 50 stavki, do 500 znakova po stavci.' };
        } catch { return { ok: false, message: 'Lista nije ispravna. Proveri navodnike i zagrade.' }; }
      }
      const values = capabilityTerms(text.split(',').map((item) => item.trim()).filter(Boolean));
      if (!values?.length) return { ok: false, message: 'Unesi najviše 50 stavki, do 500 znakova po stavci.' };
      return { ok: true, value: values, displayValue: values.join(', ') };
    }
    case 'TIMESTAMPTZ': {
      // Existing canonical instants remain byte-identical after strict validation,
      // including their explicit offset and microseconds. Never reinterpret them
      // in the device zone.
      if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        return calendarInstant(text) !== null ? { ok: true, value: text, displayValue: text }
          : { ok: false, message: 'Termin nije ispravan. Proveri datum, vreme i vremensku zonu.' };
      }
      // Manual civil input is intentionally narrow and uses the same explicit
      // zone shown by review. Date.parse is forbidden here because its meaning
      // depends on the host zone and it silently normalizes impossible dates.
      const civil = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(text);
      if (!civil) return { ok: false, message: 'Termin unesi kao GGGG-MM-DD HH:MM ili kao ISO vreme sa zonom.' };
      const resolved = civilInstant(civil[1], civil[2], REVIEW_TIMEZONE);
      return resolved.value ? { ok: true, value: resolved.value, displayValue: text }
        : { ok: false, message: resolved.error ?? 'Termin nije ispravan.' };
    }
    case 'ENUM': {
      const normalized = text.toLocaleLowerCase('sr-Latn-RS');
      if (fact.key === 'need.price_mode') {
        const value = PRICE_MODE[normalized] ?? text.toUpperCase();
        if (!['MY_PRICE', 'OFFERS'].includes(value)) {
          return { ok: false, message: 'Koristiš: moja cena ili ponude.' };
        }
        return { ok: true, value, displayValue: text };
      }
      if (fact.key === 'need.price_basis') {
        const value = PRICE_BASIS[normalized] ?? text.toUpperCase();
        if (!['TOTAL', 'PER_PERSON'].includes(value)) {
          return { ok: false, message: 'Koristiš: ukupno ili po osobi.' };
        }
        return { ok: true, value, displayValue: text };
      }
      if (fact.key === 'need.schedule_kind') {
        const value = SCHEDULE_KIND[normalized] ?? text.toUpperCase();
        if (!['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(value)) {
          return { ok: false, message: 'Termin izmeni prirodnim jezikom kroz razgovor.' };
        }
        return { ok: true, value, displayValue: text };
      }
      return { ok: true, value: text, displayValue: text };
    }
    case 'OBJECT':
      return { ok: false, message: 'Lokaciju izmeni kroz razgovor da bi struktura ostala bezbedna.' };
    case 'TEXT':
    default:
      if (fact.key === 'need.task_country_code') {
        const value = countryCode(text);
        return value ? { ok: true, value, displayValue: value } : { ok: false, message: 'Unesi dvoslovnu oznaku države, npr. RS.' };
      }
      return { ok: true, value: text, displayValue: text };
  }
}

export function safetyMessage(safety: AiNeedSafety): string | null {
  switch (safety) {
    case 'BLOCK':
      return 'Ovaj zahtev ne može da nastavi kroz AI unos.';
    case 'REVIEW':
      return 'Zahtev traži dodatnu serversku proveru pre objavljivanja. Nacrt možeš pregledati i sačuvati.';
    case 'CLARIFY':
      return 'AI još razjašnjava važan podatak. Odgovori u razgovoru pre završnog pregleda.';
    case 'ALLOW':
    default:
      return null;
  }
}
