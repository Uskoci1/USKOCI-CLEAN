import type { MojaPrijavaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import { failure, positiveInteger, readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type ExistingApplicationInterval = { start: string | null; end: string | null };
/** UPDATE replaces the whole offer. Read the existing owned, version-bound
 * interval instead of interpreting the list's formatted Need time as an offer.
 * Existing response/Need SELECT policies remain the authority. */
export function readExistingApplicationInterval(p: MojaPrijavaProjekcija) {
  const owner = sesijaSada(), accountId = owner.user?.id;
  if (!accountId || !uuid(p.prijavaId) || !uuid(p.potrebaId) || !positiveInteger(p.prijavaVerzija) ||
      !positiveInteger(p.potrebaRevizija) || !positiveInteger(p.prijavaRevizija)) {
    return Promise.resolve(failure('APPLICATION_INTERVAL_UNAVAILABLE', 'Ponovo otvorite aktuelnu Prijavu.'));
  }
  return readOwnedResult<ExistingApplicationInterval>({ account: { accountId, accountRevision: owner.accountRevision },
    errors: {}, fallback: 'APPLICATION_INTERVAL_UNAVAILABLE', invalid: 'APPLICATION_INTERVAL_CHANGED',
    request: () => supabaseKlijent().from('marketplace_responses')
      .select('id,need_id,worker_account_id,current_version,submitted_against_need_revision,status,proposed_start_at,proposed_end_at,needs!inner(id,revision)')
      .eq('id', p.prijavaId).eq('need_id', p.potrebaId).eq('worker_account_id', accountId)
      .eq('current_version', p.prijavaVerzija).eq('needs.revision', p.potrebaRevizija).maybeSingle(),
    decode(raw) {
      const row = record(raw), need = record(row?.needs);
      if (!row || !need || !sameId(row.id, p.prijavaId) || !sameId(row.need_id, p.potrebaId) ||
          row.worker_account_id !== accountId || row.current_version !== p.prijavaVerzija ||
          row.submitted_against_need_revision !== p.prijavaRevizija || row.status !== 'STALE_REVIEW_REQUIRED' ||
          !sameId(need.id, p.potrebaId) || need.revision !== p.potrebaRevizija) return null;
      const start = row.proposed_start_at, end = row.proposed_end_at;
      if (start !== null && !timestamp(start) || end !== null && !timestamp(end)) return null;
      if (start !== null && end !== null && calendarInstant(start)! >= calendarInstant(end)!) return null;
      return { start, end };
    },
  });
}
