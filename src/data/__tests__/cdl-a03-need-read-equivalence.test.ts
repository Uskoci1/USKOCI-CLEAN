/**
 * CDL-A03 — canonical Need read contract after deletion.
 *
 * Pre-deletion equivalence was proven by PRE-P4 run 33954247260. These tests
 * now lock the canonical request/mapping/error behavior and prove the old Need
 * read owners are physically absent.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockEq = jest.fn();
  const mockOrder = jest.fn();
  const mockMaybeSingle = jest.fn();

  const builder = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
  };

  mockFrom.mockImplementation(() => builder);
  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
    __testMocks: {
      mockGetUser,
      mockFrom,
      mockSelect,
      mockEq,
      mockOrder,
      mockMaybeSingle,
    },
  };
});

import { needClientService } from '../needClientService';
import { needGeographyRows, needRequirementRows, needScheduleText, needPeopleText } from '../needDetailPresentation';

const mocks = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockGetUser: jest.Mock;
    mockFrom: jest.Mock;
    mockSelect: jest.Mock;
    mockEq: jest.Mock;
    mockOrder: jest.Mock;
    mockMaybeSingle: jest.Mock;
  };
}).__testMocks;

function reset() {
  Object.values(mocks).forEach((mock) => mock.mockClear());
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: 'requester-1' } },
    error: null,
  });
  mocks.mockOrder.mockResolvedValue({ data: [], error: null });
  mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
}

const rawNeed = {
  id: 'need-1',
  revision: 4,
  title: 'Preuzmi paket',
  description: 'Preuzmi paket u centru i donesi na Liman.',
  status: 'PUBLISHED', category: 'Dostava', schedule_kind: 'FIXED_WINDOW', ends_at: '2026-09-06T11:00:00.000Z',
  task_country_code: 'RS', task_timezone: 'Europe/Belgrade', execution_location_mode: 'STATIONARY',
  need_geography: null, need_requirement_details: null, required_licenses: [], minimum_experience_years: null, verified_identity_required: false,
  starts_at: '2026-09-06T10:00:00.000Z',
  approximate_area: 'Centar',
  approximate_city: 'Novi Sad',
  required_slots: 2,
  required_skills: ['dostava'],
  required_tools: ['kolica'],
  required_vehicles: ['automobil'],
  covered_slots: 1,
  mode: 'MY_PRICE',
  requester_price_rsd: 2500,
  marketplace_responses: [{ id: 'response-1' }],
};

describe('CDL-A03 — canonical Need read contract', () => {
  beforeEach(reset);

  it('transitional Need override is deleted and baseline no longer owns migrated reads', () => {
    const dataDir = join(__dirname, '..');
    const baseline = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const productionStart = indexSource.indexOf('const produkcijskiIzvor');
    const productionEnd = indexSource.indexOf('export const izvor');
    const composition = indexSource.slice(productionStart, productionEnd);

    expect(existsSync(join(dataDir, 'needProductionOverrides.ts'))).toBe(false);
    expect(baseline).not.toContain('async mojePotrebe(');
    expect(baseline).not.toContain('async potreba(');
    expect(composition).toContain('...needClientService');
    expect(composition).not.toContain('needProductionOverrides');
  });

  it('mojePotrebe preserves auth, exact query chain and mapped projection', async () => {
    mocks.mockOrder.mockResolvedValue({ data: [rawNeed], error: null });

    const result = await needClientService.mojePotrebe();

    expect(mocks.mockGetUser).toHaveBeenCalledTimes(1);
    expect(mocks.mockFrom.mock.calls).toEqual([['needs']]);
    expect(mocks.mockEq.mock.calls).toEqual([['requester_account_id', 'requester-1']]);
    expect(mocks.mockOrder.mock.calls).toEqual([['created_at', { ascending: false }]]);
    expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
    expect(String(mocks.mockSelect.mock.calls[0][0])).toContain('marketplace_responses(id)');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'need-1',
        revizija: 4,
        naslov: 'Preuzmi paket',
        stanje: 'CEKA_PRIJAVE',
        pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 },
        podrucjeTekst: 'Centar, Novi Sad',
        uslovi: ['dostava', 'kolica', 'automobil'],
        brojPrijava: 1,
        rezimCene: 'MY_PRICE',
        ponudjenaCena: expect.objectContaining({ iznos: 2500, valuta: 'RSD' }),
      }),
    ]);
  });

  it('mojePotrebe remains fail-loud for auth error and unauthenticated state', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'AUTH_BROKEN' } });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('AUTH_BROKEN');
    expect(mocks.mockFrom).not.toHaveBeenCalled();

    reset();
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('AUTH_REQUIRED');
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('mojePotrebe remains fail-loud for backend, invalid projection and unsupported status', async () => {
    mocks.mockOrder.mockResolvedValue({ data: null, error: { message: 'NEEDS_DENIED' } });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('NEEDS_DENIED');

    reset();
    mocks.mockOrder.mockResolvedValue({ data: { invalid: true }, error: null });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('NEED_LIST_INVALID_PROJECTION');

    reset();
    mocks.mockOrder.mockResolvedValue({
      data: [{ ...rawNeed, status: 'UNKNOWN_STATE' }],
      error: null,
    });
    await expect(needClientService.mojePotrebe()).rejects.toThrow(
      'NEED_STATUS_UNSUPPORTED:UNKNOWN_STATE',
    );
  });

  it('potreba preserves trim, exact query and mapped projection', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({
      data: { ...rawNeed, status: 'SELECTION' },
      error: null,
    });

    const result = await needClientService.potreba('  need-1  ');

    expect(mocks.mockFrom.mock.calls).toEqual([['needs']]);
    expect(mocks.mockEq.mock.calls).toEqual([['id', 'need-1']]);
    expect(mocks.mockMaybeSingle.mock.calls).toEqual([[]]);
    expect(result).toEqual(expect.objectContaining({
      id: 'need-1',
      stanje: 'DELIMICNO_POPUNJENA',
      pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 },
    }));
  });

  it('potreba preserves blank-id, missing-row and backend-error semantics', async () => {
    await expect(needClientService.potreba('   ')).resolves.toBeNull();
    expect(mocks.mockFrom).not.toHaveBeenCalled();

    reset();
    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(needClientService.potreba('missing')).resolves.toBeNull();

    reset();
    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'NEED_DENIED' } });
    await expect(needClientService.potreba('need-1')).rejects.toThrow('NEED_DENIED');
  });
});


describe('V2 saved Need detail uses the existing public relations', () => {
  beforeEach(reset);
  const geo = { mode: 'MULTI_STOP', start: { city: 'Novi Sad', area: 'Liman' },
    waypoints: [{ city: 'Petrovaradin', label: 'Prvo preuzimanje' }, { city: 'Beočin', area: 'Druga stanica' }],
    end: { city: 'Sremska Kamenica', area: 'Odredište' } };
  it('reads full public topology, category and both instants in one scoped existing query', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed,
      execution_location_mode: 'MULTI_STOP', need_geography: { public_topology: geo },
      need_sensitive: { exact_address: 'SECRET address', resolved_location: { exact_lat: 45.123456 } } } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(result.detalji).toMatchObject({ kategorija: 'Dostava', geografija: geo });
    expect(result.schedule).toEqual({ kind: 'FIXED_WINDOW', startsAt: rawNeed.starts_at, endsAt: rawNeed.ends_at });
    const rows = needGeographyRows(result);
    expect(rows.map(row => row.label)).toEqual(['Način izvršenja', 'Polazište', 'Stanica 1', 'Stanica 2', 'Odredište']);
    expect(rows[4].value).toBe('Sremska Kamenica · Odredište');
    expect(result.vremeTekst).toContain('12:00'); expect(result.vremeTekst).toContain('13:00');
    expect(result.vremeTekst).toContain('Europe/Belgrade');
    expect(JSON.stringify(result)).not.toMatch(/SECRET|exact_address|resolved_location|exact_lat/);
    expect(mocks.mockFrom.mock.calls).toEqual([['needs']]);
    const selection = String(mocks.mockSelect.mock.calls[0][0]);
    for (const key of ['category', 'ends_at', 'schedule_kind', 'task_country_code', 'task_timezone', 'need_geography(public_topology)', 'need_requirement_details(critical_conditions)']) expect(selection).toContain(key);
    expect(selection).not.toMatch(/need_sensitive|exact_address|resolved_location|exact_lat|requester_account_id/);
  });
  it('preserves every requirement group without treating a requirement as earned verification', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, required_licenses: ['B', 'B'],
      minimum_experience_years: 0, verified_identity_required: true, need_requirement_details: { critical_conditions: ['Bez lifta', 'Pristup sa dvorišta'] } } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(needRequirementRows(result)).toEqual([
      { label: 'Veštine', value: '• dostava' }, { label: 'Alat', value: '• kolica' }, { label: 'Vozilo', value: '• automobil' },
      { label: 'Dozvole', value: '• B\n• B' }, { label: 'Bitni uslovi', value: '• Bez lifta\n• Pristup sa dvorišta' },
      { label: 'Najmanje iskustva', value: '0 god.' }, { label: 'Identitet', value: 'Potreban je potvrđen identitet' },
    ]);
  });
  it('preserves historical null geography/country/zone without inferring Serbia or a single start', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, task_country_code: null, task_timezone: null, execution_location_mode: null } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(result.taskCountryCode).toBeUndefined(); expect(result.taskTimezone).toBeUndefined();
    expect(result.detalji?.geografija).toBeNull(); expect(result.detalji?.rezimLokacije).toBeNull();
    expect(needGeographyRows(result)).toEqual([{ label: 'Približno područje', value: 'Centar, Novi Sad' }]);
    expect(result.vremeTekst).toContain('10:00'); expect(result.vremeTekst).toContain('UTC · zona nije navedena');
  });
  it('keeps Remote explicit and does not display physical fallback cities', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, execution_location_mode: 'REMOTE',
      need_geography: { public_topology: { mode: 'REMOTE' } }, schedule_kind: 'REMOTE_ANYTIME', starts_at: null, ends_at: null } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(needGeographyRows(result)).toEqual([{ label: 'Način izvršenja', value: 'Na daljinu' }]);
    expect(result.vremeTekst).toBe('Na daljinu, fleksibilno');
  });
  it.each([
    { need_geography: [{ public_topology: geo }] },
    { need_geography: { public_topology: null } },
    { need_geography: { public_topology: 'malformed' } },
    { need_requirement_details: { critical_conditions: ['Valid', 4] } },
    { ends_at: '2026-09-06T09:00:00.000Z' }, { ends_at: '2026-02-30T10:00:00Z' },
    { category: undefined }, { task_country_code: 'rs' }, { task_timezone: 'Invented/Zone' },
  ])('rejects unreadable/mismatched detail rather than silently removing it: %o', async patch => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, ...patch } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  });
});


describe('saved Need schedule and people presentation', () => {
  it('labels flexible endpoints as a preference rather than a fixed booking', () => {
    const value = needScheduleText({ kind: 'WEEK_FLEXIBLE', startsAt: '2026-09-10T16:00:00Z', endsAt: '2026-09-12T17:00:00Z' }, 'Europe/Belgrade');
    expect(value).toContain('Fleksibilan raspon'); expect(value).toContain('10.'); expect(value).toContain('12.');
    expect(value).toContain('18:00'); expect(value).toContain('19:00');
  });
  it('distinguishes repeated civil times at the autumn DST boundary', () => {
    const value = needScheduleText({ kind: 'FIXED_WINDOW', startsAt: '2026-10-25T00:30:00Z', endsAt: '2026-10-25T01:30:00Z' }, 'Europe/Belgrade');
    expect(value.match(/02:30/g)).toHaveLength(2); expect(value).toContain('UTC+02:00'); expect(value).toContain('UTC+01:00');
  });
  it('retains microseconds and never fabricates an unknown fixed endpoint', () => {
    const value = needScheduleText({ kind: 'FIXED_WINDOW', startsAt: '2026-09-10T16:00:00.123456Z', endsAt: null }, 'Europe/Belgrade');
    expect(value).toContain('Od '); expect(value).toContain('18:00:00.123456'); expect(value).not.toContain(' – ');
    expect(needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: null })).toBe('Tačan termin nije potpun');
  });
  it.each([[1, 'osoba'], [2, 'osobe'], [5, 'osoba'], [11, 'osoba'], [12, 'osoba'], [14, 'osoba'], [22, 'osobe']])('labels %s people', (count, word) => {
    expect(needPeopleText(count as number)).toBe(`${count} ${word}`);
  });
});


describe('schema-compatible historical Need detail', () => {
  beforeEach(reset);
  it.each([' '.repeat(200) + '😀'.repeat(120) + ' '.repeat(200), '\t'])('uses actual SQL ASCII btrim/codepoint category bounds without overwriting the value', async category => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, category } });
    expect((await needClientService.potreba(rawNeed.id))!.detalji!.kategorija).toBe(category);
  });
  it.each([null, '', '   ', '😀'.repeat(121)])('rejects category impossible under the current NOT NULL/check schema', async category => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, category } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  });
  it.each([
    { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beočin' } },
    { mode: 'STATIONARY', start: { city: 42 } },
    { mode: 'STATIONARY', start: { city: 'Novi Sad', exactAddress: 'SECRET' } },
    {},
  ])('keeps schema-legal pre-normalizer or mode-mismatched topology readable as unknown: %o', async public_topology => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, need_geography: { public_topology } } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(result.naslov).toBe(rawNeed.title); expect(result.detalji!.geografija).toBeNull();
    expect(result.detalji!.rezimLokacije).toBe('STATIONARY');
    expect(needGeographyRows(result)).toEqual([{ label: 'Približno područje', value: 'Centar, Novi Sad' }]);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it.each(['FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE'])('keeps required existing schedule enum %s with nullable endpoints', async schedule_kind => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, schedule_kind, starts_at: null, ends_at: null } });
    expect((await needClientService.potreba(rawNeed.id))!.schedule).toEqual({ kind: schedule_kind, startsAt: null, endsAt: null });
  });
  it.each([null, undefined, 'DATE_RANGE'])('rejects a missing or noncanonical schedule kind', async schedule_kind => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, schedule_kind } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  });
});
