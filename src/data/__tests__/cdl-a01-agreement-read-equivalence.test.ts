/**
 * CDL-A01 — Agreement workspace read consolidation
 *
 * The pre-deletion commit proved old-owner/new-owner equivalence in CI.
 * After migration, these tests lock the canonical RPC/auth/mapping/error
 * contract and verify that the transitional Agreement override and legacy
 * baseline no longer own either read operation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockRpc = jest.fn();

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    }),
    __testMocks: { mockGetUser, mockRpc },
  };
});

import { agreementClientService } from '../agreementClientService';
import { agreementProductionOverrides } from '../agreementProductionOverrides';

const { mockGetUser, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockGetUser: jest.Mock;
    mockRpc: jest.Mock;
  };
}).__testMocks;

const rawAgreement = {
  id: 'agr-1',
  requesterAccountId: 'requester-1',
  workerAccountId: 'worker-1',
  requesterName: 'Miloš',
  workerName: 'Ana',
  title: 'Preuzmi paket',
  status: 'ACTIVE',
  agreementStatus: 'CONFIRMED',
  currentVersion: 4,
  requiredSlots: 3,
  executionMode: 'PICKUP_DELIVERY',
  approximateArea: 'Centar',
  approximateCity: 'Novi Sad',
  startsAt: '2026-09-05T10:30:00.000Z',
  createdAt: '2026-09-05T08:00:00.000Z',
  requesterDeadlineAt: '2026-09-06T08:00:00.000Z',
  myPhoneShared: true,
  theirPhone: '+38160111222',
  problemOpened: false,
  terms: {
    price_rsd: 2400,
    currency: 'RSD',
    covered_slots: 2,
    proposed_start_at: '2026-09-05T10:00:00.000Z',
  },
};

function resetHappyAuth() {
  mockGetUser.mockReset();
  mockRpc.mockReset();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'requester-1' } },
    error: null,
  });
}

describe('CDL-A01 — canonical Agreement read contract', () => {
  beforeEach(() => resetHappyAuth());

  it('transitional Agreement override no longer owns migrated reads', () => {
    expect(agreementProductionOverrides).not.toHaveProperty('mojiDogovori');
    expect(agreementProductionOverrides).not.toHaveProperty('dogovor');
  });

  it('legacy baseline physically excludes migrated reads and production has one owner', () => {
    const indexSource = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(__dirname, '..', 'supabaseIzvor.ts'), 'utf8');
    const productionStart = indexSource.indexOf('const produkcijskiIzvor');
    const productionEnd = indexSource.indexOf('export const izvor');
    const productionComposition = indexSource.slice(productionStart, productionEnd);

    expect(baselineSource).not.toContain('async mojiDogovori(');
    expect(baselineSource).not.toContain('async dogovor(');
    expect(baselineSource).toContain("type SupabaseIzvor = Omit<Izvor, 'mojiDogovori' | 'dogovor'>;");
    expect(productionComposition).toContain('...supabaseIzvor');
    expect(productionComposition).toContain('...agreementClientService');
  });

  it('mojiDogovori uses only canonical list RPC and preserves projection mapping', async () => {
    mockRpc.mockResolvedValue({ data: [rawAgreement], error: null });

    const result = await agreementClientService.mojiDogovori();

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls).toEqual([['rpc_list_my_agreements']]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'agr-1',
      verzija: 4,
      naslov: 'Preuzmi paket',
      stanje: 'ACTIVE',
      cena: { iznos: 2400, valuta: 'RSD' },
      putanjaTekst: 'Centar, Novi Sad',
      pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 },
      rezim: 'PREUZIMANJE_DOSTAVA',
      kontakt: {
        mojTelefonPodeljen: true,
        njihovTelefon: '+38160111222',
        lokacijaPostoji: true,
        tacnaLokacija: null,
        emailNijeDeljen: true,
      },
      chatDostupan: true,
      rokPotvrdeIso: '2026-09-06T08:00:00.000Z',
      problemOtvoren: false,
      ocenaMoguca: false,
    });
    expect(result[0].ucesnici).toEqual([
      expect.objectContaining({ id: 'requester-1', ime: 'Miloš', uloga: 'narucilac', viSte: true }),
      expect.objectContaining({ id: 'worker-1', ime: 'Ana', uloga: 'uskocer', viSte: false, mesta: 2 }),
    ]);
  });

  it('dogovor uses exact canonical workspace RPC params and mapping', async () => {
    mockRpc.mockResolvedValue({ data: rawAgreement, error: null });

    const result = await agreementClientService.dogovor('agr-1');

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls).toEqual([
      ['rpc_get_agreement_workspace', { p_agreement_id: 'agr-1' }],
    ]);
    expect(result).toMatchObject({
      id: 'agr-1',
      verzija: 4,
      naslov: 'Preuzmi paket',
      stanje: 'ACTIVE',
      rezim: 'PREUZIMANJE_DOSTAVA',
    });
  });

  it('mojiDogovori remains fail-loud on backend error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'LIST_DENIED' } });

    await expect(agreementClientService.mojiDogovori()).rejects.toThrow('LIST_DENIED');
    expect(mockRpc.mock.calls).toEqual([['rpc_list_my_agreements']]);
  });

  it('mojiDogovori remains fail-loud on invalid projection', async () => {
    mockRpc.mockResolvedValue({ data: { unexpected: true }, error: null });

    await expect(agreementClientService.mojiDogovori()).rejects.toThrow(
      'AGREEMENT_LIST_INVALID_PROJECTION',
    );
  });

  it('dogovor preserves null workspace semantics', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(agreementClientService.dogovor('missing')).resolves.toBeNull();
    expect(mockRpc.mock.calls).toEqual([
      ['rpc_get_agreement_workspace', { p_agreement_id: 'missing' }],
    ]);
  });

  it('dogovor remains fail-loud on backend error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'WORKSPACE_DENIED' } });

    await expect(agreementClientService.dogovor('agr-1')).rejects.toThrow('WORKSPACE_DENIED');
  });

  it('AUTH_REQUIRED is preserved and prevents RPC execution', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AUTH_REQUIRED');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
