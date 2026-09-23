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
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, ...patch });
const known = <T,>(value: T) => ({ kind: 'known' as const, value });
const reads = (patch: Partial<HomeReads> = {}): HomeReads => ({ needs: known([]), applications: known([]), agreements: known([]), ...patch });

test('PKG-035: history stays visible but only selectable applications require attention', () => {
  const historical = Object.assign(need('history', { brojPrijava: 7 }), { brojPrijavaZaIzbor: 0 });
  const actionable = Object.assign(need('choice', { brojPrijava: 9 }), { brojPrijavaZaIzbor: 2 });
  const home = composeHome(reads({ needs: known([historical, actionable]) }));
  expect(home.attention).toEqual([{ id: 'need:choice:applications', title: '2 prijave',
    detail: 'Zadatak choice · čeka tvoj izbor', target: { kind: 'CANDIDATES', needId: 'choice' } }]);
  expect(home.attentionMore).toBe(0);
  // Both stay active tasks (history is not hidden); only the one with a selectable application waits for a choice.
  // (The activity preview that showed "7 prijava" is retired, 2026-09-23; the count is Početna's "Moji zadaci" row.)
  expect(home.mine.tasks).toEqual(known({ total: 2, active: 2, waiting: 1, drafts: 0, history: 0 }));
});

test('PKG-035: historical totals never substitute for an unknown actionable count', () => {
  const home = composeHome(reads({ needs: known([need('legacy', { brojPrijava: 7 })]) }));
  expect(home.attention).toEqual([]);
});

describe('Početna — composed from the reads that already exist, with no mode', () => {
  it('an account with nothing has no attention, no rows and no invented numbers, and is a first run', () => {
    expect(composeHome(reads())).toEqual({ attention: [], attentionMore: 0, agreements: known({ rows: [], more: 0 }),
      mine: { tasks: known({ total: 0, active: 0, waiting: 0, drafts: 0, history: 0 }), applications: known({ total: 0, attention: 0, active: 0, finished: 0 }) },
      partial: false, firstRun: true, ratingsDue: 0 });
  });

  it('is a first run only when every read answered and nothing exists at all', () => {
    expect(composeHome(reads({ needs: known([need('done', { stanje: 'ZATVORENA' })]) })).firstRun).toBe(false);
    expect(composeHome(reads({ agreements: known([agreement('old', 'uskocer', { stanje: 'COMPLETED' })]) })).firstRun).toBe(false);
    expect(composeHome(reads({ applications: { kind: 'unavailable' } })).firstRun).toBe(false);
    expect(composeHome(reads(), { kind: 'unavailable' }).firstRun).toBe(false);
    expect(composeHome(reads(), { kind: 'known', value: { rows: [], more: 0, asOf: '2026-09-23T10:00:00Z' } }).firstRun).toBe(true);
  });

  it("names the completed Dogovori that still wait for my rating, the same ones Dogovori/Aktivni lists (2026-09-23)", () => {
    const home = composeHome(reads({ agreements: known([agreement("done-1", "uskocer", { stanje: "COMPLETED", ocenaMoguca: true }),
      agreement("done-2", "uskocer", { stanje: "COMPLETED", ocenaMoguca: true }), agreement("rated", "uskocer", { stanje: "COMPLETED", ocenaMoguca: false }),
      agreement("soon", "narucilac")]) }));
    expect(home.ratingsDue).toBe(2);
    // A completed Dogovor is not a next one: the scheduled list keeps only the confirmed one.
    expect(home.agreements).toEqual(known({ more: 0, rows: [expect.objectContaining({ id: "agreement:soon" })] }));
  });

  it('holds both sides of one account at once and says on the next Dogovor what I am to it', () => {
    const home = composeHome(reads({ needs: known([need('a')]), applications: known([application('c')]),
      agreements: known([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]) }));
    expect(home.mine).toEqual({ tasks: known({ total: 1, active: 1, waiting: 0, drafts: 0, history: 0 }),
      applications: known({ total: 1, attention: 0, active: 1, finished: 0 }) });
    // One next Dogovor (2026-09-23); the other is one tab away and is counted, not dropped.
    expect(home.agreements).toEqual(known({ more: 1, rows: [
      { id: 'agreement:g-a', title: 'Dogovor g-a', detail: 'Tvoj zadatak · Jelena · danas 17h', target: { kind: 'AGREEMENT', agreementId: 'g-a' } }] }));
    expect(composeHome(reads({ agreements: known([agreement('g-c', 'uskocer')]) })).agreements).toEqual(known({ more: 0, rows: [
      { id: 'agreement:g-c', title: 'Dogovor g-c', detail: 'Uskačeš · Jelena · danas 17h', target: { kind: 'AGREEMENT', agreementId: 'g-c' } }] }));
    expect(home.firstRun).toBe(false);
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

  it('a section that could not be read is unavailable, never empty or zero, and the rest still stands', () => {
    const home = composeHome(reads({ needs: { kind: 'unavailable' }, applications: known([application('c')]) }));
    expect(home.partial).toBe(true); expect(home.firstRun).toBe(false);
    expect(home.mine).toEqual({ tasks: { kind: 'unavailable' }, applications: known({ total: 1, attention: 0, active: 1, finished: 0 }) });
    expect(composeHome(reads({ needs: { kind: 'unavailable' }, applications: { kind: 'unavailable' } })).mine)
      .toEqual({ tasks: { kind: 'unavailable' }, applications: { kind: 'unavailable' } });
    expect(composeHome(reads({ agreements: { kind: 'unavailable' } })).agreements).toEqual({ kind: 'unavailable' });
  });

  it('counts each side by the rule of the list it opens, and shows the one next Dogovor', () => {
    const home = composeHome(reads({
      needs: known([...Array.from({ length: 6 }, (_, i) => need(`n${i}`)), need('choice', { brojPrijava: 2, brojPrijavaZaIzbor: 2 }),
        need('done', { stanje: 'ZATVORENA' }), need('draft', { stanje: 'NACRT' })]),
      applications: known([application('x'), application('y'), application('t', { traziPaznju: true }), application('w', { stanje: 'WITHDRAWN' }),
        application('s', { stanje: 'SELECTED', dogovorId: 'g' })]),
      agreements: known([agreement('1', 'narucilac'), agreement('2', 'uskocer'), agreement('3', 'uskocer'), agreement('old', 'uskocer', { stanje: 'COMPLETED' })]) }));
    // Moji zadaci: Aktivni 7 (one of them waits for a choice), Nacrti 1, Istorija 1.
    expect(home.mine.tasks).toEqual(known({ total: 9, active: 7, waiting: 1, drafts: 1, history: 1 }));
    // Moje prijave: Čeka te 1, Aktivne 2, Završene 2 (withdrawn and selected).
    expect(home.mine.applications).toEqual(known({ total: 5, attention: 1, active: 2, finished: 2 }));
    expect(home.agreements).toEqual(known({ more: 2, rows: [expect.objectContaining({ id: 'agreement:1' })] }));
  });

  it('a draft is counted as a draft, never as an active task', () => {
    const home = composeHome(reads({ needs: known([need('d', { stanje: 'NACRT', brojPrijavaZaIzbor: 1 })]) }));
    expect(home.mine.tasks).toEqual(known({ total: 1, active: 0, waiting: 0, drafts: 1, history: 0 }));
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
  it('shows the Dogovor that starts soonest, and keeps the ones with no term behind it', () => {
    const rows = [
      agreement('later', 'narucilac', { pocinje: '2026-09-25T09:00:00Z' }),
      agreement('undated', 'uskocer', { pocinje: null }),
      agreement('soonest', 'uskocer', { pocinje: '2026-09-20T07:00:00Z' }),
    ];
    const home = composeHome({ needs: { kind: "known", value: [] }, applications: { kind: "known", value: [] },
      agreements: { kind: 'known', value: rows } });
    expect(home.agreements.kind).toBe('known');
    if (home.agreements.kind !== 'known') return;
    expect(home.agreements.value.rows.map(row => row.id)).toEqual(['agreement:soonest']);
    expect(home.agreements.value.more).toBe(2);
    // With the soonest gone, the dated one still comes before the undated one.
    const rest = composeHome({ needs: { kind: 'known', value: [] }, applications: { kind: 'known', value: [] },
      agreements: { kind: 'known', value: rows.filter(row => row.id !== 'soonest') } });
    expect(rest.agreements.kind === 'known' ? rest.agreements.value.rows.map(row => row.id) : null).toEqual(['agreement:later']);
  });
});
