import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAuthAvailability } from '../../hooks/useAuthAvailability';
import { useAuthFormCommand } from '../../hooks/useAuthFormCommand';

const mockRead = jest.fn();
const mockRemove = jest.fn();
let mockForeground: (state: string) => void;
let mockSession = { user: null as null | { id: string }, accountRevision: 0 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'AppState' ? { addEventListener: (_: unknown, callback: typeof mockForeground) => {
      mockForeground = callback; return { remove: mockRemove };
    } } : Reflect.get(target, key);
  } });
});
jest.mock('../authAvailabilityClientService', () => ({ authAvailabilityClientService: { read: (...args: unknown[]) => mockRead(...args) } }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));

const emailOnly = { emailPassword: true, emailSignup: true, phoneOtp: false,
  emailConfirmationRequired: true, passwordRecovery: false };
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Availability({ enabled = true }: { enabled?: boolean }) {
  return React.createElement('Snapshot', { snapshot: useAuthAvailability(enabled) });
}
function Commands() { return React.createElement('Snapshot', { snapshot: useAuthFormCommand() }); }
let tree: ReactTestRenderer;
const snapshot = () => tree.root.findByType('Snapshot' as React.ElementType).props.snapshot;
beforeEach(() => { jest.clearAllMocks(); mockRead.mockResolvedValue(emailOnly); mockSession = { user: null, accountRevision: 0 }; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('waits until entry opens, then closes the read boundary when hidden', async () => {
  await act(async () => { tree = create(<Availability enabled={false} />); });
  expect(mockRead).not.toHaveBeenCalled();
  await act(async () => tree.update(<Availability />));
  expect(snapshot()).toMatchObject({ status: 'ready', data: emailOnly });
  await act(async () => tree.update(<Availability enabled={false} />));
  expect(snapshot().current()).toBeNull();
  await act(async () => snapshot().retry()); expect(mockRead).toHaveBeenCalledTimes(1);
});

it('clears availability synchronously on retry and rejects a superseded response', async () => {
  const old = deferred<unknown>(); const fresh = deferred<unknown>();
  mockRead.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  await act(async () => { tree = create(<Availability />); });
  const firstSignal = mockRead.mock.calls[0][0];
  await act(async () => { void snapshot().retry(); });
  expect(firstSignal.aborted).toBe(true);
  await act(async () => fresh.resolve(emailOnly));
  await act(async () => old.resolve({ ...emailOnly, phoneOtp: true }));
  expect(snapshot()).toMatchObject({ status: 'ready', data: emailOnly });
  await act(async () => { void snapshot().retry(); expect(snapshot().current()).toBeNull(); });
});

it('shows network error as unknown and retries without caching a false disabled projection', async () => {
  mockRead.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { tree = create(<Availability />); });
  expect(snapshot()).toMatchObject({ status: 'error', data: null });
  await act(async () => snapshot().retry());
  expect(snapshot()).toMatchObject({ status: 'ready', data: emailOnly });
});

it('aborts on background/unmount and reads fresh settings on foreground', async () => {
  const late = deferred<unknown>(); mockRead.mockReturnValueOnce(late.promise);
  await act(async () => { tree = create(<Availability />); });
  const signal = mockRead.mock.calls[0][0];
  await act(async () => mockForeground('background'));
  expect(signal.aborted).toBe(true); expect(snapshot().current()).toBeNull();
  await act(async () => late.resolve({ ...emailOnly, phoneOtp: true }));
  expect(snapshot()).toMatchObject({ status: 'loading', data: null });
  await act(async () => mockForeground('active'));
  expect(snapshot()).toMatchObject({ status: 'ready', data: emailOnly });
  await act(async () => tree.unmount()); expect(mockRemove).toHaveBeenCalledTimes(1);
});

it('admits only one same-tick Auth command and blocks form changes until settlement', async () => {
  const pending = deferred<string>(); const command = jest.fn(() => pending.promise);
  const success = jest.fn(); const failure = jest.fn(); const formChange = jest.fn();
  await act(async () => { tree = create(<Commands />); });
  await act(async () => { const run = snapshot().run; void run(command, success, failure); void run(command, success, failure);
    expect(snapshot().changeForm(formChange)).toBe(false); });
  expect(command).toHaveBeenCalledTimes(1); expect(formChange).not.toHaveBeenCalled();
  await act(async () => pending.resolve('accepted')); expect(success).toHaveBeenCalledWith('accepted');
  expect(snapshot().busy).toBe(false);
});

it('rejects an obsolete form callback after a same-tick form revision, while the new form remains usable', async () => {
  const command = jest.fn().mockResolvedValue('new'); const success = jest.fn();
  await act(async () => { tree = create(<Commands />); });
  const staleRun = snapshot().run;
  await act(async () => { snapshot().changeForm(() => {}); void staleRun(command, success, jest.fn()); });
  expect(command).not.toHaveBeenCalled();
  await act(async () => snapshot().run(command, success, jest.fn()));
  expect(success).toHaveBeenCalledWith('new');
});

it.each(['success', 'failure'] as const)('ignores late %s after signed-out→A→signed-out ownership change', async result => {
  const pending = deferred<string>(); const success = jest.fn(); const failure = jest.fn();
  await act(async () => { tree = create(<Commands />); });
  await act(async () => { void snapshot().run(() => pending.promise, success, failure); });
  mockSession = { user: { id: 'A' }, accountRevision: 1 }; mockSession = { user: null, accountRevision: 2 };
  await act(async () => { if (result === 'success') pending.resolve('old'); else pending.reject(new Error('old')); });
  expect(success).not.toHaveBeenCalled(); expect(failure).not.toHaveBeenCalled();
});

it('rejects an old form action before React renders a signed-out→A→signed-out transition', async () => {
  const command = jest.fn().mockResolvedValue('obsolete credentials'); const edit = jest.fn();
  await act(async () => { tree = create(<Commands />); });
  const oldRun = snapshot().run; const oldEdit = snapshot().changeForm;
  mockSession = { user: { id: 'A' }, accountRevision: 1 }; mockSession = { user: null, accountRevision: 2 };
  await act(async () => { void oldRun(command, jest.fn(), jest.fn()); oldEdit(edit); });
  expect(command).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
});

it('does not start an Auth command from a signed-in session and ignores completion after unmount', async () => {
  const command = jest.fn().mockResolvedValue(undefined);
  mockSession = { user: { id: 'A' }, accountRevision: 1 };
  await act(async () => { tree = create(<Commands />); });
  await act(async () => snapshot().run(command, jest.fn(), jest.fn())); expect(command).not.toHaveBeenCalled();
  mockSession = { user: null, accountRevision: 2 }; const pending = deferred<string>(); const success = jest.fn();
  await act(async () => tree.update(<Commands />));
  await act(async () => { void snapshot().run(() => pending.promise, success, jest.fn()); });
  await act(async () => tree.unmount()); await act(async () => pending.resolve('late'));
  expect(success).not.toHaveBeenCalled();
});

it('makes a failed command retryable without swallowing the error callback', async () => {
  const command = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ok');
  const success = jest.fn(); const failure = jest.fn();
  await act(async () => { tree = create(<Commands />); });
  await act(async () => snapshot().run(command, success, failure)); expect(failure).toHaveBeenCalledTimes(1);
  expect(snapshot().busy).toBe(false);
  await act(async () => snapshot().run(command, success, failure)); expect(success).toHaveBeenCalledWith('ok');
});
