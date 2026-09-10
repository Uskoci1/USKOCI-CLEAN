import { countryCode, marketConfig, timeZone } from '../../lib/market';
import { marketClientService } from '../marketClientService';

const A = '11111111-2222-4333-8444-555555555555';
const mockRpc = jest.fn();
let mockOwner: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
const row = () => ({ countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD',
  defaultLanguageTag: 'sr-Latn-RS', defaultTimezone: 'Europe/Belgrade' });
beforeEach(() => { jest.resetAllMocks(); mockOwner = { user: { id: A }, accountRevision: 1 }; });
afterEach(() => jest.useRealTimers());

it('normalizes country syntax and rejects malformed timezones without inferring geography', () => {
  expect(countryCode(' rs ')).toBe('RS'); expect(countryCode('Serbia')).toBeNull();
  expect(countryCode('SRB')).toBeNull(); expect(countryCode('\nRS')).toBeNull();
  expect(timeZone('Europe/Sarajevo')).toBe('Europe/Sarajevo'); expect(timeZone('Not/AZone')).toBeNull();
  expect(marketConfig(row())).toEqual(row());
});
it.each([{ countryCode: 'rs' }, { countryCode: 'SRB' }, { productStatus: 'ALPHA' }, { productStatus: null },
  { defaultCurrencyCode: 'rsd' }, { defaultLanguageTag: 'bad tag' }, { defaultTimezone: 'Not/AZone' }, { privateKey: 'secret' }])
('rejects malformed or unexpected server fields: %p', async patch => {
  mockRpc.mockResolvedValue({ data: [{ ...row(), ...patch }], error: null });
  await expect(marketClientService.list()).resolves.toMatchObject({ ok: false, kod: 'MARKET_CONFIG_INVALID_RESPONSE' });
});
it('reads the exact server-owned list without selecting a default country', async () => {
  mockRpc.mockResolvedValue({ data: [row()], error: null });
  await expect(marketClientService.list()).resolves.toEqual({ ok: true, podatak: [row()] });
  expect(mockRpc.mock.calls).toEqual([['rpc_list_location_markets', {}]]);
});
it.each([{}, null, [row(), row()], Array(251).fill(row())])('rejects nonlists, duplicate countries and excessive rows', async data => {
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(marketClientService.list()).resolves.toMatchObject({ ok: false, kod: 'MARKET_CONFIG_INVALID_RESPONSE' });
});
it('preserves an empty server list instead of inventing availability', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  await expect(marketClientService.list()).resolves.toEqual({ ok: true, podatak: [] });
});
it('rejects a late A-to-B-to-A account result using the existing account revision fence', async () => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const pending = marketClientService.list();
  mockOwner = { user: { id: A }, accountRevision: 3 };
  resolve({ data: [row()], error: null });
  await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('does not query without an account', async () => {
  mockOwner = { user: null, accountRevision: 2 };
  await expect(marketClientService.list()).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  expect(mockRpc).not.toHaveBeenCalled();
});
