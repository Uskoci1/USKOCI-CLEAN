import { readFileSync } from 'fs';
import { join } from 'path';
import type { WorkerCalendarEvent } from '../../../contracts/workerCalendar';
import { agendaCoverage, agendaItems, agendaWindow, dayMark, itemsOnDay, withinDay, withoutExactTerm, type AgendaAgreement } from '../agenda';

// Owner step 10 (critique A15): the calendar places the Dogovori of both sides. Jest runs in UTC, so a day here is a UTC
// day and Serbian time is two hours ahead in September.
const from = '2026-09-21T00:00:00.000Z', to = '2026-09-28T00:00:00.000Z';
const event = (id: string, agreementId: string, version: number, startsAt: string, endsAt: string): WorkerCalendarEvent =>
  ({ eventId: id, agreementId, agreementVersion: version, startsAt, endsAt, agreementStatus: 'CONFIRMED', source: 'AGREEMENT' });
const agreement = (id: string, patch: Partial<AgendaAgreement> = {}): AgendaAgreement => ({
  id, verzija: 1, naslov: 'Pomoć oko krečenja stana', stanje: 'CONFIRMED', cena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' },
  vremeTekst: '', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
    { id: 'other', profilId: null, ime: 'Marko', inicijali: 'M', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null,
  izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, tacanTermin: null, ...patch,
} as AgendaAgreement);
const worker = (id: string, patch: Partial<AgendaAgreement> = {}) => agreement(id, { ucesnici: [
  { id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'uskocer', mesta: 1, viSte: true, telefon: null },
  { id: 'other', profilId: null, ime: 'Ana', inicijali: 'A', uloga: 'narucilac', mesta: null, viSte: false, telefon: null }], ...patch });
const window = (pocetak: string, kraj: string) => ({ pocetak, kraj });

describe('agendaItems', () => {
  it('adds a Dogovor for my own task from its exact accepted window, as "Tvoj zadatak"', () => {
    const items = agendaItems({ events: [], agreements: [agreement('a1', { tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z') })], from, to });
    expect(items).toEqual([expect.objectContaining({ agreementId: 'a1', role: 'Tvoj zadatak', state: 'CONFIRMED', title: 'Pomoć oko krečenja stana',
      amount: '4.000 RSD', person: 'Marko', place: 'Liman, Novi Sad', startsAt: '2026-09-24T10:00:00Z' })]);
  });

  it('keeps a finished Dogovor, and never a cancelled one', () => {
    const items = agendaItems({ events: [], from, to, agreements: [
      agreement('done', { stanje: 'COMPLETED', tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z') }),
      agreement('gone', { stanje: 'CANCELLED', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') }),
    ] });
    expect(items.map(item => [item.agreementId, item.state])).toEqual([['done', 'COMPLETED']]);
  });

  it('never adds my own confirmed work from the list: the schedule is its one authority', () => {
    const items = agendaItems({ events: [], from, to, agreements: [
      worker('mine', { tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z') }),
      worker('waiting', { stanje: 'AWAITING_REQUESTER', tacanTermin: window('2026-09-23T10:00:00Z', '2026-09-23T12:00:00Z') }),
    ] });
    expect(items.map(item => [item.agreementId, item.role, item.state])).toEqual([['waiting', 'Uskačeš', 'AWAITING_REQUESTER']]);
  });

  it('adds nothing twice when a Dogovor is already in the schedule, whatever the case of its id', () => {
    const items = agendaItems({ from, to, events: [event('e1', 'ABC-1', 1, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')],
      agreements: [worker('abc-1', { stanje: 'AWAITING_REQUESTER', tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z') })] });
    expect(items).toHaveLength(1); expect(items[0].key).toBe('event:e1');
  });

  it('takes a schedule row\'s facts only from the same Dogovor at the same version, still active', () => {
    const events = [event('e1', 'A-1', 2, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    const older = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 1, naslov: 'Stari naslov' })] });
    expect(older[0]).toEqual(expect.objectContaining({ title: null, fallbackTitle: 'Potvrđen Dogovor', amount: null, person: null, role: 'Uskačeš' }));
    const same = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 2, naslov: 'Selidba', cena: { iznos: 0, valuta: 'RSD', prikaz: '' } })] });
    expect(same[0]).toEqual(expect.objectContaining({ title: 'Selidba', amount: '', person: 'Ana' }));
    const unread = agendaItems({ events, from, to, agreements: null });
    expect(unread[0]).toEqual(expect.objectContaining({ title: null, amount: null }));
  });

  // Review of owner step 10: after I mark my work done the Dogovor waits for the requester, at the same version, and the
  // schedule keeps the event while the Dogovor is agreed. The row said only "Potvrđen Dogovor", untitled.
  it('says that my own work waits for the completion to be confirmed, from the list at the same version', () => {
    const events = [event('e1', 'a-1', 3, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    const waiting = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 3, stanje: 'AWAITING_REQUESTER', naslov: 'Selidba' })] });
    expect(waiting).toEqual([expect.objectContaining({ key: 'event:e1', state: 'AWAITING_REQUESTER', title: 'Selidba', person: 'Ana', role: 'Uskačeš' })]);
    // Any other state, or another version, adds nothing to the schedule's row.
    for (const patch of [{ verzija: 3, stanje: 'COMPLETED' as const }, { verzija: 3, stanje: 'CANCELLED' as const }, { verzija: 2, stanje: 'AWAITING_REQUESTER' as const }]) {
      const [row] = agendaItems({ events, from, to, agreements: [worker('a-1', { naslov: 'Selidba', ...patch })] });
      expect(row).toEqual(expect.objectContaining({ state: 'CONFIRMED', title: null, amount: null, fallbackTitle: 'Potvrđen Dogovor' }));
    }
  });

  it('leaves out a window outside the week and a Dogovor whose window the list did not give', () => {
    const items = agendaItems({ events: [], from, to, agreements: [
      agreement('later', { tacanTermin: window('2026-10-02T10:00:00Z', '2026-10-02T11:00:00Z') }),
      agreement('unsaid', { tacanTermin: undefined }),
    ] });
    expect(items).toEqual([]);
  });

  it('orders the week by start, then by title', () => {
    const items = agendaItems({ from, to, events: [event('e1', 'w', 1, '2026-09-24T12:00:00Z', '2026-09-24T13:00:00Z')], agreements: [
      agreement('b', { naslov: 'Beta', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') }),
      agreement('a', { naslov: 'Alfa', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T10:00:00Z') }),
    ] });
    expect(items.map(item => item.agreementId)).toEqual(['a', 'b', 'w']);
  });

  it('says "Na daljinu" for remote work instead of an area', () => {
    const [item] = agendaItems({ events: [], from, to, agreements: [agreement('r', { rezim: 'DALJINSKI', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') })] });
    expect(item.place).toBe('Na daljinu');
  });
});

describe('withoutExactTerm and coverage', () => {
  it('counts only active Dogovori known to have no exact window', () => {
    expect(withoutExactTerm([agreement('a', { tacanTermin: null }), agreement('b', { stanje: 'AWAITING_REQUESTER', tacanTermin: null }),
      agreement('c', { stanje: 'COMPLETED', tacanTermin: null }), agreement('d', { stanje: 'CANCELLED', tacanTermin: null }),
      agreement('e', { tacanTermin: undefined }), agreement('f', { tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') })], [])).toBe(2);
  });
  it('is unknown while a Dogovor the calendar could place does not say whether it has a window', () => {
    expect(agendaCoverage([agreement('a', { tacanTermin: null })], [])).toBe('full');
    expect(agendaCoverage([agreement('a', { tacanTermin: undefined })], [])).toBe('unknown');
    // My own confirmed work is the schedule's; its silence in the list changes nothing.
    expect(agendaCoverage([worker('w', { tacanTermin: undefined })], [])).toBe('full');
    expect(agendaCoverage([agreement('x', { stanje: 'CANCELLED', tacanTermin: undefined })], [])).toBe('full');
  });
});

describe('the day', () => {
  const items = agendaItems({ from, to, events: [], agreements: [
    agreement('done', { stanje: 'COMPLETED', tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z') }),
    agreement('night', { tacanTermin: window('2026-09-25T20:00:00Z', '2026-09-26T04:00:00Z') }),
  ] });
  it('cuts the week into days and marks them', () => {
    expect(itemsOnDay(items, '2026-09-24').map(item => item.agreementId)).toEqual(['done']);
    expect(itemsOnDay(items, '2026-09-26').map(item => item.agreementId)).toEqual(['night']);
    expect(dayMark(items, '2026-09-24')).toBe('finished');
    expect(dayMark(items, '2026-09-25')).toBe('active');
    expect(dayMark(items, '2026-09-23')).toBeNull();
  });
  it('writes the window in Serbian time: its clocks on its own day, its days otherwise', () => {
    expect(agendaWindow(items[0], '2026-09-24')).toBe('12:00–19:00');
    expect(withinDay(items[0], '2026-09-24')).toBe(true);
    expect(agendaWindow(items[1], '2026-09-25')).toMatch(/^25\. sep( 2026)? · 22:00 – 26\. sep( 2026)? · 06:00$/);
    expect(withinDay(items[1], '2026-09-25')).toBe(false);
  });
});

it('keeps its status words equal to the Dogovor presentation\'s', () => {
  // AgreementPresentation cannot be imported by the calendar (its photos pull the Supabase client), so the words are
  // written twice; this keeps the two copies one.
  const source = readFileSync(join(__dirname, '../../v2/AgreementPresentation.tsx'), 'utf8');
  expect(source).toContain("AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno'");
});
