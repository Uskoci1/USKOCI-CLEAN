import type { NeedScheduleProjection, PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots } from '../lib/location';
import { displayDate, zonedParts } from '../ui/calendar/calendarPresentation';
import { novac } from '../lib/novac';

const SCHEDULE: Record<NeedScheduleProjection['kind'], string> = {
  FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilan termin', REMOTE_ANYTIME: 'Na daljinu, fleksibilno',
  TODAY_FLEXIBLE: 'Danas, fleksibilno', TOMORROW_FLEXIBLE: 'Sutra, fleksibilno', WEEK_FLEXIBLE: 'Ove nedelje, fleksibilno',
};
const GEOGRAPHY = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta', MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
/** The reader's own zone, when the platform will say. */
function deviceZone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

/** Presentation follows the saved task zone. Historical unknown zones are explicitly UTC. */
export function needScheduleText(schedule: NeedScheduleProjection, timezone?: string): string {
  const zone = timezone ?? 'UTC';
  const instant = (value: string | null) => {
    const parsed = calendarInstant(value);
    if (parsed === null) return null;
    const ms = parsed >= 0n ? parsed / 1000n : (parsed - 999n) / 1000n;
    try {
      const parts = zonedParts(new Date(Number(ms)), zone);
      const fraction = /\.(\d+)(?:Z|[+-])/.exec(value!)?.[1];
      const time = parts.time.endsWith(':00') && !fraction?.replace(/0/g, '') ? parts.time.slice(0, 5)
        : parts.time + (fraction ? `.${fraction}` : '');
      const wall = calendarInstant(`${parts.date}T${parts.time}Z`)!;
      const second = parsed >= 0n ? parsed / 1_000_000n : (parsed - 999_999n) / 1_000_000n;
      const offsetMinutes = Number((wall - second * 1_000_000n) / 60_000_000n);
      const offset = `UTC${offsetMinutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
      return { text: `${displayDate(parts.date)} ${parts.date.slice(0, 4)} · ${time}`, offset, date: parts.date, time };
    } catch { return null; }
  };
  const start = instant(schedule.startsAt), end = instant(schedule.endsAt);
  // Repeated civil times across a DST change need both offsets to remain exact.
  const shifted = start && end && start.offset !== end.offset;
  // A window that begins and ends on one day named that day twice: "20. sep 2026 · 06:38:53 –
  // 20. sep 2026 · 09:38:53". The second date says nothing the first did not. The exact instant is
  // kept to the microsecond, because for a Dogovor that is the thing being agreed.
  const sameDay = !!start && !!end && start.date === end.date;
  const endText = sameDay ? end!.time : end?.text;
  const range = start && end ? `${start.text}${shifted ? ` ${start.offset}` : ''} – ${endText}${shifted ? ` ${end.offset}` : ''}`
    : start ? `Od ${start.text}` : end ? `Do ${end.text}` : null;
  const preference = schedule.kind === 'FIXED_WINDOW' ? '' : schedule.kind === 'REMOTE_ANYTIME' ? 'Na daljinu, fleksibilno · ' : 'Fleksibilan raspon · ';
  // A zone the reader is already standing in does not need to be named; a different one does.
  // Naming it was not the problem — printing an instant in UTC and apologising for it was.
  const named = timezone && timezone !== deviceZone() ? ` (${timezone})` : timezone ? '' : ' (UTC · zona nije navedena)';
  return range ? `${preference}${range}${named}`
    : schedule.kind === 'FIXED_WINDOW' ? 'Tačan termin nije potpun' : SCHEDULE[schedule.kind];
}
/**
 * A task title as a person should read it.
 *
 * Six of seventeen tasks on canonical DEV are stored with their title inside quotation marks —
 * `"Hitno prenosenje troseda"` — because that is how the interview wrote them. The stored value is
 * the server's and stays exactly as it is: cdl-a03-need-read-equivalence requires the projection to
 * carry it unchanged, and the real repair belongs in the prompt that writes it. This is the same
 * display-only tidy the category already gets, and it removes only a PAIR of wrapping quotes, so a
 * title that genuinely quotes something keeps it.
 */
export function readableTitle(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  const text = value.trim().replace(/\s+/g, ' ');
  const pairs: [string, string][] = [['"', '"'], ['„', '“'], ['“', '”'], ["'", "'"]];
  for (const [open, close] of pairs) {
    if (text.length > 1 && text.startsWith(open) && text.endsWith(close)) return text.slice(1, -1).trim();
  }
  return text;
}

export type PriceBasis = "TOTAL" | "PER_PERSON" | null | undefined;

/**
 * What a task's price says, in words, once a task can say what its price is FOR (pkg025a-c).
 *
 * A null basis is every task written before 2026-09-20 and every task written since without one:
 * it reads exactly as it always has, because nothing about it has changed. PER_PERSON names the
 * unit, and on a screen with room it also names what the whole task would cost, which is the number
 * the owner said a person actually wants: "3.000 RSD po osobi - 6 osoba - ukupno 18.000 RSD".
 */
export function needPriceText(input: {
  rezimCene?: string; ponudjenaCena?: { iznos: number; prikaz: string }; osnovaCene?: PriceBasis;
  pokrivenost?: { ukupno: number };
}, options?: { withTotal?: boolean }): string {
  if (input.rezimCene === 'OFFERS') return 'Tražim ponude';
  if (!input.ponudjenaCena) return 'Cena nije navedena';
  const amount = input.ponudjenaCena.prikaz;
  if (input.osnovaCene === 'PER_PERSON') {
    const people = input.pokrivenost?.ukupno ?? 0;
    if (!options?.withTotal || people < 2 || !Number.isFinite(input.ponudjenaCena.iznos)) return `${amount} po osobi`;
    return `${amount} po osobi · ukupno ${novac(input.ponudjenaCena.iznos * people)}`;
  }
  if (input.osnovaCene === 'TOTAL') return `${amount} ukupno`;
  return amount;
}

/**
 * The qualifier that belongs under a price, when the number by itself would mislead.
 *
 * Some surfaces — the draft card in the interview above all — are built around one big number, and
 * `needPriceText`'s combined string does not fit that shape: "5.000 RSD po osobi · ukupno 15.000 RSD"
 * in that size is no longer a signature, it is a sentence. But dropping the qualifier is what the
 * owner refused on the first device run: the card read 5.000 for a three-person task that actually
 * costs 15.000, and the number a person pays is the one they must see before publishing.
 *
 * So the number stays big and this goes quietly underneath it. It lives beside needPriceText so the
 * two cannot drift into saying different things about the same price.
 */
export function needPriceBasisNote(input: {
  osnovaCene?: PriceBasis; ponudjenaCena?: { iznos: number }; pokrivenost?: { ukupno: number };
}): string | null {
  if (input.osnovaCene === 'TOTAL') return 'ukupno za ceo zadatak';
  if (input.osnovaCene !== 'PER_PERSON') return null;
  const people = input.pokrivenost?.ukupno ?? 0;
  const amount = input.ponudjenaCena?.iznos;
  if (people < 2 || typeof amount !== 'number' || !Number.isFinite(amount)) return 'po osobi';
  return `po osobi · ukupno ${novac(amount * people)}`;
}

/**
 * The price an application must carry when the task names its own price — the rule
 * `rpc_submit_response` enforces since pkg025b, stated once for the composer (deep read 8.10).
 *
 * No basis: the task's amount, whatever the application covers. PER_PERSON: the amount for each
 * person this application brings. TOTAL: the amount, and the application covers every place
 * (`fixedApplicationPeople`). OFFERS, or no usable amount: null — the worker names the price, or
 * there is nothing that could pass.
 */
export function fixedApplicationPrice(input: {
  rezimCene?: string; ponudjenaCena?: { iznos: number }; osnovaCene?: PriceBasis;
}, people: number): number | null {
  if (input.rezimCene !== 'MY_PRICE') return null;
  const amount = input.ponudjenaCena?.iznos;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) return null;
  if (input.osnovaCene !== 'PER_PERSON') return amount;
  if (!Number.isSafeInteger(people) || people < 1) return null;
  const total = amount * people;
  return Number.isSafeInteger(total) ? total : null;
}

/** A TOTAL price buys the whole task, so an application for it covers every place; otherwise the worker chooses. */
export function fixedApplicationPeople(input: {
  rezimCene?: string; osnovaCene?: PriceBasis; pokrivenost?: { ukupno: number };
}): number | null {
  if (input.rezimCene !== 'MY_PRICE' || input.osnovaCene !== 'TOTAL') return null;
  const places = input.pokrivenost?.ukupno;
  return typeof places === 'number' && Number.isSafeInteger(places) && places >= 1 ? places : null;
}

export function needGeographyRows(need: Pick<PotrebaProjekcija, 'detalji' | 'podrucjeTekst'>): { label: string; value: string }[] {
  const geo = need.detalji?.geografija;
  if (!geo) return [{ label: 'Približno područje', value: need.podrucjeTekst }];
  if (geo.mode === 'REMOTE') return [{ label: 'Način izvršenja', value: 'Na daljinu' }];
  return [{ label: 'Način izvršenja', value: GEOGRAPHY[geo.mode] }, ...locationSlots(geo).map(slot => {
    const point = slot === 'start' ? geo.start : slot === 'end' ? geo.end : slot === 'serviceArea' ? geo.serviceArea : geo.waypoints?.[Number(slot.split('/')[1])];
    return { label: slot === 'start' ? geo.mode === 'STATIONARY' ? 'Mesto' : 'Polazište' : slot === 'end' ? 'Odredište'
      : slot === 'serviceArea' ? 'Područje' : `Stanica ${Number(slot.split('/')[1]) + 1}`,
      value: [point?.label, point?.city, point?.area].filter(value => value !== undefined).join(' · ') };
  })];
}
export function needRequirementRows(need: Pick<PotrebaProjekcija, 'detalji' | 'uslovi'>): { label: string; value: string }[] {
  const requirements = need.detalji?.zahtevi;
  if (!requirements) return need.uslovi.length ? [{ label: 'Uslovi', value: need.uslovi.map(value => `• ${value}`).join('\n') }] : [];
  const groups: [string, string[] | null][] = [['Veštine', requirements.vestine], ['Alat', requirements.alati], ['Vozilo', requirements.vozila],
    ['Dozvole', requirements.dozvole], ['Bitni uslovi', requirements.bitniUslovi]];
  return [...groups.filter(([, values]) => values?.length).map(([label, values]) => ({ label, value: values!.map(value => `• ${value}`).join('\n') })),
    ...(requirements.iskustvoGodina !== null ? [{ label: 'Najmanje iskustva', value: `${requirements.iskustvoGodina} god.` }] : []),
    ...(requirements.potvrdjenIdentitet ? [{ label: 'Identitet', value: 'Potreban je potvrđen identitet' }] : [])];
}
