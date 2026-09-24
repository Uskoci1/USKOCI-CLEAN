/**
 * Review of owner step 10 (critique A15): the calendar places my own tasks and finished Dogovori by the exact window of
 * their accepted terms, so the Dogovori list carries it as `tacanTermin`. An object when both ends are exact instants
 * with the start first; `null` when the Dogovor has no exact window; left out when the read carried no terms at all, so
 * the calendar says it shows only my work instead of calling a day empty.
 */
jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ auth: { getUser: mockGetUser }, rpc: mockRpc }),
    __testMocks: { mockGetUser, mockRpc },
  };
});

import { agreementClientService } from '../agreementClientService';

const { mockGetUser, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockGetUser: jest.Mock; mockRpc: jest.Mock };
}).__testMocks;

const row = (id: string, patch: Record<string, unknown> = {}) => ({
  id, requesterAccountId: 'requester-1', workerAccountId: 'worker-1', requesterName: 'Miloš', workerName: 'Ana',
  title: 'Pomoć oko krečenja stana', status: 'COMPLETED', agreementStatus: 'COMPLETED', currentVersion: 2, requiredSlots: 1,
  executionMode: 'ON_SITE', approximateArea: 'Liman', approximateCity: 'Novi Sad', createdAt: '2026-09-20T08:00:00Z',
  terms: { price_rsd: 4000, currency: 'RSD' }, ...patch,
});

beforeEach(() => {
  mockGetUser.mockReset(); mockRpc.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'requester-1' } }, error: null });
});

it('maps the accepted exact window from the same terms the list reads, keeping the stored text as it came', async () => {
  const items = [
    row('exact', { terms: { price_rsd: 4000, proposed_start_at: '2026-09-24T10:00:00.123456+00:00', proposed_end_at: '2026-09-24T17:00:00+00:00' } }),
    row('none', { terms: { price_rsd: 4000 } }),
    row('one-end', { terms: { proposed_start_at: '2026-09-24T10:00:00Z' } }),
    row('backwards', { terms: { proposed_start_at: '2026-09-24T17:00:00Z', proposed_end_at: '2026-09-24T10:00:00Z' } }),
    row('unreadable', { terms: { proposed_start_at: 'sutra', proposed_end_at: '2026-09-24T10:00:00Z' } }),
    row('unsaid', { terms: undefined }),
    row('malformed', { terms: ['2026-09-24T10:00:00Z'] }),
  ];
  mockRpc.mockImplementation((name: string) => Promise.resolve(name === 'rpc_list_my_agreements_page'
    ? { data: { items, hasMore: false }, error: null } : { data: { eligible: false }, error: null }));
  const result = Object.fromEntries((await agreementClientService.mojiDogovori()).map(item => [item.id, item]));
  expect(result.exact.tacanTermin).toEqual({ pocetak: '2026-09-24T10:00:00.123456+00:00', kraj: '2026-09-24T17:00:00+00:00' });
  for (const id of ['none', 'one-end', 'backwards', 'unreadable']) expect(result[id].tacanTermin).toBeNull();
  for (const id of ['unsaid', 'malformed']) expect('tacanTermin' in result[id]).toBe(false);
  // Nothing else the calendar reads changes with it.
  expect(result.exact).toMatchObject({ stanje: 'COMPLETED', verzija: 2, naslov: 'Pomoć oko krečenja stana', cena: { prikaz: '4.000 RSD' } });
});

it('carries the same window on the one Dogovor read', async () => {
  mockRpc.mockResolvedValue({ data: row('agr-1', { status: 'CONFIRMED', agreementStatus: 'CONFIRMED',
    terms: { proposed_start_at: '2026-09-24T10:00:00Z', proposed_end_at: '2026-09-24T12:00:00Z' } }), error: null });
  const result = await agreementClientService.dogovor('agr-1');
  expect(result?.tacanTermin).toEqual({ pocetak: '2026-09-24T10:00:00Z', kraj: '2026-09-24T12:00:00Z' });
});
