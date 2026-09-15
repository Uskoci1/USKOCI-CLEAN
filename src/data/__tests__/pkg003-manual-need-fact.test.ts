const mockRpc = jest.fn();
let mockSessionState: any = { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, accountRevision: 7 };

jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSessionState }));

import {
  canBootstrapManualNeedFact,
  manualNeedFactClientService,
  manualNeedFactFromText,
} from '../manualNeedFactClientService';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conversationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const factId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

beforeEach(() => {
  jest.resetAllMocks();
  mockSessionState = { user: { id: accountId }, accountRevision: 7 };
});

describe('PKG-003 provider-independent manual NEED_FACT_V2 bootstrap client', () => {
  it('saves an owned missing scalar fact through only the dedicated manual RPC and validates the receipt', async () => {
    mockRpc.mockResolvedValue({ data: {
      accountId, conversationId, clientRequestId: requestId, factId,
      factKey: 'need.title', authoritative: true, idempotentReplay: false,
    }, error: null });

    await expect(manualNeedFactClientService.save({
      conversationId, clientRequestId: requestId, key: 'need.title', value: 'Prenos ormara', displayValue: 'Prenos ormara',
    })).resolves.toEqual({ ok: true, podatak: {
      accountId, conversationId, clientRequestId: requestId, factId,
      factKey: 'need.title', authoritative: true, idempotentReplay: false,
    } });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_set_manual_need_fact_v2', {
      p_conversation_id: conversationId,
      p_client_request_id: requestId,
      p_fact_key: 'need.title',
      p_value: 'Prenos ormara',
      p_display_value: 'Prenos ormara',
    });
    expect(mockRpc.mock.calls.flat().join(' ')).not.toContain('rpc_ai_propose_fact');
    expect(mockRpc.mock.calls.flat().join(' ')).not.toContain('uskoci-ai-interview');
  });

  it('does not accept a malformed or cross-command receipt as success', async () => {
    mockRpc.mockResolvedValue({ data: {
      accountId, conversationId, clientRequestId: requestId,
      factId, factKey: 'need.description', authoritative: true, idempotentReplay: false,
    }, error: null });

    const result = await manualNeedFactClientService.save({
      conversationId, clientRequestId: requestId, key: 'need.title', value: 'Prenos ormara', displayValue: 'Prenos ormara',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kod).toBe('MANUAL_FACT_SAVE_INVALID_RESPONSE');
  });

  it('retires a late write receipt after account incarnation changes', async () => {
    let release!: (value: unknown) => void;
    mockRpc.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const pending = manualNeedFactClientService.save({
      conversationId, clientRequestId: requestId, key: 'need.title', value: 'Prenos ormara', displayValue: 'Prenos ormara',
    });

    mockSessionState = { user: { id: accountId }, accountRevision: 8 };
    release({ data: {
      accountId, conversationId, clientRequestId: requestId, factId,
      factKey: 'need.title', authoritative: true, idempotentReplay: false,
    }, error: null });

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kod).toBe('AUTH_ACCOUNT_CHANGED');
  });

  it('keeps location/media on their dedicated authority and refuses unavailable verified identity=true before transport', async () => {
    expect(canBootstrapManualNeedFact('need.task_geography')).toBe(false);
    expect(canBootstrapManualNeedFact('need.public_photo_paths')).toBe(false);
    expect(manualNeedFactFromText('need.task_geography', 'Novi Sad').ok).toBe(false);

    const result = await manualNeedFactClientService.save({
      conversationId, clientRequestId: requestId, key: 'need.verified_identity_required', value: true, displayValue: 'Da',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kod).toBe('VERIFIED_IDENTITY_UNAVAILABLE');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reuses the canonical typed correction parser for legitimate manual scalar/list values', () => {
    expect(manualNeedFactFromText('need.title', 'Kupovina karte')).toEqual({
      ok: true, value: 'Kupovina karte', displayValue: 'Kupovina karte',
    });
    expect(manualNeedFactFromText('need.people_needed', '2')).toEqual({ ok: true, value: 2, displayValue: '2' });
    expect(manualNeedFactFromText('need.price_mode', 'ponude')).toEqual({ ok: true, value: 'OFFERS', displayValue: 'ponude' });

    const instant = manualNeedFactFromText('need.starts_at', '2026-09-20 12:30');
    expect(instant.ok).toBe(true);
    if (instant.ok) expect(instant.value).toBe('2026-09-20T10:30:00.000Z');
  });
});
