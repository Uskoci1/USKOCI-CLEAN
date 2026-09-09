import { configuredRecoveryRedirect } from './passwordRecoveryLink';
import { PasswordRecoveryError } from '../contracts/passwordRecovery';
import { recoveryDeadline, recoveryError } from './passwordRecoveryErrors';
import type { AuthAccountScope, AuthClientPort } from '../contracts/auth';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';

function assertCurrentAccount(expected: AuthAccountScope) {
  const current = sesijaSada();
  if (!expected.accountId || current.user?.id !== expected.accountId ||
    current.accountRevision !== expected.accountRevision) {
    throw new Error('AUTH_ACCOUNT_CHANGED');
  }
}

/** The existing Auth transport boundary; no provider, policy or session authority is added. */
export const authClientService: AuthClientPort = {
  async signInWithPassword(input) {
    const { error } = await supabaseKlijent().auth.signInWithPassword(input);
    if (error) throw error;
  },

  async signUp({ email, password, firstName, lastName, city }) {
    const { data, error } = await supabaseKlijent().auth.signUp({
      email, password,
      options: { data: { first_name: firstName, last_name: lastName, city } },
    });
    if (error) throw error;
    return { hasSession: !!data.session };
  },

  async sendPhoneOtp(input) {
    const { error } = await supabaseKlijent().auth.signInWithOtp(input);
    if (error) throw error;
  },

  async verifyPhoneOtp(input) {
    const { error } = await supabaseKlijent().auth.verifyOtp({ ...input, type: 'sms' });
    if (error) throw error;
  },

  async requestPasswordRecovery(email) {
    const owner = sesijaSada();
    if (owner.user) throw new PasswordRecoveryError('SIGNED_IN');
    const redirectTo = configuredRecoveryRedirect();
    if (!redirectTo) throw new PasswordRecoveryError('UNCONFIGURED');
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new PasswordRecoveryError('INVALID_EMAIL');
    try {
      const { error } = await recoveryDeadline(() => supabaseKlijent().auth.resetPasswordForEmail(address, { redirectTo }), 'request');
      if (sesijaSada().user || sesijaSada().accountRevision !== owner.accountRevision) {
        throw new PasswordRecoveryError('ACCOUNT_CHANGED');
      }
      if (error) throw error;
    } catch (error) { throw recoveryError(error, 'request'); }
  },

  async signOutLocal(expected) {
    assertCurrentAccount(expected);
    const client = supabaseKlijent();
    const { data, error: sessionError } = await client.auth.getSession();
    assertCurrentAccount(expected);
    if (sessionError) throw sessionError;
    if (data.session?.user.id !== expected.accountId) throw new Error('AUTH_ACCOUNT_CHANGED');
    // Only the captured current account may begin the SDK's local logout.
    // Its Auth event, not this command or the screen, owns session cleanup.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },
};
