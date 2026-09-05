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
  status: 'PUBLISHED',
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
