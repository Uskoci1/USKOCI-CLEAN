/**
 * RU-4 — owner edit of a public Zadatak has one physical client path.
 *
 * R04 "Izmeni Zadatak" used to push a route that does not exist. The live
 * server has owned the edit authority since RU-4 closure; this locks the
 * client contract onto it: open a bound edit conversation, review in R07,
 * confirm with the exact revision the owner saw. The server decides
 * materiality, staleness and the post-Dogovor lock — the client only
 * translates its answers into product language.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { aiNeedV2Production } from '../aiNeedV2Production';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const NEED = '11111111-1111-4111-8111-111111111111';
const CONVERSATION = '22222222-2222-4222-8222-222222222222';

describe('RU-4 — R04 edit no longer dead-ends', () => {
  it('R04 opens the real server edit flow instead of a route that does not exist', () => {
    const screen = readFileSync(join(__dirname, '..', '..', 'app', '(app)', 'potrebe', '[id]', 'pregled.tsx'), 'utf8');
    expect(screen).not.toContain("'/potrebe/[id]/izmeni'");
    expect(screen).not.toContain('as any');
    expect(screen).toContain('openEditConversation');
    expect(screen).toContain("pathname: '/nova'");
  });

  it('R07 confirms an edit through the RU-4 review authority, not the DRAFT creator', () => {
    const review = readFileSync(join(__dirname, '..', '..', 'app', '(app)', 'pregled-nacrta.tsx'), 'utf8');
    expect(review).toContain('confirmEdit');
    expect(review).toContain('review.boundNeedId');
  });
});

describe('RU-4 — openEditConversation', () => {
  it('passes the exact need id and returns the bound conversation with its revision', async () => {
    resetRpc({ data: { conversationId: CONVERSATION, needId: NEED, revision: 3, status: 'PUBLISHED' }, error: null });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(mockRpc.mock.calls).toEqual([['rpc_ai_open_need_edit_conversation_v2', { p_need_id: NEED }]]);
    expect(result).toEqual({ ok: true, podatak: { conversationId: CONVERSATION, needId: NEED, revision: 3 } });
  });

  it('translates the post-Dogovor lock into product language and keeps the server code', async () => {
    resetRpc({ data: null, error: { code: 'P0001', message: 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' } });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kod).toBe('NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR');
    expect(result.poruka).toContain('Dogovor');
    expect(result.poruka).not.toContain('NEED_EDIT');
  });

  it('fails closed on a malformed server answer', async () => {
    resetRpc({ data: { conversationId: CONVERSATION }, error: null });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(result).toMatchObject({ ok: false, kod: 'NEED_EDIT_INVALID_RESPONSE' });
  });
});

describe('RU-4 — confirmEdit', () => {
  it('carries the reviewed revision and a stable request id to the v2 authority', async () => {
    resetRpc({
      data: { needId: NEED, fromRevision: 3, revision: 4, status: 'DRAFT', requiresReadmission: true, idempotentReplay: false },
      error: null,
    });
    const result = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(mockRpc.mock.calls).toEqual([[
      'rpc_confirm_need_edit_from_review_v2',
      { p_need_id: NEED, p_expected_revision: 3, p_conversation_id: CONVERSATION, p_client_request_id: 'ru4-edit-abc12345' },
    ]]);
    expect(result).toEqual({
      ok: true,
      podatak: { needId: NEED, fromRevision: 3, revision: 4, requiresReadmission: true, idempotentReplay: false },
    });
  });

  it('reports a replayed receipt as such instead of a second edit', async () => {
    resetRpc({ data: { needId: NEED, fromRevision: 3, revision: 4, idempotentReplay: true, requiresReadmission: true }, error: null });
    const result = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(result).toMatchObject({ ok: true, podatak: { idempotentReplay: true, revision: 4 } });
  });

  it('turns a moved revision into a re-read instruction, never a silent overwrite', async () => {
    resetRpc({ data: null, error: { code: '40001', message: 'STALE_REVIEW_REQUIRED' } });
    const result = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(result).toMatchObject({ ok: false, kod: 'STALE_REVIEW_REQUIRED' });
    if (!result.ok) expect(result.poruka).toContain('u međuvremenu promenjen');
  });

  it('explains an unchanged review and unconfirmed facts in product language', async () => {
    resetRpc({ data: null, error: { code: '22023', message: 'NO_MATERIAL_CHANGE' } });
    const unchanged = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(unchanged).toMatchObject({ ok: false, kod: 'NO_MATERIAL_CHANGE', poruka: 'Niste promenili nijedan podatak.' });

    resetRpc({ data: null, error: { code: 'P0001', message: 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' } });
    const unconfirmed = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(unconfirmed).toMatchObject({ ok: false, kod: 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' });
    if (!unconfirmed.ok) expect(unconfirmed.poruka).toContain('Potvrdite');
  });
});
