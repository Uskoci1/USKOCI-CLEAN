jest.mock('../supabaseClient', () => {
  const mockAuth = jest.fn();
  const mockRead = jest.fn();
  const mockOrder = jest.fn(() => ({ order: mockRead }));
  const mockEq = jest.fn(() => ({ order: mockOrder }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));
  return { supabaseKlijent: () => ({ auth: { getUser: mockAuth }, from: mockFrom }),
    __mocks: { mockAuth, mockRead, mockEq, mockSelect, mockFrom } };
});
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));
import { supabaseIzvor } from '../supabaseIzvor';
const { mockAuth, mockRead, mockEq, mockSelect, mockFrom } = jest.requireMock('../supabaseClient').__mocks;
const account = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const agreement = '20000000-0000-4000-8000-000000000001';
const message = '30000000-0000-4000-8000-000000000001';
const row = { id: message, sender_account_id: account, client_message_id: 'poruka_retry_123', body: 'Stižem uskoro.', created_at: '2026-09-07T11:00:00Z' };
beforeEach(() => {
  jest.clearAllMocks(); mockAuth.mockReset(); mockRead.mockReset();
  mockAuth.mockResolvedValue({ data: { user: { id: account } }, error: null });
  mockRead.mockResolvedValue({ data: [row], error: null });
});
describe('real Agreement message read and retry reconciliation fields', () => {
  it('preserves persisted sender/key/body and has no invented read receipt', async () => {
    const [result] = await supabaseIzvor.poruke(agreement, account);
    expect(result).toMatchObject({ id: message, clientMessageId: row.client_message_id,
      posiljalacAccountId: account, telo: row.body, moja: true, procitano: null });
    expect(mockFrom).toHaveBeenCalledWith('agreement_messages');
    expect(mockEq).toHaveBeenCalledWith('agreement_id', agreement);
    expect(mockSelect).toHaveBeenCalledWith('id, sender_account_id, client_message_id, body, created_at');
  });
  it('preserves legacy messages with no client command key', async () => {
    mockRead.mockResolvedValue({ data: [{ ...row, sender_account_id: other, client_message_id: null }], error: null });
    expect((await supabaseIzvor.poruke(agreement, account))[0]).toMatchObject({ moja: false, clientMessageId: null, procitano: null });
  });
  it('only a successful empty array means no messages', async () => {
    mockRead.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: null });
    await expect(supabaseIzvor.poruke(agreement, account)).resolves.toEqual([]);
    await expect(supabaseIzvor.poruke(agreement, account)).rejects.toThrow('MESSAGE_READ_FAILED');
  });
  it('fails on transport/database error, then recovers on a later request', async () => {
    mockRead.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [], error: { code: '42501' } });
    await expect(supabaseIzvor.poruke(agreement, account)).rejects.toThrow('offline');
    await expect(supabaseIzvor.poruke(agreement, account)).rejects.toThrow('MESSAGE_READ_FAILED');
    await expect(supabaseIzvor.poruke(agreement, account)).resolves.toHaveLength(1);
  });
  it('rejects a replaced account before querying messages', async () => {
    mockAuth.mockResolvedValue({ data: { user: { id: other } }, error: null });
    await expect(supabaseIzvor.poruke(agreement, account)).rejects.toThrow('MESSAGE_AUTH_CONTEXT_CHANGED');
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('rejects a token/account switch while the read is in flight', async () => {
    mockAuth.mockResolvedValueOnce({ data: { user: { id: account } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: other } }, error: null });
    await expect(supabaseIzvor.poruke(agreement, account)).rejects.toThrow('MESSAGE_AUTH_CONTEXT_CHANGED');
  });
  it.each([{ id: 'invalid' }, { sender_account_id: 'invalid' }, { client_message_id: 'retry_key\n' },
    { client_message_id: undefined }, { body: null }, { created_at: 'invalid' }])('rejects a malformed projection: %j', async patch => {
    mockRead.mockResolvedValue({ data: [{ ...row, ...patch }], error: null });
    await expect(supabaseIzvor.poruke(agreement, account)).rejects.toThrow('MESSAGE_PROJECTION_INVALID');
  });
  it.each(['bad', `${agreement}\n`])('invalid route cannot issue an Auth or message request', async id => {
    await expect(supabaseIzvor.poruke(id, account)).rejects.toThrow('MESSAGE_SCOPE_INVALID');
    expect(mockAuth).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
  });
});
