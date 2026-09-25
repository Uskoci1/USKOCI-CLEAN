import type { JavniProfilProjekcija } from '../../contracts/projections';
import { enrichPublicProfiles, PUBLIC_PROFILE_BUDGET_MS } from '../publicProfileEnrichment';
import { publicProfileClientService } from '../publicProfileClientService';

const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
const profile = (id: string): JavniProfilProjekcija => ({
  profilId: id, uloga: 'narucilac', ime: `Person ${id}`, avatarPutanja: null, grad: null,
  naslov: null, biografija: null,
  poverenje: { ocenaProsek: 4.5, brojRecenzija: 2, zavrseniBroj: 3, identitetVerifikovan: false,
    ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false },
});
const rawProfile = (id: string) => ({ profileId: id, role: 'REQUESTER', displayName: `Person ${id}`,
  publicSummary: {}, trust: { ratingAverage: 4.5, reviewCount: 2, completedCount: 3,
    identityVerified: false, ratingAvailable: true, reviewsAvailable: true, identityVerificationAvailable: false } });
const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
beforeEach(() => { jest.useFakeTimers(); mockRpc.mockReset(); });
afterEach(() => { jest.useRealTimers(); });

it('reads 1000 distinct authors with at most four concurrent requests', async () => {
  let active = 0, peak = 0;
  const read = jest.fn((id: string) => {
    active++; peak = Math.max(peak, active);
    return new Promise<JavniProfilProjekcija>(resolve => setTimeout(() => {
      active--; resolve(profile(id));
    }, 1));
  });
  const pending = enrichPublicProfiles(Array.from({ length: 1000 }, (_, n) => String(n)), read, () => true);
  expect(read).toHaveBeenCalledTimes(4);
  await jest.advanceTimersByTimeAsync(300);
  const result = await pending;
  expect(peak).toBe(4); expect(read).toHaveBeenCalledTimes(1000);
  expect(result.size).toBe(1000); expect(result.get('999')).toEqual(profile('999'));
  expect(jest.getTimerCount()).toBe(0);
});

it('deduplicates authors and skips missing ids without inventing profiles', async () => {
  const read = jest.fn(async (id: string) => id === 'a' ? profile(id) : null);
  const result = await enrichPublicProfiles(['a', 'b', 'a', null, undefined, '', 'b'], read, () => true);
  expect(read.mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
  expect([...result.keys()]).toEqual(['a', 'b']); expect(result.get('b')).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});

it('releases a stalled pool at the collection deadline and never starts queued or accepts late reads', async () => {
  const signals: AbortSignal[] = [];
  const late: Array<(profile: JavniProfilProjekcija) => void> = [];
  const read = jest.fn((_id: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<JavniProfilProjekcija>(resolve => { late.push(resolve); });
  });
  const pending = enrichPublicProfiles(Array.from({ length: 1000 }, (_, n) => String(n)), read, () => true);
  let settled = false;
  void pending.then(() => { settled = true; });
  await jest.advanceTimersByTimeAsync(PUBLIC_PROFILE_BUDGET_MS - 1);
  expect(settled).toBe(false); expect(read).toHaveBeenCalledTimes(4);
  await jest.advanceTimersByTimeAsync(1);
  const result = await pending;
  expect(result.size).toBe(0); expect(signals.every(signal => signal.aborted)).toBe(true);
  late.forEach((resolve, n) => resolve(profile(String(n))));
  await flush(); await jest.advanceTimersByTimeAsync(5000);
  expect(result.size).toBe(0); expect(read).toHaveBeenCalledTimes(4); expect(jest.getTimerCount()).toBe(0);
});

it('retains only completed validated metadata when another author stalls', async () => {
  const read = jest.fn((id: string) => id === 'slow' ? new Promise<JavniProfilProjekcija>(() => {})
    : Promise.resolve(profile(id)));
  const pending = enrichPublicProfiles(['slow', 'good'], read, () => true);
  await jest.advanceTimersByTimeAsync(PUBLIC_PROFILE_BUDGET_MS);
  const result = await pending;
  expect(result.get('good')).toEqual(profile('good')); expect(result.has('slow')).toBe(false);
});

it('retires an A-B-A account revision, including already-read metadata, and aborts pending reads', async () => {
  let account = { id: 'a', revision: 1 };
  const owner = account;
  const signals: AbortSignal[] = [];
  const read = jest.fn((id: string, signal: AbortSignal) => {
    signals.push(signal);
    return id === 'fast' ? Promise.resolve(profile(id)) : new Promise<JavniProfilProjekcija>(() => {});
  });
  const pending = enrichPublicProfiles(['fast', 'b', 'c', 'd', 'e', 'f', 'g'], read,
    () => account.id === owner.id && account.revision === owner.revision);
  await flush(); expect(read).toHaveBeenCalledTimes(5);
  account = { id: 'b', revision: 2 }; account = { id: 'a', revision: 3 };
  await jest.advanceTimersByTimeAsync(100);
  expect((await pending).size).toBe(0); expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(read).toHaveBeenCalledTimes(5); expect(jest.getTimerCount()).toBe(0);
});

it('does not start enrichment when the reader is already retired', async () => {
  const read = jest.fn();
  expect((await enrichPublicProfiles(['a'], read, () => false)).size).toBe(0);
  expect(read).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

it('keeps the public-profile validation boundary for malformed and failed projections', async () => {
  mockRpc.mockImplementation((_name, { p_profile_id: id }) => Promise.resolve(
    id === 'failed' ? { data: null, error: { message: 'private diagnostic' } }
      : { data: id === 'malformed' ? { ...rawProfile(id), trust: {} } : rawProfile(id), error: null }));
  const result = await enrichPublicProfiles(['good', 'malformed', 'failed'],
    (id, signal) => publicProfileClientService.javniProfil(id, signal), () => true);
  expect(result.get('good')).toEqual(profile('good'));
  expect(result.get('malformed')).toBeNull(); expect(result.get('failed')).toBeNull();
  expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(Array(3).fill('rpc_get_public_profile'));
});

it('threads abort into the profile transport and never returns a response after it was aborted', async () => {
  const controller = new AbortController();
  let resolve!: (value: unknown) => void;
  const transport = new Promise(accept => { resolve = accept; });
  const abortSignal = jest.fn(() => transport);
  mockRpc.mockReturnValue({ abortSignal });
  const pending = publicProfileClientService.javniProfil('good', controller.signal);
  const rejected = expect(pending).rejects.toThrow('PUBLIC_PROFILE_READ_FAILED');
  expect(abortSignal).toHaveBeenCalledWith(controller.signal);
  controller.abort(); resolve({ data: rawProfile('good'), error: null });
  await rejected;
  await expect(publicProfileClientService.javniProfil('good', controller.signal)).rejects.toThrow('PUBLIC_PROFILE_READ_FAILED');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
