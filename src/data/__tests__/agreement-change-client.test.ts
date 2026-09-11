import { agreementChangeService, agreementClientService, type AgreementChangeProposal } from '../agreementClientService';
import type { IzmenaKomanda } from '../ports';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const ID = '20000000-0000-4000-8000-000000000001', PID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
let mockAccount: string | undefined = A, mockRevision = 1;
const mockRpc = jest.fn(), mockRows = jest.fn();
const mockQuery = { select: jest.fn(), eq: jest.fn(), order: jest.fn(),
  then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => mockRows().then(resolve, reject) };
const mockFrom = jest.fn(() => mockQuery);
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
const account = { accountId: A, accountRevision: 1 };
const rawTerms = { price_rsd: 3200, scope_note: 'Prenos ormara', currency: 'RSD', covered_slots: 1,
  proposed_start_at: '2026-10-25T02:30:00.000001+02:00', proposed_end_at: '2026-10-25T02:30:00.000002+02:00' };
const terms = { priceRsd: 3200, currency: 'RSD' as const, scopeNote: rawTerms.scope_note,
  startsAt: rawTerms.proposed_start_at, endsAt: rawTerms.proposed_end_at };
const workspace = { id: ID, currentVersion: 7, agreementStatus: 'CONFIRMED', status: 'AWAITING_REQUESTER',
  requesterAccountId: A, workerAccountId: B, terms: rawTerms };
const row = { id: PID, agreement_id: ID, base_version: 7, proposed_terms: { ...rawTerms, price_rsd: 3400 },
  reason: 'Dodatni ormar', proposed_by_account_id: B, status: 'PENDING',
  responded_by_account_id: null, responded_at: null, created_at: '2026-09-11T12:00:00.123456Z' };
const proposal: AgreementChangeProposal = { proposalId: PID, agreementId: ID, baseVersion: 7, proposedBy: B,
  status: 'PENDING', reason: row.reason, createdAt: row.created_at, respondedBy: null, respondedAt: null,
  termsAvailable: true, terms: { ...terms, priceRsd: 3400 } };
const command: IzmenaKomanda = { dogovorId: ID, ocekivanaVerzija: 7, clientRequestId: KEY,
  razlog: '  Dodatni ormar  ', izmena: { cenaIznos: 3400, cenaValuta: 'RSD', obim: 'Dva ormara',
    pocetakIso: rawTerms.proposed_start_at, krajIso: rawTerms.proposed_end_at } };
const ok = (data: unknown) => ({ data, error: null });
const read = () => agreementChangeService.read(ID, account);
const respond = (accept = true, value: AgreementChangeProposal = proposal) => agreementChangeService.respond(value, accept, account);
beforeEach(() => {
  jest.clearAllMocks(); mockRpc.mockReset(); mockRows.mockReset(); mockAccount = A; mockRevision = 1;
  for (const method of ['select', 'eq', 'order'] as const) mockQuery[method].mockReturnValue(mockQuery);
  mockRpc.mockResolvedValue(ok(workspace)); mockRows.mockResolvedValue(ok([row]));
});
afterEach(() => jest.useRealTimers());

describe('M05 participant read and immutable accepted terms', () => {
  it('reads actual Agreement status, accepted microseconds and participant-only proposals, then checks the version again', async () => {
    expect(await read()).toEqual({ ok: true, podatak: { agreementId: ID, agreementVersion: 7, agreementStatus: 'CONFIRMED',
      requesterAccountId: A, workerAccountId: B, terms, proposals: [proposal] } });
    expect(mockRpc.mock.calls).toEqual(Array(2).fill(['rpc_get_agreement_workspace', { p_agreement_id: ID }]));
    expect(mockFrom.mock.calls).toEqual([['agreement_change_proposals']]);
    expect(mockQuery.eq.mock.calls).toEqual([['agreement_id', ID]]);
    expect(mockQuery.select.mock.calls[0][0]).not.toContain('client_request_id');
    expect(mockQuery.select.mock.calls[0][0]).not.toContain('*');
  });
  it.each(['COMPLETED', 'CANCELLED', 'SUPERSEDED'])('retains immutable accepted terms for %s without changing their business state', async agreementStatus => {
    mockRpc.mockResolvedValue(ok({ ...workspace, agreementStatus }));
    expect(await read()).toMatchObject({ ok: true, podatak: { agreementStatus, terms } });
  });
  it('defaults only an absent RSD currency and preserves a genuinely unscheduled interval and empty scope', async () => {
    mockRpc.mockResolvedValue(ok({ ...workspace, terms: { price_rsd: 1, scope_note: '', proposed_start_at: null, proposed_end_at: null } }));
    mockRows.mockResolvedValue(ok([]));
    expect(await read()).toMatchObject({ ok: true, podatak: { terms: { priceRsd: 1, currency: 'RSD', scopeNote: '', startsAt: null, endsAt: null }, proposals: [] } });
  });
  it.each([null, {}, { ...workspace, id: B }, { ...workspace, requesterAccountId: ID },
    { ...workspace, workerAccountId: A }, { ...workspace, currentVersion: '7' },
    { ...workspace, agreementStatus: 'AWAITING_REQUESTER' },
    ...[null, 'rsd', 'EUR'].map(currency => ({ ...workspace, terms: { ...rawTerms, currency } })),
    ...[0, -1, 2.5, '3200', 2147483648].map(price_rsd => ({ ...workspace, terms: { ...rawTerms, price_rsd } })),
    { ...workspace, terms: { ...rawTerms, scope_note: null } },
    { ...workspace, terms: { ...rawTerms, proposed_end_at: null } },
    { ...workspace, terms: { ...rawTerms, proposed_start_at: '2026-02-30T12:00:00Z' } },
    { ...workspace, terms: { ...rawTerms, proposed_end_at: rawTerms.proposed_start_at } },
  ])('does not query proposals for malformed/foreign accepted context %#', async data => {
    mockRpc.mockResolvedValue(ok(data));
    expect(await read()).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_INVALID' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each([null, {}, [row, row], [{ ...row, agreement_id: B }], [{ ...row, proposed_by_account_id: ID }],
    [{ ...row, base_version: 8 }], [{ ...row, base_version: '7' }], [{ ...row, status: 'VOID' }],
    [{ ...row, reason: 12 }], [{ ...row, created_at: 'not-a-date' }],
    [{ ...row, responded_by_account_id: A }], [{ ...row, status: 'REJECTED' }],
    [{ ...row, proposed_terms: [] }], [{ ...row, other_private_data: 'secret' }],
  ])('never silently filters a malformed or foreign proposal row %#', async data => {
    mockRows.mockResolvedValue(ok(data)); expect(await read()).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_INVALID' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('keeps known historical invalid terms unavailable without inventing accepted values or losing proposal metadata', async () => {
    mockRows.mockResolvedValue(ok([{ ...row, proposed_terms: { ...rawTerms, price_rsd: '3400' } }]));
    expect(await read()).toMatchObject({ ok: true, podatak: { terms, proposals: [{ ...proposal, termsAvailable: false, terms: null }] } });
  });
  it('retains old pending metadata and accepted/rejected/superseded history without making it current', async () => {
    mockRows.mockResolvedValue(ok([
      { ...row, base_version: 5 },
      { ...row, id: '30000000-0000-4000-8000-000000000002', base_version: 6, status: 'ACCEPTED', responded_by_account_id: A, responded_at: row.created_at },
      { ...row, id: '30000000-0000-4000-8000-000000000003', base_version: 6, status: 'REJECTED', responded_by_account_id: A, responded_at: row.created_at },
      { ...row, id: '30000000-0000-4000-8000-000000000004', base_version: 6, status: 'SUPERSEDED', responded_at: row.created_at },
    ]));
    const result = await read(); expect(result.ok).toBe(true);
    if (result.ok) expect(result.podatak.proposals.map(p => [p.baseVersion, p.status])).toEqual([[5, 'PENDING'], [6, 'ACCEPTED'], [6, 'REJECTED'], [6, 'SUPERSEDED']]);
  });
  it.each([{ ...workspace, currentVersion: 8 }, { ...workspace, agreementStatus: 'CANCELLED' },
    { ...workspace, terms: { ...rawTerms, scope_note: 'Promenjen obim' } }])('rejects a mixed snapshot if accepted context changes during the RLS read %#', async after => {
    mockRpc.mockResolvedValueOnce(ok(workspace)).mockResolvedValueOnce(ok(after));
    expect(await read()).toMatchObject({ ok: false, kod: 'VERSION_CONFLICT' });
  });
  it('does not invent scope/reason length policy or trim server-authoritative display values', async () => {
    const text = ' '.repeat(2) + '😀'.repeat(5000) + '  ';
    mockRpc.mockResolvedValue(ok({ ...workspace, terms: { ...rawTerms, scope_note: text } }));
    mockRows.mockResolvedValue(ok([{ ...row, reason: text }]));
    expect(await read()).toMatchObject({ ok: true, podatak: { terms: { scopeNote: text }, proposals: [{ reason: text }] } });
  });
});

describe('M05 exact proposal command and authoritative response', () => {
  it('copies the typed command before dispatch and preserves exact offsets, microseconds, reason and key', async () => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const mutable = { ...command, izmena: { ...command.izmena } };
    const pending = agreementChangeService.propose(mutable, account);
    mutable.izmena.cenaIznos = 9999; mutable.razlog = 'Changed'; mutable.clientRequestId = 'different';
    resolve(ok(PID)); expect(await pending).toEqual({ ok: true, podatak: { proposalId: PID } });
    expect(mockRpc.mock.calls).toEqual([['rpc_propose_agreement_change_v2', {
      p_agreement_id: ID, p_expected_version: 7, p_client_request_id: KEY, p_reason: command.razlog,
      p_patch: { price_rsd: 3400, currency: 'RSD', scope_note: 'Dva ormara', proposed_start_at: rawTerms.proposed_start_at, proposed_end_at: rawTerms.proposed_end_at },
    }]]);
  });
  it('allows a partial patch without inferring inherited end, scope or currency', async () => {
    mockRpc.mockResolvedValue(ok(PID));
    expect((await agreementChangeService.propose({ ...command, razlog: undefined, izmena: { pocetakIso: rawTerms.proposed_start_at } }, account)).ok).toBe(true);
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_reason: null, p_patch: { proposed_start_at: rawTerms.proposed_start_at } });
  });
  it.each<[unknown, string]>([
    [{ ...command, dogovorId: 'id' }, 'AGREEMENT_CHANGE_INVALID'],
    [{ ...command, ocekivanaVerzija: 0 }, 'AGREEMENT_CHANGE_INVALID'],
    [{ ...command, clientRequestId: ' ' }, 'CLIENT_REQUEST_ID_REQUIRED'],
    [{ ...command, razlog: 4 }, 'AGREEMENT_CHANGE_INVALID'],
    [{ ...command, izmena: {} }, 'CHANGE_PATCH_REQUIRED'],
    ...[0, 1.5, 2147483648, '3400'].map((cenaIznos): [unknown, string] => [{ ...command, izmena: { cenaIznos } }, 'INVALID_PRICE']),
    [{ ...command, izmena: { cenaValuta: 'EUR' } }, 'CHANGE_CURRENCY_INVALID'],
    [{ ...command, izmena: { obim: null } }, 'CHANGE_SCOPE_INVALID'],
    [{ ...command, izmena: { pocetakIso: 'tomorrow' } }, 'AGREEMENT_CALENDAR_INTERVAL_INVALID'],
    [{ ...command, izmena: { pocetakIso: rawTerms.proposed_end_at, krajIso: rawTerms.proposed_start_at } }, 'AGREEMENT_CALENDAR_INTERVAL_INVALID'],
    [{ ...command, izmena: { covered_slots: 3 } }, 'AGREEMENT_CHANGE_INVALID'],
  ])('rejects invalid typed commands before any RPC %#', async (value, code) => {
    expect(await agreementChangeService.propose(value as IzmenaKomanda, account)).toMatchObject({ ok: false, kod: code });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, 'proposal-1', { proposalId: PID }])('requires the actual UUID proposal receipt %#', async data => {
    mockRpc.mockResolvedValue(ok(data)); expect(await agreementChangeService.propose(command, account)).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_INVALID' });
  });
  it.each([true, false])('preserves strict accept=%s receipt and immutable base version for replay', async accept => {
    const receipt = { proposalId: PID, accepted: accept, agreementVersion: accept ? 8 : 7, authoritative: true };
    mockRpc.mockResolvedValue(ok(receipt));
    expect(await respond(accept)).toEqual({ ok: true, podatak: receipt });
    expect(await respond(accept, { ...proposal, status: accept ? 'ACCEPTED' : 'REJECTED' })).toEqual({ ok: true, podatak: receipt });
    expect(mockRpc.mock.calls[0]).toEqual(['rpc_respond_agreement_change', { p_proposal_id: PID, p_accept: accept }]);
  });
  it.each([null, {}, { proposalId: PID, accepted: true, agreementVersion: 9, authoritative: true },
    { proposalId: B, accepted: true, agreementVersion: 8, authoritative: true },
    { proposalId: PID, accepted: false, agreementVersion: 8, authoritative: true },
    { proposalId: PID, accepted: true, agreementVersion: '8', authoritative: true },
    { proposalId: PID, accepted: true, agreementVersion: 8, authoritative: false },
    { proposalId: PID, accepted: true, agreementVersion: 8, authoritative: true, extra: 'secret' },
  ])('does not turn malformed, foreign or latest-version acknowledgment into acceptance %#', async data => {
    mockRpc.mockResolvedValue(ok(data)); expect(await respond()).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_INVALID' });
  });
  it('requires the other participant and a compatible decision; legacy unavailable terms can only be rejected', async () => {
    expect(await respond(true, { ...proposal, proposedBy: A })).toMatchObject({ ok: false, kod: 'PROPOSER_CANNOT_RESPOND' });
    expect(await respond(true, { ...proposal, status: 'REJECTED' })).toMatchObject({ ok: false, kod: 'PROPOSAL_NOT_PENDING' });
    expect(await respond(false, { ...proposal, status: 'SUPERSEDED' })).toMatchObject({ ok: false, kod: 'PROPOSAL_NOT_PENDING' });
    const legacy: AgreementChangeProposal = { ...proposal, termsAvailable: false, terms: null };
    expect(await respond(true, legacy)).toMatchObject({ ok: false, kod: 'CHANGE_TERMS_INVALID' });
    expect(mockRpc).not.toHaveBeenCalled();
    mockRpc.mockResolvedValue(ok({ proposalId: PID, accepted: false, agreementVersion: 7, authoritative: true }));
    expect((await respond(false, legacy)).ok).toBe(true);
  });
  it.each(['CHANGE_REQUEST_ID_REUSED', 'VERSION_CONFLICT', 'AGREEMENT_NOT_ACTIVE', 'WORKER_CALENDAR_CONFLICT'])('maps known %s without forwarding backend detail', async message => {
    mockRpc.mockResolvedValue({ data: null, error: { message, details: 'private detail' } });
    const result = await agreementChangeService.propose(command, account);
    expect(result).toMatchObject({ ok: false, kod: message }); expect(JSON.stringify(result)).not.toContain('private detail');
  });
  it('keeps unrecognized backend errors private and represents serialization as a required recheck', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'private raw message', details: 'private body' } });
    const failed = await respond(); expect(failed).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_UNCONFIRMED' });
    expect(JSON.stringify(failed)).not.toContain('private');
    mockRpc.mockResolvedValue({ data: null, error: { message: 'private lock names', code: '40P01' } });
    expect(await respond()).toMatchObject({ ok: false, kod: 'CALENDAR_RECHECK_REQUIRED' });
  });
});

describe('M05 ownership and bounded outcome', () => {
  it('makes no request with missing Auth, changed account or old incarnation', async () => {
    mockAccount = undefined; expect((await read()).ok).toBe(false);
    mockAccount = B; expect((await agreementChangeService.propose(command, account)).ok).toBe(false);
    mockAccount = A; mockRevision = 3; expect((await respond()).ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each(['read', 'propose', 'respond'] as const)('does not adopt late %s across account ABA', async kind => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = kind === 'read' ? read() : kind === 'propose' ? agreementChangeService.propose(command, account) : respond();
    mockRevision += 2; resolve(ok(kind === 'read' ? workspace : kind === 'propose' ? PID : { proposalId: PID, accepted: true, agreementVersion: 8, authoritative: true }));
    expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('does not start the final workspace read after an account change while proposal rows were pending', async () => {
    let resolve!: (value: unknown) => void;
    mockRows.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = read(); await Promise.resolve(); await Promise.resolve(); mockRevision += 2;
    resolve(ok([row])); expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('expires the entire multi-stage read and never starts a late secondary request', async () => {
    jest.useFakeTimers(); let resolve!: (value: unknown) => void;
    mockRpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = read(); await jest.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_READ_FAILED' });
    resolve(ok(workspace)); await Promise.resolve(); await Promise.resolve();
    expect(mockFrom).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it.each(['propose', 'respond'] as const)('times out %s as unknown without automatic replay or late acceptance', async kind => {
    jest.useFakeTimers(); let resolve!: (value: unknown) => void;
    mockRpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = kind === 'propose' ? agreementChangeService.propose(command, account) : respond();
    await jest.advanceTimersByTimeAsync(15_000); expect(await pending).toMatchObject({ ok: false, kod: 'AGREEMENT_CHANGE_UNCONFIRMED' });
    resolve(ok(PID)); await Promise.resolve(); expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('retains the old Izvor void response contract through the same RPC adapter', async () => {
    mockRpc.mockResolvedValue(ok({ proposalId: PID, accepted: true, agreementVersion: 8, authoritative: true }));
    expect(await agreementClientService.odgovoriNaIzmenu(PID, true)).toEqual({ ok: true, podatak: null });
    expect(mockRpc).toHaveBeenCalledWith('rpc_respond_agreement_change', { p_proposal_id: PID, p_accept: true });
  });
});
