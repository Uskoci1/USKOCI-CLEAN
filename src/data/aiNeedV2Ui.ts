import type { AiNeedSafety, AiNeedV2Fact } from '../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  type NeedFactV2Key,
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

export function correctionInputText(fact: AiNeedV2Fact): string {
  return Array.isArray(fact.value) ? fact.value.join('\n') : String(fact.value);
}

export function correctionFromText(fact: AiNeedV2Fact, input: string, arrayMode: 'comma' | 'lines' = 'comma'): FactCorrection {
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
      const values = text.split(arrayMode === 'lines' ? /\r?\n/ : ',').map((item) => item.trim()).filter(Boolean);
      if (!values.length) return { ok: false, message: 'Unesite bar jednu stavku.' };
      return { ok: true, value: values, displayValue: values.join(', ') };
    }
    case 'TIMESTAMPTZ': {
      // Never infer the intended task timezone from the current device locale.
      // The conversation can clarify natural language; inline correction must
      // carry its explicit instant just like the existing server fact value.
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
        return { ok: false, message: 'Navedite datum i vreme sa vremenskom zonom ili ih izmenite kroz razgovor.' };
      }
      const [year, month, day] = text.slice(0, 10).split('-').map(Number);
      const lastDay = new Date(0);
      lastDay.setUTCFullYear(year, month, 0);
      if (month < 1 || month > 12 || day < 1 || day > lastDay.getUTCDate() || Number(text.slice(11, 13)) > 23) {
        return { ok: false, message: 'Datum ili vreme ne postoji. Proverite unos ili ih izmenite kroz razgovor.' };
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
