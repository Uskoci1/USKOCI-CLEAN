import type { AzurirajProfilKomanda, Ishod, Izvor } from './ports';
import { sesijaSada } from '../store/sesija';
import { capabilityTerms } from '../lib/capabilityTerms';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount, type ReceiptOptions } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

type WorkerProfileClientService = Pick<Izvor, 'azurirajRadnikProfil'>;
const inFlight = new Set<string>();
const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da biste izmenili profil.',
  DISPLAY_NAME_REQUIRED: 'Unesite ime pre završetka profila.',
  CITY_REQUIRED: 'Unesite mesto rada pre završetka profila.',
  SKILL_REQUIRED: 'Unesite bar jednu veštinu pre završetka profila.',
  PROFILE_NOT_ACTIVATABLE: 'Profil trenutno ne može da se aktivira.',
  PROFILE_NOT_FOUND: 'Profil nije pronađen. Osvežite prikaz.',
  NOT_WORKER_PROFILE_OWNER: 'Nalog je promenjen. Ponovo otvorite profil.',
  V2_FACT_TYPE_INVALID: 'Unesite najviše 50 stavki u svaku listu.',
  V2_FACT_ARRAY_ITEM_INVALID: 'Svaka stavka mora imati tekst do 500 znakova.',
  V2_FACT_VALUE_REQUIRED: 'Unesite ispravne podatke profila.',
};
const RESOURCE_FIELDS = { vestine: 'skills', alati: 'tools', vozila: 'vehicles', licence: 'licenses' } as const;
const TEXT_FIELDS = { ime: 'display_name', grad: 'city', biografija: 'bio' } as const;

function profileRow(raw: unknown, account: string, expectedId?: string): { id: string } | null {
  const row = record(raw);
  if (!row || !uuid(row.id) || !sameId(row.account_id, account) || row.kind !== 'WORKER' ||
      (expectedId && !sameId(row.id, expectedId))) return null;
  return { id: row.id };
}

/** Existing profile writer and activation RPC, now using the same owned-result
 * fence as location/calendar/availability. Captured owner filters also protect
 * REST writes if the SDK token changes while the request is being prepared. */
export const workerProfileClientService: WorkerProfileClientService = {
  async azurirajRadnikProfil(k: AzurirajProfilKomanda): Promise<Ishod<null>> {
    const owner = sesijaSada();
    if (!owner.user) return failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED);
    const account: ReceiptAccount = { accountId: owner.user.id, accountRevision: owner.accountRevision };
    const lock = `${account.accountId}:${account.accountRevision}`;
    if (inFlight.has(lock)) return failure('PROFILE_BUSY', 'Prethodno čuvanje profila se još obrađuje.');
    const input = record(k);
    if (!input || Object.keys(input).some(key => !['ime','grad','biografija','vestine','alati','vozila','licence','dostupanOdmah','radijusKm','zavrsi'].includes(key))) {
      return failure('PROFILE_INPUT_INVALID', 'Podaci profila nisu ispravni.');
    }
    const patch: Record<string, unknown> = {};
    for (const [field, column] of Object.entries(TEXT_FIELDS)) {
      if (input[field] === undefined) continue;
      if (typeof input[field] !== 'string') return failure('PROFILE_INPUT_INVALID', 'Podaci profila nisu ispravni.');
      patch[column] = input[field];
    }
    for (const [field, column] of Object.entries(RESOURCE_FIELDS)) {
      if (input[field] === undefined) continue;
      const terms = capabilityTerms(input[field]);
      if (!terms) return failure('PROFILE_CAPABILITY_INPUT_INVALID', 'Unesite do 50 nepraznih stavki, do 500 znakova po stavci.');
      patch[column] = terms;
    }
    if (input.dostupanOdmah !== undefined) {
      if (typeof input.dostupanOdmah !== 'boolean') return failure('PROFILE_INPUT_INVALID', 'Dostupnost nije ispravna.');
      patch.available_now = input.dostupanOdmah;
    }
    if (input.radijusKm !== undefined) {
      if (typeof input.radijusKm !== 'number' || !Number.isInteger(input.radijusKm) || input.radijusKm < 1 || input.radijusKm > 200) {
        return failure('PROFILE_INPUT_INVALID', 'Radijus mora biti ceo broj od 1 do 200 km.');
      }
      patch.radius_km = input.radijusKm;
    }
    if (input.zavrsi !== undefined && typeof input.zavrsi !== 'boolean') return failure('PROFILE_INPUT_INVALID', 'Radnja profila nije ispravna.');
    const activate = input.zavrsi === true;
    inFlight.add(lock);
    async function run<T>(options: Omit<ReceiptOptions<T>, 'errors'> & { request: () => PromiseLike<unknown> }): Promise<Ishod<T>> {
      const result = await readOwnedResult({ ...options, errors: COPY, account });
      if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') {
        return failure(result.kod, 'Nalog je promenjen. Ponovo otvorite profil.');
      }
      return result;
    }
    try {
      const supabase = supabaseKlijent();
      const authenticated = await run({ request: () => supabase.auth.getUser(), fallback: 'AUTH_REQUIRED', invalid: 'AUTH_ACCOUNT_CHANGED',
        decode: raw => sameId(record(record(raw)?.user)?.id, account.accountId) ? true : null });
      if (!authenticated.ok) return authenticated.kod === 'AUTH_REQUIRED' ? failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED) : authenticated;
      const existing = await run({
        request: () => supabase.from('app_profiles').select('id,account_id,kind')
          .eq('account_id', account.accountId).eq('kind', 'WORKER').maybeSingle(),
        fallback: 'PROFILE_READ_FAILED', invalid: 'PROFILE_INVALID_RESPONSE',
        decode: raw => {
          if (raw === null) return { profile: null };
          const profile = profileRow(raw, account.accountId);
          return profile ? { profile } : null;
        },
      });
      if (!existing.ok) return existing;
      let profileId = existing.podatak.profile?.id;
      if (!profileId) {
        const inserted = await run({
          request: () => supabase.from('app_profiles').insert({
            account_id: account.accountId, kind: 'WORKER', display_name: '', city: '', bio: '',
            skills: [], tools: [], vehicles: [], available_now: false, radius_km: 15,
            ...patch, profile_status: 'DRAFT',
          }).select('id,account_id,kind').single(),
          fallback: 'PROFILE_CREATE_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true,
          decode: raw => profileRow(raw, account.accountId),
        });
        if (!inserted.ok) return inserted;
        profileId = inserted.podatak.id;
      } else if (Object.keys(patch).length) {
        const expectedId = profileId;
        const updated = await run({
          request: () => supabase.from('app_profiles').update(patch).eq('id', expectedId)
            .eq('account_id', account.accountId).eq('kind', 'WORKER').select('id,account_id,kind').single(),
          fallback: 'PROFILE_UPDATE_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true,
          decode: raw => profileRow(raw, account.accountId, expectedId),
        });
        if (!updated.ok) return updated;
      }
      if (activate) {
        const result = await run({ request: () => supabase.rpc('rpc_complete_worker_profile', { p_profile_id: profileId }),
          fallback: 'PROFILE_ACTIVATION_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true, decode: raw => raw === null ? true : null });
        if (!result.ok) return result;
      }
      return { ok: true, podatak: null };
    } catch {
      if (sesijaSada().user?.id !== account.accountId || sesijaSada().accountRevision !== account.accountRevision) {
        return failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvorite profil.');
      }
      return failure('PROFILE_UPDATE_FAILED', 'Ishod čuvanja nije potvrđen. Osvežite profil pre ponovnog pokušaja.');
    } finally {
      inFlight.delete(lock);
    }
  },
};
