import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryItems, discoveryStartSnap, happensBetween, happensIn,
  initialMarketplaceView, marketplaceItems, pinLabel, pinPlaces, placeSuggestions, pointKey, publicArea, publicFeatures, saysWhen,
  saysWorkMode, serbianToday, undatedCount, workMode, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { conditionsWords, datesWords, placesWords, whenWords, whereWords } from '../../ui/v2/discovery/discoveryWords';

/**
 * Zadaci as one screen (owner step 4, 2026-09-24): the pure rules under it. The four filter sections read only facts the
 * tasks already carry, a view without them filters exactly as before, the list sheet starts where the rule says, a pin
 * says money only when there is an amount, and tasks rounded to one public point are one reachable place.
 */
const item = (id: string, patch: Partial<MarketplaceItem> & Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`,
  podrucjeTekst: 'Beograd', vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: { lat: 44.81, lng: 20.46 }, taskTimezone: 'Europe/Belgrade', ...patch } as MarketplaceItem);
const ids = (rows: readonly MarketplaceItem[]) => rows.map(row => row.id);
const view = (patch: Partial<MarketplaceView> = {}): MarketplaceView => ({ ...initialMarketplaceView(), ...patch });
// Thursday 24 September 2026, 10:00 in Belgrade (08:00 UTC). The week ends on Sunday the 27th.
const NOW = new Date('2026-09-24T08:00:00Z');
const window = (startsAt: string | null, endsAt: string | null = null) => ({ schedule: { kind: 'FIXED_WINDOW' as const, startsAt, endsAt } });

describe('Kada, read in the task\'s own zone', () => {
  const today = item('today', window('2026-09-24T14:00:00+02:00', '2026-09-24T16:00:00+02:00'));
  const tomorrow = item('tomorrow', window('2026-09-25T09:00:00+02:00', '2026-09-25T11:00:00+02:00'));
  const sunday = item('sunday', window('2026-09-27T09:00:00+02:00'));
  const nextWeek = item('next-week', window('2026-09-29T09:00:00+02:00'));
  const past = item('past', window('2026-09-20T09:00:00+02:00', '2026-09-20T12:00:00+02:00'));
  // 23:30 UTC on the 24th is already 01:30 on the 25th in Belgrade: tomorrow there, whatever the phone's zone.
  const lateUtc = item('late-utc', window('2026-09-24T23:30:00Z'));
  // A window that runs into the day and ends exactly at midnight belongs to the day before it.
  const toMidnight = item('to-midnight', window('2026-09-24T20:00:00+02:00', '2026-09-25T00:00:00+02:00'));
  const running = item('running', window('2026-09-23T09:00:00+02:00', '2026-09-26T18:00:00+02:00'));
  const rows = [today, tomorrow, sunday, nextWeek, past, lateUtc, toMidnight, running];
  it('Danas, Sutra and Ove nedelje take the days a window touches', () => {
    expect(ids(marketplaceItems(rows, view({ when: 'today' }), false, NOW))).toEqual(['today', 'to-midnight', 'running']);
    expect(ids(marketplaceItems(rows, view({ when: 'tomorrow' }), false, NOW))).toEqual(['tomorrow', 'late-utc', 'running']);
    expect(ids(marketplaceItems(rows, view({ when: 'week' }), false, NOW))).toEqual(['today', 'tomorrow', 'sunday', 'late-utc', 'to-midnight', 'running']);
    expect(ids(marketplaceItems(rows, view({ when: 'any' }), false, NOW))).toEqual(ids(rows));
  });
  it('flexible words without dates mean what the card says; any-time work fits any day; an unknown or incomplete schedule fits no day', () => {
    const flexible = (id: string, kind: 'TODAY_FLEXIBLE' | 'TOMORROW_FLEXIBLE' | 'WEEK_FLEXIBLE' | 'FLEXIBLE' | 'REMOTE_ANYTIME') =>
      item(id, { schedule: { kind, startsAt: null, endsAt: null } });
    const rows2 = [flexible('danas', 'TODAY_FLEXIBLE'), flexible('sutra', 'TOMORROW_FLEXIBLE'), flexible('nedelja', 'WEEK_FLEXIBLE'),
      flexible('bilo-kad', 'FLEXIBLE'), flexible('daljina', 'REMOTE_ANYTIME'), item('bez-rasporeda'), item('nepotpun', window(null, '2026-09-24T12:00:00+02:00'))];
    expect(ids(marketplaceItems(rows2, view({ when: 'today' }), false, NOW))).toEqual(['danas', 'nedelja', 'bilo-kad', 'daljina']);
    expect(ids(marketplaceItems(rows2, view({ when: 'tomorrow' }), false, NOW))).toEqual(['sutra', 'nedelja', 'bilo-kad', 'daljina']);
    // A flexible range is read by its dates when it has them.
    const range = item('range', { schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-28T00:00:00+02:00', endsAt: '2026-10-02T00:00:00+02:00' } });
    expect(happensIn(range, 'week', NOW)).toBe(false);
    expect(happensIn(range, 'any', NOW)).toBe(true);
  });
  it('an unreadable zone or instant never matches a day and never throws', () => {
    expect(happensIn(item('zone', { ...window('2026-09-24T14:00:00+02:00'), taskTimezone: 'Nije/Zona' }), 'today', NOW)).toBe(false);
    expect(happensIn(item('instant', window('24. 9. 2026')), 'today', NOW)).toBe(false);
  });
});

describe('Gde se radi, Slobodna mesta, Cena', () => {
  const remote = item('remote', { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] });
  const onsite = item('onsite', { detalji: { rezimLokacije: 'STATIONARY' } as MarketplaceItem['detalji'] });
  const unsaid = item('unsaid');
  it('reads the work mode only from the task, and a task that does not say is in neither set', () => {
    expect([workMode(remote), workMode(onsite), workMode(unsaid)]).toEqual(['remote', 'onsite', null]);
    expect(ids(marketplaceItems([remote, onsite, unsaid], view({ where: 'remote' }), false, NOW))).toEqual(['remote']);
    expect(ids(marketplaceItems([remote, onsite, unsaid], view({ where: 'onsite' }), false, NOW))).toEqual(['onsite']);
    expect(saysWorkMode([unsaid])).toBe(false); expect(saysWorkMode([unsaid, remote])).toBe(true);
  });
  // Discovery V47: "Koliko vas dolazi" is a count of people, at least n open places; the old "2 ili više" is n = 2.
  it('"Koliko vas dolazi" keeps tasks with at least that many open places; 1 is every open task', () => {
    const rows = [item('one', { pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 0.66 } }), item('two'), item('five', { pokrivenost: { ukupno: 5, popunjeno: 0, preostalo: 5, udeo: 0 } })];
    expect(ids(marketplaceItems(rows, view({ places: 2 }), false, NOW))).toEqual(['two', 'five']);
    expect(ids(marketplaceItems(rows, view({ places: 3 }), false, NOW))).toEqual(['five']);
    expect(ids(marketplaceItems(rows, view({ places: 1 }), false, NOW))).toEqual(['one', 'two', 'five']);
    // Anything that is not a whole count from 1 is every open task, and the count never passes its ceiling.
    for (const odd of [0, -2, 1.5, Number.NaN, '2', undefined]) expect(atLeast(odd)).toBe(1);
    expect(atLeast(99)).toBe(10);
  });
  it('the price filter is the existing one, and the filters combine', () => {
    const rows = [item('price'), item('offers', { rezimCene: 'OFFERS', ponudjenaCena: undefined, detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] })];
    expect(ids(marketplaceItems(rows, view({ price: 'OFFERS' }), false, NOW))).toEqual(['offers']);
    expect(ids(marketplaceItems(rows, view({ price: 'OFFERS', where: 'onsite' }), false, NOW))).toEqual([]);
    expect(discoveryFiltered(view())).toBe(false);
    for (const patch of [{ price: 'MY_PRICE' as const }, { when: 'week' as const }, { where: 'remote' as const }, { places: 2 }, { dates: { from: '2026-09-25', to: '2026-09-26' } }])
      expect(discoveryFiltered(view(patch))).toBe(true);
    // "Uslovi pretrage" counts the conditions that are on; a place, searched words and the map's area are "Gde", not conditions.
    expect(discoveryConditions(view({ when: 'today', where: 'remote', places: 3, price: 'OFFERS' }))).toBe(4);
    expect(discoveryConditions(view({ dates: { from: '2026-09-25', to: '2026-09-26' }, when: 'any' }))).toBe(1);
    expect(discoveryConditions(view({ place: 'Novi Sad', query: 'selidba', area: [19, 45, 20, 46] }))).toBe(0);
  });
  it('defaults change nothing: a view written before the filters existed filters exactly as the new defaults do', () => {
    const rows = [item('a', window('2020-01-01T00:00:00Z')), item('b', { pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 } }), item('c', { detalji: null as never })];
    const old = { query: '', section: 'active', attention: false, price: 'all', mode: 'list', area: null, viewport: null, selectedId: null } as MarketplaceView;
    expect(ids(marketplaceItems(rows, old, false))).toEqual(['a', 'b', 'c']);
    expect(ids(marketplaceItems(rows, initialMarketplaceView(), false))).toEqual(['a', 'b', 'c']);
  });
});

describe('the Zadaci list and its sheet', () => {
  it('never lists my own tasks, whatever the filters, and lists everything when nothing is known', () => {
    const rows = [item('mine'), item('other'), item('applied')];
    expect(ids(discoveryItems(rows, view(), new Set(['mine']), NOW))).toEqual(['other', 'applied']);
    expect(ids(discoveryItems(rows, view(), undefined, NOW))).toEqual(['mine', 'other', 'applied']);
    expect(ids(discoveryItems(rows, view({ query: 'mine' }), new Set(['mine']), NOW))).toEqual([]);
  });
  it.each([
    [6, 4, 'half'], [6, 3, 'half'], [6, 2, 'peek'], [6, 0, 'peek'], [4, 1, 'peek'],
    [3, 0, 'half'], [1, 0, 'half'], [0, 0, 'half'],
    // Nothing on the map at all: the list takes the screen.
    [5, 5, 'full'], [1, 1, 'full'],
  ] as const)('%i shown, %i without a pin → %s', (shown, withoutPin, snap) => {
    expect(discoveryStartSnap(shown, withoutPin)).toBe(snap);
  });
});

describe('what a pin says', () => {
  // Review r3 item 1 (2026-09-24): this pinned a long RSD amount shortened to its bare number ("120.000"), which broke
  // the `Novac` contract (never a number without its currency). Every amount now keeps its currency, whatever its length.
  it('an amount is money, exactly as the read formatted it, and never loses its currency however long it is', () => {
    expect(pinLabel(item('a'))).toEqual({ text: '6.000 RSD', tone: 'money', spoken: '6.000 RSD' });
    expect(pinLabel(item('b', { ponudjenaCena: { iznos: 120000, valuta: 'RSD', prikaz: '120.000 RSD' } }))).toEqual({ text: '120.000 RSD', tone: 'money', spoken: '120.000 RSD' });
    // Another currency is never relabelled as a bare number either.
    expect(pinLabel(item('c', { ponudjenaCena: { iznos: 1200000, valuta: 'EUR', prikaz: '1.200.000 EUR' } })).text).toBe('1.200.000 EUR');
  });
  it('a task that asks for offers says so quietly and never wears the money tone, even with a stale amount on it', () => {
    const offers = pinLabel(item('o', { rezimCene: 'OFFERS' }));
    expect(offers).toEqual({ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' });
    expect(offers.tone).not.toBe('money');
  });
  it('no price is no words on the pin and an honest sentence to a screen reader; never an invented amount', () => {
    for (const patch of [{ ponudjenaCena: undefined }, { ponudjenaCena: { iznos: 0, valuta: 'RSD', prikaz: '' } }, { rezimCene: undefined, ponudjenaCena: undefined }])
      expect(pinLabel(item('n', patch))).toEqual({ text: '', tone: 'none', spoken: 'Cena nije navedena' });
  });
});

describe('tasks on one public point', () => {
  it('group by the rounded point the map draws, in the list order; a remote or pinless task is in no place', () => {
    const rows = [item('a', { priblizno: { lat: 44.8144, lng: 20.4621 } }), item('b', { priblizno: { lat: 44.8103, lng: 20.4588 } }),
      item('c', { priblizno: { lat: 44.83, lng: 20.41 } }), item('d', { priblizno: null }), item('e', { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] })];
    const places = pinPlaces(rows);
    expect([...places.values()]).toEqual([
      { key: '44.81,20.46', point: { lat: 44.81, lng: 20.46 }, ids: ['a', 'b'] },
      { key: '44.83,20.41', point: { lat: 44.83, lng: 20.41 }, ids: ['c'] },
    ]);
    expect(pointKey({ lat: 0, lng: 0 })).toBe('0.00,0.00');
    // The native source is unchanged by the grouping: one feature per task, IDs and rounded points only.
    expect(publicFeatures(rows).features.map(feature => feature.properties)).toEqual([{ needId: 'a' }, { needId: 'b' }, { needId: 'c' }]);
  });
});

/**
 * Discovery V47: the search panel's choices, as pure rules. Kada has two more flexible words and a range of dates; "Gde"
 * offers only the areas the loaded tasks name; a time choice never hides a task without a date silently.
 */
describe('Discovery V47: Kada', () => {
  const flexible = (id: string, kind: 'TODAY_FLEXIBLE' | 'TOMORROW_FLEXIBLE' | 'WEEK_FLEXIBLE' | 'FLEXIBLE') => item(id, { schedule: { kind, startsAt: null, endsAt: null } });
  const on = (id: string, day: string) => item(id, window(`${day}T10:00:00+02:00`, `${day}T12:00:00+02:00`));
  const days = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30', '2026-10-01'];
  const rows = days.map(day => on(day, day));
  it('"Ovaj vikend" is the coming Saturday and Sunday; on a weekend day, what is left of it', () => {
    expect(ids(marketplaceItems(rows, view({ when: 'weekend' }), false, NOW))).toEqual(['2026-09-26', '2026-09-27']);
    const saturday = new Date('2026-09-26T08:00:00Z'), sunday = new Date('2026-09-27T08:00:00Z');
    expect(ids(marketplaceItems(rows, view({ when: 'weekend' }), false, saturday))).toEqual(['2026-09-26', '2026-09-27']);
    expect(ids(marketplaceItems(rows, view({ when: 'weekend' }), false, sunday))).toEqual(['2026-09-27']);
  });
  it('"Narednih 7 dana" is today and the six days after it', () => {
    expect(ids(marketplaceItems(rows, view({ when: 'next7' }), false, NOW))).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30']);
  });
  it('a range of dates keeps the tasks whose work days touch it; a flexible task is read by what its words mean', () => {
    const range = { from: '2026-09-26', to: '2026-09-28' };
    expect(ids(marketplaceItems(rows, view({ dates: range }), false, NOW))).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    // A range wins over a stale flexible word: the two are one choice.
    expect(ids(marketplaceItems(rows, view({ dates: range, when: 'today' }), false, NOW))).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    const week = flexible('ove-nedelje', 'WEEK_FLEXIBLE'), anytime = flexible('bilo-kad', 'FLEXIBLE'), today = flexible('danas', 'TODAY_FLEXIBLE');
    expect(happensBetween(week, range, NOW)).toBe(true);
    expect(happensBetween(anytime, range, NOW)).toBe(true);
    expect(happensBetween(today, range, NOW)).toBe(false);
    // A task whose schedule names no day matches no range.
    expect(happensBetween(item('bez-rasporeda'), range, NOW)).toBe(false);
  });
  it('only a real range of real days is read; anything else is no range at all', () => {
    expect(dateRange({ from: '2026-09-26', to: '2026-09-28' })).toEqual({ from: '2026-09-26', to: '2026-09-28' });
    for (const odd of [{ from: '2026-09-28', to: '2026-09-26' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '26.9.', to: '28.9.' }, null, 'x'])
      expect(dateRange(odd)).toBeNull();
    expect(ids(marketplaceItems(rows, view({ dates: { from: '2026-09-28', to: '2026-09-26' } }), false, NOW))).toEqual(ids(rows));
  });
  it('a time choice says how many tasks it leaves out only because they name no day; with no time choice it says nothing', () => {
    const list = [...rows, item('bez-rasporeda'), item('nepotpun', window(null, '2026-09-24T12:00:00+02:00')), item('moj-bez-rasporeda')];
    expect(undatedCount(list, view(), undefined, NOW)).toBe(0);
    expect(undatedCount(list, view({ when: 'weekend' }), new Set(['moj-bez-rasporeda']), NOW)).toBe(2);
    expect(undatedCount(list, view({ dates: { from: '2026-09-26', to: '2026-09-26' } }), undefined, NOW)).toBe(3);
    // It counts only what the other filters leave: a search that finds none of them leaves none out.
    expect(undatedCount(list, view({ when: 'weekend', query: 'Pomoć 2026' }), undefined, NOW)).toBe(0);
    expect(saysWhen([item('bez-rasporeda')], NOW)).toBe(false); expect(saysWhen(list, NOW)).toBe(true);
  });
  it('today in Serbian time is the day the grid starts from, whatever the phone\'s zone', () => {
    expect(serbianToday(new Date('2026-09-24T21:30:00Z'))).toBe('2026-09-24');
    expect(serbianToday(new Date('2026-09-24T22:30:00Z'))).toBe('2026-09-25');
  });
});

describe('Discovery V47: Gde', () => {
  const at = (id: string, podrucjeTekst: string, patch: Record<string, unknown> = {}) => item(id, { podrucjeTekst, ...patch });
  const rows = [at('a', 'Liman, Novi Sad'), at('b', 'Liman,  Novi Sad'), at('c', 'Vračar, Beograd', { rezimCene: 'OFFERS', ponudjenaCena: undefined }),
    at('d', 'Na daljinu', { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'], priblizno: null }),
    at('e', 'Lokacija nije navedena', { priblizno: null }), at('mine', 'Zemun, Beograd')];
  it('a place is the public area a task names: never a remote task\'s words or the words for no area', () => {
    expect(rows.map(publicArea)).toEqual(['Liman, Novi Sad', 'Liman, Novi Sad', 'Vračar, Beograd', null, null, 'Zemun, Beograd']);
  });
  it('the suggestions are only the areas the loaded tasks that are not mine name, each with its count under the other conditions', () => {
    expect(placeSuggestions(rows, view(), new Set(['mine']), NOW)).toEqual([{ text: 'Liman, Novi Sad', count: 2 }, { text: 'Vračar, Beograd', count: 1 }]);
    // Counted under the other conditions: a price choice leaves one place; the searched words and the map's area do not count.
    expect(placeSuggestions(rows, view({ price: 'OFFERS', query: 'nema', area: [0, 0, 1, 1] }), new Set(['mine']), NOW))
      .toEqual([{ text: 'Vračar, Beograd', count: 1 }]);
  });
  it('choosing a place keeps the tasks that name it, however the spacing or the case', () => {
    expect(ids(marketplaceItems(rows, view({ place: 'liman, novi sad' }), false, NOW))).toEqual(['a', 'b']);
    expect(ids(marketplaceItems(rows, view({ place: 'Nigde' }), false, NOW))).toEqual([]);
    expect(ids(marketplaceItems(rows, view({ place: null }), false, NOW))).toEqual(ids(rows));
  });
});

describe('Discovery V47: the words of the search', () => {
  it('the pill says where, then when and the conditions, or invites to add them', () => {
    expect(whereWords(view())).toBe('Svi zadaci');
    expect(whereWords(view({ area: [19, 45, 20, 46] }))).toBe('Oblast sa mape');
    expect(whereWords(view({ query: ' farbanje ' }))).toBe('„farbanje“');
    expect(whereWords(view({ place: 'Liman, Novi Sad', query: 'selidba', area: [19, 45, 20, 46] }))).toBe('Liman, Novi Sad · „selidba“');
    expect(conditionsWords(view(), NOW)).toBe('Bilo kada · Dodaj uslove');
    expect(conditionsWords(view({ when: 'weekend', places: 2 }), NOW)).toBe('Ovaj vikend · 2+ mesta');
    expect(conditionsWords(view({ where: 'remote', price: 'OFFERS' }), NOW)).toBe('Bilo kada · Onlajn · Ponude');
    expect(placesWords(1)).toBe('Bilo koliko'); expect(placesWords(4)).toBe('4+ mesta');
  });
  it('a range of days is written once, the month once when it can be', () => {
    expect(datesWords({ from: '2026-09-26', to: '2026-09-26' }, NOW)).toBe('26. sep');
    expect(datesWords({ from: '2026-09-26', to: '2026-09-28' }, NOW)).toBe('26–28. sep');
    expect(datesWords({ from: '2026-09-30', to: '2026-10-02' }, NOW)).toBe('30. sep – 2. okt');
    expect(whenWords({ when: 'any', dates: { from: '2026-09-26', to: '2026-09-28' } }, NOW)).toBe('26–28. sep');
    expect(whenWords({ when: 'next7', dates: null }, NOW)).toBe('Narednih 7 dana');
  });
});
