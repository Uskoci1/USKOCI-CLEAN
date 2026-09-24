import { discoveryFiltered, discoveryItems, discoveryStartSnap, happensIn, initialMarketplaceView, marketplaceItems, pinLabel, pinPlaces,
  pointKey, publicFeatures, saysWorkMode, workMode, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';

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
  it('"2 ili više" keeps tasks with at least two open places', () => {
    const rows = [item('one', { pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 0.66 } }), item('two'), item('five', { pokrivenost: { ukupno: 5, popunjeno: 0, preostalo: 5, udeo: 0 } })];
    expect(ids(marketplaceItems(rows, view({ places: 'two' }), false, NOW))).toEqual(['two', 'five']);
  });
  it('the price filter is the existing one, and the filters combine', () => {
    const rows = [item('price'), item('offers', { rezimCene: 'OFFERS', ponudjenaCena: undefined, detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] })];
    expect(ids(marketplaceItems(rows, view({ price: 'OFFERS' }), false, NOW))).toEqual(['offers']);
    expect(ids(marketplaceItems(rows, view({ price: 'OFFERS', where: 'onsite' }), false, NOW))).toEqual([]);
    expect(discoveryFiltered(view())).toBe(false);
    for (const patch of [{ price: 'MY_PRICE' as const }, { when: 'week' as const }, { where: 'remote' as const }, { places: 'two' as const }]) expect(discoveryFiltered(view(patch))).toBe(true);
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
