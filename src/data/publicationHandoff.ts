import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from './aiTaskReviewClientService';
import { positiveInteger, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { sesijaSada } from '../store/sesija';

/** Navigation context only. No facts, private locations, credentials or server authority are stored here. */
export type PublicationHandoff = Readonly<ReceiptAccount & {
  token: string; needId: string; needRevision: number;
}>;

let sequence = 0;
let latest: PublicationHandoff | null = null;

/** Called only after the review route has read back the published owner revision. URL params cannot create it. */
export function rememberPublication(input: {
  review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand; publishedReadback: boolean;
}, owner: ReceiptAccount): PublicationHandoff | null {
  const session = sesijaSada();
  if (session.user?.id !== owner.accountId || session.accountRevision !== owner.accountRevision
    || input.review.accountId !== owner.accountId || !input.publishedReadback
    || input.command.authoritative !== true || input.command.state !== 'PUBLISHED'
    || !sameId(input.command.reviewId, input.review.reviewId)
    || !uuid(input.command.needId) || !positiveInteger(input.command.needRevision)) return null;
  latest = Object.freeze({ ...owner, token: `publication-${++sequence}`,
    needId: input.command.needId, needRevision: input.command.needRevision });
  return latest;
}

/** Identity revision rejects A→B→A, while an ordinary token refresh keeps the same account context. */
export function publicationIsCurrent(handoff: PublicationHandoff): boolean {
  const session = sesijaSada();
  return latest === handoff && session.user?.id === handoff.accountId
    && session.accountRevision === handoff.accountRevision;
}

/** An external/old route is not proof of ownership or of a publication performed in this app session. */
export function readPublicationHandoff(params: {
  publishedHandoff?: unknown; publishedNeedId?: unknown; publishedRevision?: unknown;
}): PublicationHandoff | null {
  return latest && publicationIsCurrent(latest) && params.publishedHandoff === latest.token
    && sameId(params.publishedNeedId, latest.needId) && params.publishedRevision === String(latest.needRevision)
    ? latest : null;
}
