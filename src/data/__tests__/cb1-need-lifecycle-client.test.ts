jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'test-owner' }, accountRevision: 1 }) }));

/**
 * CB1 — Requester terminal commands on a Zadatak. Revision-bound, idempotent,
 * server exception names mapped once to product language.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { needLifecycleClientService } from '../needLifecycleClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const NEED = '11111111-2222-4333-8444-555555555555';

describe('CB1 — cancelNeed', () => {
  it('sends the revision-bound cancel and returns the consequence count', async () => {
    resetRpc({ data: { needId: NEED, status: 'CANCELLED', revision: 4, affectedResponses: 2, idempotentReplay: false, authoritative: true }, error: null });
    const result = await needLifecycleClientService.cancelNeed(NEED, 4, 'Nije više potrebno');
    expect(mockRpc.mock.calls).toEqual([['rpc_cancel_need', { p_need_id: NEED, p_need_revision: 4, p_reason: 'Nije više potrebno' }]]);
    expect(result).toEqual({ ok: true, podatak: { needId: NEED, status: 'CANCELLED', revision: 4, affectedResponses: 2, idempotentReplay: false } });
  });

  it('reports a replayed cancellation and routes a Dogovor-bound Zadatak to the Dogovor flow', async () => {
    resetRpc({ data: { needId: NEED, status: 'CANCELLED', revision: 4, affectedResponses: 0, idempotentReplay: true, authoritative: true }, error: null });
    expect(await needLifecycleClientService.cancelNeed(NEED, 4)).toMatchObject({ ok: true, podatak: { idempotentReplay: true, affectedResponses: 0 } });
    resetRpc({ data: null, error: { code: 'P0001', message: 'NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW' } });
    const blocked = await needLifecycleClientService.cancelNeed(NEED, 4);
    expect(blocked).toMatchObject({ ok: false, kod: 'NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW' });
    if (!blocked.ok) {
      expect(blocked.poruka).toContain('Dogovor');
      expect(blocked.poruka).not.toContain('NEED_');
    }
    resetRpc({ data: null, error: { code: 'P0001', message: 'STALE_REVIEW_REQUIRED' } });
    const stale = await needLifecycleClientService.cancelNeed(NEED, 3);
    if (!stale.ok) expect(stale.poruka).toContain('promenjen');
  });

  it('fails closed on an unconfirmed cancellation', async () => {
    resetRpc({ data: { needId: NEED, status: 'PUBLISHED' }, error: null });
    expect(await needLifecycleClientService.cancelNeed(NEED, 4)).toMatchObject({ ok: false, kod: 'NEED_CANCEL_INVALID_RESPONSE' });
  });
});

describe('CB1 — deleteDraftNeed', () => {
  it('deletes a draft with the revision and returns the receipt', async () => {
    resetRpc({ data: { needId: NEED, revision: 1, deleted: true, idempotentReplay: false, authoritative: true }, error: null });
    const result = await needLifecycleClientService.deleteDraftNeed(NEED, 1);
    expect(mockRpc.mock.calls).toEqual([['rpc_delete_draft_need', { p_need_id: NEED, p_need_revision: 1, p_reason: '' }]]);
    expect(result).toEqual({ ok: true, podatak: { needId: NEED, revision: 1, deleted: true, idempotentReplay: false } });
  });

  it('translates draft-only, media and history boundaries', async () => {
    for (const [name, fragment] of [
      ['NEED_NOT_DELETABLE_DRAFT', 'nacrt'],
      ['DRAFT_MEDIA_CLEANUP_REQUIRED', 'fotografije'],
      ['DRAFT_HAS_AUTHORITATIVE_HISTORY', 'otkazati'],
      ['FORBIDDEN', 'Vaš Zadatak'],
    ] as const) {
      resetRpc({ data: null, error: { code: 'P0001', message: name } });
      const result = await needLifecycleClientService.deleteDraftNeed(NEED, 1);
      expect(result).toMatchObject({ ok: false, kod: name });
      if (!result.ok) expect(result.poruka).toContain(fragment);
    }
  });
});
