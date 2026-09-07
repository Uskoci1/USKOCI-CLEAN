/** @jest-environment node */
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));

import { createClient } from '@supabase/supabase-js';
import { createDiscoveryClientService } from '../discoveryClientService';
import type { JavniProfilProjekcija } from '../../contracts/projections';

const id = (n: number) => `10000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const time = '2026-09-07T10:00:00.123456+00:00';
const row = (n = 1, override: Record<string, unknown> = {}) => ({
  id: id(n), title: 'Pomoć oko selidbe', status: 'PUBLISHED', created_at: time,
  starts_at: null, ends_at: null, schedule_kind: 'FLEXIBLE', execution_location_mode: 'STATIONARY',
  approximate_city: 'Beograd', approximate_area: 'Centar', approximate_lat: 44.8, approximate_lng: 20.4,
  required_slots: 2, covered_slots: 0, required_skills: ['Selidbe'], required_tools: [], required_vehicles: ['Kombi'],
  mode: 'OFFERS', requester_price_rsd: null, requester_profile_id: id(100 + n), response_deadline: null,
  ...override,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
function setup() {
  const fetch = jest.fn();
  const publicProfile = jest.fn<Promise<JavniProfilProjekcija | null>, [string]>().mockResolvedValue(null);
  const sdk = createClient('http://127.0.0.1:54321', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  const service = createDiscoveryClientService({ client: () => sdk, publicProfile });
  const url = (n = 0) => new URL(String(fetch.mock.calls[n][0]));
  return { service, fetch, publicProfile, url };
}

describe('actual PostgREST SDK discovery read adapter (controlled HTTP only)', () => {
  it('keeps lifecycle separate from price mode and carries complete public time and origin into the DTO', async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValue(respond([row(1, { mode: 'MY_PRICE', requester_price_rsd: 4500,
      execution_location_mode: 'POINT_TO_POINT', schedule_kind: 'FIXED_WINDOW',
      starts_at: '2026-09-08T14:00:00Z', ends_at: '2026-09-08T18:00:00Z', covered_slots: 2 })]));
    const item = (await service.otvorenePrilikeStrana()).items[0];
    expect(item).toMatchObject({ statusTekst: 'Objavljen zadatak', primaNovePrijave: false,
      podrucjeTekst: 'Polazište: Centar, Beograd', ponudjenaCena: { iznos: 4500 } });
    expect(item.statusTekst).not.toMatch(/ponude|Otvorene prijave/);
    expect(item.vremeTekst).toContain('16:00–20:00');
    expect(item.vremeTekst).toContain('vreme u Srbiji');
  });

  it('uses a bounded public GET and one identical item set for list and map, with safe zero coordinates', async () => {
    const { service, fetch, url } = setup();
    fetch.mockResolvedValue(respond([row(2, { approximate_lat: 0, approximate_lng: 0 }), row(1, {
      execution_location_mode: 'REMOTE', approximate_lat: 44, approximate_lng: 20,
      requester_account_id: 'must-not-leak', exact_address: 'must-not-leak', private_terms: 'must-not-leak',
    })]));
    const page = await service.otvorenePrilikeStrana();
    expect(url().pathname).toBe('/rest/v1/needs');
    expect(fetch.mock.calls[0][1].method).toBe('GET');
    expect(url().searchParams.get('status')).toBe('in.(PUBLISHED,SELECTION)');
    expect(url().searchParams.get('order')).toBe('created_at.desc,id.desc');
    expect(url().searchParams.get('limit')).toBe('31');
    const selected = url().searchParams.get('select')!.split(',');
    expect(selected).toEqual(expect.arrayContaining(['execution_location_mode', 'schedule_kind', 'response_deadline', 'covered_slots']));
    expect(selected).not.toEqual(expect.arrayContaining(['requester_account_id']));
    expect(selected.join(',')).not.toMatch(/sensitive|exact|description|responses|app_profiles|private/);
    expect(page.items.map(item => item.id)).toEqual([id(2), id(1)]);
    expect(page.items[0].priblizno).toEqual({ lat: 0, lng: 0 });
    expect(page.items[0].pokrivenost).toEqual({ ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 });
    expect(page.items[1]).toMatchObject({ executionLocationMode: 'REMOTE', priblizno: null, podrucjeTekst: 'Na daljinu' });
    expect(JSON.stringify(page)).not.toContain('must-not-leak');
    expect(page.nextCursor).toBeNull();
  });

  it('preserves microseconds and UUID tie-break in the next SDK query; lookahead is not enriched or displayed', async () => {
    const { service, fetch, url, publicProfile } = setup();
    fetch.mockResolvedValueOnce(respond([row(4), row(3), row(2)]))
      .mockResolvedValueOnce(respond([row(2), row(1, { created_at: '2026-09-07T10:00:00.123455+00:00' })]));
    const first = await service.otvorenePrilikeStrana({ limit: 2 });
    expect(first.nextCursor).toEqual({ createdAt: time, id: id(3) });
    expect(publicProfile.mock.calls.map(call => call[0])).toEqual([id(104), id(103)]);
    const second = await service.otvorenePrilikeStrana({ limit: 2, cursor: first.nextCursor! });
    expect(url(1).searchParams.get('or')).toBe(`(created_at.lt.${time},and(created_at.eq.${time},id.lt.${id(3)}))`);
    expect([...first.items, ...second.items].map(item => item.id)).toEqual([id(4), id(3), id(2), id(1)]);
    expect(second.nextCursor).toBeNull();
    expect(url().searchParams.get('limit')).toBe('3');
  });

  it.each([0, -1, 51, 1.5, NaN, Infinity])('refuses invalid limit %s before HTTP', async limit => {
    const { service, fetch } = setup();
    await expect(service.otvorenePrilikeStrana({ limit })).rejects.toThrow('DISCOVERY_LIMIT_INVALID');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { createdAt: time, id: `${id(1)},status.eq.DRAFT` },
    { createdAt: `${time}),status.eq.DRAFT`, id: id(1) },
    { createdAt: time, id: `${id(1)}\n` },
    { createdAt: `${time}\n`, id: id(1) },
    { createdAt: '2026-02-30T10:00:00Z', id: id(1) },
    { createdAt: '2026-09-07T24:00:00Z', id: id(1) },
  ])('refuses unsafe/invalid cursor before HTTP: %j', async cursor => {
    const { service, fetch } = setup();
    await expect(service.otvorenePrilikeStrana({ cursor })).rejects.toThrow('DISCOVERY_CURSOR_INVALID');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the maximum explicit page bound and refuses an oversized or duplicate server page', async () => {
    const { service, fetch, url } = setup();
    fetch.mockResolvedValueOnce(respond([])).mockResolvedValueOnce(respond([row(1), row(1)]))
      .mockResolvedValueOnce(respond([row(3), row(2), row(1)]));
    await service.otvorenePrilikeStrana({ limit: 50 });
    expect(url().searchParams.get('limit')).toBe('51');
    await expect(service.otvorenePrilikeStrana()).rejects.toThrow('OPPORTUNITIES_RESPONSE_INVALID');
    await expect(service.otvorenePrilikeStrana({ limit: 1 })).rejects.toThrow('OPPORTUNITIES_RESPONSE_INVALID');
  });

  it.each([
    [null, 20], [44, null], [undefined, 20], [NaN, 20], [91, 20], [44, -181], ['0', 20],
  ])('keeps the item without a pin for incomplete/invalid coordinates %j,%j', async (lat, lng) => {
    const { service, fetch } = setup();
    fetch.mockResolvedValue(respond([row(1, { approximate_lat: lat, approximate_lng: lng })]));
    const page = await service.otvorenePrilikeStrana();
    expect(page.items).toHaveLength(1);
    expect(page.items[0].priblizno).toBeNull();
  });
  it.each([[90, 180], [-90, -180], [0, 20], [44, 0]])('retains valid boundary point %j,%j', async (lat, lng) => {
    const { service, fetch } = setup();
    fetch.mockResolvedValue(respond([row(1, { approximate_lat: lat, approximate_lng: lng })]));
    expect((await service.otvorenePrilikeStrana()).items[0].priblizno).toEqual({ lat, lng });
  });
  it.each([
    { required_slots: 0 }, { required_slots: null }, { required_slots: 51 }, { required_slots: 1.5 },
    { covered_slots: null }, { covered_slots: -1 }, { covered_slots: '0' }, { covered_slots: 0.5 },
  ])('never fabricates available capacity from %j', async invalid => {
    const { service, fetch, publicProfile } = setup();
    fetch.mockResolvedValue(respond([row(1, invalid)]));
    await expect(service.otvorenePrilikeStrana()).rejects.toThrow('TASK_CAPACITY_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });
  it('retains actual covered count on overfill, clamps only the visual ratio and disables the hint', async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValue(respond([row(1, { required_slots: 2, covered_slots: 3 })]));
    expect((await service.otvorenePrilikeStrana()).items[0]).toMatchObject({ primaNovePrijave: false,
      pokrivenost: { ukupno: 2, popunjeno: 3, preostalo: 0, udeo: 1 } });
  });

  it('distinguishes error/null/empty and allows an independent read to recover', async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValueOnce(respond({ code: '42501', message: 'Read denied' }, 403))
      .mockResolvedValueOnce(respond(null)).mockResolvedValueOnce(respond([])).mockResolvedValueOnce(respond([row()]));
    await expect(service.otvorenePrilikeStrana()).rejects.toMatchObject({ code: '42501' });
    await expect(service.otvorenePrilikeStrana()).rejects.toThrow('OPPORTUNITIES_RESPONSE_INVALID');
    await expect(service.otvorenePrilikeStrana()).resolves.toEqual({ items: [], nextCursor: null });
    expect((await service.otvorenePrilikeStrana()).items).toHaveLength(1);
  });
  it('preserves detail error vs unavailable and public deadline/status hints', async () => {
    const { service, fetch, url } = setup();
    fetch.mockResolvedValueOnce(respond({ code: '42501', message: 'Read denied' }, 403))
      .mockResolvedValueOnce(respond([]))
      .mockResolvedValueOnce(respond([row(1, { response_deadline: '2020-01-01T00:00:00Z' })]))
      .mockResolvedValueOnce(respond([row(1, { status: 'ACTIVE' })]));
    await expect(service.prilika(id(1))).rejects.toMatchObject({ code: '42501' });
    await expect(service.prilika(id(1))).resolves.toBeNull();
    await expect(service.prilika(id(1))).resolves.toMatchObject({ primaNovePrijave: false, rokZaPrijaveIso: '2020-01-01T00:00:00Z' });
    await expect(service.prilika(id(1))).resolves.toMatchObject({ primaNovePrijave: false, statusTekst: 'Prijave zatvorene' });
    expect(url().searchParams.get('id')).toBe(`eq.${id(1)}`);
    expect(url().searchParams.has('status')).toBe(false); // RLS also admits authorized participants after closure.
  });
  it('refuses missing or malformed public deadline and schedule rather than assuming flexibility', async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValueOnce(respond([row(1, { response_deadline: undefined })]))
      .mockResolvedValueOnce(respond([row(1, { response_deadline: '2026-02-30T00:00:00Z' })]))
      .mockResolvedValueOnce(respond([row(1, { starts_at: 'not-a-date' })]));
    await expect(service.prilika(id(1))).rejects.toThrow('TASK_DEADLINE_INVALID');
    await expect(service.prilika(id(1))).rejects.toThrow('TASK_DEADLINE_INVALID');
    await expect(service.prilika(id(1))).rejects.toThrow('TASK_SCHEDULE_INVALID');
  });

  it('cancels before HTTP and passes the same signal to the actual SDK fetch', async () => {
    const { service, fetch } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(service.otvorenePrilikeStrana({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
    const pending = deferred<Response>(), httpStarted = deferred<void>();
    fetch.mockImplementation(() => { httpStarted.resolve(); return pending.promise; });
    const active = new AbortController();
    const reading = service.otvorenePrilikeStrana({ signal: active.signal });
    await httpStarted.promise;
    expect(fetch.mock.calls[0][1].signal).toBe(active.signal);
    active.abort();
    pending.resolve(respond([row()])); // Even a transport ignoring abort cannot publish late data.
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects late enrichment after cancellation; bounds profile concurrency and never enriches lookahead', async () => {
    const { service, fetch, publicProfile } = setup();
    const started = deferred<void>(), profile = deferred<JavniProfilProjekcija | null>();
    fetch.mockResolvedValue(respond(Array.from({ length: 7 }, (_, i) => row(7 - i))));
    publicProfile.mockImplementation(() => {
      if (publicProfile.mock.calls.length === 4) started.resolve();
      return profile.promise;
    });
    const controller = new AbortController();
    const reading = service.otvorenePrilikeStrana({ limit: 6, signal: controller.signal });
    await started.promise;
    expect(publicProfile).toHaveBeenCalledTimes(4);
    controller.abort(); // A never-settling optional RPC must not keep the cancelled page pending.
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(publicProfile).toHaveBeenCalledTimes(4);
    profile.resolve(null);
  });
  it('deduplicates optional profile reads, preserves unavailable trust and rejects mismatched identity enrichment', async () => {
    const { service, fetch, publicProfile } = setup();
    fetch.mockResolvedValue(respond([row(3), row(2, { requester_profile_id: id(103) }), row(1)]));
    publicProfile.mockRejectedValueOnce(new Error('Private transport error'))
      .mockResolvedValueOnce({ profilId: id(999), ime: 'Wrong identity' } as JavniProfilProjekcija);
    const page = await service.otvorenePrilikeStrana();
    expect(publicProfile).toHaveBeenCalledTimes(2);
    expect(page.items.every(item => item.narucilacIme === '' && item.narucilacOcena === null)).toBe(true);
  });
  it('closes a task hint if the deadline passes during optional profile enrichment', async () => {
    const { service, fetch, publicProfile } = setup();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-07T10:00:00Z'));
    fetch.mockResolvedValue(respond([row(1, { response_deadline: '2026-09-07T10:00:01Z' })]));
    publicProfile.mockImplementation(async () => { clock.mockReturnValue(Date.parse('2026-09-07T10:00:02Z')); return null; });
    try { expect((await service.otvorenePrilikeStrana()).items[0].primaNovePrijave).toBe(false); }
    finally { clock.mockRestore(); }
  });
});
