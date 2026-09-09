import type { WorkerCalendarEvent, WorkerCalendarRange } from '../contracts/workerCalendar';
import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, timestamp, uuid } from './serverReceipt';

const INVALID = 'WORKER_CALENDAR_INVALID_RESPONSE';
const CALENDAR_COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da biste otvorili svoj kalendar.',
  CALENDAR_RANGE_INVALID: 'Izabrani period kalendara nije ispravan.',
};

function validRange(from: string, to: string): boolean {
  return timestamp(from) && timestamp(to) && Date.parse(from) < Date.parse(to);
}

function sameInstant(value: string, expected: string): boolean {
  return Date.parse(value) === Date.parse(expected);
}

function mapEvent(raw: unknown, from: string, to: string): WorkerCalendarEvent | null {
  const value = record(raw);
  if (!value || !uuid(value.eventId) || !uuid(value.agreementId) ||
      !positiveInteger(value.agreementVersion) || !timestamp(value.startsAt) || !timestamp(value.endsAt) ||
      value.agreementStatus !== 'CONFIRMED' || value.source !== 'AGREEMENT') return null;
  const starts = Date.parse(value.startsAt);
  const ends = Date.parse(value.endsAt);
  if (!(starts < ends) || !(starts < Date.parse(to) && ends > Date.parse(from))) return null;
  return {
    eventId: value.eventId,
    agreementId: value.agreementId,
    agreementVersion: value.agreementVersion,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    agreementStatus: 'CONFIRMED',
    source: 'AGREEMENT',
  };
}

async function calendarReceipt(options: Parameters<typeof readReceipt<WorkerCalendarRange>>[0]): Promise<Ishod<WorkerCalendarRange>> {
  const result = await readReceipt(options);
  if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') {
    return failure(result.kod, 'Nalog je promenjen. Ponovo otvorite kalendar.');
  }
  if (!result.ok && result.kod === 'AUTH_REQUIRED') return failure(result.kod, CALENDAR_COPY.AUTH_REQUIRED);
  return result;
}

export const workerCalendarClientService = {
  readRange(from: string, to: string): Promise<Ishod<WorkerCalendarRange>> {
    if (!validRange(from, to)) {
      return Promise.resolve(failure('CALENDAR_RANGE_INVALID', CALENDAR_COPY.CALENDAR_RANGE_INVALID));
    }
    return calendarReceipt({
      rpc: 'rpc_get_worker_calendar',
      args: { p_from: from, p_to: to },
      errors: CALENDAR_COPY,
      fallback: 'WORKER_CALENDAR_READ_FAILED',
      invalid: INVALID,
      decode(raw): WorkerCalendarRange | null {
        const value = record(raw);
        if (!value || value.authoritative !== true || !timestamp(value.from) || !timestamp(value.to) ||
            !sameInstant(value.from, from) || !sameInstant(value.to, to) || !Array.isArray(value.events)) return null;
        const events: WorkerCalendarEvent[] = [];
        for (const rawEvent of value.events) {
          const event = mapEvent(rawEvent, from, to);
          if (!event) return null;
          events.push(event);
        }
        for (let index = 1; index < events.length; index += 1) {
          const previous = events[index - 1];
          const current = events[index];
          if (Date.parse(previous.startsAt) > Date.parse(current.startsAt)) return null;
        }
        return { from: value.from, to: value.to, events, authoritative: true };
      },
    });
  },
};
