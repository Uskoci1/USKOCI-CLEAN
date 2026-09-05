/**
 * CDL-A03 — Need read consolidation, pre-deletion equivalence proof.
 *
 * The old active owner and the new explicit service are executed against the
 * same mocked Supabase contract. Only after this test and the full PRE-P4 gate
 * are green may the old Need read implementations be removed.
 */

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
import { needProductionOverrides } from '../needProductionOverrides';

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

type Config = {
  auth?: unknown;
  list?: unknown;
  single?: unknown;
};

function reset(config: Config = {}) {
  Object.values(mocks).forEach((mock) => mock.mockClear());
  mocks.mockGetUser.mockResolvedValue(
    config.auth ?? { data: { user: { id: 'requester-1' } }, error: null },
  );
  mocks.mockOrder.mockResolvedValue(
    config.list ?? { data: [], error: null },
  );
  mocks.mockMaybeSingle.mockResolvedValue(
    config.single ?? { data: null, error: null },
  );
}

function calls() {
  return {
    auth: mocks.mockGetUser.mock.calls.map((args) => [...args]),
    from: mocks.mockFrom.mock.calls.map((args) => [...args]),
    select: mocks.mockSelect.mock.calls.map((args) => [...args]),
    eq: mocks.mockEq.mock.calls.map((args) => [...args]),
    order: mocks.mockOrder.mock.calls.map((args) => [...args]),
    maybeSingle: mocks.mockMaybeSingle.mock.calls.map((args) => [...args]),
  };
}

async function capture<T>(run: () => Promise<T>, config: Config = {}) {
  reset(config);
  try {
    const value = await run();
    return { outcome: { kind: 'value' as const, value }, calls: calls() };
  } catch (error) {
    return {
      outcome: {
        kind: 'error' as const,
        message: error instanceof Error ? error.message : String(error),
      },
      calls: calls(),
    };
  }
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

describe('CDL-A03 — Need read equivalence before deletion', () => {
  it('mojePotrebe preserves auth, exact query chain and mapped projection', async () => {
    const config = { list: { data: [rawNeed], error: null } };
    const oldOwner = await capture(
      () => needProductionOverrides.mojePotrebe!(),
      config,
    );
    const newOwner = await capture(
      () => needClientService.mojePotrebe(),
      config,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls.from).toEqual([['needs']]);
    expect(newOwner.calls.eq).toEqual([['requester_account_id', 'requester-1']]);
    expect(newOwner.calls.order).toEqual([['created_at', { ascending: false }]]);
    expect(newOwner.calls.select).toHaveLength(1);
    expect(String(newOwner.calls.select[0][0])).toContain('marketplace_responses(id)');
    expect(newOwner.outcome).toEqual({
      kind: 'value',
      value: [
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
      ],
    });
  });

  it.each([
    [
      { data: { user: null }, error: { message: 'AUTH_BROKEN' } },
      'AUTH_BROKEN',
    ],
    [
      { data: { user: null }, error: null },
      'AUTH_REQUIRED',
    ],
  ])('mojePotrebe preserves auth failure semantics %#', async (auth, message) => {
    const config = { auth };
    const oldOwner = await capture(() => needProductionOverrides.mojePotrebe!(), config);
    const newOwner = await capture(() => needClientService.mojePotrebe(), config);

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.outcome).toEqual({ kind: 'error', message });
    expect(newOwner.calls.from).toEqual([]);
  });

  it.each([
    [{ data: null, error: { message: 'NEEDS_DENIED' } }, 'NEEDS_DENIED'],
    [{ data: { invalid: true }, error: null }, 'NEED_LIST_INVALID_PROJECTION'],
  ])('mojePotrebe preserves backend/projection failure semantics %#', async (list, message) => {
    const config = { list };
    const oldOwner = await capture(() => needProductionOverrides.mojePotrebe!(), config);
    const newOwner = await capture(() => needClientService.mojePotrebe(), config);

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.outcome).toEqual({ kind: 'error', message });
  });

  it('mojePotrebe preserves unsupported-status fail-loud behavior', async () => {
    const config = { list: { data: [{ ...rawNeed, status: 'UNKNOWN_STATE' }], error: null } };
    const oldOwner = await capture(() => needProductionOverrides.mojePotrebe!(), config);
    const newOwner = await capture(() => needClientService.mojePotrebe(), config);

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.outcome).toEqual({
      kind: 'error',
      message: 'NEED_STATUS_UNSUPPORTED:UNKNOWN_STATE',
    });
  });

  it('potreba preserves trim, exact query chain and mapped projection', async () => {
    const config = { single: { data: { ...rawNeed, status: 'SELECTION' }, error: null } };
    const oldOwner = await capture(
      () => needProductionOverrides.potreba!('  need-1  '),
      config,
    );
    const newOwner = await capture(
      () => needClientService.potreba('  need-1  '),
      config,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls.from).toEqual([['needs']]);
    expect(newOwner.calls.eq).toEqual([['id', 'need-1']]);
    expect(newOwner.calls.maybeSingle).toEqual([[]]);
    expect(newOwner.outcome).toEqual({
      kind: 'value',
      value: expect.objectContaining({
        id: 'need-1',
        stanje: 'DELIMICNO_POPUNJENA',
        pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 },
      }),
    });
  });

  it('potreba preserves blank-id null behavior without a database read', async () => {
    const oldOwner = await capture(() => needProductionOverrides.potreba!('   '));
    const newOwner = await capture(() => needClientService.potreba('   '));

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.outcome).toEqual({ kind: 'value', value: null });
    expect(newOwner.calls.from).toEqual([]);
  });

  it('potreba preserves missing-row null semantics', async () => {
    const config = { single: { data: null, error: null } };
    const oldOwner = await capture(() => needProductionOverrides.potreba!('missing'), config);
    const newOwner = await capture(() => needClientService.potreba('missing'), config);

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.outcome).toEqual({ kind: 'value', value: null });
  });

  it('potreba preserves backend failure semantics', async () => {
    const config = { single: { data: null, error: { message: 'NEED_DENIED' } } };
    const oldOwner = await capture(() => needProductionOverrides.potreba!('need-1'), config);
    const newOwner = await capture(() => needClientService.potreba('need-1'), config);

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.outcome).toEqual({ kind: 'error', message: 'NEED_DENIED' });
  });
});
