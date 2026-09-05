/**
 * CDL-A01 — Agreement workspace read consolidation
 *
 * Proof goal: the new explicit Agreement read service must be behaviorally
 * identical to the currently active agreementProductionOverrides owner before
 * either legacy implementation is deleted.
 */

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

async function capture<T>(run: () => Promise<T>, rpcResult: unknown) {
  resetHappyAuth();
  mockRpc.mockResolvedValue(rpcResult);
  const result = await run();
  return {
    result,
    rpcCalls: mockRpc.mock.calls.map((call: unknown[]) => [...call]),
    authCalls: mockGetUser.mock.calls.length,
  };
}

async function captureFailure(run: () => Promise<unknown>, rpcResult?: unknown) {
  resetHappyAuth();
  if (rpcResult !== undefined) mockRpc.mockResolvedValue(rpcResult);

  let message = '';
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  return {
    message,
    rpcCalls: mockRpc.mock.calls.map((call: unknown[]) => [...call]),
    authCalls: mockGetUser.mock.calls.length,
  };
}

describe('CDL-A01 — Agreement read equivalence', () => {
  it('mojiDogovori preserves RPC, auth, projection and mapping exactly', async () => {
    const oldOwner = await capture(
      () => agreementProductionOverrides.mojiDogovori!(),
      { data: [rawAgreement], error: null },
    );
    const newOwner = await capture(
      () => agreementClientService.mojiDogovori(),
      { data: [rawAgreement], error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([['rpc_list_my_agreements']]);
    expect(newOwner.authCalls).toBe(1);
  });

  it('dogovor preserves RPC name/params and mapped result exactly', async () => {
    const oldOwner = await capture(
      () => agreementProductionOverrides.dogovor!('agr-1'),
      { data: rawAgreement, error: null },
    );
    const newOwner = await capture(
      () => agreementClientService.dogovor('agr-1'),
      { data: rawAgreement, error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.rpcCalls).toEqual([
      ['rpc_get_agreement_workspace', { p_agreement_id: 'agr-1' }],
    ]);
    expect(newOwner.authCalls).toBe(1);
  });

  it('mojiDogovori preserves backend error propagation exactly', async () => {
    const rpcResult = { data: null, error: { message: 'LIST_DENIED' } };
    const oldOwner = await captureFailure(
      () => agreementProductionOverrides.mojiDogovori!(),
      rpcResult,
    );
    const newOwner = await captureFailure(
      () => agreementClientService.mojiDogovori(),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.message).toBe('LIST_DENIED');
  });

  it('mojiDogovori preserves invalid projection fail-loud behavior exactly', async () => {
    const rpcResult = { data: { unexpected: true }, error: null };
    const oldOwner = await captureFailure(
      () => agreementProductionOverrides.mojiDogovori!(),
      rpcResult,
    );
    const newOwner = await captureFailure(
      () => agreementClientService.mojiDogovori(),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.message).toBe('AGREEMENT_LIST_INVALID_PROJECTION');
  });

  it('dogovor preserves null workspace semantics exactly', async () => {
    const oldOwner = await capture(
      () => agreementProductionOverrides.dogovor!('missing'),
      { data: null, error: null },
    );
    const newOwner = await capture(
      () => agreementClientService.dogovor('missing'),
      { data: null, error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.result).toBeNull();
  });

  it('dogovor preserves backend error propagation exactly', async () => {
    const rpcResult = { data: null, error: { message: 'WORKSPACE_DENIED' } };
    const oldOwner = await captureFailure(
      () => agreementProductionOverrides.dogovor!('agr-1'),
      rpcResult,
    );
    const newOwner = await captureFailure(
      () => agreementClientService.dogovor('agr-1'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.message).toBe('WORKSPACE_DENIED');
  });

  it('both owners preserve AUTH_REQUIRED and make no RPC call', async () => {
    const runOld = async () => {
      mockGetUser.mockReset();
      mockRpc.mockReset();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(agreementProductionOverrides.mojiDogovori!()).rejects.toThrow('AUTH_REQUIRED');
      return mockRpc.mock.calls.length;
    };

    const runNew = async () => {
      mockGetUser.mockReset();
      mockRpc.mockReset();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AUTH_REQUIRED');
      return mockRpc.mock.calls.length;
    };

    expect(await runNew()).toBe(await runOld());
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
