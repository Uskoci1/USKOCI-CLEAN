import { aiNeedV2Production } from '../aiNeedV2Production';

let mockStatus: unknown;
const mockSelect = jest.fn();
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  from: (table: string) => {
    const query = { select: (columns: string) => { mockSelect(table, columns); return query; },
      eq: () => query,
      maybeSingle: async () => ({ data: { id: 'conversation-a', fact_schema_version: 'NEED_FACT_V2', status: mockStatus }, error: null }),
      order: async () => ({ data: [], error: null }),
    };
    return query;
  },
  rpc: (...args: unknown[]) => mockRpc(...args),
}) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: { conversationId: 'conversation-a', schemaVersion: 'NEED_FACT_V2',
    boundNeedId: 'need-a', canSaveDraft: true, missingRequired: [], facts: [] }, error: null });
});

describe('actual conversation lifecycle projection', () => {
  it.each(['OPEN', 'COMPLETED', 'ABANDONED'])('preserves actual stored %s with its owned bound review', async status => {
    mockStatus = status;
    const conversation = await aiNeedV2Production.loadConversation('conversation-a');
    expect(conversation?.status).toBe(status);
    expect(conversation?.review.boundNeedId).toBe('need-a');
    expect(mockSelect).toHaveBeenCalledWith('ai_conversations', 'id,purpose,status,fact_schema_version');
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_need_review_v2', { p_conversation_id: 'conversation-a' });
  });

  it.each(['PUBLISHED', 'UNKNOWN', 'open', null, undefined, { status: 'OPEN' }])('does not invent OPEN authority from unknown status %s', async status => {
    mockStatus = status;
    const conversation = await aiNeedV2Production.loadConversation('conversation-a');
    expect(conversation?.status).toBeUndefined();
    expect(conversation?.review.boundNeedId).toBe('need-a');
  });
});
