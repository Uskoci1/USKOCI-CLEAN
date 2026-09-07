import { authClientService } from '../authClientService';

const mockAuth = {
  signInWithPassword: jest.fn(), signUp: jest.fn(), signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(), resetPasswordForEmail: jest.fn(), getSession: jest.fn(), signOut: jest.fn(),
};
let mockCurrent = { user: { id: 'account-a' }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: mockAuth }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockCurrent }));

const actor = { accountId: 'account-a', accountRevision: 1 };
beforeEach(() => {
  jest.resetAllMocks();
  mockCurrent = { user: { id: 'account-a' }, accountRevision: 1 };
  for (const method of Object.values(mockAuth)) method.mockResolvedValue({ error: null });
  mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-a' } } }, error: null });
});

describe('central Auth client boundary', () => {
  it('preserves password bytes and the existing email/password sign-in payload', async () => {
    const command = { email: 'ana@example.test', password: '  čuvaj Lozinku!  ' };
    await expect(authClientService.signInWithPassword(command)).resolves.toBeUndefined();
    expect(mockAuth.signInWithPassword.mock.calls).toEqual([[command]]);
  });

  it.each([null, { access_token: 'never-projected', user: { id: 'account-a' } }])(
    'preserves signup metadata and projects only the presence of its session', async session => {
      mockAuth.signUp.mockResolvedValue({ data: { session, user: { id: 'account-a' } }, error: null });
      const result = await authClientService.signUp({ email: 'ana@example.test', password: 'password',
        firstName: 'Ana', lastName: 'Petrović', city: 'Novi Sad' });
      expect(mockAuth.signUp.mock.calls).toEqual([[{
        email: 'ana@example.test', password: 'password',
        options: { data: { first_name: 'Ana', last_name: 'Petrović', city: 'Novi Sad' } },
      }]]);
      expect(result).toEqual({ hasSession: !!session });
    },
  );

  it('keeps existing phone OTP options and explicitly verifies an sms token', async () => {
    await authClientService.sendPhoneOtp({ phone: '+381601234567' });
    await authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' });
    expect(mockAuth.signInWithOtp.mock.calls).toEqual([[{ phone: '+381601234567' }]]);
    expect(mockAuth.verifyOtp.mock.calls).toEqual([[{ phone: '+381601234567', token: '012345', type: 'sms' }]]);
  });

  it('keeps the existing password recovery request without new redirect/provider options', async () => {
    await authClientService.requestPasswordRecovery('ana@example.test');
    expect(mockAuth.resetPasswordForEmail.mock.calls).toEqual([['ana@example.test']]);
  });

  it.each(['signInWithPassword', 'signUp', 'signInWithOtp', 'verifyOtp', 'resetPasswordForEmail'] as const)(
    'preserves the %s error used by the existing presentation', async method => {
      const error = new Error('Existing Auth message');
      mockAuth[method].mockResolvedValue({ data: null, error });
      const commands = {
        signInWithPassword: () => authClientService.signInWithPassword({ email: 'a', password: 'b' }),
        signUp: () => authClientService.signUp({ email: 'a', password: 'b', firstName: 'c', lastName: 'd', city: 'e' }),
        signInWithOtp: () => authClientService.sendPhoneOtp({ phone: 'a' }),
        verifyOtp: () => authClientService.verifyPhoneOtp({ phone: 'a', token: 'b' }),
        resetPasswordForEmail: () => authClientService.requestPasswordRecovery('a'),
      };
      await expect(commands[method]()).rejects.toBe(error);
    },
  );

  it('logs out only the current account with the existing local scope', async () => {
    await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
    expect(mockAuth.signOut.mock.calls).toEqual([[{ scope: 'local' }]]);
    expect(mockCurrent).toEqual({ user: { id: 'account-a' }, accountRevision: 1 });
  });

  it('rejects a stale actor before starting any Auth read or logout', async () => {
    mockCurrent = { user: { id: 'account-a' }, accountRevision: 3 };
    await expect(authClientService.signOutLocal(actor)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.getSession).not.toHaveBeenCalled();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('rejects batched A→B→A while its local session read is deferred', async () => {
    let resolve!: (value: unknown) => void;
    mockAuth.getSession.mockReturnValue(new Promise(done => { resolve = done; }));
    const command = authClientService.signOutLocal(actor);
    mockCurrent = { user: { id: 'account-b' }, accountRevision: 2 };
    mockCurrent = { user: { id: 'account-a' }, accountRevision: 3 };
    resolve({ data: { session: { user: { id: 'account-a' } } }, error: null });
    await expect(command).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('rejects an SDK session belonging to a different account even before the runtime catches up', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-b' } } }, error: null });
    await expect(authClientService.signOutLocal(actor)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('does not claim logout after a failed session read and keeps SDK logout failure retryable', async () => {
    const error = new Error('Auth unavailable');
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
    await expect(authClientService.signOutLocal(actor)).rejects.toBe(error);
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    mockAuth.signOut.mockResolvedValueOnce({ error });
    await expect(authClientService.signOutLocal(actor)).rejects.toBe(error);
    await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledTimes(2);
  });
});
