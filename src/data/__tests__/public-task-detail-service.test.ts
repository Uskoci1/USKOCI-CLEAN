/** @jest-environment node */
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));

import { createClient } from '@supabase/supabase-js';
import { createDiscoveryClientService } from '../discoveryClientService';
import type { JavniProfilProjekcija } from '../../contracts/projections';

const id = (n = 1) => `10000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const location = { city: 'Grad', area: 'Centar' };
const topology = { mode: 'POINT_TO_POINT', start: location, end: { city: 'Drugi grad' } };
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: id(), title: 'Prevoz nekoliko kutija', status: 'PUBLISHED', created_at: '2026-09-07T10:00:00Z',
    starts_at: '2026-10-01T14:00:00Z', ends_at: '2026-10-01T16:00:00Z', schedule_kind: 'FIXED_WINDOW',
    execution_location_mode: 'POINT_TO_POINT', approximate_city: 'Grad', approximate_area: 'Centar',
    approximate_lat: 0, approximate_lng: 0, required_slots: 2, covered_slots: 0,
    required_skills: ['Prenos'], required_tools: ['Kolica'], required_vehicles: ['Kombi'], required_licenses: ['B'],
    mode: 'OFFERS', requester_price_rsd: null, requester_profile_id: id(100), response_deadline: null,
    revision: 3, description: 'Nekoliko kutija i dvoje pomagača.', category: 'Selidbe',
    minimum_experience_years: 0, verified_identity_required: false,
    geography: { need_id: id(), public_topology: topology },
    requirementDetails: { need_id: id(), critical_conditions: ['Bez lifta'] },
    ...overrides,
  };
}
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
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  return { fetch, publicProfile, service: createDiscoveryClientService({ client: () => sdk, publicProfile }),
    url: (n = 0) => new URL(String(fetch.mock.calls[n][0])) };
}

describe('public W04 material through actual SDK with controlled HTTP (not live Auth/RLS proof)', () => {
  it('uses one explicit GET/LEFT snapshot and projects all public material, preserving zero/false', async () => {
    const { fetch, publicProfile, service, url } = setup();
    fetch.mockResolvedValue(respond([row({ requester_account_id: 'PRIVATE_SENTINEL',
      need_sensitive: { exact_address: 'PRIVATE_SENTINEL' }, private_terms: 'PRIVATE_SENTINEL' })]));
    const detail = await service.detaljiPrilike(id());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe('GET');
    expect(url().pathname).toBe('/rest/v1/needs');
    expect(url().searchParams.get('id')).toBe(`eq.${id()}`);
    expect(url().searchParams.has('status')).toBe(false);
    const fields = url().searchParams.get('select')!;
    expect(fields).toContain('geography:need_geography(need_id,public_topology)');
    expect(fields).toContain('requirementDetails:need_requirement_details(need_id,critical_conditions)');
    expect(fields).not.toMatch(/!inner|\*|sensitive|exact|account_id|responses|app_profiles|private|policy|provider/);
    expect(publicProfile).toHaveBeenCalledWith(id(100));
    expect(detail).toMatchObject({ revision: 3, opis: 'Nekoliko kutija i dvoje pomagača.', kategorija: 'Selidbe',
      zahtevi: { vestine: ['Prenos'], alati: ['Kolica'], vozila: ['Kombi'], licence: ['B'],
        minimalnoIskustvoGodina: 0, zahtevaProverenIdentitet: false },
      javnaGeografija: { state: 'available', value: topology },
      kriticniUslovi: { state: 'available', value: ['Bez lifta'] },
      pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2 }, priblizno: { lat: 0, lng: 0 },
    });
    expect(JSON.stringify(detail)).not.toContain('PRIVATE_SENTINEL');
  });

  it.each(['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED'])('retains an RLS-readable %s parent with unavailable children and closed entry', async status => {
    const { fetch, service } = setup();
    fetch.mockResolvedValue(respond([row({ status, geography: null, requirementDetails: null })]));
    expect(await service.detaljiPrilike(id())).toMatchObject({ primaNovePrijave: false,
      javnaGeografija: { state: 'unavailable' }, kriticniUslovi: { state: 'unavailable' } });
  });

  it('keeps unavailable, explicit empty, nullable experience and false distinct without cross-read material cache', async () => {
    const { fetch, service } = setup();
    fetch.mockResolvedValueOnce(respond([row()]))
      .mockResolvedValueOnce(respond([row({ revision: 4, geography: null, requirementDetails: null,
        minimum_experience_years: null })]))
      .mockResolvedValueOnce(respond([row({ revision: 5, requirementDetails: { need_id: id(), critical_conditions: [] } })]));
    const first = await service.detaljiPrilike(id());
    const restricted = await service.detaljiPrilike(id());
    const empty = await service.detaljiPrilike(id());
    expect(first?.kriticniUslovi).toEqual({ state: 'available', value: ['Bez lifta'] });
    expect(restricted?.kriticniUslovi).toEqual({ state: 'unavailable' });
    expect(restricted?.javnaGeografija).toEqual({ state: 'unavailable' });
    expect(restricted?.zahtevi.minimalnoIskustvoGodina).toBeNull();
    expect(empty?.kriticniUslovi).toEqual({ state: 'available', value: [] });
    expect(empty?.zahtevi.minimalnoIskustvoGodina).toBe(0);
  });

  it('distinguishes absence from transport/permission errors and does not fall back to owner reads', async () => {
    const { fetch, publicProfile, service, url } = setup();
    fetch.mockResolvedValueOnce(respond([])).mockResolvedValueOnce(respond({ code: '42501', message: 'denied' }, 403));
    expect(await service.detaljiPrilike(id())).toBeNull();
    await expect(service.detaljiPrilike(id())).rejects.toMatchObject({ code: '42501' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(url(1).pathname).toBe('/rest/v1/needs');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it.each(['', 'ormar', `${id()}\n`, `${id()},status.eq.DRAFT`, 'x'.repeat(36)])('rejects malformed id %j before HTTP', async value => {
    const { fetch, service } = setup();
    await expect(service.detaljiPrilike(value)).rejects.toThrow('PUBLIC_TASK_ID_INVALID');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('normalizes an uppercase UUID before exact parent/child identity checks', async () => {
    const { fetch, service, url } = setup();
    const taskId = 'aaaaaaaa-0000-4000-8000-000000000001';
    fetch.mockResolvedValue(respond([row({ id: taskId, geography: null, requirementDetails: null })]));
    expect((await service.detaljiPrilike(taskId.toUpperCase()))?.id).toBe(taskId);
    expect(url().searchParams.get('id')).toBe(`eq.${taskId}`);
  });

  it.each([
    ['wrong parent', { id: id(2) }], ['revision zero', { revision: 0 }], ['revision fraction', { revision: 1.5 }],
    ['revision outside SQL integer', { revision: 2147483648 }], ['blank title', { title: ' ' }],
    ['unbound public profile', { requester_profile_id: `${id(100)}\n` }],
    ['description missing', { description: undefined }], ['description blank', { description: '  ' }],
    ['description length', { description: 'a'.repeat(6001) }], ['category length', { category: 'a'.repeat(121) }],
    ['license not array', { required_licenses: 'B' }], ['license nontext', { required_licenses: [4] }],
    ['license blank', { required_licenses: [' '] }], ['too many tools', { required_tools: Array(51).fill('Alat') }],
    ['oversized condition', { requirementDetails: { need_id: id(), critical_conditions: ['a'.repeat(501)] } }],
    ['experience negative', { minimum_experience_years: -1 }], ['experience high', { minimum_experience_years: 61 }],
    ['experience fraction', { minimum_experience_years: 0.5 }], ['experience string', { minimum_experience_years: '0' }],
    ['identity string', { verified_identity_required: 'false' }], ['status unknown', { status: 'MAYBE' }],
    ['geography omitted', { geography: undefined }], ['geography array', { geography: [] }],
    ['geography foreign', { geography: { need_id: id(2), public_topology: topology } }],
    ['conditions foreign', { requirementDetails: { need_id: id(2), critical_conditions: [] } }],
    ['conditions array', { requirementDetails: [{ need_id: id(), critical_conditions: [] }] }],
    ['conditions null value', { requirementDetails: { need_id: id(), critical_conditions: null } }],
  ])('fails malformed material %s before profile reads', async (_label, changes) => {
    const { fetch, service, publicProfile } = setup();
    fetch.mockResolvedValue(respond([row(changes as Record<string, unknown>)]));
    await expect(service.detaljiPrilike(id())).rejects.toThrow('PUBLIC_TASK_MATERIAL_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'REMOTE' }, { mode: 'STATIONARY', start: location }, topology,
    { mode: 'MULTI_STOP', start: location, waypoints: [{ label: 'Druga stanica' }] },
    { mode: 'AREA_BASED', serviceArea: { city: 'Grad' } },
  ])('preserves supported public topology %j without deriving a route from coordinates', async publicTopology => {
    const { fetch, service } = setup();
    fetch.mockResolvedValue(respond([row({ execution_location_mode: publicTopology.mode,
      geography: { need_id: id(), public_topology: publicTopology } })]));
    const result = await service.detaljiPrilike(id());
    expect(result?.javnaGeografija).toEqual({ state: 'available', value: publicTopology });
    if (publicTopology.mode === 'REMOTE') expect(result?.priblizno).toBeNull();
  });
  it('normalizes nullable point members and accepts maximum meaningful boundary sizes', async () => {
    const { fetch, service } = setup();
    fetch.mockResolvedValue(respond([row({ description: '🙂'.repeat(6000), category: 'c'.repeat(120),
      required_licenses: Array(50).fill('l'.repeat(500)), minimum_experience_years: 60, verified_identity_required: true,
      execution_location_mode: 'MULTI_STOP', geography: { need_id: id(), public_topology: {
        mode: 'MULTI_STOP', start: { label: null, city: ' Grad ', area: null }, end: null, serviceArea: null,
        waypoints: Array(20).fill({ label: 'x'.repeat(240) }),
      } } })]));
    const result = await service.detaljiPrilike(id());
    expect(result?.zahtevi).toMatchObject({ minimalnoIskustvoGodina: 60, zahtevaProverenIdentitet: true });
    expect(result?.javnaGeografija).toMatchObject({ state: 'available', value: { start: { city: 'Grad' } } });
  });
  it.each([
    { ...topology, exact_address: 'PRIVATE' }, { ...topology, start: { ...location, lat: 0, lng: 0 } },
    { ...topology, start: { city: 4 } }, { ...topology, start: {} }, { ...topology, start: { label: 'a'.repeat(241) } },
    { ...topology, waypoints: null }, { ...topology, end: null }, { mode: 'REMOTE', start: location },
    { mode: 'STATIONARY', start: location, end: location },
    { mode: 'MULTI_STOP', start: location, waypoints: [null] },
    { mode: 'MULTI_STOP', start: location, waypoints: Array(21).fill(location) },
    { mode: 'AREA_BASED', serviceArea: location, end: location }, { mode: 'STATIONARY' },
  ])('refuses private/invalid/unsupported geography without leaking or substituting it: %j', async publicTopology => {
    const { fetch, service, publicProfile } = setup();
    fetch.mockResolvedValue(respond([row({ execution_location_mode: publicTopology.mode,
      geography: { need_id: id(), public_topology: publicTopology } })]));
    await expect(service.detaljiPrilike(id())).rejects.toThrow('PUBLIC_TASK_MATERIAL_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });
  it('rejects a topology mode that disagrees with the parent material', async () => {
    const { fetch, service } = setup();
    fetch.mockResolvedValue(respond([row({ execution_location_mode: 'REMOTE' })]));
    await expect(service.detaljiPrilike(id())).rejects.toThrow('PUBLIC_TASK_MATERIAL_INVALID');
  });

  it('cancels before HTTP and discards a late transport result even when fetch ignores cancellation', async () => {
    const { fetch, service, publicProfile } = setup();
    const already = new AbortController(); already.abort();
    await expect(service.detaljiPrilike(id(), { signal: already.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
    const pending = deferred<Response>(), scope = new AbortController();
    fetch.mockReturnValue(pending.promise);
    const result = service.detaljiPrilike(id(), { signal: scope.signal });
    await new Promise(resolve => setImmediate(resolve));
    expect(fetch.mock.calls[0][1].signal).toBe(scope.signal);
    scope.abort(); pending.resolve(respond([row()]));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(publicProfile).not.toHaveBeenCalled();
  });
  it('stops waiting for profile on scope cancellation and does not merge a later read with the old result', async () => {
    const { fetch, service, publicProfile } = setup();
    const pending = deferred<JavniProfilProjekcija | null>(), scope = new AbortController();
    fetch.mockResolvedValueOnce(respond([row()])).mockResolvedValueOnce(respond([row({ revision: 4, geography: null, requirementDetails: null })]));
    publicProfile.mockReturnValueOnce(pending.promise);
    const result = service.detaljiPrilike(id(), { signal: scope.signal });
    await new Promise(resolve => setImmediate(resolve));
    scope.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    const fresh = await service.detaljiPrilike(id());
    expect(fresh?.revision).toBe(4);
    expect(fresh?.kriticniUslovi).toEqual({ state: 'unavailable' });
    pending.resolve(null);
    expect(fresh?.kriticniUslovi).toEqual({ state: 'unavailable' });
  });
  it('rechecks deadline after optional profile enrichment while preserving material', async () => {
    const { fetch, service, publicProfile } = setup();
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T10:00:00Z'));
    const pending = deferred<JavniProfilProjekcija | null>();
    fetch.mockResolvedValue(respond([row({ response_deadline: '2026-10-01T10:00:01Z' })]));
    publicProfile.mockReturnValue(pending.promise);
    try {
      const result = service.detaljiPrilike(id());
      await new Promise(resolve => setImmediate(resolve));
      now.mockReturnValue(Date.parse('2026-10-01T10:00:02Z')); pending.resolve(null);
      expect(await result).toMatchObject({ revision: 3, primaNovePrijave: false });
    } finally { now.mockRestore(); }
  });
});
