import type { NeedUrgencyProjection } from '../contracts/projections';
import { sesijaSada } from '../store/sesija';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

/** The raw flag only selects candidates for the existing server-owned read.
 * It never creates a badge or activates urgency. No ranking or dispatch changes. */
export async function readNeedUrgencies(rows: readonly { id: unknown; urgent?: unknown }[], signal?: AbortSignal): Promise<Map<string, NeedUrgencyProjection>> {
  const owner = sesijaSada(), result = new Map<string, NeedUrgencyProjection>();
  if (!owner.user || signal?.aborted) return result;
  const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
  const ids = [...new Set(rows.filter(row => row.urgent === true && uuid(row.id)).map(row => row.id as string))];
  let cursor = 0, available = true;
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
    while (available && !signal?.aborted && cursor < ids.length && sesijaSada().user?.id === account.accountId && sesijaSada().accountRevision === account.accountRevision) {
      const id = ids[cursor++];
      const read = await readOwnedResult({ account, errors: {}, fallback: 'URGENCY_UNAVAILABLE', invalid: 'URGENCY_INVALID',
        request: () => {
          if (signal?.aborted) throw new Error('URGENCY_READ_ABORTED');
          const request = supabaseKlijent().rpc('fn_need_urgency', { p_need_id: id });
          return signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request;
        }, decode: raw => decodeNeedUrgency(raw, id) });
      if (signal?.aborted) return;
      if (read.ok) result.set(id, read.podatak);
      else available = false; // Do not serially delay the whole list during an outage.
    }
  }));
  if (signal?.aborted || sesijaSada().user?.id !== account.accountId || sesijaSada().accountRevision !== account.accountRevision) result.clear();
  return result;
}

export function decodeNeedUrgency(raw: unknown, id: string): NeedUrgencyProjection | null {
  const r = record(raw);
  if (!r || !sameId(r.needId, id) || r.authoritative !== true) return null;
  if (r.level === 'NORMAL' && r.activatedAt === null && r.expiresAt === null) return { level: 'NORMAL', expiresAt: null };
  if (r.level !== 'HITNO' || !timestamp(r.activatedAt) || !timestamp(r.expiresAt)
    || Date.parse(r.activatedAt) >= Date.parse(r.expiresAt)) return null;
  return { level: 'HITNO', expiresAt: r.expiresAt };
}
