/**
 * PKG-006 / GAP-0031 — durable application command journal.
 * Opaque identity plus the exact frozen offer, scoped to one account and Need.
 */
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }) } }));
import { applicationCommandJournal, parseApplicationCommand } from '../applicationCommandJournal';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const NEED = '20000000-0000-4000-8000-000000000001', OTHER = '20000000-0000-4000-8000-000000000002', PROFILE = '30000000-0000-4000-8000-000000000003';
const command = { clientRequestId: 'prijava_mfz8k1_0123456789abcdef', potrebaId: NEED, potrebaRevizija: 3, radnikProfilId: PROFILE,
  pokrivenaMesta: 2, cenaRsd: 4500, predlozeniPocetak: '2026-09-20T08:00:00.123456Z', predlozeniKraj: '2026-09-20T09:00:00Z', napomena: 'Dolazimo sa trakama.' };
const record = { version: 1 as const, accountId: A, needId: NEED, command };
const KEY = `uskoci.application.command.v1.${A}.${NEED}`;
const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default as { setItem: jest.Mock; removeItem: jest.Mock };
beforeEach(() => { mockStorage.clear(); jest.clearAllMocks(); });

it('stores the exact frozen command under the account/Need scope and reads it back unchanged', async () => {
  await applicationCommandJournal.save(record);
  expect([...mockStorage.keys()]).toEqual([KEY]);
  expect(JSON.parse(mockStorage.get(KEY)!)).toEqual(record);
  await expect(applicationCommandJournal.load(A, NEED)).resolves.toEqual({ state: 'PRESENT', record });
  await expect(applicationCommandJournal.load(A, OTHER)).resolves.toEqual({ state: 'ABSENT' });
  await expect(applicationCommandJournal.load(B, NEED)).resolves.toEqual({ state: 'ABSENT' });
});
it.each([
  ['foreign account', { ...record, accountId: B }],
  ['foreign Need', { ...record, needId: OTHER }],
  ['command bound to another Need', { ...record, command: { ...command, potrebaId: OTHER } }],
  ['unknown version', { ...record, version: 2 }],
  ['extra top-level field', { ...record, receipt: { prijavaId: PROFILE } }],
  ['missing command field', { ...record, command: (({ napomena: _n, ...rest }) => rest)(command) }],
  ['extra command field', { ...record, command: { ...command, prijavaId: PROFILE } }],
  ['short key', { ...record, command: { ...command, clientRequestId: 'short' } }],
  ['key with whitespace', { ...record, command: { ...command, clientRequestId: 'prijava key with spaces' } }],
  ['zero revision', { ...record, command: { ...command, potrebaRevizija: 0 } }],
  ['non-uuid profile', { ...record, command: { ...command, radnikProfilId: 'profile' } }],
  ['fractional people', { ...record, command: { ...command, pokrivenaMesta: 1.5 } }],
  ['negative price', { ...record, command: { ...command, cenaRsd: -1 } }],
  ['unreadable interval', { ...record, command: { ...command, predlozeniPocetak: 'juče' } }],
  ['numeric note', { ...record, command: { ...command, napomena: 7 } }],
  ['oversized note', { ...record, command: { ...command, napomena: 'a'.repeat(4001) } }],
])('rejects a %s record', (_label, value) => {
  expect(() => parseApplicationCommand(JSON.stringify(value), A, NEED)).toThrow('APPLICATION_COMMAND_JOURNAL_INVALID');
});
it('reports corrupt storage as corrupt, never as a replayable command, and discards only corrupt values', async () => {
  mockStorage.set(KEY, 'not json');
  await expect(applicationCommandJournal.load(A, NEED)).resolves.toEqual({ state: 'CORRUPT' });
  await applicationCommandJournal.discard(A, NEED);
  expect(mockStorage.has(KEY)).toBe(false);
  await applicationCommandJournal.save(record);
  await applicationCommandJournal.discard(A, NEED);
  expect(mockStorage.has(KEY)).toBe(true);
});
it('never replaces an unresolved command with a different key; the same key is idempotent', async () => {
  await applicationCommandJournal.save(record);
  await expect(applicationCommandJournal.save({ ...record, command: { ...command, clientRequestId: 'prijava_other_key_00000000' } }))
    .rejects.toThrow('APPLICATION_COMMAND_UNRESOLVED');
  await applicationCommandJournal.save(record);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  expect(JSON.parse(mockStorage.get(KEY)!).command.clientRequestId).toBe(command.clientRequestId);
});
it('clears only the exact command key', async () => {
  await applicationCommandJournal.save(record);
  await applicationCommandJournal.clear(A, NEED, 'prijava_other_key_00000000');
  expect(mockStorage.has(KEY)).toBe(true);
  await applicationCommandJournal.clear(B, NEED, command.clientRequestId);
  expect(mockStorage.has(KEY)).toBe(true);
  await applicationCommandJournal.clear(A, NEED, command.clientRequestId);
  expect(mockStorage.has(KEY)).toBe(false);
  expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
});
it('does not write after the owning scope changed and rejects invalid scopes before touching storage', async () => {
  await expect(applicationCommandJournal.save(record, () => false)).rejects.toThrow('APPLICATION_COMMAND_SCOPE_CHANGED');
  expect(mockStorage.size).toBe(0);
  await expect(applicationCommandJournal.load('owner a', NEED)).rejects.toThrow('APPLICATION_COMMAND_JOURNAL_INVALID');
  await expect(applicationCommandJournal.load(A, 'need')).rejects.toThrow('APPLICATION_COMMAND_JOURNAL_INVALID');
});
it('serializes concurrent writes for the same scope without losing the first key', async () => {
  const second = { ...record, command: { ...command, clientRequestId: 'prijava_second_key_0000000' } };
  const results = await Promise.allSettled([applicationCommandJournal.save(record), applicationCommandJournal.save(second)]);
  expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
  expect(JSON.parse(mockStorage.get(KEY)!).command.clientRequestId).toBe(command.clientRequestId);
});
