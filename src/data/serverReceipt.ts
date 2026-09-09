import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
export function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}
export function sameId(value: unknown, expected: string): value is string {
  return uuid(value) && value.toLowerCase() === expected.toLowerCase();
}
export function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
export function failure(kod: string, poruka: string): Ishod<never> { return { ok: false, kod, poruka }; }

/** This boundary validates receipts, not business permissions. The RPC remains authority. */
export async function readReceipt<T>(options: {
  rpc: string;
  args: Record<string, unknown>;
  decode: (raw: unknown) => T | null;
  errors: Readonly<Record<string, string>>;
  fallback: string;
  invalid: string;
  write?: boolean;
}): Promise<Ishod<T>> {
  const owner = sesijaSada();
  const accountId = owner.user?.id;
  if (!accountId) return failure('AUTH_REQUIRED', 'Prijavite se da biste nastavili.');
  const current = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === owner.accountRevision;
  const changed = () => failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvorite Zadatak.');
  const unconfirmed = () => failure(options.fallback, options.write
    ? 'Ishod radnje nije potvrđen. Osvežite prikaz pre ponovnog pokušaja; za ponavljanje koristite isti zahtev.'
    : 'Podaci trenutno nisu dostupni. Proverite vezu i pokušajte ponovo.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // No automatic write replay. A timeout bounds the caller, not server execution.
    const response: unknown = await Promise.race([
      Promise.resolve(supabaseKlijent().rpc(options.rpc, options.args)),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('RPC_RECEIPT_TIMEOUT')), 15_000); }),
    ]);
    if (!current()) return changed();
    const result = record(response);
    if (!result || !Object.prototype.hasOwnProperty.call(result, 'error')) return unconfirmed();
    if (result.error !== null) {
      const error = record(result.error);
      const name = error?.message;
      // Never turn arbitrary backend/provider text into a public code or message.
      return typeof name === 'string' && Object.prototype.hasOwnProperty.call(options.errors, name)
        ? failure(name, options.errors[name]) : unconfirmed();
    }
    const decoded = options.decode(result.data);
    if (decoded === null) return failure(options.invalid, options.write
      ? 'Server nije vratio potpunu potvrdu radnje. Osvežite prikaz pre ponovnog pokušaja.'
      : 'Server je vratio nečitljive podatke. Pokušajte ponovo.');
    return { ok: true, podatak: decoded };
  } catch {
    return current() ? unconfirmed() : changed();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
