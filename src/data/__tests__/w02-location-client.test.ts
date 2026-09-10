import { normalizeNeedLocation, normalizeTaskGeography, normalizeWorkerLocation } from '../../lib/location';
import { needLocationClientService, workerLocationClientService } from '../locationClientService';
import { createLocationResolver } from '../locationResolver';
import type { NeedLocationSave, WorkerLocationSave } from '../../contracts/location';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const C = '22222222-3333-4444-8555-666666666666';
const P = '33333333-4444-4555-8666-777777777777';
const revision = 'a'.repeat(64);
const mockRpc = jest.fn();
let mockOwner: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
const input = () => ({ taskCountryCode: 'RS', geography: { mode: 'STATIONARY' as const, start: { city: 'Novi Sad', area: 'Liman' } }, exactAddress: 'Privatna 12', accessNotes: 'Privatno uputstvo' });
const command = (): NeedLocationSave => ({ conversationId: C, expectedRevision: revision, confirmed: true, value: input() });
const document = () => ({ accountId: A, conversationId: C, revision, editable: true, confirmed: true, value: input() });
const receipt = () => ({ saved: true, idempotentReplay: false, review: document() });
const workerInput = () => ({ operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 15, approximatePosition: null });
const workerCommand = (): WorkerLocationSave => ({ expectedRevision: revision, confirmed: true, value: workerInput() });
const workerDoc = () => ({ accountId: A, profileId: P, revision, ...workerInput() });
const workerReceipt = () => ({ saved: true, idempotentReplay: false, location: workerDoc() });
beforeEach(() => { jest.resetAllMocks(); mockOwner = { user: { id: A }, accountRevision: 1 }; });
afterEach(() => jest.useRealTimers());

it.each([undefined, null, '', 'SRB', 'Serbia', '1S', '\nRS'])('requires an explicit syntactically valid country before a save: %p', async country => {
  await expect(needLocationClientService.save({ ...command(), value: { ...input(), taskCountryCode: country } as never }))
    .resolves.toMatchObject({ ok: false, kod: 'LOCATION_INPUT_INVALID' });
  await expect(workerLocationClientService.save({ ...workerCommand(), value: { ...workerInput(), operatingCountryCode: country } as never }))
    .resolves.toMatchObject({ ok: false, kod: 'LOCATION_INPUT_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('normalizes explicit country codes without using the city or account as authority', () => {
  expect(normalizeNeedLocation({ ...input(), taskCountryCode: ' rs ' })?.taskCountryCode).toBe('RS');
  expect(normalizeWorkerLocation({ ...workerInput(), operatingCountryCode: 'ba' })?.operatingCountryCode).toBe('BA');
});
it.each([null, undefined])('preserves historical unknown country without assigning Serbia: %p', async country => {
  mockRpc.mockResolvedValueOnce({ data: { ...document(), value: { ...input(), taskCountryCode: country } }, error: null });
  await expect(needLocationClientService.read(C)).resolves.toMatchObject({ ok: true,
    podatak: { confirmed: false, value: { taskCountryCode: null } } });
  mockRpc.mockResolvedValueOnce({ data: { ...workerDoc(), operatingCountryCode: country }, error: null });
  await expect(workerLocationClientService.read()).resolves.toMatchObject({ ok: true, podatak: { operatingCountryCode: null } });
});
it('does not accept a missing or changed country as a matching write receipt', async () => {
  mockRpc.mockResolvedValueOnce({ data: { ...receipt(), review: { ...document(), value: { ...input(), taskCountryCode: null } } }, error: null });
  await expect(needLocationClientService.save(command())).resolves.toMatchObject({ ok: false, kod: 'LOCATION_INVALID_RESPONSE' });
  mockRpc.mockResolvedValueOnce({ data: { ...workerReceipt(), location: { ...workerDoc(), operatingCountryCode: 'BA' } }, error: null });
  await expect(workerLocationClientService.save(workerCommand())).resolves.toMatchObject({ ok: false, kod: 'LOCATION_INVALID_RESPONSE' });
});
it('shows the known unavailable-country error without exposing arbitrary backend text', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'LOCATION_COUNTRY_UNAVAILABLE' } });
  await expect(needLocationClientService.save(command())).resolves.toMatchObject({ ok: false, kod: 'LOCATION_COUNTRY_UNAVAILABLE' });
});

it('manual geography is the existing textual topology with private fields kept separate', () => {
  expect(normalizeNeedLocation({ ...input(), geography: { mode: 'STATIONARY', start: { city: ' Novi Sad ', area: ' Liman ' } } })).toEqual(input());
  expect(normalizeNeedLocation({ ...input(), accessNotes: 'Ulaz A\nSprat 2' })?.accessNotes).toBe('Ulaz A\nSprat 2');
});
it.each([
  { mode: 'REMOTE' }, { mode: 'STATIONARY', start: { label: 'Centar' } },
  { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beograd' } },
  { mode: 'MULTI_STOP', start: { city: 'Novi Sad' }, waypoints: [{ area: 'Centar' }] },
  { mode: 'AREA_BASED', serviceArea: { city: 'Novi Sad' } },
])('retains supported manual topology without coordinates: %p', value => {
  expect(normalizeTaskGeography(value)).toEqual(value);
});
it.each([
  null, [], {}, { mode: null }, { mode: 3 }, { mode: 'OTHER' },
  { mode: 'STATIONARY' }, { mode: 'STATIONARY', start: {} },
  { mode: 'STATIONARY', start: { city: 12 } }, { mode: 'STATIONARY', start: { city: ' ' } },
  { mode: 'STATIONARY', start: { city: 'Novi\nSad' } }, { mode: 'STATIONARY', start: { city: 'x'.repeat(161) } },
  { mode: 'STATIONARY', start: { city: 'Novi Sad', latitude: 45.25132 } },
  { mode: 'STATIONARY', start: { city: 'Novi Sad', exactAddress: 'Private 12' } },
  { mode: 'STATIONARY', start: { city: 'Novi Sad' }, privateAddress: 'Private 12' },
  { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' } },
  { mode: 'MULTI_STOP', start: { city: 'Novi Sad' }, waypoints: [null] },
  { mode: 'MULTI_STOP', start: { city: 'Novi Sad' }, waypoints: Array(21).fill({ city: 'Beograd' }) },
  { mode: 'AREA_BASED', end: { city: 'Beograd' } },
  { mode: 'REMOTE', start: { city: 'Novi Sad' } }, { mode: 'REMOTE', waypoints: [{ city: 'Novi Sad' }] },
])('rejects malformed public geography or a private/precise field: %p', value => {
  expect(normalizeTaskGeography(value)).toBeNull();
});
it('REMOTE explicitly requires no address/GPS and never supplies a synthetic position', () => {
  expect(normalizeNeedLocation({ taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null }))
    .toEqual({ taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null });
  expect(normalizeNeedLocation({ ...input(), geography: { mode: 'REMOTE' } })).toBeNull();
  expect(normalizeTaskGeography({ mode: 'REMOTE', start: null, end: null, waypoints: [], serviceArea: null })).toEqual({ mode: 'REMOTE' });
});
it.each([{ exactAddress: undefined }, { accessNotes: '' }, { exactAddress: 'x'.repeat(1001) }, { accessNotes: 'x'.repeat(2001) },
  { exactAddress: 12 }, { accountId: B }, { coordinates: [45.123456, 19.123456] }])('rejects incomplete/oversize/private-location input without guessing: %p', patch => {
  expect(normalizeNeedLocation({ ...input(), ...patch })).toBeNull();
});
it('reads an empty or partial preparation so a user can manually fill missing location', async () => {
  for (const value of [{ taskCountryCode: null, geography: null, exactAddress: null, accessNotes: null }, { taskCountryCode: null, geography: null, exactAddress: 'Private', accessNotes: null }]) {
    mockRpc.mockResolvedValue({ data: { ...document(), confirmed: false, value }, error: null });
    await expect(needLocationClientService.read(C)).resolves.toMatchObject({ ok: true, podatak: { value, confirmed: false } });
  }
});
it('sends human confirmation through the owned fact command, not direct Need or address writes', async () => {
  mockRpc.mockResolvedValue({ data: receipt(), error: null });
  await expect(needLocationClientService.save(command())).resolves.toMatchObject({ ok: true, podatak: { saved: true } });
  expect(mockRpc.mock.calls).toEqual([['rpc_save_need_location_review', {
    p_conversation_id: C, p_expected_revision: revision, p_confirmed: true, p_value: input(),
  }]]);
});
it.each([{ saved: false }, { idempotentReplay: undefined }, { review: null },
  { review: { ...document(), accountId: B } }, { review: { ...document(), conversationId: B } },
  { review: { ...document(), revision: '' } }, { review: { ...document(), confirmed: false } },
  { review: { ...document(), editable: false } }, { review: { ...document(), value: { ...input(), exactAddress: 'Other' } } },
])('never treats a malformed/unrelated location receipt as success: %p', patch => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), ...patch }, error: null });
  return expect(needLocationClientService.save(command())).resolves.toMatchObject({ ok: false, kod: 'LOCATION_INVALID_RESPONSE' });
});
it('copies values before awaiting the server and does not compare against newly edited fields', async () => {
  mockRpc.mockResolvedValue({ data: receipt(), error: null });
  const value = input();
  const pending = needLocationClientService.save({ ...command(), value });
  value.geography.start.city = 'Beograd'; value.exactAddress = 'Changed';
  await expect(pending).resolves.toMatchObject({ ok: true });
  expect(mockRpc.mock.calls[0][1].p_value.geography.start.city).toBe('Novi Sad');
});
it('worker location accepts manual city/radius and explicitly clears coarse coordinates', async () => {
  mockRpc.mockResolvedValue({ data: workerReceipt(), error: null });
  await expect(workerLocationClientService.save(workerCommand())).resolves.toMatchObject({ ok: true });
  expect(mockRpc.mock.calls).toEqual([['rpc_save_worker_location', { p_expected_revision: revision, p_confirmed: true, p_value: workerInput() }]]);
});
it('an incomplete draft Worker can read its missing city for correction', async () => {
  mockRpc.mockResolvedValue({ data: { ...workerDoc(), city: '' }, error: null });
  await expect(workerLocationClientService.read()).resolves.toMatchObject({ ok: true, podatak: { city: '' } });
});
it.each([{ city: ' ' }, { city: 42 }, { city: 'x'.repeat(161) }, { radiusKm: 0 }, { radiusKm: 201 }, { radiusKm: 15.1 },
  { approximatePosition: undefined }, { approximatePosition: { latitude: 91, longitude: 0 } },
  { approximatePosition: { latitude: 45.123456, longitude: 19.123456 } },
  { approximatePosition: { latitude: NaN, longitude: Infinity } }, { approximatePosition: { latitude: 45.25 } },
  { exactAddress: 'Private' }, { latitude: 45.123456 }, { profileId: B },
])('does not submit invalid or precise Worker geography: %p', patch => {
  expect(normalizeWorkerLocation({ ...workerInput(), ...patch })).toBeNull();
});
it('retains an explicitly supplied two-decimal coarse position without a provider claim', () => {
  expect(normalizeWorkerLocation({ ...workerInput(), approximatePosition: { latitude: 45.25, longitude: 19.83 } }))
    .toMatchObject({ approximatePosition: { latitude: 45.25, longitude: 19.83 } });
});
it.each([{ saved: false }, { idempotentReplay: null }, { location: { ...workerDoc(), profileId: '' } },
  { location: { ...workerDoc(), city: 'Other' } }, { location: { ...workerDoc(), radiusKm: 16 } },
  { location: { ...workerDoc(), accountId: B } }])('does not claim an incomplete/foreign Worker location save: %p', patch => {
  mockRpc.mockResolvedValue({ data: { ...workerReceipt(), ...patch }, error: null });
  return expect(workerLocationClientService.save(workerCommand())).resolves.toMatchObject({ ok: false });
});
const methods = {
  needRead: () => needLocationClientService.read(C), needSave: () => needLocationClientService.save(command()),
  workerRead: () => workerLocationClientService.read(), workerSave: () => workerLocationClientService.save(workerCommand()),
};
it.each(Object.keys(methods) as (keyof typeof methods)[])('rejects signed-out %s before any RPC', async method => {
  mockOwner.user = null;
  await expect(methods[method]()).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  expect(mockRpc).not.toHaveBeenCalled();
});
it.each(Object.keys(methods) as (keyof typeof methods)[])('discards %s on account A→B→A despite matching final user id', async method => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const pending = methods[method]();
  mockOwner = { user: { id: A }, accountRevision: 3 };
  resolve({ data: receipt(), error: null });
  await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it.each(Object.keys(methods) as (keyof typeof methods)[])('bounds %s and never fabricates or retries a missing response', async method => {
  jest.useFakeTimers(); mockRpc.mockReturnValue(new Promise(() => {}));
  const pending = methods[method](); await jest.advanceTimersByTimeAsync(15_001);
  await expect(pending).resolves.toMatchObject({ ok: false });
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('refuses unconfirmed writes even when runtime input bypasses static types', async () => {
  const invalid = JSON.parse(JSON.stringify({ ...command(), confirmed: false }));
  await expect(needLocationClientService.save(invalid)).resolves.toMatchObject({ ok: false, kod: 'LOCATION_CONFIRMATION_REQUIRED' });
  await expect(workerLocationClientService.save(JSON.parse(JSON.stringify({ ...workerCommand(), confirmed: false }))))
    .resolves.toMatchObject({ ok: false, kod: 'LOCATION_CONFIRMATION_REQUIRED' });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('sanitizes raw provider errors and exposes the recognized version conflict without a retry', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'private token address' } });
  const result = await needLocationClientService.read(C);
  expect(JSON.stringify(result)).not.toContain('private token address');
  mockRpc.mockResolvedValue({ data: null, error: { message: 'LOCATION_VERSION_CONFLICT' } });
  await expect(needLocationClientService.save(command())).resolves.toMatchObject({ ok: false, kod: 'LOCATION_VERSION_CONFLICT' });
});
it('does not choose an external provider, request GPS or make network calls for manual/remote input', async () => {
  await expect(createLocationResolver().search({ city: 'Novi Sad' })).resolves.toEqual({ status: 'PROVIDER_ACTIVATION_BLOCKED' });
  const remote = normalizeNeedLocation({ taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null });
  expect(remote?.geography.mode).toBe('REMOTE');
  expect(mockRpc).not.toHaveBeenCalled();
});
it('an explicitly injected provider produces only validated suggestions awaiting confirmation', async () => {
  const search = jest.fn().mockResolvedValue([{ publicPlace: { city: 'Novi Sad' }, approximatePosition: { latitude: 45.25, longitude: 19.83 } }]);
  await expect(createLocationResolver({ search }).search({ city: ' Novi Sad ' })).resolves.toMatchObject({ status: 'PROPOSALS', requiresConfirmation: true });
  expect(search).toHaveBeenCalledWith({ city: 'Novi Sad' }, expect.any(AbortSignal));
  expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{ city: 'Novi Sad', exactAddress: 'Private 12' }, { city: 'Novi Sad', latitude: 45.123456 }, { city: '' }])('does not send private or invalid provider queries: %p', async query => {
  const search = jest.fn();
  await expect(createLocationResolver({ search }).search(query)).resolves.toEqual({ status: 'INVALID_QUERY' });
  expect(search).not.toHaveBeenCalled();
});
it.each([[{ publicPlace: { city: 'Novi Sad' }, approximatePosition: { latitude: 45.123456, longitude: 19.83 } }],
  [{ publicPlace: { city: 'Novi Sad', exactAddress: 'Private' }, approximatePosition: null }],
  [{ publicPlace: { city: 'Novi Sad' }, approximatePosition: null, privateToken: 'token' }], {}])('refuses provider private fields, precision and malformed responses: %p', async result => {
  await expect(createLocationResolver({ search: async () => result }).search({ city: 'Novi Sad' })).resolves.toEqual({ status: 'UNAVAILABLE' });
});
it('cancels even a provider which ignores AbortSignal and bounds it without repeating', async () => {
  jest.useFakeTimers(); const search = jest.fn(() => new Promise(() => {}));
  const pending = createLocationResolver({ search }).search({ city: 'Novi Sad' });
  await jest.advanceTimersByTimeAsync(10_001);
  await expect(pending).resolves.toEqual({ status: 'UNAVAILABLE' }); expect(search).toHaveBeenCalledTimes(1);
  const controller = new AbortController(); controller.abort();
  await expect(createLocationResolver({ search }).search({ city: 'Novi Sad' }, controller.signal)).resolves.toEqual({ status: 'CANCELLED' });
  expect(search).toHaveBeenCalledTimes(1);
});
