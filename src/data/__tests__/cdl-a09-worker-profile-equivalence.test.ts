/**
 * CDL-A09 — canonical Worker profile mutation contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33962358107.
 * After deletion these tests lock the canonical auth/read/create/update/activation
 * contract and prove azurirajRadnikProfil has one physical production owner.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn();
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
    }),
    __testMocks: { mockGetUser, mockFrom, mockRpc },
  };
});

import { workerProfileClientService } from '../workerProfileClientService';

const { mockGetUser, mockFrom, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockGetUser: jest.Mock;
    mockFrom: jest.Mock;
    mockRpc: jest.Mock;
  };
}).__testMocks;

type Scenario = {
  userResult?: any;
  existingResult?: any;
  insertResult?: any;
  updateResult?: any;
  rpcResult?: any;
};

function configure(s: Scenario) {
  const trace: unknown[] = [];
  mockGetUser.mockReset();
  mockFrom.mockReset();
  mockRpc.mockReset();

  mockGetUser.mockImplementation(async () => {
    trace.push(['auth.getUser']);
    return s.userResult ?? { data: { user: { id: 'user-1' } }, error: null };
  });

  mockFrom.mockImplementation((table: string) => {
    trace.push(['from', table]);

    const readChain: any = {};
    readChain.eq = jest.fn((column: string, value: unknown) => {
      trace.push(['eq', column, value]);
      return readChain;
    });
    readChain.maybeSingle = jest.fn(async () => {
      trace.push(['maybeSingle']);
      return s.existingResult ?? { data: { id: 'profile-1' }, error: null };
    });

    return {
      select: (columns: string) => {
        trace.push(['select', columns]);
        return readChain;
      },
      insert: (payload: unknown) => {
        trace.push(['insert', payload]);
        return {
          select: (columns: string) => {
            trace.push(['insert.select', columns]);
            return {
              single: async () => {
                trace.push(['insert.single']);
                return s.insertResult ?? { data: { id: 'profile-new' }, error: null };
              },
            };
          },
        };
      },
      update: (patch: unknown) => {
        trace.push(['update', patch]);
        return {
          eq: async (column: string, value: unknown) => {
            trace.push(['update.eq', column, value]);
            return s.updateResult ?? { error: null };
          },
        };
      },
    };
  });

  mockRpc.mockImplementation(async (name: string, params: unknown) => {
    trace.push(['rpc', name, params]);
    return s.rpcResult ?? { data: null, error: null };
  });

  return trace;
}

async function run(k: any, scenario: Scenario) {
  const trace = configure(scenario);
  const value = await workerProfileClientService.azurirajRadnikProfil(k);
  return { value, trace };
}

describe('CDL-A09 — canonical Worker profile mutation contract', () => {
  it('physically eliminates both lower-precedence Worker profile mutation owners', () => {
    const dataDir = join(__dirname, '..');
    const authoritySource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const canonicalSource = readFileSync(join(dataDir, 'workerProfileClientService.ts'), 'utf8');

    expect(authoritySource).not.toContain('azurirajRadnikProfil');
    expect(baselineSource).not.toContain('async azurirajRadnikProfil(');
    expect(baselineSource).toContain("'azurirajRadnikProfil'");
    expect(canonicalSource).toContain('async azurirajRadnikProfil(');
    expect(canonicalSource).toContain("supabase.rpc('rpc_complete_worker_profile'");
    expect(canonicalSource).toContain('p_profile_id: profileId');
    expect(canonicalSource).toContain("profile_status: 'DRAFT'");
  });

  it('preserves auth-required behavior before any profile access', async () => {
    const result = await run(
      { ime: 'Miloš' },
      { userResult: { data: { user: null }, error: { message: 'session missing' } } },
    );

    expect(result.value).toEqual({
      ok: false,
      kod: 'AUTH_REQUIRED',
      poruka: 'Prijavite se da biste izmenili profil.',
    });
    expect(result.trace).toEqual([['auth.getUser']]);
  });

  it('preserves exact existing-profile patch and activation with required profile id', async () => {
    const result = await run(
      {
        ime: 'Miloš',
        grad: 'Novi Sad',
        biografija: 'Pouzdan.',
        vestine: ['selidbe'],
        alati: ['bušilica'],
        vozila: ['automobil'],
        dostupanOdmah: false,
        radijusKm: 0,
        zavrsi: true,
      },
      {
        existingResult: { data: { id: 'profile-77' }, error: null },
        updateResult: { error: null },
        rpcResult: { data: null, error: null },
      },
    );

    expect(result.value).toEqual({ ok: true, podatak: null });
    expect(result.trace).toContainEqual(['update', {
      display_name: 'Miloš',
      city: 'Novi Sad',
      bio: 'Pouzdan.',
      skills: ['selidbe'],
      tools: ['bušilica'],
      vehicles: ['automobil'],
      available_now: false,
      radius_km: 0,
    }]);
    expect(result.trace).toContainEqual([
      'rpc',
      'rpc_complete_worker_profile',
      { p_profile_id: 'profile-77' },
    ]);
  });

  it('preserves exact DRAFT create payload and activates the returned profile id', async () => {
    const result = await run(
      {
        ime: 'Ana',
        grad: 'Novi Sad',
        vestine: ['čišćenje'],
        zavrsi: true,
      },
      {
        existingResult: { data: null, error: null },
        insertResult: { data: { id: 'profile-new-9' }, error: null },
        rpcResult: { data: null, error: null },
      },
    );

    expect(result.trace).toContainEqual(['insert', {
      account_id: 'user-1',
      kind: 'WORKER',
      display_name: 'Ana',
      city: 'Novi Sad',
      bio: '',
      skills: ['čišćenje'],
      tools: [],
      vehicles: [],
      available_now: false,
      radius_km: 15,
      profile_status: 'DRAFT',
    }]);
    expect(result.trace).toContainEqual([
      'rpc',
      'rpc_complete_worker_profile',
      { p_profile_id: 'profile-new-9' },
    ]);
    expect(result.value).toEqual({ ok: true, podatak: null });
  });

  it('does not issue update or activation when existing profile has no patch and zavrsi is false', async () => {
    const result = await run(
      {},
      { existingResult: { data: { id: 'profile-quiet' }, error: null } },
    );

    expect(result.value).toEqual({ ok: true, podatak: null });
    expect(result.trace.some((entry: any) => entry[0] === 'update')).toBe(false);
    expect(result.trace.some((entry: any) => entry[0] === 'rpc')).toBe(false);
  });

  it.each([
    [
      'profile read',
      { existingResult: { data: null, error: { code: 'READ_DENIED' } } },
      { ime: 'Ime' },
      { ok: false, kod: 'READ_DENIED', poruka: 'Profil nije mogao da se učita.' },
    ],
    [
      'profile create no data',
      { existingResult: { data: null, error: null }, insertResult: { data: null, error: null } },
      { ime: 'Ime' },
      { ok: false, kod: 'PROFILE_CREATE_FAILED', poruka: 'Profil nije mogao da se kreira.' },
    ],
    [
      'profile update',
      { existingResult: { data: { id: 'p1' }, error: null }, updateResult: { error: { message: 'UPDATE_DENIED', code: '42501' } } },
      { grad: 'Novi Sad' },
      { ok: false, kod: 'UPDATE_DENIED', poruka: 'UPDATE_DENIED' },
    ],
    [
      'profile activation',
      { existingResult: { data: { id: 'p1' }, error: null }, rpcResult: { data: null, error: { code: 'SKILL_REQUIRED' } } },
      { zavrsi: true },
      { ok: false, kod: 'SKILL_REQUIRED', poruka: 'Profil još ne ispunjava uslove za aktivaciju.' },
    ],
  ])('preserves active failure mapping for %s', async (_label, scenario, k, expected) => {
    const result = await run(k, scenario as Scenario);
    expect(result.value).toEqual(expected);
  });
});
