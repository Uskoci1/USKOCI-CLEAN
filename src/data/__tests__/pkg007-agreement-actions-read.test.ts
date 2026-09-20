/**
 * PKG-007 / GAP-0032 — the Agreement projection carries the server's own
 * completion permissions (rpc_get_agreement_workspace.actionState). The client
 * never derives them from status and party; anything missing, foreign, stale or
 * malformed fails closed to null while the Agreement itself stays readable.
 */
const mockGetUser = jest.fn(), mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({
  supabaseKonfigurisan: () => true,
  supabaseKlijent: () => ({ auth: { getUser: mockGetUser }, rpc: mockRpc }),
}));

import { agreementClientService } from '../agreementClientService';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const ID = '20000000-0000-4000-8000-000000000001', PID = '30000000-0000-4000-8000-000000000001';
const terms = { price_rsd: 3000, currency: 'RSD', covered_slots: 1, proposed_start_at: null, proposed_end_at: null };
const actionState = { agreementId: ID, agreementVersion: 4, accountId: A, authoritative: true,
  canProposeChange: true, canRespondChange: false, canWithdrawChange: false,
  canMarkWorkDone: false, canConfirmCompletion: true, canCancel: true, pendingChanges: [] as unknown[] };
const pending = { id: PID, baseVersion: 4, proposedByAccountId: B, createdAt: '2026-09-11T15:00:00.123456Z', proposedTerms: terms, reason: null };
const raw = { id: ID, currentVersion: 4, status: 'CONFIRMED', agreementStatus: 'CONFIRMED', title: 'Prenos ormara',
  approximateArea: 'Liman', approximateCity: 'Novi Sad', requiredSlots: 1, startsAt: null, terms,
  requesterAccountId: A, workerAccountId: B, requesterName: 'Ana', workerName: 'Marko', executionMode: 'ON_SITE',
  requesterDeadlineAt: null, problemOpened: false, myPhoneShared: false, theirPhone: null, createdAt: '2026-09-10T08:00:00Z', actionState };
const user = (id: string) => ({ data: { user: { id } }, error: null });

beforeEach(() => { mockGetUser.mockReset().mockResolvedValue(user(A)); mockRpc.mockReset(); });

describe('PKG-007 — server completion permissions in the Agreement projection', () => {
  it('projects the server permissions for this account and version', async () => {
    mockRpc.mockResolvedValue({ data: raw, error: null });
    const result = await agreementClientService.dogovor(ID);
    expect(result).toMatchObject({ id: ID, verzija: 4, stanje: 'CONFIRMED',
      radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false } });
  });
  it('reports a pending change together with the server-denied completion', async () => {
    mockRpc.mockResolvedValue({ data: { ...raw, actionState: { ...actionState, canProposeChange: false, canRespondChange: true,
      canConfirmCompletion: false, pendingChanges: [pending] } }, error: null });
    expect((await agreementClientService.dogovor(ID))?.radnje)
      .toMatchObject({ mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true });
  });
  it('says what the pending change changes, who proposed it and who answers it', async () => {
    const proposed = { ...pending, reason: 'Ima više stvari nego što je rečeno.',
      proposedTerms: { ...terms, price_rsd: 4500, scope_note: 'I dve komode' } };
    mockRpc.mockResolvedValue({ data: { ...raw, actionState: { ...actionState, canProposeChange: false, canRespondChange: true,
      canConfirmCompletion: false, pendingChanges: [proposed] } }, error: null });
    expect((await agreementClientService.dogovor(ID))?.radnje?.predlogIzmene).toEqual({ id: PID, moj: false,
      mozeOdgovoriti: true, mozePovuci: false, razlog: 'Ima više stvari nego što je rečeno.',
      izmene: [{ polje: 'Cena', sada: '3.000 RSD', predlog: '4.500 RSD' }, { polje: 'Obim', sada: 'Nije naveden', predlog: 'I dve komode' }] });
  });
  it('marks my own pending proposal as mine, answerable by the other side only', async () => {
    mockRpc.mockResolvedValue({ data: { ...raw, actionState: { ...actionState, canProposeChange: false, canWithdrawChange: true,
      canConfirmCompletion: false, pendingChanges: [{ ...pending, proposedByAccountId: A,
        proposedTerms: { ...terms, price_rsd: 2500 } }] } }, error: null });
    expect((await agreementClientService.dogovor(ID))?.radnje?.predlogIzmene).toMatchObject({ moj: true,
      mozeOdgovoriti: false, mozePovuci: true, izmene: [{ polje: 'Cena', sada: '3.000 RSD', predlog: '2.500 RSD' }] });
  });
  it('keeps the pending flag and invents no content when the proposal cannot be read', async () => {
    mockRpc.mockResolvedValue({ data: { ...raw, actionState: { ...actionState, canConfirmCompletion: false,
      pendingChanges: [{ ...pending, proposedTerms: { price_rsd: 'mnogo' } }] } }, error: null });
    expect((await agreementClientService.dogovor(ID))?.radnje).toMatchObject({ izmenaNaCekanju: true, predlogIzmene: null });
  });
  it('keeps the worker permission separate from the requester permission', async () => {
    mockGetUser.mockResolvedValue(user(B));
    mockRpc.mockResolvedValue({ data: { ...raw, actionState: { ...actionState, accountId: B, canMarkWorkDone: true, canConfirmCompletion: false } }, error: null });
    expect((await agreementClientService.dogovor(ID))?.radnje)
      .toEqual({ mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null });
  });
  it.each([
    ['absent', undefined],
    ['null', null],
    ['scalar', 'true'],
    ['foreign account', { ...actionState, accountId: B }],
    ['foreign Agreement', { ...actionState, agreementId: B }],
    ['stale version', { ...actionState, agreementVersion: 5 }],
    ['non-authoritative', { ...actionState, authoritative: false }],
    ['non-boolean permission', { ...actionState, canConfirmCompletion: 'true' }],
    ['missing permission key', (({ canMarkWorkDone: _k, ...rest }) => rest)(actionState)],
    ['unbounded pending list', { ...actionState, pendingChanges: [pending, pending] }],
    ['non-array pending list', { ...actionState, pendingChanges: null }],
  ])('fails closed to null on a %s actionState while the Agreement stays readable', async (_label, state) => {
    const data: Record<string, unknown> = { ...raw };
    if (state === undefined) delete data.actionState; else data.actionState = state;
    mockRpc.mockResolvedValue({ data, error: null });
    const result = await agreementClientService.dogovor(ID);
    expect(result).toMatchObject({ id: ID, stanje: 'CONFIRMED' });
    expect(result?.radnje).toBeNull();
  });
  it('never fabricates permissions for the Agreement list, which carries no actionState', async () => {
    const { actionState: _omitted, ...row } = raw;
    mockRpc.mockResolvedValue({ data: { items: [row], hasMore: false }, error: null });
    const rows = await agreementClientService.mojiDogovori();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: ID, stanje: 'CONFIRMED' });
    expect(rows[0].radnje).toBeNull();
  });
});
