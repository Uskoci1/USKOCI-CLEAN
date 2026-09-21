import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { composeActivities, composeHome, type HomeReads } from '../homeSnapshot';

const ME = 'me', OTHER = 'other';
const need = (id: string, patch: Partial<PotrebaProjekcija> = {}): PotrebaProjekcija => ({ id, revizija: 1, naslov: `Zadatak ${id}`, opis: '',
  stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'sutra 17–19', podrucjeTekst: 'Liman',
  uslovi: [], brojPrijava: 0, ...patch } as PotrebaProjekcija);
const application = (id: string, patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: id, potrebaId: `n-${id}`,
  potrebaRevizija: 1, prijavaRevizija: 1, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: `Tuđ zadatak ${id}`, opis: '',
  cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' }, pokrivaMesta: 1, napomena: '', podrucjeTekst: 'Detelinara', vremeTekst: 'subota',
  dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const agreement = (id: string, mine: 'narucilac' | 'uskocer', patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija => ({ id, verzija: 1,
  naslov: `Dogovor ${id}`, stanje: 'CONFIRMED', cena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' }, vremeTekst: 'danas 17h', putanjaTekst: '',
  pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: ME, profilId: null, ime: 'Ja', inicijali: 'JA', uloga: mine, mesta: null, viSte: true, telefon: null },
    { id: OTHER, profilId: null, ime: 'Jelena', inicijali: 'JE', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, ...patch });
const known = <T,>(value: T) => ({ kind: 'known' as const, value });
const reads = (patch: Partial<HomeReads> = {}): HomeReads => ({ needs: known([]), applications: known([]), agreements: known([]), ...patch });

test('PKG-035: history stays visible but only selectable applications require attention', () => {
  const historical = Object.assign(need('history', { brojPrijava: 7 }), { brojPrijavaZaIzbor: 0 });
  const actionable = Object.assign(need('choice', { brojPrijava: 9 }), { brojPrijavaZaIzbor: 2 });
  const home = composeHome(reads({ needs: known([historical, actionable]) }));
  expect(home.attention).toEqual([{ id: 'need:choice:applications', title: '2 prijave',
    detail: 'Zadatak choice · čeka tvoj izbor', target: { kind: 'CANDIDATES', needId: 'choice' } }]);
  expect(home.attentionMore).toBe(0);
  expect(JSON.stringify(home.activities)).toContain('7 prijava');
});

test('PKG-035: historical totals never substitute for an unknown actionable count', () => {
  const home = composeHome(reads({ needs: known([need('legacy', { brojPrijava: 7 })]) }));
  expect(home.attention).toEqual([]);
});

describe('Početna v1 — composed from the reads that already exist, with no mode', () => {
  it('an account with nothing has no attention, no rows and no invented numbers', () => {
    expect(composeHome(reads())).toEqual({ attention: [], attentionMore: 0, agreements: known({ rows: [], more: 0 }),
      activities: known({ rows: [], more: 0 }), partial: false });
  });

  it('holds both sides of one account at once and says on each row what I am to it', () => {
    const home = composeHome(reads({ needs: known([need('a')]), applications: known([application('c')]),
      agreements: known([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]) }));
    expect(home.activities).toEqual(known({ more: 0, rows: [
      { id: 'need:a', relation: 'OWNED', title: 'Zadatak a', detail: 'Tvoj zadatak · sutra 17–19 · još nema prijava', target: { kind: 'NEED', needId: 'a' } },
      { id: 'application:c', relation: 'APPLIED', title: 'Tuđ zadatak c', detail: 'Tvoja prijava · 2.500 RSD ukupno · čeka izbor', target: { kind: 'APPLICATION', applicationId: 'c' } }] }));
    expect(home.agreements).toEqual(known({ more: 0, rows: [
      { id: 'agreement:g-a', title: 'Dogovor g-a', detail: 'Objavio si · Jelena · danas 17h', target: { kind: 'AGREEMENT', agreementId: 'g-a' } },
      { id: 'agreement:g-c', title: 'Dogovor g-c', detail: 'Uskočio si · Jelena · danas 17h', target: { kind: 'AGREEMENT', agreementId: 'g-c' } }] }));
  });

  it('orders attention by what blocks a person first, bounds it, and counts the rest honestly', () => {
    const home = composeHome(reads({
      needs: known([need('a', { brojPrijava: 3, brojPrijavaZaIzbor: 3 }), need('b', { brojPrijava: 1, brojPrijavaZaIzbor: 1 })]),
      applications: known([application('c', { stanje: 'STALE_REVIEW_REQUIRED', promenjenaPotreba: true })]),
      agreements: known([agreement('g', 'narucilac', { stanje: 'AWAITING_REQUESTER' }), agreement('p', 'uskocer', { problemOtvoren: true })]) }));
    expect(home.attention.map(item => item.id)).toEqual(['agreement:g:confirm', 'agreement:p:problem', 'application:c:stale']);
    expect(home.attention[0]).toEqual({ id: 'agreement:g:confirm', title: 'Potvrdi završetak', detail: 'Dogovor g · završetak je označen i čeka tvoju potvrdu',
      target: { kind: 'AGREEMENT', agreementId: 'g' } });
    expect(home.attentionMore).toBe(2);
  });

  it('words the attention flag the server set on an application without guessing its reason', () => {
    const home = composeHome(reads({ applications: known([application('c', { traziPaznju: true })]) }));
    expect(home.attention).toEqual([{ id: 'application:c:attention', title: 'Prijava traži tvoju pažnju', detail: 'Tuđ zadatak c · otvori svoju prijavu',
      target: { kind: 'APPLICATION', applicationId: 'c' } }]);
  });

  it('a worker waiting for the requester is not asked to confirm anything', () => {
    expect(composeHome(reads({ agreements: known([agreement('g', 'uskocer', { stanje: 'AWAITING_REQUESTER' })]) })).attention).toEqual([]);
  });

  it('a section that could not be read is unavailable, never empty, and the rest still stands', () => {
    const home = composeHome(reads({ needs: { kind: 'unavailable' }, applications: known([application('c')]) }));
    expect(home.partial).toBe(true);
    expect(home.activities).toEqual({ kind: 'partial', missing: ['needs'], value: { more: 0, rows: [expect.objectContaining({ id: 'application:c' })] } });
    expect(composeHome(reads({ needs: { kind: 'unavailable' }, applications: { kind: 'unavailable' } })).activities).toEqual({ kind: 'unavailable' });
    expect(composeHome(reads({ agreements: { kind: 'unavailable' } })).agreements).toEqual({ kind: 'unavailable' });
  });

  it('shows a bounded preview, shares it between both sides, and leaves history out', () => {
    const home = composeHome(reads({
      needs: known([...Array.from({ length: 6 }, (_, i) => need(`n${i}`)), need('done', { stanje: 'ZATVORENA' }), need('draft', { stanje: 'NACRT' })]),
      applications: known([application('x'), application('y'), application('w', { stanje: 'WITHDRAWN' }), application('s', { stanje: 'SELECTED', dogovorId: 'g' })]),
      agreements: known([agreement('1', 'narucilac'), agreement('2', 'uskocer'), agreement('3', 'uskocer'), agreement('old', 'uskocer', { stanje: 'COMPLETED' })]) }));
    const activities = home.activities.kind === 'known' ? home.activities.value : null;
    expect(activities?.rows.map(row => row.id)).toEqual(['need:n0', 'application:x', 'need:n1', 'application:y', 'need:n2']);
    expect(activities?.more).toBe(4);
    expect(home.agreements).toEqual(known({ more: 1, rows: [expect.objectContaining({ id: 'agreement:1' }), expect.objectContaining({ id: 'agreement:2' })] }));
  });

  it('a draft says it is a draft and leads back into it', () => {
    const home = composeHome(reads({ needs: known([need('d', { stanje: 'NACRT' })]) }));
    expect(home.activities).toEqual(known({ more: 0, rows: [{ id: 'need:d', relation: 'OWNED', title: 'Zadatak d', detail: 'Nacrt · nije objavljen',
      target: { kind: 'NEED', needId: 'd' } }] }));
  });
});

describe('Moje aktivnosti v1 — the things I am part of, filtered by what I am to them', () => {
  const all = reads({
    needs: known([need('open', { brojPrijava: 2 }), need('draft', { stanje: 'NACRT' }), need('closed', { stanje: 'ZATVORENA' })]),
    applications: known([application('wait'), application('gone', { stanje: 'WITHDRAWN' }),
      application('won', { stanje: 'SELECTED', dogovorId: 'g-live' }), application('done', { stanje: 'SELECTED', dogovorId: 'g-done' })]),
    agreements: known([agreement('g-live', 'uskocer'), agreement('g-done', 'uskocer', { stanje: 'COMPLETED' })]) });

  it('lists both sides together when active, each row saying which side it is', () => {
    const page = composeActivities(all, { relation: 'ALL', period: 'ACTIVE' });
    expect(page.kind).toBe('known');
    expect(page.kind === 'known' ? page.value.map(row => [row.id, row.relation]) : null).toEqual([
      ['need:open', 'OWNED'], ['application:wait', 'APPLIED'], ['need:draft', 'OWNED'], ['application:won', 'APPLIED']]);
  });

  it('filters by relation without consulting any mode', () => {
    const owned = composeActivities(all, { relation: 'OWNED', period: 'ACTIVE' });
    const applied = composeActivities(all, { relation: 'APPLIED', period: 'ACTIVE' });
    expect(owned.kind === 'known' ? owned.value.map(row => row.id) : null).toEqual(['need:open', 'need:draft']);
    expect(applied.kind === 'known' ? applied.value.map(row => row.id) : null).toEqual(['application:wait', 'application:won']);
  });

  it('history holds what is over: a closed task, a withdrawn application, and a selected one whose Dogovor has ended', () => {
    const page = composeActivities(all, { relation: 'ALL', period: 'HISTORY' });
    expect(page.kind === 'known' ? page.value.map(row => row.id) : null).toEqual(['need:closed', 'application:gone', 'application:done']);
  });

  it('a selected application leads to its own Dogovor, and one whose Dogovor cannot be read stays where it can be found', () => {
    const page = composeActivities(all, { relation: 'APPLIED', period: 'ACTIVE' });
    expect(page.kind === 'known' ? page.value.find(row => row.id === 'application:won') : null).toEqual({ id: 'application:won', relation: 'APPLIED',
      title: 'Tuđ zadatak won', detail: 'Tvoja prijava je izabrana · otvori Dogovor', target: { kind: 'AGREEMENT', agreementId: 'g-live' } });
    const blind = composeActivities({ ...all, agreements: { kind: 'unavailable' } }, { relation: 'APPLIED', period: 'ACTIVE' });
    expect(blind.kind === 'known' ? blind.value.map(row => row.id) : null).toEqual(['application:wait', 'application:won', 'application:done']);
  });

  it('never shows a side that could not be read as a side with nothing in it', () => {
    expect(composeActivities({ ...all, needs: { kind: 'unavailable' } }, { relation: 'OWNED', period: 'ACTIVE' })).toEqual({ kind: 'unavailable' });
    const mixed = composeActivities({ ...all, needs: { kind: 'unavailable' } }, { relation: 'ALL', period: 'ACTIVE' });
    expect(mixed).toEqual({ kind: 'partial', missing: ['needs'], value: [expect.objectContaining({ id: 'application:wait' }), expect.objectContaining({ id: 'application:won' })] });
  });
});

describe('what comes next (PKG-023a)', () => {
  it('shows the two Dogovori that start soonest, and keeps the ones with no term behind them', () => {
    const rows = [
      agreement('later', 'narucilac', { pocinje: '2026-09-25T09:00:00Z' }),
      agreement('undated', 'uskocer', { pocinje: null }),
      agreement('soonest', 'uskocer', { pocinje: '2026-09-20T07:00:00Z' }),
    ];
    const home = composeHome({ needs: { kind: "known", value: [] }, applications: { kind: "known", value: [] },
      agreements: { kind: 'known', value: rows } });
    expect(home.agreements.kind).toBe('known');
    if (home.agreements.kind !== 'known') return;
    expect(home.agreements.value.rows.map(row => row.id)).toEqual(['agreement:soonest', 'agreement:later']);
    expect(home.agreements.value.more).toBe(1);
  });
});
