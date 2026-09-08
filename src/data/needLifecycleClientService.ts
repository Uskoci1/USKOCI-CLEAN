import type { DraftDeletionReceipt, NeedCancellationReceipt } from '../contracts/needLifecycle';
import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, sameId, uuid } from './serverReceipt';

const LIFECYCLE_COPY: Readonly<Record<string, string>> = {
  NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW: 'Zadatak već ima Dogovor. Otkazivanje ide kroz Dogovor, ne kroz Zadatak.',
  NEED_NOT_CANCELLABLE: 'Ovaj Zadatak više ne može da se otkaže.',
  NEED_NOT_DELETABLE_DRAFT: 'Samo neobjavljen nacrt može da se obriše.',
  DRAFT_MEDIA_CLEANUP_REQUIRED: 'Uklonite fotografije iz nacrta pre brisanja.',
  DRAFT_HAS_AUTHORITATIVE_HISTORY: 'Ovaj nacrt ima istoriju i ne može da se obriše. Možete ga otkazati.',
  STALE_REVIEW_REQUIRED: 'Zadatak je u međuvremenu promenjen. Osvežite prikaz pa pokušajte ponovo.',
  NEED_NOT_FOUND: 'Zadatak nije pronađen.', FORBIDDEN: 'Ovo nije Vaš Zadatak.',
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
};
function invalidInput(needId: string, revision: number, reason: string): Ishod<never> | null {
  return uuid(needId) && positiveInteger(revision) && typeof reason === 'string' ? null
    : failure('NEED_COMMAND_INVALID_INPUT', 'Ponovo otvorite Zadatak i pregledajte aktuelne podatke.');
}

/** Revision-bound terminal commands. No defaults may manufacture a server outcome. */
export const needLifecycleClientService = {
  async cancelNeed(needId: string, expectedRevision: number, reason = ''): Promise<Ishod<NeedCancellationReceipt>> {
    const invalid = invalidInput(needId, expectedRevision, reason);
    if (invalid) return invalid;
    return readReceipt({
      rpc: 'rpc_cancel_need', args: { p_need_id: needId, p_need_revision: expectedRevision, p_reason: reason },
      errors: LIFECYCLE_COPY, fallback: 'NEED_CANCEL_FAILED', invalid: 'NEED_CANCEL_INVALID_RESPONSE', write: true,
      decode(raw): NeedCancellationReceipt | null {
        const data = record(raw);
        if (!data || data.authoritative !== true || data.status !== 'CANCELLED' || !sameId(data.needId, needId) ||
          !positiveInteger(data.revision) || typeof data.idempotentReplay !== 'boolean' ||
          typeof data.affectedResponses !== 'number' || !Number.isSafeInteger(data.affectedResponses) || data.affectedResponses < 0) return null;
        // The server intentionally returns a current terminal receipt before
        // checking revision on replay. Do not replace that revision with the caller's.
        if (data.idempotentReplay ? data.affectedResponses !== 0 : data.revision !== expectedRevision) return null;
        return { needId: data.needId, status: 'CANCELLED', revision: data.revision,
          affectedResponses: data.affectedResponses, idempotentReplay: data.idempotentReplay };
      },
    });
  },
  async deleteDraftNeed(needId: string, expectedRevision: number, reason = ''): Promise<Ishod<DraftDeletionReceipt>> {
    const invalid = invalidInput(needId, expectedRevision, reason);
    if (invalid) return invalid;
    return readReceipt({
      rpc: 'rpc_delete_draft_need', args: { p_need_id: needId, p_need_revision: expectedRevision, p_reason: reason },
      errors: LIFECYCLE_COPY, fallback: 'DRAFT_DELETE_FAILED', invalid: 'DRAFT_DELETE_INVALID_RESPONSE', write: true,
      decode(raw): DraftDeletionReceipt | null {
        const data = record(raw);
        if (!data || data.authoritative !== true || data.deleted !== true || !sameId(data.needId, needId) ||
          !positiveInteger(data.revision) || data.revision !== expectedRevision || typeof data.idempotentReplay !== 'boolean') return null;
        return { needId: data.needId, revision: data.revision, deleted: true, idempotentReplay: data.idempotentReplay };
      },
    });
  },
};
