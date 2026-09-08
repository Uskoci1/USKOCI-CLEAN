import type { DraftDeletionReceipt, NeedCancellationReceipt } from '../contracts/needLifecycle';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

// Server exception names → product language. The user never sees a code.
const LIFECYCLE_COPY: Record<string, string> = {
  NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW: 'Zadatak već ima Dogovor. Otkazivanje ide kroz Dogovor, ne kroz Zadatak.',
  NEED_NOT_CANCELLABLE: 'Ovaj Zadatak više ne može da se otkaže.',
  NEED_NOT_DELETABLE_DRAFT: 'Samo neobjavljen nacrt može da se obriše.',
  DRAFT_MEDIA_CLEANUP_REQUIRED: 'Uklonite fotografije iz nacrta pre brisanja.',
  DRAFT_HAS_AUTHORITATIVE_HISTORY: 'Ovaj nacrt ima istoriju i ne može da se obriše. Možete ga otkazati.',
  STALE_REVIEW_REQUIRED: 'Zadatak je u međuvremenu promenjen. Osvežite prikaz pa pokušajte ponovo.',
  NEED_NOT_FOUND: 'Zadatak nije pronađen.',
  FORBIDDEN: 'Ovo nije Vaš Zadatak.',
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
};

function lifecycleFailure(error: any, fallback: string): Ishod<never> {
  const name = typeof error?.message === 'string' ? error.message : '';
  return fail(name || error?.code || fallback, LIFECYCLE_COPY[name] ?? 'Radnja trenutno nije mogla da se završi. Pokušajte ponovo.');
}

/**
 * Requester-side terminal commands on a Zadatak. Both are revision-bound so a
 * stale screen never cancels or deletes a Zadatak the user did not see; both
 * replay idempotently. The server alone decides whether a Zadatak with a
 * Dogovor must go through the Dogovor lifecycle instead.
 */
export const needLifecycleClientService = {
  async cancelNeed(needId: string, expectedRevision: number, reason = ''): Promise<Ishod<NeedCancellationReceipt>> {
    const { data, error } = await supabase.rpc('rpc_cancel_need', { p_need_id: needId, p_need_revision: expectedRevision, p_reason: reason });
    if (error) return lifecycleFailure(error, 'NEED_CANCEL_FAILED');
    if (data?.status !== 'CANCELLED' || typeof data?.needId !== 'string') return fail('NEED_CANCEL_INVALID_RESPONSE', 'Server nije potvrdio otkazivanje.');
    return {
      ok: true,
      podatak: {
        needId: data.needId,
        status: 'CANCELLED',
        revision: Number(data.revision ?? expectedRevision),
        affectedResponses: Number(data.affectedResponses ?? 0),
        idempotentReplay: data.idempotentReplay === true,
      },
    };
  },

  async deleteDraftNeed(needId: string, expectedRevision: number, reason = ''): Promise<Ishod<DraftDeletionReceipt>> {
    const { data, error } = await supabase.rpc('rpc_delete_draft_need', { p_need_id: needId, p_need_revision: expectedRevision, p_reason: reason });
    if (error) return lifecycleFailure(error, 'DRAFT_DELETE_FAILED');
    if (data?.deleted !== true || typeof data?.needId !== 'string') return fail('DRAFT_DELETE_INVALID_RESPONSE', 'Server nije potvrdio brisanje nacrta.');
    return { ok: true, podatak: { needId: data.needId, revision: Number(data.revision ?? expectedRevision), deleted: true, idempotentReplay: data.idempotentReplay === true } };
  },
};
