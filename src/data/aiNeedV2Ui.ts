import { capabilityTerms } from '../lib/capabilityTerms';
import { countryCode } from '../lib/market';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots, normalizeNeedLocation, normalizeTaskGeography } from '../lib/location';
import { displayDate, zonedParts } from '../ui/calendar/calendarPresentation';
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

export function canEditFactInline(fact: AiNeedV2Fact): boolean {
  return fact.valueType !== 'OBJECT';
}

const PRICE_LABELS: Record<string, string> = { MY_PRICE: 'Moja cena', OFFERS: 'Ponude', FASTEST: 'Najbrže (raniji način)' };
const SCHEDULE_LABELS: Record<string, string> = { FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Daljinski bilo kada',
  TODAY_FLEXIBLE: 'Danas', TOMORROW_FLEXIBLE: 'Sutra', WEEK_FLEXIBLE: 'Ove nedelje' };
const GEOGRAPHY_LABELS: Record<NeedTaskGeography['mode'], string> = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta',
  MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
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
      const parts = zonedParts(new Date(Number(milliseconds)), 'Europe/Belgrade');
      // Include date/year/seconds and exact fractional precision, never device timezone.
      const fraction = typeof value === 'string' ? /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] : undefined;
      return `${displayDate(parts.date)} ${parts.date.slice(0, 4)} · ${parts.time}${fraction ? `.${fraction}` : ''} (vreme u Beogradu)`;
    } catch { return 'Termin nije dostupan'; }
  }
  if (fact.key === 'need.price_mode') return typeof value === 'string' ? PRICE_LABELS[value] ?? 'Način cene nije dostupan' : 'Način cene nije dostupan';
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
  if (fact.key === 'need.price_mode' || fact.key === 'need.schedule_kind') return factReviewValue(fact);
  return typeof fact.value === 'string' ? fact.value : '';
}

export function correctionFromText(fact: AiNeedV2Fact, input: string): FactCorrection {
  const text = input.trim();
  if (!text) return { ok: false, message: 'Unesite vrednost.' };

  switch (fact.valueType) {
    case 'INTEGER': {
      const normalized = text.replace(/\s/g, '').replace(',', '.');
      const parsed = Number(normalized);
      if (!Number.isInteger(parsed)) {
        return { ok: false, message: 'Unesite ceo broj.' };
      }
      return { ok: true, value: parsed, displayValue: text };
    }
    case 'BOOLEAN': {
      const normalized = text.toLocaleLowerCase('sr-Latn-RS');
      if (['da', 'yes', 'true', '1'].includes(normalized)) {
        return { ok: true, value: true, displayValue: 'Da' };
      }
      if (['ne', 'no', 'false', '0'].includes(normalized)) {
        return { ok: true, value: false, displayValue: 'Ne' };
      }
      return { ok: false, message: 'Unesite „da“ ili „ne“.' };
    }
    case 'TEXT_ARRAY': {
      if (text.startsWith('[')) {
        try {
          const values = capabilityTerms(JSON.parse(text));
          const display = values?.length ? Array.from(values.join(', ')).slice(0, 1000).join('') : 'Nema navedenih stavki';
          return values ? { ok: true, value: values, displayValue: display }
            : { ok: false, message: 'Proverite listu: najviše 50 stavki, do 500 znakova po stavci.' };
        } catch { return { ok: false, message: 'Lista nije ispravna. Proverite navodnike i zagrade.' }; }
      }
      const values = capabilityTerms(text.split(',').map((item) => item.trim()).filter(Boolean));
      if (!values?.length) return { ok: false, message: 'Unesite najviše 50 stavki, do 500 znakova po stavci.' };
      return { ok: true, value: values, displayValue: values.join(', ') };
    }
    case 'TIMESTAMPTZ': {
      if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        return calendarInstant(text) !== null ? { ok: true, value: text, displayValue: text }
          : { ok: false, message: 'Termin nije ispravan. Proverite datum, vreme i vremensku zonu.' };
      }
      const parsed = Date.parse(text);
      if (!Number.isFinite(parsed)) {
        return { ok: false, message: 'Termin nije prepoznat. Izmenite ga kroz razgovor.' };
      }
      return { ok: true, value: new Date(parsed).toISOString(), displayValue: text };
    }
    case 'ENUM': {
      const normalized = text.toLocaleLowerCase('sr-Latn-RS');
      if (fact.key === 'need.price_mode') {
        const value = PRICE_MODE[normalized] ?? text.toUpperCase();
        if (!['MY_PRICE', 'OFFERS'].includes(value)) {
          return { ok: false, message: 'Koristite: moja cena ili ponude.' };
        }
        return { ok: true, value, displayValue: text };
      }
      if (fact.key === 'need.schedule_kind') {
        const value = SCHEDULE_KIND[normalized] ?? text.toUpperCase();
        if (!['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(value)) {
          return { ok: false, message: 'Termin izmenite prirodnim jezikom kroz razgovor.' };
        }
        return { ok: true, value, displayValue: text };
      }
      return { ok: true, value: text, displayValue: text };
    }
    case 'OBJECT':
      return { ok: false, message: 'Lokaciju izmenite kroz razgovor da bi struktura ostala bezbedna.' };
    case 'TEXT':
    default:
      if (fact.key === 'need.task_country_code') {
        const value = countryCode(text);
        return value ? { ok: true, value, displayValue: value } : { ok: false, message: 'Unesite dvoslovnu oznaku države, npr. RS.' };
      }
      return { ok: true, value: text, displayValue: text };
  }
}

export function safetyMessage(safety: AiNeedSafety): string | null {
  switch (safety) {
    case 'BLOCK':
      return 'Ovaj zahtev ne može da nastavi kroz AI unos.';
    case 'REVIEW':
      return 'Zahtev traži dodatnu serversku proveru pre objavljivanja. Nacrt možete pregledati i sačuvati.';
    case 'CLARIFY':
      return 'AI još razjašnjava važan podatak. Odgovorite u razgovoru pre završnog pregleda.';
    case 'ALLOW':
    default:
      return null;
  }
}
