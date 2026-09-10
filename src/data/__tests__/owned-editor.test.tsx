import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import type { Ishod } from '../ports';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
let mockIntent = 'narucilac';
let mockFocused = true;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));

const ok = (value: string): Ishod<string> => ({ ok: true, podatak: value });
const conflict: Ishod<string> = { ok: false, kod: 'LOCATION_VERSION_CONFLICT', poruka: 'Učitajte sačuvano stanje.' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Probe({ read }: { read: () => Promise<Ishod<string>> }) {
  return React.createElement('Snapshot', useOwnedEditor(read));
}
let tree: ReactTestRenderer;
const snapshot = () => tree.root.findByType('Snapshot' as React.ElementType).props as ReturnType<typeof useOwnedEditor<string>>;
const render = async (read: () => Promise<Ishod<string>>) => {
  await act(async () => { tree = create(<Probe read={read} />); });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
  mockIntent = 'narucilac'; mockFocused = true;
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('owned location editor lifecycle', () => {
  it('serializes duplicate save taps before a busy render and uses the accepted receipt', async () => {
    await render(jest.fn().mockResolvedValue(ok('server revision one')));
    const pending = deferred<Ishod<string>>();
    const command = jest.fn(() => pending.promise);
    const save = snapshot().save;
    await act(async () => { void save(command); void save(command); });
    expect(command).toHaveBeenCalledTimes(1);
    expect(snapshot()).toMatchObject({ busy: true, saved: false });
    await act(async () => pending.resolve(ok('server revision two')));
    expect(snapshot()).toMatchObject({ data: 'server revision two', busy: false, saved: true });
  });

  it.each(['conflict', 'unknown'] as const)('requires successful readback after %s, including retained save handlers', async kind => {
    const read = jest.fn().mockResolvedValueOnce(ok('initial')).mockResolvedValueOnce(conflict).mockResolvedValueOnce(ok('reconciled'));
    await render(read);
    const command = jest.fn().mockImplementationOnce(() => kind === 'conflict'
      ? Promise.resolve(conflict) : Promise.reject(new Error('private transport detail'))).mockResolvedValue(ok('next'));
    const retainedSave = snapshot().save;
    await act(async () => { await retainedSave(command); });
    expect(snapshot()).toMatchObject({ uncertain: true, data: 'initial', saved: false });
    expect(snapshot().error).not.toContain('private transport detail');
    await act(async () => { await snapshot().save(command); await retainedSave(command); });
    expect(command).toHaveBeenCalledTimes(1);
    await act(async () => { await snapshot().refresh(); });
    expect(snapshot()).toMatchObject({ uncertain: true, data: null });
    await act(async () => { await snapshot().save(command); });
    expect(command).toHaveBeenCalledTimes(1);
    await act(async () => { await snapshot().refresh(); });
    expect(snapshot()).toMatchObject({ uncertain: false, data: 'reconciled' });
    await act(async () => { await snapshot().save(command); });
    expect(command).toHaveBeenCalledTimes(2);
  });

  it('discards an older overlapping read even when it resolves last', async () => {
    const old = deferred<Ishod<string>>(), current = deferred<Ishod<string>>();
    const read = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await render(read);
    await act(async () => { void snapshot().refresh(); });
    await act(async () => current.resolve(ok('fresh read')));
    await act(async () => old.resolve(ok('old private read')));
    expect(snapshot()).toMatchObject({ data: 'fresh read', loading: false });
  });

  it('does not allow a retained save callback to write while current readback is pending', async () => {
    const pending = deferred<Ishod<string>>();
    const read = jest.fn().mockResolvedValueOnce(ok('initial')).mockReturnValueOnce(pending.promise);
    await render(read);
    const retainedSave = snapshot().save, command = jest.fn().mockResolvedValue(ok('should not be sent'));
    await act(async () => { void snapshot().refresh(); });
    await act(async () => { await retainedSave(command); });
    expect(command).not.toHaveBeenCalled();
    await act(async () => pending.resolve(ok('readback')));
    expect(snapshot().data).toBe('readback');
  });

  it.each(['success', 'failure'] as const)('ignores late read %s after blur and loads a new focused read', async result => {
    const old = deferred<Ishod<string>>();
    const read = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(ok('new focus'));
    await render(read);
    mockFocused = false;
    await act(async () => tree.update(<Probe read={read} />));
    await act(async () => { if (result === 'success') old.resolve(ok('blurred private data')); else old.reject(new Error('late failure')); });
    expect(snapshot().data).toBeNull();
    expect(snapshot().error).toBeNull();
    mockFocused = true;
    await act(async () => tree.update(<Probe read={read} />));
    expect(snapshot().data).toBe('new focus');
  });

  it.each(['success', 'failure'] as const)('fences late save %s across A→B→A account incarnation', async result => {
    const pending = deferred<Ishod<string>>();
    const read = jest.fn().mockResolvedValueOnce(ok('old account A')).mockResolvedValueOnce(ok('new account A'));
    await render(read);
    await act(async () => { void snapshot().save(() => pending.promise); });
    mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    mockSession = { user: { id: 'account-a' }, accountRevision: 3, sessionEpoch: 3 };
    await act(async () => tree.update(<Probe read={read} />));
    await act(async () => { if (result === 'success') pending.resolve(ok('stale account receipt')); else pending.reject(new Error('stale failure')); });
    expect(snapshot()).toMatchObject({ data: 'new account A', saved: false, uncertain: false, busy: false, error: null });
  });

  it.each(['account', 'intent', 'route'] as const)('rejects retained save and refresh callbacks after %s changes', async change => {
    const oldRead = jest.fn().mockResolvedValue(ok('old owned route'));
    const newRead = jest.fn().mockResolvedValue(ok('new owned route'));
    await render(oldRead);
    const retained = snapshot(), command = jest.fn().mockResolvedValue(ok('old command'));
    if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    if (change === 'intent') mockIntent = 'uskocer';
    const read = change === 'route' ? newRead : oldRead;
    await act(async () => tree.update(<Probe read={read} />));
    const callsBefore = oldRead.mock.calls.length;
    await act(async () => { await retained.save(command); await retained.refresh(); });
    expect(command).not.toHaveBeenCalled();
    expect(oldRead).toHaveBeenCalledTimes(callsBefore);
    expect(snapshot().data).toBe(change === 'route' ? 'new owned route' : 'old owned route');
  });

  it('keeps current ownership during same-account token refresh', async () => {
    const read = jest.fn().mockResolvedValue(ok('current'));
    await render(read);
    mockSession = { ...mockSession, sessionEpoch: 2 };
    await act(async () => tree.update(<Probe read={read} />));
    expect(read).toHaveBeenCalledTimes(1);
    expect(snapshot().data).toBe('current');
  });

  it.each(['readback', 'refocus'] as const)('rejects a retained old-draft save after a successful %s replaces its server revision', async change => {
    const read = jest.fn().mockResolvedValueOnce(ok('old server revision')).mockResolvedValueOnce(ok('new server revision'));
    await render(read);
    const retainedSave = snapshot().save, command = jest.fn().mockResolvedValue(ok('old draft command'));
    if (change === 'readback') await act(async () => { await snapshot().refresh(); });
    else {
      mockFocused = false;
      await act(async () => tree.update(<Probe read={read} />));
      mockFocused = true;
      await act(async () => tree.update(<Probe read={read} />));
    }
    expect(snapshot().data).toBe('new server revision');
    await act(async () => { await retainedSave(command); });
    expect(command).not.toHaveBeenCalled();
    expect(snapshot().data).toBe('new server revision');
  });
});
