/**
 * CDL-A02 — Agreement mutation override consolidation
 *
 * Proof goal: before deleting any transitional Agreement mutation owner, prove
 * the canonical agreementClientService is request/validation/error equivalent
 * to the currently active agreementProductionOverrides implementation.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  const mockGetUser = jest.fn();

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    }),
    __testMocks: { mockRpc, mockGetUser },
  };
});

import { agreementClientService } from '../agreementClientService';
import { agreementProductionOverrides } from '../agreementProductionOverrides';
import type { IzmenaKomanda } from '../ports';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

async function capture<T>(run: () => Promise<T>, rpcResult: unknown) {
  resetRpc(rpcResult);
  const result = await run();
  return {
    result,
    rpcCalls: mockRpc.mock.calls.map((call: unknown[]) => [...call]),
  };
}

const fullChange: IzmenaKomanda = {
  dogovorId: 'agr-1',
  ocekivanaVerzija: 7,
  razlog: 'Promena termina',
  clientRequestId: 'req-123',
  izmena: {
    cenaIznos: 3200,
    cenaValuta: 'RSD',
    pocetakIso: '2026-09-06T10:00:00.000Z',
    krajIso: '2026-09-06T12:00:00.000Z',
    obim: 'Preuzimanje i dostava dva paketa',
  },
};

describe('CDL-A02 — Agreement mutation equivalence', () => {
  it('posaljiPoruku preserves trim, exact RPC and success result', async () => {
    const rpcResult = { data: 'msg-1', error: null };
    const oldOwner = await capture(
      () => agreementProductionOverrides.posaljiPoruku!('agr-1', '  Stižem u 17h.  '),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.posaljiPoruku('agr-1', '  Stižem u 17h.  '),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([
      ['rpc_send_agreement_message', { p_agreement_id: 'agr-1', p_body: 'Stižem u 17h.' }],
    ]);
    expect(newOwner.result).toEqual({ ok: true, podatak: { porukaId: 'msg-1' } });
  });

  it('posaljiPoruku preserves empty-body validation and makes no RPC call', async () => {
    const oldOwner = await capture(
      () => agreementProductionOverrides.posaljiPoruku!('agr-1', '   '),
      { data: 'unused', error: null },
    );
    const newOwner = await capture(
      () => agreementClientService.posaljiPoruku('agr-1', '   '),
      { data: 'unused', error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([]);
    expect(newOwner.result).toEqual({ ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' });
  });

  it.each([
    [{ data: null, error: { message: 'CHAT_DENIED', code: '42501' } }, 'CHAT_DENIED'],
    [{ data: null, error: null }, 'MESSAGE_SEND_FAILED'],
  ])('posaljiPoruku preserves failure semantics %#', async (rpcResult, code) => {
    const oldOwner = await capture(
      () => agreementProductionOverrides.posaljiPoruku!('agr-1', 'Poruka'),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.posaljiPoruku('agr-1', 'Poruka'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.result).toMatchObject({ ok: false, kod: code });
  });

  it('predloziIzmenu preserves exact full patch, version, reason and idempotency params', async () => {
    const rpcResult = { data: 'proposal-1', error: null };
    const oldOwner = await capture(
      () => agreementProductionOverrides.predloziIzmenu!(fullChange),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.predloziIzmenu(fullChange),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([
      ['rpc_propose_agreement_change_v2', {
        p_agreement_id: 'agr-1',
        p_expected_version: 7,
        p_patch: {
          price_rsd: 3200,
          currency: 'RSD',
          proposed_start_at: '2026-09-06T10:00:00.000Z',
          proposed_end_at: '2026-09-06T12:00:00.000Z',
          scope_note: 'Preuzimanje i dostava dva paketa',
        },
        p_reason: 'Promena termina',
        p_client_request_id: 'req-123',
      }],
    ]);
    expect(newOwner.result).toEqual({ ok: true, podatak: { predlogId: 'proposal-1' } });
  });

  it('predloziIzmenu preserves partial patch and null reason', async () => {
    const command: IzmenaKomanda = {
      dogovorId: 'agr-2',
      ocekivanaVerzija: 3,
      clientRequestId: 'req-partial',
      izmena: { cenaIznos: 0, obim: '' },
    };
    const rpcResult = { data: 'proposal-2', error: null };

    const oldOwner = await capture(
      () => agreementProductionOverrides.predloziIzmenu!(command),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.predloziIzmenu(command),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([
      ['rpc_propose_agreement_change_v2', {
        p_agreement_id: 'agr-2',
        p_expected_version: 3,
        p_patch: { price_rsd: 0, scope_note: '' },
        p_reason: null,
        p_client_request_id: 'req-partial',
      }],
    ]);
  });

  it('predloziIzmenu preserves empty-patch validation and makes no RPC call', async () => {
    const command: IzmenaKomanda = {
      dogovorId: 'agr-1',
      ocekivanaVerzija: 1,
      clientRequestId: 'req-empty',
      izmena: {},
    };

    const oldOwner = await capture(
      () => agreementProductionOverrides.predloziIzmenu!(command),
      { data: 'unused', error: null },
    );
    const newOwner = await capture(
      () => agreementClientService.predloziIzmenu(command),
      { data: 'unused', error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([]);
    expect(newOwner.result).toEqual({
      ok: false,
      kod: 'CHANGE_PATCH_REQUIRED',
      poruka: 'Izmenite bar jedno polje Dogovora.',
    });
  });

  it.each([
    [{ data: null, error: { message: 'STALE_VERSION', code: 'P0001' } }, 'STALE_VERSION'],
    [{ data: null, error: null }, 'CHANGE_PROPOSAL_FAILED'],
  ])('predloziIzmenu preserves failure semantics %#', async (rpcResult, code) => {
    const oldOwner = await capture(
      () => agreementProductionOverrides.predloziIzmenu!(fullChange),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.predloziIzmenu(fullChange),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.result).toMatchObject({ ok: false, kod: code });
  });

  it.each([true, false])('odgovoriNaIzmenu preserves exact RPC params for accept=%s', async (accept) => {
    const rpcResult = { data: null, error: null };
    const oldOwner = await capture(
      () => agreementProductionOverrides.odgovoriNaIzmenu!('proposal-1', accept),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.odgovoriNaIzmenu('proposal-1', accept),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([
      ['rpc_respond_agreement_change', { p_proposal_id: 'proposal-1', p_accept: accept }],
    ]);
    expect(newOwner.result).toEqual({ ok: true, podatak: null });
  });

  it('odgovoriNaIzmenu preserves backend error mapping', async () => {
    const rpcResult = { data: null, error: { message: 'PROPOSAL_CLOSED', code: 'P0001' } };
    const oldOwner = await capture(
      () => agreementProductionOverrides.odgovoriNaIzmenu!('proposal-1', true),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.odgovoriNaIzmenu('proposal-1', true),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.result).toMatchObject({ ok: false, kod: 'PROPOSAL_CLOSED' });
  });
});
